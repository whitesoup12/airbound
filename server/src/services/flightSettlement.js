import Airport from '../models/Airport.js';
import Job from '../models/Job.js';
import Pilot from '../models/Pilot.js';
import { calculateDistanceNm } from './geoUtils.js';
import { generateJobsForAirport } from './jobGenerator.js';
import { computeFlightSettlement } from './economyService.js';
import { normalizeTo4CharIcao } from '../utils/icaoUtils.js';
import { calculateFlightXp, rateLandingTouchdown, getPilotRank } from './xpService.js';

/**
 * Universal Flight Settlement Engine
 * Handles the economic ledger, XP progression, logbook recording, and pilot stats
 * regardless of whether the flight is completed via the local SimConnect bridge,
 * remote connector via REST, or simulator controls.
 *
 * @param {object} params
 * @param {object} [params.job] - Active job or free flight object (will query MongoDB if not provided)
 * @param {object} [params.telemetry] - Final telemetry snapshot
 * @param {number} [params.touchdownFpm] - Landing vertical speed in FPM
 * @param {number} [params.approachSpeedKts] - Approach airspeed in knots
 * @param {number} [params.flightSeconds] - Total unpaused flight seconds
 * @param {number} [params.airborneSeconds] - Total unpaused airborne seconds
 * @param {Date} [params.departedAt] - Departure timestamp
 * @param {Date} [params.touchdownAt] - Touchdown timestamp
 * @param {object} [params.originAirport] - Origin airport document
 * @param {object} [params.destinationAirport] - Destination airport document
 */
export async function settleCompletedFlight(params = {}) {
  let {
    job = null,
    telemetry = {},
    touchdownFpm = null,
    approachSpeedKts = null,
    flightSeconds = 0,
    airborneSeconds = 0,
    departedAt = null,
    touchdownAt = null,
    originAirport = null,
    destinationAirport = null
  } = params;

  // 1. Resolve active flight if not passed
  let isFreeFlight = Boolean(job?.is_free_flight);
  if (!job) {
    const acceptedJob = await Job.findOne({ status: 'accepted' });
    if (acceptedJob) {
      job = acceptedJob;
      isFreeFlight = false;
    } else {
      const currentPilot = await Pilot.findOne();
      if (currentPilot?.active_free_flight?.active) {
        job = {
          is_free_flight: true,
          origin_icao: currentPilot.active_free_flight.origin_icao,
          destination_icao: currentPilot.active_free_flight.destination_icao,
          deduct_fees: currentPilot.active_free_flight.deduct_fees,
          status: 'accepted',
          accepted_at: currentPilot.active_free_flight.departed_at || currentPilot.active_free_flight.created_at
        };
        isFreeFlight = true;
      }
    }
  }

  if (!job) {
    throw new Error('No active contract or Free Flight session found to settle.');
  }

  const completedAt = new Date();
  let actualDepartedAt = departedAt ? new Date(departedAt) : (job.accepted_at ? new Date(job.accepted_at) : null);
  if (!actualDepartedAt || isNaN(actualDepartedAt.getTime())) {
    actualDepartedAt = new Date(completedAt.getTime() - 15 * 60 * 1000);
  }

  let actualTouchdownAt = touchdownAt ? new Date(touchdownAt) : null;
  if (actualTouchdownAt && isNaN(actualTouchdownAt.getTime())) {
    actualTouchdownAt = null;
  }

  // Compute flight duration in seconds
  const rawWallClockSeconds = Math.max(1, Math.round((completedAt.getTime() - actualDepartedAt.getTime()) / 1000));
  const durationSeconds = flightSeconds >= 1 ? Math.max(1, Math.round(flightSeconds)) : rawWallClockSeconds;
  const finalAirborneSeconds = airborneSeconds >= 1
    ? Math.max(1, Math.round(airborneSeconds))
    : (actualTouchdownAt && actualDepartedAt ? Math.max(1, Math.round((actualTouchdownAt.getTime() - actualDepartedAt.getTime()) / 1000)) : durationSeconds);
  const durationHours = Math.round((durationSeconds / 3600) * 10) / 10;

  // Fetch Pilot profile & active aircraft
  const pilot = await Pilot.findOne();
  if (!pilot) {
    throw new Error('Pilot profile not found.');
  }

  const activeAircraft = pilot.active_aircraft || {
    name: 'Cessna 172 Skyhawk',
    fuel_burn_gph: 9.0,
    fuel_type: '100LL',
    category: 'single_prop'
  };

  // Determine Destination Airfield
  let destIcao = job.destination_icao;
  if (!destIcao && isFreeFlight && telemetry?.latitude && telemetry?.longitude) {
    // Open roam landing auto-detection
    try {
      const nearest = await Airport.findOne({
        location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [telemetry.longitude, telemetry.latitude] },
            $maxDistance: 25000 // 25 km
          }
        }
      });
      if (nearest) {
        destIcao = nearest.icao;
        destinationAirport = nearest;
      }
    } catch {
      // Ignore geo search error
    }
  }

  destIcao = (await normalizeTo4CharIcao(destIcao || pilot.current_icao || 'KLAX')) || 'KLAX';

  if (!destinationAirport) {
    destinationAirport = await Airport.findOne({ icao: destIcao });
  }
  if (!originAirport && job.origin_icao) {
    originAirport = await Airport.findOne({ icao: job.origin_icao });
  }

  const destCountry = destinationAirport?.country || 'US';
  const destRunwayFt = destinationAirport?.longest_runway_ft || 5000;

  // Calculate distance for Free Flight if missing
  let distanceNm = job.distance_nm;
  if (!distanceNm || distanceNm <= 0) {
    if (originAirport?.location?.coordinates && destinationAirport?.location?.coordinates) {
      const [oLon, oLat] = originAirport.location.coordinates;
      const [dLon, dLat] = destinationAirport.location.coordinates;
      distanceNm = Math.round(calculateDistanceNm(oLat, oLon, dLat, dLon) * 10) / 10;
    } else {
      distanceNm = Math.max(1, Math.round(((finalAirborneSeconds || 60) / 3600) * (telemetry.groundSpeed || 110)));
    }
  }

  // 2. Economic Settlement Calculation
  let settlement;
  if (isFreeFlight) {
    if (job.deduct_fees) {
      settlement = computeFlightSettlement({
        grossPayout: 0,
        durationSeconds,
        fuelBurnGph: activeAircraft.fuel_burn_gph || 9.0,
        fuelType: activeAircraft.fuel_type || '100LL',
        destRunwayFt,
        aircraftName: activeAircraft.name || 'Cessna 172 Skyhawk'
      });
      settlement.netPayout = -settlement.totalExpenses;
    } else {
      settlement = {
        grossPayout: 0,
        fuelCost: 0,
        fuelGallons: 0,
        landingFee: 0,
        netPayout: 0,
        aircraftName: activeAircraft.name || 'Cessna 172 Skyhawk'
      };
    }
  } else {
    settlement = computeFlightSettlement({
      grossPayout: job.payout || 0,
      durationSeconds,
      fuelBurnGph: activeAircraft.fuel_burn_gph || 9.0,
      fuelType: activeAircraft.fuel_type || '100LL',
      destRunwayFt,
      aircraftName: activeAircraft.name || 'Cessna 172 Skyhawk'
    });
  }

  // 3. Touchdown & XP Rating
  const landingRate = rateLandingTouchdown(touchdownFpm, {
    category: activeAircraft.category,
    aircraftName: activeAircraft.name || telemetry.simAircraftTitle,
    approachKts: approachSpeedKts
  });

  const isUnvisited = Boolean(
    job.is_unvisited ||
    (pilot && !pilot.visited_airports.includes(destIcao))
  );

  const flightXp = calculateFlightXp({
    distanceNm,
    isUnvisited,
    destRunwayFt,
    touchdownFpm,
    category: activeAircraft.category,
    aircraftName: activeAircraft.name,
    approachKts: approachSpeedKts,
    landingClass: landingRate.aircraftClass
  });

  // 4. Update Job contract in MongoDB if commercial dispatch
  if (job._id) {
    await Job.findByIdAndUpdate(job._id, {
      status: 'completed',
      completed_at: completedAt,
      touchdown_fpm: touchdownFpm,
      landing_rating: flightXp.landingRating,
      landing_class: flightXp.aircraftClass,
      approach_speed_kts: approachSpeedKts,
      xp_reward: flightXp.totalXp
    });
  }

  // 5. Construct Logbook Summary
  const flightSummary = {
    job_id: job._id || null,
    origin_icao: job.origin_icao || 'UNKN',
    destination_icao: destIcao,
    distance_nm: distanceNm || 1,
    cargo_lbs: job.cargo_lbs || 0,
    pax_count: job.pax_count || 0,
    payout: settlement.netPayout,
    gross_payout: settlement.grossPayout,
    fuel_cost: settlement.fuelCost,
    fuel_gallons: settlement.fuelGallons,
    landing_fee: settlement.landingFee,
    net_payout: settlement.netPayout,
    exploration_bonus: job.exploration_bonus || 0,
    rental_fee: isFreeFlight ? 0 : (job.rental_fee_charged || (activeAircraft.is_rental && !activeAircraft.is_loaner ? (activeAircraft.rental_price_per_flight || 0) : 0)),
    aircraft_name: telemetry.simAircraftTitle || activeAircraft.name || settlement.aircraftName,
    category: activeAircraft.category || 'single_prop',
    duration_seconds: durationSeconds,
    airborne_seconds: finalAirborneSeconds,
    touchdown_fpm: touchdownFpm,
    landing_rating: flightXp.landingRating,
    landing_class: flightXp.aircraftClass,
    approach_speed_kts: approachSpeedKts,
    xp_earned: flightXp.totalXp,
    departed_at: actualDepartedAt,
    completed_at: completedAt,
    source: isFreeFlight ? 'free_flight' : 'airbound_dispatch'
  };

  // 6. Update Pilot Persistence
  let insufficientRentalFunds = false;
  let rentalPrice = 0;
  let leveledUp = false;
  let rankInfo = null;

  if (isFreeFlight) {
    pilot.active_free_flight = null;
  }

  // Fleet flight hours
  let fleetPlane = null;
  if (pilot.fleet && pilot.fleet.length > 0 && activeAircraft.tail_number) {
    fleetPlane = pilot.fleet.find((p) => p.tail_number === activeAircraft.tail_number);
    if (fleetPlane) {
      fleetPlane.flight_hours = Math.round(((fleetPlane.flight_hours || 0) + durationHours) * 10) / 10;
    }
  }

  // Reset rental flight status
  if (activeAircraft.is_rental && !activeAircraft.is_loaner) {
    if (pilot.active_aircraft) {
      pilot.active_aircraft.rental_flights_paid = 0;
    }
    if (fleetPlane) {
      fleetPlane.rental_flights_paid = 0;
    }
  }

  const prevLevel = pilot.level || 1;
  pilot.xp = (pilot.xp || 0) + flightXp.totalXp;
  rankInfo = getPilotRank(pilot.xp);
  pilot.level = rankInfo.level;
  pilot.rank_title = rankInfo.title;
  leveledUp = pilot.level > prevLevel;

  pilot.balance = Math.max(0, (pilot.balance || 0) + settlement.netPayout);
  pilot.current_icao = destIcao;
  if (!pilot.visited_airports.includes(destIcao)) {
    pilot.visited_airports.push(destIcao);
  }
  if (destCountry && !pilot.visited_countries.includes(destCountry)) {
    pilot.visited_countries.push(destCountry);
  }
  pilot.flight_log.push(flightSummary);

  if (activeAircraft.is_rental && !activeAircraft.is_loaner) {
    rentalPrice = activeAircraft.rental_price_per_flight || 0;
    if (pilot.balance < rentalPrice) {
      insufficientRentalFunds = true;
    }
  }

  // Completion Payload for Client Banner
  const completedResult = {
    summary: flightSummary,
    payout: settlement.netPayout,
    settlement,
    flightXp,
    touchdownFpm,
    landingRating: flightXp.landingRating,
    rankInfo,
    leveledUp,
    newIcao: destIcao,
    insufficientRentalFunds,
    rentalPrice,
    aircraftName: activeAircraft.name
  };

  // Store completedFlight in active_telemetry so polled web clients detect completion
  pilot.active_telemetry = {
    ...(pilot.active_telemetry || {}),
    phase: 'COMPLETED',
    touchdownFpm,
    landingRating: flightXp.landingRating,
    completedFlight: completedResult,
    lastSeen: new Date()
  };

  await pilot.save();

  console.log(
    `[FlightSettlement] Flight completed! Gross: $${settlement.grossPayout}, Net: +$${settlement.netPayout}, XP: +${flightXp.totalXp} (${flightXp.landingLabel}). Pilot Level: ${rankInfo?.level || 1} (${rankInfo?.title || 'Junior Aviator'})`
  );

  // 7. Auto-generate fresh jobs for the new location
  await generateJobsForAirport(destIcao, { aircraft: pilot.active_aircraft });

  return completedResult;
}

export default settleCompletedFlight;
