import fs from 'fs';
import path from 'path';
import Airport from '../models/Airport.js';
import Pilot from '../models/Pilot.js';
import { calculateDistanceNm } from './geoUtils.js';
import { calculateFlightXp } from './xpService.js';
import { normalizeTo4CharIcao } from '../utils/icaoUtils.js';

/**
 * Searches common Steam and MS Store locations for MSFS 2024 / 2020 logbooks.
 */
export function detectLogbookFiles() {
  const detected = [];

  // 1. Steam paths (Common across standard drive letters)
  const driveLetters = ['C', 'D', 'E', 'F', 'G'];
  for (const drive of driveLetters) {
    const steamUserBase = `${drive}:\\Program Files (x86)\\Steam\\userdata`;
    const altSteamBase = `${drive}:\\Steam\\userdata`;
    
    for (const base of [steamUserBase, altSteamBase]) {
      if (fs.existsSync(base)) {
        try {
          const userFolders = fs.readdirSync(base);
          for (const userFolder of userFolders) {
            const userPath = path.join(base, userFolder);
            if (!fs.statSync(userPath).isDirectory()) continue;

            // MSFS 2024 Steam App ID: 2537590
            const srPath = path.join(userPath, '2537590', 'remote', 'sr_logbook');
            if (fs.existsSync(srPath)) {
              const stat = fs.statSync(srPath);
              detected.push({
                sim: 'MSFS 2024',
                edition: 'Steam',
                path: srPath,
                sizeBytes: stat.size,
                modifiedAt: stat.mtime
              });
            }

            // MSFS 2020 Steam App ID: 1250410
            const khPath = path.join(userPath, '1250410', 'remote', 'kh_logbook');
            if (fs.existsSync(khPath)) {
              const stat = fs.statSync(khPath);
              detected.push({
                sim: 'MSFS 2020',
                edition: 'Steam',
                path: khPath,
                sizeBytes: stat.size,
                modifiedAt: stat.mtime
              });
            }
          }
        } catch {
          // Skip folders with permission restrictions
        }
      }
    }
  }

  // 2. Microsoft Store / Game Pass (Xbox App) paths
  if (process.env.LOCALAPPDATA) {
    const packagesDir = path.join(process.env.LOCALAPPDATA, 'Packages');
    if (fs.existsSync(packagesDir)) {
      try {
        const pkgs = fs.readdirSync(packagesDir);
        for (const pkg of pkgs) {
          // MSFS 2024 package usually contains Limitless
          if (pkg.includes('Limitless') || pkg.includes('FlightSimulator')) {
            const wgsDir = path.join(packagesDir, pkg, 'SystemAppData', 'wgs');
            if (fs.existsSync(wgsDir)) {
              // Recursively scan for sr_logbook or files > 500KB
              const scanDir = (dir) => {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                  const full = path.join(dir, entry.name);
                  if (entry.isDirectory()) {
                    scanDir(full);
                  } else if (entry.name === 'sr_logbook' || entry.name === 'kh_logbook') {
                    const stat = fs.statSync(full);
                    detected.push({
                      sim: entry.name.startsWith('sr') ? 'MSFS 2024' : 'MSFS 2020',
                      edition: 'MS Store',
                      path: full,
                      sizeBytes: stat.size,
                      modifiedAt: stat.mtime
                    });
                  }
                }
              };
              scanDir(wgsDir);
            }
          }
        }
      } catch {
        // Skip protected UWP folders
      }
    }
  }

  // 3. Project fallback: msfs2024_logbook.json
  const jsonFallback = path.resolve(process.cwd(), 'msfs2024_logbook.json');
  if (fs.existsSync(jsonFallback)) {
    const stat = fs.statSync(jsonFallback);
    detected.push({
      sim: 'MSFS 2024',
      edition: 'JSON Export',
      path: jsonFallback,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime
    });
  }

  return detected;
}

/**
 * Reads length-prefixed ASCII string from buffer at given offset
 */
function parseStringAt(buffer, offset) {
  if (offset >= buffer.length) return { str: '', nextOffset: offset };
  const len = buffer[offset];
  if (len === 0 || len > 120) return { str: '', nextOffset: offset };
  if (offset + 1 + len > buffer.length) return { str: '', nextOffset: offset };

  for (let i = 0; i < len; i++) {
    const b = buffer[offset + 1 + i];
    if (b < 32 || b > 126) return { str: '', nextOffset: offset };
  }

  const str = buffer.slice(offset + 1, offset + 1 + len).toString('ascii');
  return { str, nextOffset: offset + 1 + len };
}

/**
 * Cleans aircraft name from internal MSFS IDs
 */
function cleanAircraftTitle(title) {
  if (!title) return 'MSFS Aircraft';
  let t = title.replace(/^asobo-aircraft-/, '').replace(/^aircraft-/, '');
  if (t.includes('%')) {
    const parts = t.split('%');
    t = parts[parts.length - 1];
  }
  return t.trim() || 'MSFS Aircraft';
}

/**
 * Parses binary sr_logbook or kh_logbook file into structured flight records
 */
export function parseBinaryLogbook(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Logbook file not found at: ${filePath}`);
  }

  // Handle JSON export fallback
  if (filePath.endsWith('.json')) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return (data.flights || []).map((f, idx) => ({
      flight_number: f.flight_number || idx + 1,
      date: f.timestamp || new Date().toISOString(),
      origin_icao: (f.origin_icao || 'ZZZZ').toUpperCase(),
      destination_icao: (f.destination_icao || 'ZZZZ').toUpperCase(),
      duration_seconds: Math.round(f.duration_seconds || 0),
      aircraft_title: f.aircraft_title || f.aircraft_model || 'MSFS Aircraft',
      distance_nm: f.distance_nm || null
    }));
  }

  const buf = fs.readFileSync(filePath);
  if (buf.length < 32) {
    throw new Error('Logbook file is corrupt or too small.');
  }

  const version = buf.readUInt32LE(0);
  const totalEntries = buf.readUInt32LE(4);

  const flights = [];

  for (let i = 0; i < buf.length - 100; i++) {
    const year = buf.readUInt16LE(i);
    // Support flights logged between 2020 and 2027
    if (year >= 2020 && year <= 2027) {
      const month = buf.readUInt16LE(i + 2);
      const day = buf.readUInt16LE(i + 4);
      const hour = buf.readUInt16LE(i + 6);
      const min = buf.readUInt16LE(i + 8);
      const sec = buf.readUInt16LE(i + 10);

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour <= 23 && min <= 59 && sec <= 59) {
        // Look for flight duration float32 in bytes i+12 .. i+25
        let durationSec = 0;
        for (let fOffset = i + 12; fOffset <= i + 25; fOffset += 2) {
          try {
            const val = buf.readFloatLE(fOffset);
            if (val > 10 && val < 86400) {
              durationSec = Math.round(val);
              break;
            }
          } catch {}
        }

        // Look for origin & destination ICAOs in bytes i+12 .. i+60
        let foundOrigin = null;
        let foundDest = null;
        let foundAircraftModel = null;
        let foundAircraftTitle = null;

        for (let sOffset = i + 12; sOffset <= i + 60; sOffset++) {
          const { str: s1, nextOffset: n1 } = parseStringAt(buf, sOffset);
          if (s1.length >= 3 && s1.length <= 5 && /^[A-Z0-9]{3,5}$/.test(s1)) {
            const { str: s2 } = parseStringAt(buf, n1);
            if (s2.length >= 3 && s2.length <= 5 && /^[A-Z0-9]{3,5}$/.test(s2)) {
              foundOrigin = s1;
              foundDest = s2;
              break;
            }
          }
        }

        if (foundOrigin) {
          // Look for aircraft title in the next 300 bytes
          for (let aOffset = i + 40; aOffset <= i + 260; aOffset++) {
            const { str, nextOffset } = parseStringAt(buf, aOffset);
            if (
              str.startsWith('asobo-aircraft-') ||
              str.startsWith('aircraft-') ||
              str.includes('c172') ||
              str.includes('a320') ||
              str.includes('da40') ||
              str.includes('da62') ||
              str.includes('c208') ||
              str.includes('kingair') ||
              str.includes('citation') ||
              str.includes('vision')
            ) {
              foundAircraftModel = str;
              const next = parseStringAt(buf, nextOffset);
              if (next.str.length > 2) {
                foundAircraftTitle = next.str;
              }
              break;
            }
          }

          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}Z`;

          flights.push({
            flight_number: flights.length + 1,
            date: dateStr,
            origin_icao: foundOrigin,
            destination_icao: foundDest,
            duration_seconds: durationSec,
            aircraft_title: cleanAircraftTitle(foundAircraftTitle || foundAircraftModel)
          });

          // Skip past this record header
          i += 100;
        }
      }
    }
  }

  return flights;
}

/**
 * Determines whether a candidate MSFS flight is a duplicate of an existing flight record.
 * Matches on:
 * 1. Matching external flight number
 * 2. Exact timestamp signature
 * 3. Same route (origin & dest) within a 3-hour window of departed_at or completed_at
 * 4. Same route on the same calendar day with similar duration (+/- 30 min)
 */
export function isDuplicateFlight(candidate, existingFlightLogs = []) {
  const candFlightNum = candidate.flight_number;
  const candDate = candidate.date ? new Date(candidate.date) : new Date();
  const candTime = candDate.getTime();
  const candOrig = (candidate.origin_icao || '').toUpperCase();
  const candDest = (candidate.destination_icao || '').toUpperCase();
  const candDuration = Math.round(candidate.duration_seconds || 0);

  for (const log of existingFlightLogs) {
    // 1. Exact external flight number match (for MSFS-to-MSFS re-imports)
    if (candFlightNum != null && log.external_flight_number != null && log.external_flight_number === candFlightNum) {
      return true;
    }

    const logOrig = (log.origin_icao || '').toUpperCase();
    const logDest = (log.destination_icao || '').toUpperCase();

    // 2. Route matching
    if (logOrig === candOrig && logDest === candDest) {
      const logCompletedTime = log.completed_at ? new Date(log.completed_at).getTime() : 0;
      const logDepartedTime = log.departed_at ? new Date(log.departed_at).getTime() : logCompletedTime;

      // Check if within 3 hours (180 minutes) of departure or completion
      const diffMinutes = Math.min(
        Math.abs(candTime - logCompletedTime),
        Math.abs(candTime - logDepartedTime)
      ) / (60 * 1000);

      if (diffMinutes <= 180) {
        return true;
      }

      // Check if same calendar day with duration within 30 minutes
      const candIso = candDate.toISOString().slice(0, 10);
      const logIso = log.completed_at ? new Date(log.completed_at).toISOString().slice(0, 10) : '';
      if (candIso && logIso && candIso === logIso) {
        const logDuration = Math.round(log.duration_seconds || 0);
        if (Math.abs(candDuration - logDuration) < 1800) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Deduplicates existing flight logs in a pilot profile.
 * Removes redundant msfs_import entries that duplicate an Airbound dispatch or free flight.
 */
export function deduplicatePilotFlightLog(pilot) {
  if (!pilot || !pilot.flight_log || pilot.flight_log.length <= 1) {
    return { removedCount: 0, removedXp: 0 };
  }

  const logs = pilot.flight_log;
  const idsToRemove = new Set();
  let removedXp = 0;

  // Identify all internal Airbound dispatch / career flights
  const internalFlights = logs.filter((f) => f.source !== 'msfs_import' && f.is_external !== true);

  for (const internal of internalFlights) {
    const intCompTime = internal.completed_at ? new Date(internal.completed_at).getTime() : 0;
    const intDepTime = internal.departed_at ? new Date(internal.departed_at).getTime() : intCompTime;
    const intOrig = (internal.origin_icao || '').toUpperCase();
    const intDest = (internal.destination_icao || '').toUpperCase();

    for (const imp of logs) {
      if (imp.source === 'msfs_import' || imp.is_external === true) {
        const impOrig = (imp.origin_icao || '').toUpperCase();
        const impDest = (imp.destination_icao || '').toUpperCase();

        if (impOrig === intOrig && impDest === intDest) {
          const impTime = new Date(imp.completed_at || imp.departed_at).getTime();
          const diffMinutes = Math.min(
            Math.abs(impTime - intCompTime),
            Math.abs(impTime - intDepTime)
          ) / (60 * 1000);

          if (diffMinutes <= 180) {
            idsToRemove.add(String(imp._id));
            removedXp += (imp.xp_earned || 0);
          }
        }
      }
    }
  }

  if (idsToRemove.size > 0) {
    pilot.flight_log = logs.filter((f) => !idsToRemove.has(String(f._id)));
    pilot.xp = Math.max(0, (pilot.xp || 0) - removedXp);
  }

  return { removedCount: idsToRemove.size, removedXp };
}

/**
 * Imports parsed flights into pilot's career profile
 */
export async function importFlightsToPilot(flights) {
  let pilot = await Pilot.findOne();
  if (!pilot) {
    pilot = new Pilot({
      callsign: 'James',
      balance: 15000,
      current_icao: 'KLAX',
      visited_airports: ['KLAX'],
      visited_countries: ['US']
    });
  }

  pilot.flight_log = pilot.flight_log || [];

  // Automatically clean up any existing duplicate msfs_import records overlapping with Airbound flights
  const dedupInitial = deduplicatePilotFlightLog(pilot);

  const visitedAirportsSet = new Set(pilot.visited_airports || []);
  const visitedCountriesSet = new Set(pilot.visited_countries || ['US']);

  let newImportedCount = 0;
  let skippedCount = 0;
  let totalFlightHoursAdded = 0;
  let totalXpAdded = 0;

  // Cache airport coordinates in memory for fast distance lookups
  const airportMap = new Map();
  const airportsInDb = await Airport.find({}, 'icao location country').lean();
  for (const a of airportsInDb) {
    if (a.icao) airportMap.set(a.icao.toUpperCase(), a);
  }

  for (const f of flights) {
    const flightNumber = f.flight_number;
    const completedAt = f.date ? new Date(f.date) : new Date();

    const origIcao = (await normalizeTo4CharIcao(f.origin_icao || 'ZZZZ')).toUpperCase();
    const destIcao = (await normalizeTo4CharIcao(f.destination_icao || 'ZZZZ')).toUpperCase();

    const candidate = {
      flight_number: flightNumber,
      date: completedAt,
      origin_icao: origIcao,
      destination_icao: destIcao,
      duration_seconds: f.duration_seconds
    };

    if (isDuplicateFlight(candidate, pilot.flight_log)) {
      skippedCount++;
      continue;
    }

    const durationSec = Math.max(0, Math.round(f.duration_seconds || 0));
    const departedAt =
      completedAt && durationSec > 0
        ? new Date(completedAt.getTime() - durationSec * 1000)
        : completedAt;

    // Calculate distance in nautical miles
    let distanceNm = f.distance_nm || 0;
    const origAirport = airportMap.get(origIcao);
    const destAirport = airportMap.get(destIcao);

    if (origAirport?.location?.coordinates && destAirport?.location?.coordinates) {
      const [oLon, oLat] = origAirport.location.coordinates;
      const [dLon, dLat] = destAirport.location.coordinates;
      distanceNm = Math.round(calculateDistanceNm(oLat, oLon, dLat, dLon) * 10) / 10;
    } else if (durationSec > 0 && !distanceNm) {
      // Estimate based on standard cruise speed (120 kts) if airport coords unavailable
      distanceNm = Math.round((durationSec / 3600) * 115 * 10) / 10;
    }

    // Calculate career XP for this flight
    const xpCalc = calculateFlightXp({
      distanceNm,
      flightSeconds: durationSec,
      touchdownFpm: null, // Touchdown rating unrecorded in bulk import
      originIcao: origIcao,
      destIcao: destIcao,
      pilotLevel: pilot.level || 1,
      visitedAirports: Array.from(visitedAirportsSet)
    });

    const xpEarned = xpCalc?.totalXp || Math.max(50, Math.round(distanceNm * 1.5));
    totalXpAdded += xpEarned;
    totalFlightHoursAdded += durationSec / 3600;

    const logEntry = {
      origin_icao: origIcao,
      destination_icao: destIcao,
      distance_nm: distanceNm,
      cargo_lbs: 0,
      pax_count: 0,
      payout: 0,
      gross_payout: 0,
      fuel_cost: 0,
      fuel_gallons: 0,
      landing_fee: 0,
      net_payout: 0,
      aircraft_name: f.aircraft_title || 'MSFS Aircraft',
      duration_seconds: durationSec,
      airborne_seconds: durationSec,
      departed_at: departedAt,
      completed_at: completedAt,
      source: 'msfs_import',
      is_external: true,
      external_flight_number: flightNumber,
      xp_earned: xpEarned,
      touchdown_fpm: null,
      landing_rating: 'Unrecorded',
      landing_class: 'Light'
    };

    pilot.flight_log.push(logEntry);
    newImportedCount++;

    if (origIcao && origIcao !== 'ZZZZ') visitedAirportsSet.add(origIcao);
    if (destIcao && destIcao !== 'ZZZZ') visitedAirportsSet.add(destIcao);
    if (origAirport?.country) visitedCountriesSet.add(origAirport.country.toUpperCase());
    if (destAirport?.country) visitedCountriesSet.add(destAirport.country.toUpperCase());
  }

  // Sort flight log chronologically
  pilot.flight_log.sort((a, b) => {
    const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return dateA - dateB;
  });

  pilot.visited_airports = Array.from(visitedAirportsSet);
  pilot.visited_countries = Array.from(visitedCountriesSet);
  pilot.xp = (pilot.xp || 0) + totalXpAdded;

  // Credit flight hours to active aircraft
  if (pilot.active_aircraft && totalFlightHoursAdded > 0) {
    pilot.active_aircraft.flight_hours =
      Math.round(((pilot.active_aircraft.flight_hours || 0) + totalFlightHoursAdded) * 10) / 10;
  }

  await pilot.save();

  console.log(`[MSFS Import] Successfully imported ${newImportedCount} flights (skipped ${skippedCount}).`);

  return {
    success: true,
    imported: newImportedCount,
    skipped: skippedCount,
    cleanedDuplicates: dedupInitial.removedCount,
    totalFlights: pilot.flight_log.length,
    xpAwarded: totalXpAdded,
    pilot
  };
}

export default {
  detectLogbookFiles,
  parseBinaryLogbook,
  importFlightsToPilot,
  isDuplicateFlight,
  deduplicatePilotFlightLog
};
