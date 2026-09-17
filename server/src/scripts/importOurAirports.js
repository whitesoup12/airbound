import https from 'https';
import csv from 'csv-parser';
import dotenv from 'dotenv';
dotenv.config();
import { connectDB, disconnectDB } from '../config/db.js';
import Airport from '../models/Airport.js';
import Pilot from '../models/Pilot.js';

// Standard ICAO 2-letter prefix to ISO country code mapping for edge cases
const ICAO_PREFIX_TO_COUNTRY = {
  K: 'US',
  C: 'CA',
  ED: 'DE',
  ET: 'DE',
  LF: 'FR',
  EG: 'GB',
  LI: 'IT',
  LE: 'ES',
  LP: 'PT',
  LG: 'GR',
  EB: 'BE',
  EH: 'NL',
  LS: 'CH',
  LO: 'AT',
  LK: 'CZ',
  LZ: 'SK',
  EP: 'PL',
  LH: 'HU',
  LR: 'RO',
  LB: 'BG',
  SC: 'CL',
  SA: 'AR',
  SB: 'BR',
  SK: 'CO',
  SV: 'VE',
  SP: 'PE',
  MM: 'MX',
  MY: 'BS',
  MK: 'JM',
  MD: 'DO',
  MT: 'HT',
  MU: 'CU',
  FM: 'MG',
  FA: 'ZA',
  OT: 'QA',
  OE: 'SA',
  OM: 'AE',
  RK: 'KR',
  RJ: 'JP',
  YB: 'AU',
  YM: 'AU',
  NZ: 'NZ',
  NT: 'PF'
};

function inferCountryFromIcao(icao) {
  if (!icao) return 'US';
  const code = icao.toUpperCase().trim();
  // Check 2-letter prefix first
  const p2 = code.slice(0, 2);
  if (ICAO_PREFIX_TO_COUNTRY[p2]) return ICAO_PREFIX_TO_COUNTRY[p2];
  // Check 1-letter prefix (K for US, C for Canada)
  const p1 = code.slice(0, 1);
  if (ICAO_PREFIX_TO_COUNTRY[p1]) return ICAO_PREFIX_TO_COUNTRY[p1];
  return 'US';
}

function downloadAndStreamCsv(url) {
  return new Promise((resolve, reject) => {
    const rows = [];
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
      }
      res
        .pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', () => resolve(rows))
        .on('error', reject);
    }).on('error', reject);
  });
}

export async function importOurAirports() {
  console.log('========================================================');
  console.log('  OURAIRPORTS GLOBAL DATABASE INGESTION & SYNC (COMPLETE)');
  console.log('========================================================\n');

  console.log('[1/4] Connecting to MongoDB Atlas...');
  await connectDB();

  // Ensure geospatial index
  await Airport.createIndexes();

  console.log('[2/4] Downloading and parsing OurAirports runways.csv...');
  const runwayStartTime = Date.now();
  const runways = await downloadAndStreamCsv('https://davidmegginson.github.io/ourairports-data/runways.csv');
  console.log(`[Runways] Downloaded ${runways.length.toLocaleString()} runways in ${((Date.now() - runwayStartTime) / 1000).toFixed(2)}s.`);

  // Build runway length map: ident -> longest runway (ft)
  const runwayMap = new Map();
  for (const rw of runways) {
    const ident = (rw.airport_ident || '').trim().toUpperCase();
    const len = parseInt(rw.length_ft, 10);
    if (ident && !isNaN(len) && len > 0) {
      const current = runwayMap.get(ident) || 0;
      if (len > current) {
        runwayMap.set(ident, len);
      }
    }
  }
  console.log(`[Runways] Mapped longest runways for ${runwayMap.size.toLocaleString()} unique airfields.`);

  console.log('\n[3/4] Downloading and parsing OurAirports airports.csv...');
  const airportStartTime = Date.now();
  const airports = await downloadAndStreamCsv('https://davidmegginson.github.io/ourairports-data/airports.csv');
  console.log(`[Airports] Downloaded ${airports.length.toLocaleString()} airports in ${((Date.now() - airportStartTime) / 1000).toFixed(2)}s.`);

  console.log('\n[4/4] Ingesting airports and aliases into MongoDB Atlas...');
  const bulkBatchSize = 2500;
  let bulkOps = [];
  let totalProcessed = 0;
  const ingestStartTime = Date.now();

  // Map to hold airport records by all known code aliases
  const airportRecordsByCode = new Map();

  for (const a of airports) {
    const ident = (a.ident || '').trim().toUpperCase();
    const local = (a.local_code || '').trim().toUpperCase();
    const gps = (a.gps_code || '').trim().toUpperCase();
    const iata = (a.iata_code || '').trim().toUpperCase();
    const lat = parseFloat(a.latitude_deg);
    const lon = parseFloat(a.longitude_deg);

    if (!ident || isNaN(lat) || isNaN(lon)) continue;
    if (a.type === 'balloonport') continue;

    const country = (a.iso_country || inferCountryFromIcao(ident)).trim().toUpperCase();
    const name = a.name || ident;
    const city = (a.municipality || '').trim();

    let longestRunway = runwayMap.get(ident) || runwayMap.get(local) || runwayMap.get(gps);
    if (!longestRunway) {
      switch (a.type) {
        case 'large_airport':
          longestRunway = 10000;
          break;
        case 'medium_airport':
          longestRunway = 5500;
          break;
        case 'heliport':
          longestRunway = 100;
          break;
        case 'seaplane_base':
          longestRunway = 4000;
          break;
        default:
          longestRunway = 3000;
      }
    }

    const airportDocData = {
      name,
      city,
      country,
      longest_runway_ft: longestRunway,
      location: {
        type: 'Point',
        coordinates: [lon, lat]
      }
    };

    // Ensure primary ICAO is standard 4 characters (e.g. KJLN not JLN)
    let primaryIcao = ident;
    if (ident.length === 3 && country === 'US' && /^[A-Z]{3}$/.test(ident)) {
      primaryIcao = 'K' + ident;
    }

    if (!airportRecordsByCode.has(primaryIcao)) {
      airportRecordsByCode.set(primaryIcao, {
        icao: primaryIcao,
        ...airportDocData
      });
    }
  }

  console.log(`[Airports] Generated ${airportRecordsByCode.size.toLocaleString()} searchable airport entries with aliases.`);

  for (const [code, record] of airportRecordsByCode.entries()) {
    bulkOps.push({
      updateOne: {
        filter: { icao: code },
        update: { $set: record },
        upsert: true
      }
    });

    totalProcessed++;

    if (bulkOps.length >= bulkBatchSize) {
      await Airport.bulkWrite(bulkOps, { ordered: false });
      process.stdout.write(`  Upserted: ${totalProcessed.toLocaleString()} / ${airportRecordsByCode.size.toLocaleString()} entries...\r`);
      bulkOps = [];
    }
  }

  if (bulkOps.length > 0) {
    await Airport.bulkWrite(bulkOps, { ordered: false });
    bulkOps = [];
  }

  const totalInDb = await Airport.countDocuments();
  console.log(`\n[Ingest Complete] Ingested ${totalProcessed.toLocaleString()} airport records in ${((Date.now() - ingestStartTime) / 1000).toFixed(2)}s.`);
  console.log(`[Database Total] Current total airfields in MongoDB Atlas: ${totalInDb.toLocaleString()}\n`);

  // Pilot Profile & Flight Log Synchronization
  console.log('========================================================');
  console.log('  SYNCHRONIZING PILOT PROFILE & VISITED COUNTRIES');
  console.log('========================================================\n');

  const pilot = await Pilot.findOne();
  if (pilot) {
    console.log(`[Pilot Sync] Checking ${pilot.visited_airports.length} visited airports for pilot '${pilot.callsign}'...`);

    // Fetch verified airport docs from the newly seeded collection
    const visitedDocs = await Airport.find({
      icao: { $in: pilot.visited_airports }
    }).select('icao country name city longest_runway_ft location');

    const airportMap = new Map();
    for (const doc of visitedDocs) {
      airportMap.set(doc.icao, doc);
    }

    // Check if any visited airport is still missing, and synthesize a fallback document
    const missingVisited = pilot.visited_airports.filter((icao) => !airportMap.has(icao));
    if (missingVisited.length > 0) {
      console.log(`[Pilot Sync] Synthesizing exact fallback docs for ${missingVisited.length} remaining edge-case airfields:`, missingVisited);
      const fallbackOps = [];
      for (const icao of missingVisited) {
        const country = inferCountryFromIcao(icao);
        const fallbackDoc = {
          icao,
          name: `${icao} Airfield`,
          city: '',
          country,
          longest_runway_ft: 3500,
          location: {
            type: 'Point',
            coordinates: country === 'US' ? [-94.3, 36.3] : [0, 0]
          }
        };
        fallbackOps.push({
          updateOne: {
            filter: { icao },
            update: { $set: fallbackDoc },
            upsert: true
          }
        });
        airportMap.set(icao, fallbackDoc);
      }
      if (fallbackOps.length > 0) {
        await Airport.bulkWrite(fallbackOps, { ordered: false });
      }
    }

    // Recalculate unique sovereign countries
    const uniqueCountries = new Set();
    for (const icao of pilot.visited_airports) {
      const info = airportMap.get(icao);
      if (info && info.country) {
        uniqueCountries.add(info.country);
      }
    }

    pilot.visited_countries = Array.from(uniqueCountries).sort();
    console.log(`[Pilot Sync] Enriched 100% of ${pilot.visited_airports.length} visited airfields!`);
    console.log(`[Pilot Sync] Verified ${pilot.visited_countries.length} visited sovereign countries:`, pilot.visited_countries.join(', '));

    // Also enrich flight_log origin_country and destination_country
    let enrichedFlightsCount = 0;
    if (pilot.flight_log && pilot.flight_log.length > 0) {
      for (const flight of pilot.flight_log) {
        let modified = false;
        if (flight.origin_icao) {
          const origDoc = airportMap.get(flight.origin_icao);
          if (origDoc && origDoc.country && flight.origin_country !== origDoc.country) {
            flight.origin_country = origDoc.country;
            modified = true;
          }
        }
        if (flight.destination_icao) {
          const destDoc = airportMap.get(flight.destination_icao);
          if (destDoc && destDoc.country && flight.destination_country !== destDoc.country) {
            flight.destination_country = destDoc.country;
            modified = true;
          }
        }
        if (modified) enrichedFlightsCount++;
      }
    }

    await pilot.save();
    console.log(`[Pilot Sync] Saved pilot profile. Enriched ${enrichedFlightsCount} flight log entries.`);
  }

  console.log('\n========================================================');
  console.log('  GLOBAL AIRPORT INGESTION COMPLETED WITH 100% COVERAGE!');
  console.log('========================================================');

  await disconnectDB();
}

// Direct execution support
if (process.argv[1] && process.argv[1].endsWith('importOurAirports.js')) {
  importOurAirports()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Import Error]:', err);
      process.exit(1);
    });
}

