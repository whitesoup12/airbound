import Airport from '../models/Airport.js';
import Job from '../models/Job.js';
import { NM_TO_METERS, calculateDistanceNm, calculateBearing } from './geoUtils.js';
import { normalizeTo4CharIcao } from '../utils/icaoUtils.js';

export const BASE_RATE_PER_NM = 15; // $15 per NM base rate
export const CARGO_RATE_PER_LB = 1.25; // $1.25 per lb
export const PASSENGER_RATE = 150; // $150 per pax
export const SHORT_RUNWAY_BONUS = 750; // Challenge bonus for runways < 4500 ft
export const NON_SMALL_RUNWAY_FT = 4500; // Threshold for favoring non-small (regional/commercial/executive) airports
export const EXPLORATION_BONUS = 500; // Bonus payout for featured unvisited airport exploration jobs

/**
 * Returns cardinal compass abbreviation (N, NE, E, SE, S, SW, W, NW) for a bearing in degrees
 */
export function getCardinalDirection(bearing) {
  if (bearing === null || bearing === undefined || isNaN(bearing)) return '';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((bearing % 360) / 45)) % 8;
  return directions[index];
}

/**
 * Checks whether a destination bearing falls within the cone of a requested cardinal direction
 * Uses a ±55° sector cone so pilots get broad variety in their chosen direction
 */
export function matchesDirection(bearing, targetDirection = 'any') {
  if (!targetDirection || targetDirection === 'any' || targetDirection === 'all') return true;
  const dir = targetDirection.toLowerCase().trim();
  const b = ((bearing % 360) + 360) % 360;

  switch (dir) {
    case 'north':
    case 'n':
      return b >= 305 || b <= 55;
    case 'south':
    case 's':
      return b >= 125 && b <= 235;
    case 'east':
    case 'e':
      return b >= 35 && b <= 145;
    case 'west':
    case 'w':
      return b >= 215 && b <= 325;
    case 'northeast':
    case 'ne':
      return b >= 0 && b <= 90;
    case 'southeast':
    case 'se':
      return b >= 90 && b <= 180;
    case 'southwest':
    case 'sw':
      return b >= 180 && b <= 270;
    case 'northwest':
    case 'nw':
      return b >= 270 || b <= 360;
    default:
      return true;
  }
}

/**
 * Scores an airport candidate to favor non-small airports and unvisited destinations
 */
export function scoreAirport(airport, isUnvisited = false) {
  let score = 0;
  const runway = airport.longest_runway_ft || 0;

  // Favor runway lengths: non-small airports
  if (runway >= 7000) {
    score += 50; // Major jet/airline runway
  } else if (runway >= 5000) {
    score += 35; // Regional / full-service commercial/GA runway
  } else if (runway >= 4500) {
    score += 20; // Standard non-small runway
  } else if (runway < 3500) {
    score -= 30; // Deprioritize short airstrips
  } else if (runway < 2500) {
    score -= 50; // Heavily deprioritize tiny ultralight/bush strips
  }

  // Name keyword heuristics
  const name = (airport.name || '').toLowerCase();
  if (/intl|international|regional|metro|municipal|executive|county|memorial/.test(name)) {
    score += 20;
  }
  if (/airstrip|airpark|ranch|farm|glider|heliport|ultralight|seaplane|turf|grass/.test(name)) {
    score -= 35;
  }

  // Favor unvisited destinations
  if (isUnvisited) {
    score += 30;
  }

  return score;
}

/**
 * Flight distance category brackets scaled by aircraft category
 */
export function getDistanceTiers(category = 'single_prop') {
  switch (category) {
    case 'airliner':
      return {
        short: { min: 80, max: 350, label: 'Short (< 350 NM)' },
        medium: { min: 350, max: 1000, label: 'Medium (350–1,000 NM)' },
        long: { min: 1000, max: 2800, label: 'Long (1,000+ NM)' }
      };
    case 'jet':
      return {
        short: { min: 60, max: 250, label: 'Short (< 250 NM)' },
        medium: { min: 250, max: 700, label: 'Medium (250–700 NM)' },
        long: { min: 700, max: 2000, label: 'Long (700+ NM)' }
      };
    case 'turboprop':
      return {
        short: { min: 40, max: 180, label: 'Short (< 180 NM)' },
        medium: { min: 180, max: 450, label: 'Medium (180–450 NM)' },
        long: { min: 450, max: 1200, label: 'Long (450+ NM)' }
      };
    case 'twin_prop':
      return {
        short: { min: 30, max: 130, label: 'Short (< 130 NM)' },
        medium: { min: 130, max: 320, label: 'Medium (130–320 NM)' },
        long: { min: 320, max: 800, label: 'Long (320+ NM)' }
      };
    case 'single_prop':
    default:
      return {
        short: { min: 20, max: 90, label: 'Short (< 90 NM)' },
        medium: { min: 90, max: 220, label: 'Medium (90–220 NM)' },
        long: { min: 220, max: 450, label: 'Long (220+ NM)' }
      };
  }
}

export function classifyJobTier(distanceNm, category = 'single_prop') {
  const tiers = getDistanceTiers(category);
  if (distanceNm < tiers.short.max) return 'short';
  if (distanceNm < tiers.medium.max) return 'medium';
  return 'long';
}

/**
 * Calculates job payout based on distance and complexity factors, scaled by aircraft category
 */
export function calculatePayout(
  distanceNm,
  cargoLbs,
  paxCount,
  destRunwayFt,
  category = 'single_prop',
  explorationBonus = 0,
  seniorityMultiplier = 1.0
) {
  let baseRate = BASE_RATE_PER_NM;
  let cargoRate = CARGO_RATE_PER_LB;
  let paxRate = PASSENGER_RATE;

  if (category === 'airliner') {
    baseRate = 28;
    cargoRate = 1.60;
    paxRate = 220;
  } else if (category === 'jet') {
    baseRate = 22;
    cargoRate = 1.45;
    paxRate = 300; // VIP charter rate
  } else if (category === 'turboprop') {
    baseRate = 18;
    cargoRate = 1.35;
    paxRate = 180;
  } else if (category === 'twin_prop') {
    baseRate = 16.5;
    cargoRate = 1.30;
    paxRate = 165;
  }

  const basePayout = distanceNm * baseRate;
  const cargoBonus = cargoLbs * cargoRate;
  const paxBonus = paxCount * paxRate;
  const runwayBonus = destRunwayFt < 4500 ? SHORT_RUNWAY_BONUS : 0;
  const complexityMultiplier = cargoBonus + paxBonus + runwayBonus;

  const rawTotal = basePayout + complexityMultiplier + (explorationBonus || 0);
  return Math.round(rawTotal * (seniorityMultiplier || 1.0));
}

/**
 * Generates distance- and complexity-scaled jobs from origin airport across short, medium, and long tiers,
 * favoring non-small airports and highlighting 1–2 unvisited destination contracts.
 */
export async function generateJobsForAirport(originIcao, options = {}) {
  originIcao = await normalizeTo4CharIcao(originIcao);
  let {
    minDistanceNm,
    maxDistanceNm,
    minRunwayFt,
    count = 5,
    direction = 'any',
    aircraft = null,
    visitedAirports = null,
    seniorityMultiplier = null
  } = options;

  // Retrieve pilot profile for aircraft, visited airports, and seniority if not provided
  try {
    const Pilot = (await import('../models/Pilot.js')).default;
    const pilot = await Pilot.findOne();
    if (!aircraft && pilot?.active_aircraft) {
      aircraft = pilot.active_aircraft;
    }
    if (!visitedAirports && pilot?.visited_airports) {
      visitedAirports = pilot.visited_airports;
    }
    if (seniorityMultiplier === null || seniorityMultiplier === undefined) {
      const { getPilotRank } = await import('./xpService.js');
      const rank = getPilotRank(pilot?.xp || 0);
      seniorityMultiplier = rank.seniorityMultiplier;
    }
  } catch (e) {
    // ignore
  }

  if (seniorityMultiplier === null || seniorityMultiplier === undefined) {
    seniorityMultiplier = 1.0;
  }

  const visitedSet = new Set((visitedAirports || []).map((i) => (i ? i.toUpperCase() : '')).filter(Boolean));
  for (const item of Array.from(visitedSet)) {
    if (item.length === 3) {
      visitedSet.add('K' + item);
    }
  }

  const aircraftCategory = aircraft?.category || 'single_prop';
  const maxRange = aircraft?.max_range_nm || 500;
  const maxCargo = aircraft?.max_cargo_lbs || 500;
  const maxPax = aircraft?.max_pax || 3;
  const planeMinRunway = aircraft?.min_runway_ft || 1600;

  if (minRunwayFt === undefined) {
    minRunwayFt = planeMinRunway;
  } else {
    minRunwayFt = Math.max(minRunwayFt, planeMinRunway);
  }

  // Threshold to favor non-small airports (e.g. >= 4500 ft)
  const nonSmallMinRunway = Math.max(minRunwayFt, NON_SMALL_RUNWAY_FT);

  const originAirport = await Airport.findOne({ icao: originIcao.toUpperCase() });
  if (!originAirport) {
    throw new Error(`Origin airport ${originIcao} not found in database.`);
  }

  const [originLon, originLat] = originAirport.location.coordinates;

  let candidatePairs = []; // array of { airport, tier }
  const seenIcaos = new Set([originAirport.icao]);
  if (originAirport.icao.length === 4 && originAirport.icao.startsWith('K')) {
    seenIcaos.add(originAirport.icao.slice(1));
  }

  if (options.minDistanceNm !== undefined || options.maxDistanceNm !== undefined) {
    // Explicit custom distance bounds (e.g. from unit tests)
    const effectiveMinNm = minDistanceNm !== undefined ? minDistanceNm : 20;
    const effectiveMaxNm = maxDistanceNm !== undefined ? maxDistanceNm : Math.round(maxRange * 0.85);
    const minMeters = effectiveMinNm * NM_TO_METERS;
    const maxMeters = effectiveMaxNm * NM_TO_METERS;

    // 1. Try querying non-small airports first
    const customLimit = (direction && direction !== 'any' && direction !== 'all') ? 40 : 25;
    let candidateAirports = await Airport.find({
      icao: { $ne: originAirport.icao, $regex: '^[A-Z0-9]{4}$' },
      longest_runway_ft: { $gte: nonSmallMinRunway },
      location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [originLon, originLat] },
          $minDistance: minMeters,
          $maxDistance: maxMeters
        }
      }
    }).limit(customLimit);

    // 2. Fallback to include smaller runways if insufficient candidates
    if (!candidateAirports || candidateAirports.length < count) {
      const existingIcaos = candidateAirports.map((a) => a.icao);
      const moreAirports = await Airport.find({
        icao: { $ne: originAirport.icao, $nin: existingIcaos, $regex: '^[A-Z0-9]{4}$' },
        longest_runway_ft: { $gte: minRunwayFt },
        location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [originLon, originLat] },
            $minDistance: minMeters,
            $maxDistance: maxMeters
          }
        }
      }).limit(customLimit - (candidateAirports?.length || 0));

      candidateAirports = [...(candidateAirports || []), ...moreAirports];
    }

    if (!candidateAirports || candidateAirports.length === 0) {
      candidateAirports = await Airport.find({
        icao: { $ne: originAirport.icao, $regex: '^[A-Z0-9]{4}$' },
        longest_runway_ft: { $gte: minRunwayFt }
      }).limit(10);
    }

    // Score and rank candidates, favoring non-small runways, unvisited airports, and requested direction
    const scored = candidateAirports.map((ap) => {
      const [destLon, destLat] = ap.location.coordinates;
      const bearing = calculateBearing(originLat, originLon, destLat, destLon);
      const dirMatch = matchesDirection(bearing, direction);
      let score = scoreAirport(ap, !visitedSet.has(ap.icao)) + Math.random() * 15;
      if (direction && direction !== 'any' && direction !== 'all') {
        if (dirMatch) {
          score += 140;
        } else {
          score -= 150;
        }
      }
      return {
        airport: ap,
        score
      };
    });
    scored.sort((a, b) => b.score - a.score);

    const selected = scored.slice(0, Math.min(count, scored.length)).map((s) => s.airport);
    candidatePairs = selected.map((ap) => {
      const [destLon, destLat] = ap.location.coordinates;
      const dist = calculateDistanceNm(originLat, originLon, destLat, destLon);
      return { airport: ap, tier: classifyJobTier(dist, aircraftCategory) };
    });
  } else {
    // Multi-tier generation (Short, Medium, Long) for rich Dispatch Board
    const tiers = getDistanceTiers(aircraftCategory);
    for (const [tierName, tierDef] of Object.entries(tiers)) {
      const tierMinMeters = tierDef.min * NM_TO_METERS;
      const tierMaxMeters = Math.min(tierDef.max, Math.round(maxRange * 0.95)) * NM_TO_METERS;
      if (tierMinMeters >= tierMaxMeters) continue;

      // 1. Attempt to query candidates in this tier bracket
      const isDirectional = Boolean(direction && direction !== 'any' && direction !== 'all');
      const tierLimit = isDirectional ? 80 : 25;
      const effectiveRunwayThreshold = isDirectional ? minRunwayFt : nonSmallMinRunway;

      let tierCandidates = await Airport.find({
        icao: { $nin: Array.from(seenIcaos), $regex: '^[A-Z0-9]{4}$' },
        longest_runway_ft: { $gte: effectiveRunwayThreshold },
        location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [originLon, originLat] },
            $minDistance: tierMinMeters,
            $maxDistance: tierMaxMeters
          }
        }
      }).limit(tierLimit);

      // 2. Fallback to include smaller runways if insufficient candidates
      if (tierCandidates.length < 6 && effectiveRunwayThreshold > minRunwayFt) {
        const existingIcaos = tierCandidates.map((a) => a.icao);
        const fallbackCandidates = await Airport.find({
          icao: { $nin: [...Array.from(seenIcaos), ...existingIcaos], $regex: '^[A-Z0-9]{4}$' },
          longest_runway_ft: { $gte: minRunwayFt },
          location: {
            $nearSphere: {
              $geometry: { type: 'Point', coordinates: [originLon, originLat] },
              $minDistance: tierMinMeters,
              $maxDistance: tierMaxMeters
            }
          }
        }).limit(tierLimit - tierCandidates.length);

        tierCandidates = [...tierCandidates, ...fallbackCandidates];
      }

      // Score candidates, favoring non-small runways, unvisited destinations, and requested direction
      const scoredCandidates = tierCandidates.map((ap) => {
        const [destLon, destLat] = ap.location.coordinates;
        const bearing = calculateBearing(originLat, originLon, destLat, destLon);
        const dirMatch = matchesDirection(bearing, direction);
        let score = scoreAirport(ap, !visitedSet.has(ap.icao)) + Math.random() * 20;
        return {
          airport: ap,
          bearing,
          dirMatch,
          score
        };
      });

      let picked = [];
      if (isDirectional) {
        const matching = scoredCandidates.filter((c) => c.dirMatch);
        matching.sort((a, b) => b.score - a.score);
        if (matching.length >= 3) {
          picked = matching.slice(0, 3).map((item) => item.airport);
        } else {
          // Take all matching candidates first, fill remainder only if insufficient in airspace
          scoredCandidates.sort((a, b) => {
            if (a.dirMatch !== b.dirMatch) return a.dirMatch ? -1 : 1;
            return b.score - a.score;
          });
          picked = scoredCandidates.slice(0, 3).map((item) => item.airport);
        }
      } else {
        scoredCandidates.sort((a, b) => b.score - a.score);
        picked = scoredCandidates.slice(0, 3).map((item) => item.airport);
      }

      for (const ap of picked) {
        seenIcaos.add(ap.icao);
        candidatePairs.push({ airport: ap, tier: tierName });
      }
    }

    // Fallback if sparse location has fewer than 3 total
    if (candidatePairs.length < 3) {
      let fallbacks = await Airport.find({
        icao: { $nin: Array.from(seenIcaos), $regex: '^[A-Z0-9]{4}$' },
        longest_runway_ft: { $gte: minRunwayFt }
      }).limit(40);

      if (direction && direction !== 'any' && direction !== 'all') {
        const matchingFallbacks = fallbacks.filter((ap) => {
          const [destLon, destLat] = ap.location.coordinates;
          const b = calculateBearing(originLat, originLon, destLat, destLon);
          return matchesDirection(b, direction);
        });
        if (matchingFallbacks.length > 0) {
          fallbacks = matchingFallbacks;
        }
      }

      for (const ap of fallbacks) {
        if (candidatePairs.length >= 9) break;
        seenIcaos.add(ap.icao);
        const [destLon, destLat] = ap.location.coordinates;
        const dist = calculateDistanceNm(originLat, originLon, destLat, destLon);
        candidatePairs.push({ airport: ap, tier: classifyJobTier(dist, aircraftCategory) });
      }
    }
  }

  // Ensure 1 or 2 unvisited airports are included if any unvisited airports exist in range
  let unvisitedCount = candidatePairs.filter((p) => !visitedSet.has(p.airport.icao)).length;
  if (unvisitedCount < 2) {
    const isDirectional = Boolean(direction && direction !== 'any' && direction !== 'all');
    const unvisitedLimit = isDirectional ? 40 : 10;
    // Actively seek unvisited non-small airports in the aircraft's radius
    let unvisitedAvailable = await Airport.find({
      icao: { $nin: [...Array.from(seenIcaos), ...Array.from(visitedSet)], $regex: '^[A-Z0-9]{4}$' },
      longest_runway_ft: { $gte: isDirectional ? minRunwayFt : nonSmallMinRunway },
      location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [originLon, originLat] },
          $minDistance: 20 * NM_TO_METERS,
          $maxDistance: Math.round(maxRange * 0.95) * NM_TO_METERS
        }
      }
    }).limit(unvisitedLimit);

    if (isDirectional) {
      // Strictly restrict unvisited injection to the requested heading cone
      unvisitedAvailable = unvisitedAvailable.filter((ap) => {
        const [aLon, aLat] = ap.location.coordinates;
        const b = calculateBearing(originLat, originLon, aLat, aLon);
        return matchesDirection(b, direction);
      });
    }

    for (const ap of unvisitedAvailable) {
      if (unvisitedCount >= 2) break;
      const [destLon, destLat] = ap.location.coordinates;
      const dist = calculateDistanceNm(originLat, originLon, destLat, destLon);
      const tier = classifyJobTier(dist, aircraftCategory);

      // Replace a visited candidate in the same tier if possible, else any visited candidate
      const replaceIdx = candidatePairs.findIndex((p) => visitedSet.has(p.airport.icao) && p.tier === tier) !== -1
        ? candidatePairs.findIndex((p) => visitedSet.has(p.airport.icao) && p.tier === tier)
        : candidatePairs.findIndex((p) => visitedSet.has(p.airport.icao));

      if (replaceIdx !== -1) {
        seenIcaos.delete(candidatePairs[replaceIdx].airport.icao);
        seenIcaos.add(ap.icao);
        candidatePairs[replaceIdx] = { airport: ap, tier };
        unvisitedCount++;
      } else if (candidatePairs.length < (options.count || 9)) {
        seenIcaos.add(ap.icao);
        candidatePairs.push({ airport: ap, tier });
        unvisitedCount++;
      }
    }
  }

  // Identify up to 2 unvisited airports to highlight as featured exploration destinations
  const unvisitedPairs = candidatePairs.filter((p) => !visitedSet.has(p.airport.icao));
  const featuredIcaos = new Set(
    unvisitedPairs
      .sort((a, b) => (b.airport.longest_runway_ft || 0) - (a.airport.longest_runway_ft || 0))
      .slice(0, 2)
      .map((p) => p.airport.icao)
  );

  // Remove all previous unaccepted jobs across the entire database so only the active 9-job board exists
  await Job.deleteMany({ status: 'available' });

  const generatedJobs = [];
  for (const pair of candidatePairs) {
    const dest = pair.airport;
    const [destLon, destLat] = dest.location.coordinates;
    const distanceNm = calculateDistanceNm(originLat, originLon, destLat, destLon);
    const bearing = Math.round(calculateBearing(originLat, originLon, destLat, destLon));
    const cardinalDir = getCardinalDirection(bearing);

    // Randomize payload complexity based on aircraft capabilities
    const isCargoHeavy = Math.random() > 0.45;
    let paxCount = 0;
    let cargoLbs = 0;

    if (isCargoHeavy) {
      paxCount = Math.floor(Math.random() * Math.min(3, maxPax + 1));
      // Heavy cargo between 40% and 95% of maxCargo
      cargoLbs = Math.max(50, Math.round(maxCargo * (0.4 + Math.random() * 0.55)));
    } else {
      // Passenger charter between 35% and 100% of maxPax
      paxCount = Math.max(1, Math.round(maxPax * (0.35 + Math.random() * 0.65)));
      // Luggage 30-60 lbs per passenger, capped at maxCargo
      cargoLbs = Math.min(maxCargo, Math.round(paxCount * (30 + Math.random() * 30)));
    }

    const isUnvisited = !visitedSet.has(dest.icao.toUpperCase());
    const isFeatured = featuredIcaos.has(dest.icao.toUpperCase());
    const bonus = isFeatured ? EXPLORATION_BONUS : 0;

    const basePayout = calculatePayout(
      distanceNm,
      cargoLbs,
      paxCount,
      dest.longest_runway_ft,
      aircraftCategory,
      bonus,
      1.0
    );

    const totalPayout = calculatePayout(
      distanceNm,
      cargoLbs,
      paxCount,
      dest.longest_runway_ft,
      aircraftCategory,
      bonus,
      seniorityMultiplier
    );

    const seniorityBonus = Math.max(0, totalPayout - basePayout);
    const xpReward = Math.max(50, Math.round(distanceNm) + (isUnvisited ? 100 : 0) + 100);

    const job = await Job.create({
      origin_icao: originAirport.icao,
      destination_icao: dest.icao,
      distance_nm: distanceNm,
      bearing,
      cardinal_direction: cardinalDir,
      cargo_lbs: cargoLbs,
      pax_count: paxCount,
      payout: totalPayout,
      seniority_multiplier: seniorityMultiplier,
      seniority_bonus: seniorityBonus,
      xp_reward: xpReward,
      tier: pair.tier || classifyJobTier(distanceNm, aircraftCategory),
      status: 'available',
      is_unvisited: isUnvisited,
      is_featured_destination: isFeatured,
      exploration_bonus: bonus
    });

    generatedJobs.push({
      ...job.toObject(),
      bearing,
      cardinal_direction: cardinalDir,
      destination_name: dest.name,
      destination_city: dest.city,
      destination_country: dest.country,
      destination_runway_ft: dest.longest_runway_ft,
      destination_location: dest.location
    });
  }

  return generatedJobs;
}


