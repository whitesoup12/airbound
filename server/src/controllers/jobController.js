import Job from '../models/Job.js';
import Pilot from '../models/Pilot.js';
import Airport from '../models/Airport.js';
import { generateJobsForAirport, classifyJobTier } from '../services/jobGenerator.js';
import flightStateMachine from '../services/stateMachine.js';
import { normalizeTo4CharIcao } from '../utils/icaoUtils.js';
import { getCachedAirport, getCachedAirportsList } from '../services/airportCache.js';

export async function getJobs(req, res) {
  try {
    const pilot = await Pilot.findOne().select('current_icao visited_airports active_aircraft').lean();
    let currentIcao = req.query.icao || pilot?.current_icao || 'KLAX';
    currentIcao = await normalizeTo4CharIcao(currentIcao);

    let availableJobs = await Job.find({
      origin_icao: currentIcao,
      status: 'available'
    }).sort({ createdAt: -1 }).lean();

    // Auto-generate if fewer than 3 available
    if (availableJobs.length < 3) {
      await generateJobsForAirport(currentIcao, { aircraft: pilot?.active_aircraft });
      availableJobs = await Job.find({
        origin_icao: currentIcao,
        status: 'available'
      }).sort({ createdAt: -1 }).lean();
    }

    // Enrich with destination airport metadata and visited status
    const visitedSet = new Set((pilot?.visited_airports || []).map((i) => (i ? i.toUpperCase() : '')).filter(Boolean));
    for (const item of Array.from(visitedSet)) {
      if (item.length === 3) visitedSet.add('K' + item);
    }
    const destIcaos = availableJobs.map((j) => j.destination_icao);
    const destAirports = await getCachedAirportsList(destIcaos);
    const airportMap = new Map(destAirports.map((a) => [a.icao, a]));

    const enrichedJobs = availableJobs.map((job) => {
      const dest = airportMap.get(job.destination_icao);
      const tier = job.tier || classifyJobTier(job.distance_nm, pilot?.active_aircraft?.category);
      const isUnvisited = !visitedSet.has(job.destination_icao.toUpperCase());
      return {
        ...job,
        tier,
        is_unvisited: isUnvisited,
        is_featured_destination: Boolean(job.is_featured_destination && isUnvisited),
        exploration_bonus: job.exploration_bonus || 0,
        destination_name: dest?.name || job.destination_icao,
        destination_city: dest?.city || '',
        destination_country: dest?.country || '',
        destination_runway_ft: dest?.longest_runway_ft || 0,
        destination_location: dest?.location || null
      };
    });

    const activeJob =
      flightStateMachine.activeJob && flightStateMachine.activeJob.status === 'accepted'
        ? flightStateMachine.activeJob
        : await Job.findOne({ status: 'accepted' }).lean();
    let enrichedActiveJob = null;
    if (activeJob) {
      const dest = await getCachedAirport(activeJob.destination_icao);
      const orig = await getCachedAirport(activeJob.origin_icao);
      enrichedActiveJob = {
        ...(activeJob.toObject ? activeJob.toObject() : activeJob),
        origin_airport: orig,
        destination_airport: dest
      };
    }

    res.json({
      jobs: enrichedJobs,
      activeJob: enrichedActiveJob,
      originIcao: currentIcao
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function generateNewJobs(req, res) {
  try {
    const pilot = await Pilot.findOne();
    let icao = req.body.icao || pilot?.current_icao || 'KLAX';
    icao = await normalizeTo4CharIcao(icao);
    const minRunwayRaw = req.body.minRunwayFt ?? req.body.min_runway_ft;
    const minRunwayFt = minRunwayRaw ? parseInt(minRunwayRaw, 10) : undefined;
    const direction = req.body.direction || 'any';

    const newJobs = await generateJobsForAirport(icao, {
      minRunwayFt,
      direction,
      aircraft: pilot?.active_aircraft,
      visitedAirports: pilot?.visited_airports
    });
    res.json({ message: 'Jobs refreshed', jobs: newJobs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function acceptJob(req, res) {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if there is already an active job
    const existingActive = await Job.findOne({ status: 'accepted', _id: { $ne: id } });
    if (existingActive) {
      return res.status(400).json({
        error: 'You already have an active accepted contract. Complete or cancel it first.'
      });
    }

    // Check if pilot active aircraft is a rental requiring renewal fee
    let pilot = await Pilot.findOne();
    let rentalFeeCharged = 0;

    if (pilot && pilot.active_aircraft?.is_rental && !pilot.active_aircraft?.is_loaner) {
      const activeTail = pilot.active_aircraft.tail_number;
      const fleetPlane = (pilot.fleet || []).find((p) => p.tail_number === activeTail);
      const paidFlights = (fleetPlane && fleetPlane.rental_flights_paid !== undefined)
        ? fleetPlane.rental_flights_paid
        : (pilot.active_aircraft.rental_flights_paid || 0);

      if (paidFlights === 0) {
        const rentalPrice = pilot.active_aircraft.rental_price_per_flight || 0;
        if ((pilot.balance || 0) < rentalPrice) {
          const shortage = rentalPrice - (pilot.balance || 0);
          return res.status(400).json({
            error: `Insufficient funds to rent ${pilot.active_aircraft.name} for another flight. Rental fee is $${rentalPrice.toLocaleString()}, but your balance is $${pilot.balance.toLocaleString()} ($${shortage.toLocaleString()} more needed). Return this rental in your Fleet hangar or switch aircraft to continue.`
          });
        }

        // Deduct rental fee for this flight
        pilot.balance -= rentalPrice;
        pilot.active_aircraft.rental_flights_paid = 1;
        if (fleetPlane) {
          fleetPlane.rental_flights_paid = 1;
        }
        await pilot.save();
        rentalFeeCharged = rentalPrice;
      }
    }

    job.status = 'accepted';
    job.accepted_at = new Date();
    job.rental_fee_charged = rentalFeeCharged;
    await job.save();

    await flightStateMachine.setActiveJob(job);

    const dest = await Airport.findOne({ icao: job.destination_icao });
    const orig = await Airport.findOne({ icao: job.origin_icao });

    res.json({
      message: rentalFeeCharged > 0
        ? `Job accepted! $${rentalFeeCharged.toLocaleString()} rental fee deducted for this flight.`
        : 'Job accepted successfully',
      job: {
        ...job.toObject(),
        origin_airport: orig,
        destination_airport: dest
      },
      pilot,
      phase: flightStateMachine.phase
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function cancelJob(req, res) {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    let pilot = await Pilot.findOne();
    if (pilot && job.rental_fee_charged > 0) {
      // Refund rental fee if flight hasn't departed
      pilot.balance = (pilot.balance || 0) + job.rental_fee_charged;
      const activeTail = pilot.active_aircraft?.tail_number;
      const fleetPlane = (pilot.fleet || []).find((p) => p.tail_number === activeTail);
      if (pilot.active_aircraft) pilot.active_aircraft.rental_flights_paid = 0;
      if (fleetPlane) fleetPlane.rental_flights_paid = 0;
      await pilot.save();
      job.rental_fee_charged = 0;
    }

    job.status = 'failed';
    await job.save();

    await flightStateMachine.clearActiveJob();

    res.json({ message: 'Job cancelled', job, pilot, phase: flightStateMachine.phase });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

