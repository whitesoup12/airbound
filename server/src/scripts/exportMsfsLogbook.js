import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { calculateDistanceNm } from '../services/geoUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DEFAULT_LOGBOOK_PATH = 'C:\\Program Files (x86)\\Steam\\userdata\\1164262935\\2537590\\remote\\kh_logbook';

function getLengthPrefixedString(buffer, offset) {
  if (offset < 0 || offset + 4 > buffer.length) return null;
  const len = buffer.readUInt32LE(offset);
  if (len < 2 || len > 120 || offset + 4 + len > buffer.length) return null;
  const str = buffer.subarray(offset + 4, offset + 4 + len).toString('utf8');
  if (str.endsWith('\0')) return str.replace(/\0$/, '');
  return null;
}

export async function exportMsfsLogbook(logbookPath = DEFAULT_LOGBOOK_PATH) {
  if (!fs.existsSync(logbookPath)) {
    throw new Error(`MSFS 2024 logbook file not found at: ${logbookPath}`);
  }

  console.log(`[Export] Reading MSFS 2024 binary logbook: ${logbookPath}`);
  const buf = fs.readFileSync(logbookPath);
  const totalHeaderRecords = buf.readUInt32LE(4);
  console.log(`[Export] Header reports ${totalHeaderRecords} total flight records.`);

  // Connect to DB to enrich airports and compute distance
  let Airport = null;
  const airportCache = new Map();

  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      Airport = (await import('../models/Airport.js')).default;
      console.log('[Export] Connected to Airport database for coordinate and city enrichment.');
    }
  } catch (err) {
    console.warn(`[Export] Airport DB lookup unavailable (${err.message}). Continuing with raw ICAOs.`);
  }

  const needle = Buffer.from('PLANETYPE_');
  let idx = 0;
  const rawFlights = [];

  while ((idx = buf.indexOf(needle, idx)) !== -1) {
    const planeTypeLen = buf.readUInt32LE(idx - 4);
    const planeType = buf.subarray(idx, idx + planeTypeLen - 1).toString('utf8');

    let cur = idx + planeTypeLen;
    const modelId = getLengthPrefixedString(buf, cur);
    if (modelId) cur += 4 + modelId.length + 1;
    const planeTitle = getLengthPrefixedString(buf, cur);

    let dep = null;
    let arr = null;
    let durationSec = null;
    let flightDate = null;
    let flightTime = null;

    // Search backwards for the flight timestamp and ICAO block
    for (let b = idx - 10; b >= Math.max(0, idx - 450); b--) {
      const year = buf.readUInt16LE(b);
      if (year >= 1990 && year <= 2035) {
        const month = buf.readUInt16LE(b + 2);
        const day = buf.readUInt16LE(b + 4);
        const hour = buf.readUInt16LE(b + 6);
        const min = buf.readUInt16LE(b + 8);
        const sec = buf.readUInt16LE(b + 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour <= 24 && min <= 60 && sec <= 60) {
          flightDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          flightTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
          durationSec = buf.readFloatLE(b + 16);

          dep = getLengthPrefixedString(buf, b + 20);
          if (dep) {
            arr = getLengthPrefixedString(buf, b + 20 + 4 + dep.length + 1);
          }
          break;
        }
      }
    }

    rawFlights.push({
      date: flightDate || 'Unknown',
      time: flightTime || '00:00:00',
      dep: dep || 'UNKNOWN',
      arr: arr || dep || 'UNKNOWN',
      durationSeconds: durationSec > 0 && durationSec < 500000 ? Math.round(durationSec) : 0,
      planeType: planeType.replace(/^PLANETYPE_/, ''),
      modelId: modelId || 'Unknown',
      planeTitle: planeTitle || modelId || 'Unknown'
    });

    idx += 10;
  }

  console.log(`[Export] Decoded ${rawFlights.length} flights from binary.`);

  // Enrich with airport details and calculate distances
  const enrichedFlights = [];
  const icaosToFetch = new Set();
  rawFlights.forEach((f) => {
    if (f.dep && f.dep !== 'UNKNOWN') icaosToFetch.add(f.dep);
    if (f.arr && f.arr !== 'UNKNOWN') icaosToFetch.add(f.arr);
  });

  if (Airport && icaosToFetch.size > 0) {
    const airportDocs = await Airport.find({ icao: { $in: Array.from(icaosToFetch) } });
    airportDocs.forEach((doc) => {
      airportCache.set(doc.icao, {
        name: doc.name,
        city: doc.city,
        country: doc.country,
        coords: doc.location?.coordinates
      });
    });
  }

  // Fetch remaining general aviation and small airstrips from OurAirports
  const missingIcaos = new Set(Array.from(icaosToFetch).filter((icao) => !airportCache.has(icao)));
  if (missingIcaos.size > 0) {
    console.log(`[Export] Fetching details for ${missingIcaos.size} small/general aviation airstrips from OurAirports...`);
    try {
      const https = (await import('https')).default;
      const csv = (await import('csv-parser')).default;
      await new Promise((resolve) => {
        https.get('https://davidmegginson.github.io/ourairports-data/airports.csv', (res) => {
          res.pipe(csv())
            .on('data', (row) => {
              const ident = (row.ident || '').trim().toUpperCase();
              const icao = (row.icao_code || '').trim().toUpperCase();
              const gps = (row.gps_code || '').trim().toUpperCase();
              const target = missingIcaos.has(ident) ? ident : (missingIcaos.has(icao) ? icao : (missingIcaos.has(gps) ? gps : null));
              if (target && !airportCache.has(target)) {
                const lat = parseFloat(row.latitude_deg);
                const lon = parseFloat(row.longitude_deg);
                if (!isNaN(lat) && !isNaN(lon)) {
                  airportCache.set(target, {
                    name: row.name || target,
                    city: row.municipality || '',
                    country: row.iso_country || 'US',
                    coords: [lon, lat]
                  });
                }
              }
            })
            .on('end', resolve)
            .on('error', (err) => {
              console.warn('[Export] OurAirports stream notice:', err.message);
              resolve();
            });
        }).on('error', () => resolve());
      });
      console.log(`[Export] Successfully resolved ${airportCache.size} / ${icaosToFetch.size} total airports.`);
    } catch (e) {
      console.warn('[Export] Optional airstrip enrichment skipped:', e.message);
    }
  }

  for (let i = 0; i < rawFlights.length; i++) {
    const f = rawFlights[i];
    const depAirport = airportCache.get(f.dep);
    const arrAirport = airportCache.get(f.arr);

    let distanceNm = 0;
    if (depAirport?.coords && arrAirport?.coords) {
      const [oLon, oLat] = depAirport.coords;
      const [dLon, dLat] = arrAirport.coords;
      distanceNm = calculateDistanceNm(oLat, oLon, dLat, dLon);
    }

    const durationMins = Math.round((f.durationSeconds / 60) * 10) / 10;
    const durationHours = Math.round((f.durationSeconds / 3600) * 10) / 10;
    const hours = Math.floor(f.durationSeconds / 3600);
    const mins = Math.floor((f.durationSeconds % 3600) / 60);
    const formattedDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    enrichedFlights.push({
      flight_number: i + 1,
      date: f.date,
      time_utc: f.time,
      timestamp: `${f.date}T${f.time}Z`,
      origin_icao: f.dep,
      origin_name: depAirport?.name || f.dep,
      origin_city: depAirport?.city || '',
      origin_country: depAirport?.country || '',
      destination_icao: f.arr,
      destination_name: arrAirport?.name || f.arr,
      destination_city: arrAirport?.city || '',
      destination_country: arrAirport?.country || '',
      distance_nm: distanceNm,
      duration_seconds: f.durationSeconds,
      duration_minutes: durationMins,
      duration_hours: durationHours,
      duration_formatted: formattedDuration,
      aircraft_type: f.planeType,
      aircraft_model: f.modelId,
      aircraft_title: f.planeTitle
    });
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Write JSON
  const rootDir = path.resolve(__dirname, '../../../');
  const jsonPath = path.join(rootDir, 'msfs2024_logbook.json');
  const csvPath = path.join(rootDir, 'msfs2024_logbook.csv');

  const summary = {
    generated_at: new Date().toISOString(),
    source_file: logbookPath,
    total_flights: enrichedFlights.length,
    total_duration_hours: Math.round(enrichedFlights.reduce((acc, f) => acc + f.duration_hours, 0) * 10) / 10,
    total_distance_nm: Math.round(enrichedFlights.reduce((acc, f) => acc + f.distance_nm, 0)),
    unique_origin_airports: new Set(enrichedFlights.map((f) => f.origin_icao)).size,
    unique_destination_airports: new Set(enrichedFlights.map((f) => f.destination_icao)).size,
    unique_aircraft: new Set(enrichedFlights.map((f) => f.aircraft_title)).size,
    flights: enrichedFlights
  };

  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`[Export] Wrote full JSON logbook (${enrichedFlights.length} flights) to: ${jsonPath}`);

  // Write CSV
  const csvHeaders = [
    'Flight #',
    'Date',
    'Time (UTC)',
    'Origin ICAO',
    'Origin Name',
    'Origin City',
    'Destination ICAO',
    'Destination Name',
    'Destination City',
    'Distance (NM)',
    'Duration (Formatted)',
    'Duration (Minutes)',
    'Duration (Hours)',
    'Aircraft Title',
    'Aircraft Model',
    'Aircraft Category'
  ];

  const csvRows = [csvHeaders.join(',')];
  for (const f of enrichedFlights) {
    const row = [
      f.flight_number,
      `"${f.date}"`,
      `"${f.time_utc}"`,
      `"${f.origin_icao}"`,
      `"${(f.origin_name || '').replace(/"/g, '""')}"`,
      `"${(f.origin_city || '').replace(/"/g, '""')}"`,
      `"${f.destination_icao}"`,
      `"${(f.destination_name || '').replace(/"/g, '""')}"`,
      `"${(f.destination_city || '').replace(/"/g, '""')}"`,
      f.distance_nm,
      `"${f.duration_formatted}"`,
      f.duration_minutes,
      f.duration_hours,
      `"${(f.aircraft_title || '').replace(/"/g, '""')}"`,
      `"${(f.aircraft_model || '').replace(/"/g, '""')}"`,
      `"${f.aircraft_type}"`
    ];
    csvRows.push(row.join(','));
  }

  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
  console.log(`[Export] Wrote clean CSV logbook (${enrichedFlights.length} flights) to: ${csvPath}`);

  return summary;
}

if (process.argv[1] && process.argv[1].endsWith('exportMsfsLogbook.js')) {
  exportMsfsLogbook()
    .then((summary) => {
      console.log('\n======================================================');
      console.log('  MSFS 2024 LOGBOOK EXPORT SUMMARY');
      console.log('======================================================');
      console.log(`  Total Flights:         ${summary.total_flights}`);
      console.log(`  Total Logged Time:     ${summary.total_duration_hours} hours`);
      console.log(`  Total Distance Flown:  ${summary.total_distance_nm.toLocaleString()} NM`);
      console.log(`  Unique Airports:       ${summary.unique_origin_airports} origin, ${summary.unique_destination_airports} dest`);
      console.log(`  Unique Aircraft Flown: ${summary.unique_aircraft}`);
      console.log('======================================================\n');
    })
    .catch((err) => {
      console.error('Export failed:', err);
      process.exit(1);
    });
}
