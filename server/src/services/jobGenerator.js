import Airport from '../models/Airport.js';
import Job from '../models/Job.js';
import { NM_TO_METERS, calculateDistanceNm } from './geoUtils.js';

export const BASE_RATE_PER_NM = 15; // $15 per NM base rate
export const CARGO_RATE_PER_LB = 1.25; // $1.25 per lb
export const PASSENGER_RATE = 150; // $150 per pax
export const SHORT_RUNWAY_BONUS = 750; // Challenge bonus for runways < 4500 ft

/**
 * Calculates job payout based on distance and complexity factors
 */
export function calculatePayout(distanceNm, cargoLbs, paxCount, destRunwayFt) {
  const basePayout = distanceNm * BASE_RATE_PER_NM;
  const cargoBonus = cargoLbs * CARGO_RATE_PER_LB;
  const paxBonus = paxCount * PASSENGER_RATE;
  const runwayBonus = destRunwayFt < 4500 ? SHORT_RUNWAY_BONUS : 0;
  const complexityMultiplier = cargoBonus + paxBonus + runwayBonus;

  return Math.round(basePayout + complexityMultiplier);
}

/**
 * Generates 3 to 5 distance- and complexity-scaled jobs from origin airport
 * Uses MongoDB $nearSphere with $minDistance and $maxDistance converted to meters (1 NM = 1852m)
 * Filters by longest_runway_ft
 *
 * @param {string} originIcao
 * @param {object} options
 * @param {number} [options.minDistanceNm=25]
 * @param {number} [options.maxDistanceNm=750]
 * @param {number} [options.minRunwayFt=3000]
 * @param {number} [options.count=5]
 */
export async function generateJobsForAirport(originIcao, options = {}) {
  const {
    minDistanceNm = 25,
    maxDistanceNm = 800,
    minRunwayFt = 3000,
    count = 5
  } = options;

  const originAirport = await Airport.findOne({ icao: originIcao.toUpperCase() });
  if (!originAirport) {
    throw new Error(`Origin airport ${originIcao} not found in database.`);
  }

  const [originLon, originLat] = originAirport.location.coordinates;

  // Query destinations using MongoDB $nearSphere with 1 NM = 1852 meters
  const minMeters = minDistanceNm * NM_TO_METERS;
  const maxMeters = maxDistanceNm * NM_TO_METERS;

  const candidateAirports = await Airport.find({
    icao: { $ne: originAirport.icao },
    longest_runway_ft: { $gte: minRunwayFt },
    location: {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [originLon, originLat]
        },
        $minDistance: minMeters,
        $maxDistance: maxMeters
      }
    }
  }).limit(20);

  if (!candidateAirports || candidateAirports.length === 0) {
    // Fallback: If no airports within narrow band, search without maxDistance restriction
    const fallbackAirports = await Airport.find({
      icao: { $ne: originAirport.icao },
      longest_runway_ft: { $gte: minRunwayFt }
    }).limit(10);

    if (fallbackAirports.length === 0) {
      return [];
    }
    candidateAirports.push(...fallbackAirports);
  }

  // Shuffle candidates to provide variety across tiers
  const shuffled = candidateAirports.sort(() => 0.5 - Math.random());
  const selectedAirports = shuffled.slice(0, Math.min(count, shuffled.length));

  // Remove stale unaccepted 'available' jobs for this origin
  await Job.deleteMany({ origin_icao: originAirport.icao, status: 'available' });

  const generatedJobs = [];
  for (const dest of selectedAirports) {
    const [destLon, destLat] = dest.location.coordinates;
    const distanceNm = calculateDistanceNm(originLat, originLon, destLat, destLon);

    // Randomize payload complexity
    const isCargoHeavy = Math.random() > 0.5;
    const paxCount = isCargoHeavy ? Math.floor(Math.random() * 4) : Math.floor(Math.random() * 8) + 1;
    const cargoLbs = isCargoHeavy
      ? Math.floor(Math.random() * 3500) + 800
      : Math.floor(Math.random() * 600) + 100;

    const payout = calculatePayout(distanceNm, cargoLbs, paxCount, dest.longest_runway_ft);

    const job = await Job.create({
      origin_icao: originAirport.icao,
      destination_icao: dest.icao,
      distance_nm: distanceNm,
      cargo_lbs: cargoLbs,
      pax_count: paxCount,
      payout,
      status: 'available'
    });

    generatedJobs.push({
      ...job.toObject(),
      destination_name: dest.name,
      destination_city: dest.city,
      destination_country: dest.country,
      destination_runway_ft: dest.longest_runway_ft,
      destination_location: dest.location
    });
  }

  return generatedJobs;
}
