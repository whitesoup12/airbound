import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import csv from 'csv-parser';
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/db.js';
import Airport from '../models/Airport.js';
import Pilot from '../models/Pilot.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadAndParseCsv(url) {
  return new Promise((resolve, reject) => {
    const results = [];
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}, status: ${res.statusCode}`));
      }
      res
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    }).on('error', reject);
  });
}

export async function seedAirports(options = {}) {
  const { full = false, closeConnection = true } = options;
  console.log(`[Seed] Starting airport seeding (Mode: ${full ? 'Full OurAirports' : 'Curated Dataset'})...`);

  // Ensure 2dsphere index exists
  await Airport.createIndexes();

  if (full) {
    console.log('[Seed] Downloading OurAirports runways.csv...');
    const runwaysData = await downloadAndParseCsv('https://davidmegginson.github.io/ourairports-data/runways.csv');
    const runwayMap = new Map();
    for (const rw of runwaysData) {
      const ident = rw.airport_ident;
      const length = parseInt(rw.length_ft, 10);
      if (ident && !isNaN(length)) {
        const current = runwayMap.get(ident) || 0;
        if (length > current) runwayMap.set(ident, length);
      }
    }
    console.log(`[Seed] Parsed runways for ${runwayMap.size} airports.`);

    console.log('[Seed] Downloading OurAirports airports.csv...');
    const airportsData = await downloadAndParseCsv('https://davidmegginson.github.io/ourairports-data/airports.csv');
    console.log(`[Seed] Ingesting ${airportsData.length} airports from OurAirports...`);

    const bulkOps = [];
    for (const a of airportsData) {
      const icao = (a.ident || a.icao_code || '').trim().toUpperCase();
      const lat = parseFloat(a.latitude_deg);
      const lon = parseFloat(a.longitude_deg);
      if (!icao || isNaN(lat) || isNaN(lon)) continue;
      // Skip closed or heliports for realistic fixed-wing careers
      if (a.type === 'closed' || a.type === 'heliport') continue;

      const longestRunway = runwayMap.get(icao) || 3500;

      bulkOps.push({
        updateOne: {
          filter: { icao },
          update: {
            $set: {
              icao,
              name: a.name || icao,
              city: a.municipality || '',
              country: a.iso_country || '',
              longest_runway_ft: longestRunway,
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
        bulkOps.length = 0;
      }
    }
    if (bulkOps.length > 0) {
      await Airport.bulkWrite(bulkOps);
    }
  } else {
    // Seed curated set
    const curatedPath = path.join(__dirname, 'curatedAirports.json');
    const curatedData = JSON.parse(fs.readFileSync(curatedPath, 'utf8'));

    const bulkOps = curatedData.map((a) => ({
      updateOne: {
        filter: { icao: a.icao },
        update: { $set: a },
        upsert: true
      }
    }));

    await Airport.bulkWrite(bulkOps);
    console.log(`[Seed] Successfully seeded ${curatedData.length} curated airports.`);
  }

  // Ensure default pilot profile exists
  let pilot = await Pilot.findOne();
  if (!pilot) {
    pilot = await Pilot.create({
      callsign: 'James',
      balance: 15000,
      current_icao: 'KLAX',
      visited_airports: ['KLAX'],
      visited_countries: ['US'],
      flight_log: []
    });
    console.log('[Seed] Created default pilot profile at KLAX with $15,000 balance.');
  }

  const totalAirports = await Airport.countDocuments();
  console.log(`[Seed] Airport database ready with ${totalAirports} airports.`);

  if (closeConnection) {
    await disconnectDB();
  }
}

// Direct execution support
if (process.argv[1] && process.argv[1].endsWith('seedAirports.js')) {
  const isFull = process.argv.includes('--full');
  (async () => {
    try {
      await connectDB();
      await seedAirports({ full: isFull, closeConnection: true });
      process.exit(0);
    } catch (err) {
      console.error('[Seed Error]:', err);
      process.exit(1);
    }
  })();
}

