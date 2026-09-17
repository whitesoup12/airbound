import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Pilot from '../models/Pilot.js';
import Airport from '../models/Airport.js';
import { normalizeTo4CharIcao } from '../utils/icaoUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DEFAULT_JSON_PATH = path.join(__dirname, '../../../msfs2024_logbook.json');

export async function importMsfsLogbook(options = {}) {
  const {
    jsonPath = DEFAULT_JSON_PATH,
    closeConnection = true,
    mongoUri = process.env.MONGODB_URI
  } = options;

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`MSFS 2024 export JSON not found at: ${jsonPath}`);
  }

  console.log(`[Import] Reading exported MSFS 2024 flights from: ${jsonPath}`);
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const flights = rawData.flights || [];
  console.log(`[Import] Found ${flights.length} flights in export file.`);

  // Connect to database if not already connected
  if (mongoose.connection.readyState === 0) {
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable or mongoUri option is required.');
    }
    console.log('[Import] Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
  }

  let pilot = await Pilot.findOne();
  if (!pilot) {
    console.log('[Import] No pilot profile found. Creating default pilot profile...');
    pilot = new Pilot({
      callsign: 'James',
      balance: 15000,
      current_icao: 'KXNA',
      visited_airports: ['KXNA'],
      visited_countries: ['US']
    });
  }

  pilot.flight_log = pilot.flight_log || [];

  // Remove any legacy flight records prior to 2026
  const initialLogCount = pilot.flight_log.length;
  pilot.flight_log = pilot.flight_log.filter((r) => {
    if (!r.completed_at) return false;
    const year = new Date(r.completed_at).getFullYear();
    return year >= 2026;
  });
  const purgedLegacyCount = initialLogCount - pilot.flight_log.length;
  if (purgedLegacyCount > 0) {
    console.log(`[Import] Removed ${purgedLegacyCount} legacy flight log entries with dates prior to 2026.`);
  }

  // Build lookup of existing logs to ensure idempotency
  const existingFlightNumbers = new Set(
    pilot.flight_log
      .filter((r) => r.external_flight_number != null)
      .map((r) => r.external_flight_number)
  );

  const existingTimestampKeys = new Set(
    pilot.flight_log
      .filter((r) => r.completed_at)
      .map((r) => `${r.origin_icao}_${r.destination_icao}_${new Date(r.completed_at).toISOString()}`)
  );

  let newImportedCount = 0;
  let skippedCount = 0;

  // Rebuild visited locations based only on valid 2026+ flights
  const visitedAirportsSet = new Set();
  const visitedCountriesSet = new Set(['US']);
  if (pilot.current_icao) visitedAirportsSet.add(pilot.current_icao.toUpperCase());

  for (const r of pilot.flight_log) {
    if (r.origin_icao) visitedAirportsSet.add(r.origin_icao.toUpperCase());
    if (r.destination_icao) visitedAirportsSet.add(r.destination_icao.toUpperCase());
  }

  for (const f of flights) {
    const flightNumber = f.flight_number;
    const completedAt = f.timestamp ? new Date(f.timestamp) : new Date();

    // Ignore any flight records dated prior to 2026
    if (completedAt.getFullYear() < 2026) {
      skippedCount++;
      continue;
    }

    const timestampKey = `${f.origin_icao}_${f.destination_icao}_${completedAt.toISOString()}`;

    if (
      (flightNumber && existingFlightNumbers.has(flightNumber)) ||
      existingTimestampKeys.has(timestampKey)
    ) {
      skippedCount++;
      continue;
    }

    const durationSec = Math.round(f.duration_seconds || 0);
    const departedAt =
      completedAt && durationSec > 0
        ? new Date(completedAt.getTime() - durationSec * 1000)
        : completedAt;

    const origIcao = (await normalizeTo4CharIcao(f.origin_icao || 'ZZZZ')).toUpperCase();
    const destIcao = (await normalizeTo4CharIcao(f.destination_icao || 'ZZZZ')).toUpperCase();

    const logEntry = {
      origin_icao: origIcao,
      destination_icao: destIcao,
      distance_nm: parseFloat((f.distance_nm || 0).toFixed(1)),
      cargo_lbs: 0,
      pax_count: 0,
      payout: 0,
      gross_payout: 0,
      fuel_cost: 0,
      fuel_gallons: 0,
      landing_fee: 0,
      net_payout: 0,
      aircraft_name: f.aircraft_title || f.aircraft_model || 'MSFS Aircraft',
      duration_seconds: durationSec,
      departed_at: departedAt,
      completed_at: completedAt,
      source: 'msfs_import',
      is_external: true,
      external_flight_number: flightNumber
    };

    pilot.flight_log.push(logEntry);
    newImportedCount++;

    if (origIcao && origIcao !== 'ZZZZ') visitedAirportsSet.add(origIcao);
    if (destIcao && destIcao !== 'ZZZZ') visitedAirportsSet.add(destIcao);
    if (f.origin_country) visitedCountriesSet.add(f.origin_country.toUpperCase());
    if (f.destination_country) visitedCountriesSet.add(f.destination_country.toUpperCase());
  }

  // Sort logs chronologically by completed_at
  pilot.flight_log.sort((a, b) => {
    const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return dateA - dateB;
  });

  pilot.visited_airports = Array.from(visitedAirportsSet);
  pilot.visited_countries = Array.from(visitedCountriesSet);

  await pilot.save();

  console.log(`\n======================================================`);
  console.log(`  MSFS 2024 LOGBOOK IMPORT SUMMARY`);
  console.log(`======================================================`);
  console.log(`  Newly imported flights: ${newImportedCount}`);
  console.log(`  Skipped existing:       ${skippedCount}`);
  console.log(`  Total flights in log:   ${pilot.flight_log.length}`);
  console.log(`  Total unique airports:  ${pilot.visited_airports.length}`);
  console.log(`  Total unique countries: ${pilot.visited_countries.length}`);
  console.log(`======================================================\n`);

  if (closeConnection) {
    await mongoose.disconnect();
  }

  return {
    success: true,
    imported: newImportedCount,
    skipped: skippedCount,
    totalFlights: pilot.flight_log.length,
    pilot
  };
}

// CLI execution support
if (process.argv[1] && process.argv[1].endsWith('importMsfsLogbook.js')) {
  (async () => {
    try {
      await importMsfsLogbook({ closeConnection: true });
      process.exit(0);
    } catch (err) {
      console.error('[Import Error]:', err);
      process.exit(1);
    }
  })();
}

