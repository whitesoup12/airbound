import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Airport from '../models/Airport.js';
import Pilot from '../models/Pilot.js';
import Job from '../models/Job.js';
import { generateJobsForAirport } from '../services/jobGenerator.js';
import { normalizeTo4CharIcao } from '../utils/icaoUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

export async function cleanupDuplicateIcaos() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is required.');
  }

  console.log('[Cleanup] Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri);

  try {
    // 1. Find all 3-character airport records
    console.log('[Cleanup] Scanning for 3-character alias airport records...');
    const threeCharAirports = await Airport.find({
      icao: { $regex: '^[A-Z0-9]{3}$' }
    });
    console.log(`[Cleanup] Found ${threeCharAirports.length} total 3-character airport records in database.`);

    // Find which ones have a corresponding 'K' + code in the database
    const potentialKCodes = threeCharAirports.map((a) => 'K' + a.icao);
    const existingKAirports = await Airport.find({
      icao: { $in: potentialKCodes }
    }).select('icao');

    const existingKSet = new Set(existingKAirports.map((a) => a.icao));
    const idsToDelete = [];
    for (const ap of threeCharAirports) {
      if (existingKSet.has('K' + ap.icao)) {
        idsToDelete.push(ap._id);
      }
    }

    console.log(`[Cleanup] Identified ${idsToDelete.length} duplicate 3-character airport records with valid 4-character K-counterparts.`);
    if (idsToDelete.length > 0) {
      const deleteResult = await Airport.deleteMany({ _id: { $in: idsToDelete } });
      console.log(`[Cleanup] Successfully removed ${deleteResult.deletedCount} duplicate 3-character airport records from Atlas.`);
    }

    // 2. Fix Pilot profile
    const pilot = await Pilot.findOne();
    if (pilot) {
      console.log(`[Cleanup] Current pilot: ${pilot.callsign}, current_icao: '${pilot.current_icao}'`);
      let pilotModified = false;

      // Fix current_icao
      if (pilot.current_icao && pilot.current_icao.length === 3) {
        const normalized = await normalizeTo4CharIcao(pilot.current_icao);
        console.log(`[Cleanup] Normalizing pilot current_icao from '${pilot.current_icao}' to '${normalized}'`);
        pilot.current_icao = normalized;
        pilotModified = true;
      }

      // Fix visited_airports
      if (pilot.visited_airports && pilot.visited_airports.length > 0) {
        const newVisited = [];
        const seen = new Set();
        for (const code of pilot.visited_airports) {
          const norm = await normalizeTo4CharIcao(code);
          if (!seen.has(norm)) {
            seen.add(norm);
            newVisited.push(norm);
          }
        }
        if (newVisited.length !== pilot.visited_airports.length || newVisited.some((c, i) => c !== pilot.visited_airports[i])) {
          console.log(`[Cleanup] Normalized visited_airports: [${pilot.visited_airports.join(', ')}] -> [${newVisited.join(', ')}]`);
          pilot.visited_airports = newVisited;
          pilotModified = true;
        }
      }

      // Fix flight_log
      if (pilot.flight_log && pilot.flight_log.length > 0) {
        let logFixed = 0;
        for (const log of pilot.flight_log) {
          if (log.origin_icao && log.origin_icao.length === 3) {
            log.origin_icao = await normalizeTo4CharIcao(log.origin_icao);
            logFixed++;
          }
          if (log.destination_icao && log.destination_icao.length === 3) {
            log.destination_icao = await normalizeTo4CharIcao(log.destination_icao);
            logFixed++;
          }
        }
        if (logFixed > 0) {
          console.log(`[Cleanup] Normalized ${logFixed} ICAO codes inside pilot flight_log entries.`);
          pilotModified = true;
        }
      }

      if (pilotModified) {
        await pilot.save();
        console.log('[Cleanup] Pilot profile saved with normalized 4-character ICAOs.');
      }
    }

    // 3. Clean up stale jobs with 3-character codes
    console.log('[Cleanup] Cleaning up stale available jobs with 3-character codes...');
    const staleJobsResult = await Job.deleteMany({
      status: 'available',
      $or: [
        { origin_icao: { $regex: '^[A-Z0-9]{1,3}$' } },
        { destination_icao: { $regex: '^[A-Z0-9]{1,3}$' } }
      ]
    });
    console.log(`[Cleanup] Deleted ${staleJobsResult.deletedCount} stale jobs with non-4-character codes.`);

    // 4. Regenerate fresh 4-character jobs for the pilot's station
    if (pilot && pilot.current_icao) {
      console.log(`[Cleanup] Regenerating fresh jobs for pilot base: ${pilot.current_icao}...`);
      const newJobs = await generateJobsForAirport(pilot.current_icao, {
        aircraft: pilot.active_aircraft,
        visitedAirports: pilot.visited_airports
      });
      console.log(`[Cleanup] Successfully generated ${newJobs.length} fresh jobs for ${pilot.current_icao}.`);
      console.log('[Cleanup] New jobs sample:', newJobs.map(j => `${j.origin_icao} -> ${j.destination_icao} (${j.destination_name || 'N/A'}, ${j.tier}, unvisited: ${j.is_unvisited})`));
    }

    console.log('[Cleanup] All cleanup tasks finished successfully!');
  } finally {
    await mongoose.disconnect();
    console.log('[Cleanup] Disconnected from MongoDB Atlas.');
  }
}

// Run directly if invoked from command line
if (process.argv[1] && process.argv[1].endsWith('cleanupDuplicateIcaos.js')) {
  cleanupDuplicateIcaos()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Cleanup Error]', err);
      process.exit(1);
    });
}

