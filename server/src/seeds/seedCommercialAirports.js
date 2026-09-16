import https from 'https';
import csv from 'csv-parser';
import dotenv from 'dotenv';
dotenv.config();
import { connectDB, disconnectDB } from '../config/db.js';
import Airport from '../models/Airport.js';

async function downloadCsv(url) {
  return new Promise((resolve, reject) => {
    const rows = [];
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      res.pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', () => resolve(rows))
        .on('error', reject);
    }).on('error', reject);
  });
}

export async function seedAllCommercialAirports() {
  console.log('[Seed] Connecting to MongoDB Atlas...');
  await connectDB();

  console.log('[Seed] Fetching OurAirports runways.csv...');
  const runways = await downloadCsv('https://davidmegginson.github.io/ourairports-data/runways.csv');
  console.log(`[Seed] Downloaded ${runways.length} runways.`);

  const runwayMap = new Map();
  for (const rw of runways) {
    const ident = (rw.airport_ident || '').trim().toUpperCase();
    const len = parseInt(rw.length_ft, 10);
    if (ident && !isNaN(len) && len > 0) {
      const existing = runwayMap.get(ident) || 0;
      if (len > existing) runwayMap.set(ident, len);
    }
  }

  console.log('[Seed] Fetching OurAirports airports.csv...');
  const airports = await downloadCsv('https://davidmegginson.github.io/ourairports-data/airports.csv');
  console.log(`[Seed] Downloaded ${airports.length} total airports.`);

  // Filter for large_airport, medium_airport, or any airport with scheduled service
  const targetAirports = airports.filter((a) => {
    const type = a.type;
    const isCommercial = type === 'large_airport' || type === 'medium_airport' || a.scheduled_service === 'yes';
    const icao = (a.ident || a.icao_code || '').trim().toUpperCase();
    return isCommercial && icao.length >= 3;
  });

  console.log(`[Seed] Ingesting ${targetAirports.length} commercial/medium/large airports into MongoDB Atlas...`);

  await Airport.createIndexes();

  const bulkOps = [];
  let insertedCount = 0;

  for (const a of targetAirports) {
    const icao = (a.ident || a.icao_code || '').trim().toUpperCase();
    const lat = parseFloat(a.latitude_deg);
    const lon = parseFloat(a.longitude_deg);
    if (isNaN(lat) || isNaN(lon)) continue;

    const runwayFt = runwayMap.get(icao) || (a.type === 'large_airport' ? 10000 : 5000);

    bulkOps.push({
      updateOne: {
        filter: { icao },
        update: {
          $set: {
            icao,
            name: a.name || icao,
            city: a.municipality || '',
            country: a.iso_country || 'US',
            longest_runway_ft: runwayFt,
            location: {
              type: 'Point',
              coordinates: [lon, lat]
            }
          }
        },
        upsert: true
      }
    });

    if (bulkOps.length >= 1000) {
      await Airport.bulkWrite(bulkOps);
      insertedCount += bulkOps.length;
      console.log(`[Seed] Ingested ${insertedCount} / ${targetAirports.length} airports...`);
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    await Airport.bulkWrite(bulkOps);
    insertedCount += bulkOps.length;
  }

  const totalInDb = await Airport.countDocuments();
  console.log(`[Seed] Ingestion completed! Total airports in database: ${totalInDb}`);

  // Specifically check KXNA
  const kxna = await Airport.findOne({ icao: 'KXNA' });
  if (kxna) {
    console.log(`[Seed] Verified KXNA in database: ${kxna.name} (${kxna.city}, ${kxna.country}) - Runway: ${kxna.longest_runway_ft} ft`);
  }

  await disconnectDB();
}

seedAllCommercialAirports().catch((err) => {
  console.error('[Seed Error]:', err);
  process.exit(1);
});
