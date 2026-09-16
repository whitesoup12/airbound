import Job from '../models/Job.js';
import Pilot from '../models/Pilot.js';
import Airport from '../models/Airport.js';
import { generateJobsForAirport } from '../services/jobGenerator.js';
import flightStateMachine from '../services/stateMachine.js';

export async function getJobs(req, res) {
  try {
    const pilot = await Pilot.findOne();
    const currentIcao = req.query.icao || pilot?.current_icao || 'KLAX';

    let availableJobs = await Job.find({
      origin_icao: currentIcao,
      status: 'available'
    }).sort({ createdAt: -1 });

    // Auto-generate if fewer than 3 available
    if (availableJobs.length < 3) {
      await generateJobsForAirport(currentIcao);
      availableJobs = await Job.find({
        origin_icao: currentIcao,
        status: 'available'
      }).sort({ createdAt: -1 });
    }

    // Enrich with destination airport metadata
    const destIcaos = availableJobs.map((j) => j.destination_icao);
    const destAirports = await Airport.find({ icao: { $in: destIcaos } });
    const airportMap = new Map(destAirports.map((a) => [a.icao, a]));

    const enrichedJobs = availableJobs.map((job) => {
      const dest = airportMap.get(job.destination_icao);
      return {
        ...job.toObject(),
        destination_name: dest?.name || job.destination_icao,
        destination_city: dest?.city || '',
        destination_country: dest?.country || '',
        destination_runway_ft: dest?.longest_runway_ft || 0,
        destination_location: dest?.location || null
      };
    });

    const activeJob = await Job.findOne({ status: 'accepted' });
    let enrichedActiveJob = null;
    if (activeJob) {
      const dest = await Airport.findOne({ icao: activeJob.destination_icao });
      const orig = await Airport.findOne({ icao: activeJob.origin_icao });
      enrichedActiveJob = {
        ...activeJob.toObject(),
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
    const icao = req.body.icao || pilot?.current_icao || 'KLAX';
    const minRunwayFt = req.body.minRunwayFt ? parseInt(req.body.minRunwayFt, 10) : 3000;

    const newJobs = await generateJobsForAirport(icao, { minRunwayFt });
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

    job.status = 'accepted';
    job.accepted_at = new Date();
    await job.save();

    await flightStateMachine.setActiveJob(job);

    const dest = await Airport.findOne({ icao: job.destination_icao });
    const orig = await Airport.findOne({ icao: job.origin_icao });

    res.json({
      message: 'Job accepted successfully',
      job: {
        ...job.toObject(),
        origin_airport: orig,
        destination_airport: dest
      },
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

    job.status = 'failed';
    await job.save();

    await flightStateMachine.clearActiveJob();

    res.json({ message: 'Job cancelled', job, phase: flightStateMachine.phase });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

