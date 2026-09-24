import Airport from '../models/Airport.js';

const airportCache = new Map();

/**
 * Returns a cached airport document by ICAO or queries MongoDB and caches it
 * @param {string} icao 3 or 4 character airport identifier
 * @returns {Promise<object|null>}
 */
export async function getCachedAirport(icao) {
  if (!icao) return null;
  const upper = icao.toUpperCase().trim();
  if (airportCache.has(upper)) return airportCache.get(upper);

  const airport = await Airport.findOne({ icao: upper }).lean();
  if (airport) {
    airportCache.set(upper, airport);
  }
  return airport;
}

/**
 * Efficiently resolves multiple airport records, querying only uncached ICAOs
 * @param {string[]} icaos Array of ICAO codes
 * @returns {Promise<object[]>}
 */
export async function getCachedAirportsList(icaos) {
  if (!icaos || !icaos.length) return [];
  const missing = [];

  for (const code of icaos) {
    const upper = code?.toUpperCase()?.trim();
    if (upper && !airportCache.has(upper)) {
      missing.push(upper);
    }
  }

  if (missing.length > 0) {
    const fetched = await Airport.find({ icao: { $in: missing } })
      .select('icao name city country location longest_runway_ft')
      .lean();
    for (const a of fetched) {
      airportCache.set(a.icao, a);
    }
  }

  return icaos.map((code) => airportCache.get(code?.toUpperCase()?.trim())).filter(Boolean);
}

/**
 * Directly primes or updates the in-memory airport cache
 */
export function setCachedAirport(icao, airportDoc) {
  if (!icao || !airportDoc) return;
  airportCache.set(icao.toUpperCase().trim(), airportDoc);
}

export default {
  getCachedAirport,
  getCachedAirportsList,
  setCachedAirport
};

