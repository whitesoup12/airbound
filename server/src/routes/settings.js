import express from 'express';
import mongoose from 'mongoose';
import { getSettings, saveSettings, normalizeMongoUri } from '../services/settingsService.js';
import { connectDB } from '../config/db.js';
import { seedAirports } from '../seeds/seedAirports.js';
import { seedAircraftCatalog } from '../seeds/seedAircraft.js';
import Airport from '../models/Airport.js';
import Pilot from '../models/Pilot.js';
import Job from '../models/Job.js';
import flightStateMachine from '../services/stateMachine.js';
import simConnectBridge from '../services/simconnect.js';
import { generateJobsForAirport } from '../services/jobGenerator.js';
import { normalizeTo4CharIcao } from '../utils/icaoUtils.js';
import {
  detectLogbookFiles,
  parseBinaryLogbook,
  importFlightsToPilot
} from '../services/msfsLogbookParser.js';
import {
  getSyncStatus,
  startAirportSync,
  airportSyncEmitter
} from '../services/airportSyncService.js';

const router = express.Router();

/**
 * Mask sensitive credentials in MongoDB connection string
 */
function maskMongoUri(uri) {
  if (!uri) return '';
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
}

/**
 * GET /api/settings
 * Returns current configuration, active database info, and detected MSFS logbooks
 */
router.get('/', async (req, res) => {
  try {
    const settings = getSettings();
    const isConnected = mongoose.connection.readyState === 1;
    const dbHost = mongoose.connection.host || '127.0.0.1';
    const dbName = mongoose.connection.name || 'airbound';
    const totalAirports = isConnected ? await Airport.countDocuments() : 0;

    const detectedLogbooks = detectLogbookFiles();

    res.json({
      settings: {
        ...settings,
        database: {
          ...settings.database,
          hostedUriMasked: maskMongoUri(settings.database?.hostedUri)
        }
      },
      liveStatus: {
        isConnected,
        currentType: settings.database?.type || 'local',
        dbHost,
        dbName,
        totalAirports,
        isEmbedded: dbHost.includes('127.0.0.1') || dbHost.includes('localhost')
      },
      detectedLogbooks,
      airportSync: getSyncStatus()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/settings/test-db
 * Tests connection to a remote MongoDB instance without modifying active app state
 */
router.post('/test-db', async (req, res) => {
  let { uri } = req.body;
  if (!uri) {
    return res.status(400).json({ error: 'MongoDB connection URI is required.' });
  }

  uri = normalizeMongoUri(uri);

  let testConnection = null;
  const startTime = Date.now();
  try {
    testConnection = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 6000
    }).asPromise();

    const latencyMs = Date.now() - startTime;
    const dbName = testConnection.name || 'airbound';
    const host = testConnection.host;

    await testConnection.close();

    res.json({
      success: true,
      latencyMs,
      dbName,
      host,
      message: `Successfully connected to cluster at ${host} (${latencyMs}ms)`
    });
  } catch (err) {
    if (testConnection) {
      try { await testConnection.close(); } catch {}
    }
    res.status(400).json({
      success: false,
      error: err.message || 'Connection test failed'
    });
  }
});

/**
 * POST /api/settings/database
 * Updates database mode (local vs hosted) and hot-swaps active connection
 */
router.post('/database', async (req, res) => {
  let { type, uri, migrateLocalData } = req.body;

  if (type !== 'local' && type !== 'hosted') {
    return res.status(400).json({ error: 'Invalid database type. Must be "local" or "hosted".' });
  }

  if (type === 'hosted') {
    if (!uri) {
      return res.status(400).json({ error: 'Hosted MongoDB connection URI is required.' });
    }
    uri = normalizeMongoUri(uri);
  }

  try {
    // Optionally grab existing local pilot data for migration if switching from local to hosted
    let localPilotData = null;
    if (type === 'hosted' && migrateLocalData) {
      const currentPilot = await Pilot.findOne().lean();
      if (currentPilot) {
        localPilotData = currentPilot;
      }
    }

    // Save settings
    const updatedSettings = saveSettings({
      database: {
        type,
        hostedUri: type === 'hosted' ? uri : (getSettings().database?.hostedUri || '')
      }
    });

    // Disconnect active connection and reconnect to the new target
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    const targetUri = type === 'hosted' ? uri : null;
    await connectDB(targetUri);

    // Ensure essential seed data exists in the target database
    const airportCount = await Airport.countDocuments();
    if (airportCount === 0) {

      console.log('[Settings] New database detected. Seeding airports and aircraft catalog...');
      await seedAirports();
      await seedAircraftCatalog();
    }

    // If migrating local pilot data to newly connected empty database
    let pilot = await Pilot.findOne();
    if (!pilot && localPilotData) {
      delete localPilotData._id;
      delete localPilotData.__v;
      pilot = new Pilot(localPilotData);
      await pilot.save();
      console.log(`[Settings] Migrated local pilot profile (${pilot.callsign}) to hosted database.`);
    } else if (!pilot) {
      pilot = new Pilot({
        callsign: 'James',
        balance: 15000,
        current_icao: 'KLAX',
        visited_airports: ['KLAX'],
        visited_countries: ['US']
      });
      await pilot.save();
    }

    res.json({
      success: true,
      message: `Active database switched to ${type === 'hosted' ? 'Hosted MongoDB' : 'Local Embedded Database'}.`,
      database: {
        type,
        hostedUriMasked: maskMongoUri(updatedSettings.database?.hostedUri)
      },
      pilot
    });
  } catch (err) {
    console.error('[Settings] Failed to switch database:', err);
    res.status(500).json({ error: `Failed to switch database: ${err.message}` });
  }
});

/**
 * GET /api/settings/msfs-logbook
 * Returns auto-detected logbooks and preview flights for the primary detected logbook
 */
router.get('/msfs-logbook', async (req, res) => {
  try {
    const customPath = req.query.path;
    const detected = detectLogbookFiles();

    let targetPath = customPath || (detected.length > 0 ? detected[0].path : null);

    let parsedFlights = [];
    let error = null;

    if (targetPath) {
      try {
        parsedFlights = parseBinaryLogbook(targetPath);
      } catch (err) {
        error = err.message;
      }
    }

    // Calculate preview summary stats
    const totalFlights = parsedFlights.length;
    const totalDurationSec = parsedFlights.reduce((acc, f) => acc + (f.duration_seconds || 0), 0);
    const uniqueAirports = new Set();
    parsedFlights.forEach((f) => {
      if (f.origin_icao && f.origin_icao !== 'ZZZZ') uniqueAirports.add(f.origin_icao);
      if (f.destination_icao && f.destination_icao !== 'ZZZZ') uniqueAirports.add(f.destination_icao);
    });

    const latestFlight = totalFlights > 0 ? parsedFlights[totalFlights - 1] : null;

    res.json({
      detected,
      targetPath,
      totalFlights,
      totalDurationHours: Math.round((totalDurationSec / 3600) * 10) / 10,
      uniqueAirportsCount: uniqueAirports.size,
      latestFlight,
      sampleFlights: parsedFlights.slice(-5).reverse(),
      error
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/settings/msfs-logbook/import
 * Imports flights from detected or custom MSFS 2024 logbook into pilot career
 */
router.post('/msfs-logbook/import', async (req, res) => {
  try {
    const { path: customPath } = req.body;
    const detected = detectLogbookFiles();
    const targetPath = customPath || (detected.length > 0 ? detected[0].path : null);

    if (!targetPath) {
      return res.status(404).json({ error: 'No MSFS 2024 logbook file detected on this system. Please specify a file path.' });
    }

    console.log(`[Settings] Importing MSFS 2024 flights from: ${targetPath}`);
    const flights = parseBinaryLogbook(targetPath);
    const result = await importFlightsToPilot(flights);

    res.json(result);
  } catch (err) {
    console.error('[Settings] Import error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/settings/complete-onboarding
 * Marks onboarding as completed in settings and optionally saves pilot callsign & home airport
 */
router.post('/complete-onboarding', async (req, res) => {
  try {
    const { callsign, homeBase, current_icao } = req.body || {};
    let pilot = await Pilot.findOne();

    if (callsign && typeof callsign === 'string' && callsign.trim()) {
      if (!pilot) {
        pilot = new Pilot({ callsign: callsign.trim() });
      } else {
        pilot.callsign = callsign.trim();
      }
    }

    const rawIcao = (homeBase || current_icao || '').toString().trim().toUpperCase();
    if (rawIcao) {
      const targetIcao = await normalizeTo4CharIcao(rawIcao);
      let airport = await Airport.findOne({ icao: targetIcao });

      if (!airport) {
        const totalAirports = await Airport.countDocuments();
        if (totalAirports === 0) {
          airport = await Airport.create({
            icao: targetIcao,
            name: `${targetIcao} Airfield`,
            type: 'medium_airport',
            country: 'US',
            runway_length_ft: 5000,
            location: { type: 'Point', coordinates: [-93.0, 36.0] }
          });
        } else {
          return res.status(404).json({
            error: `Airport '${targetIcao}' was not found in the database. Please verify the 4-letter ICAO code.`
          });
        }
      }

      if (!pilot) {
        pilot = new Pilot({
          callsign: (callsign && typeof callsign === 'string' && callsign.trim()) ? callsign.trim() : 'James',
          current_icao: targetIcao,
          visited_airports: [targetIcao],
          visited_countries: airport?.country ? [airport.country] : ['US']
        });
      } else {
        pilot.current_icao = targetIcao;
        if (!pilot.visited_airports) pilot.visited_airports = [];
        if (!pilot.visited_airports.includes(targetIcao)) {
          pilot.visited_airports.push(targetIcao);
        }
        if (airport?.country) {
          if (!pilot.visited_countries) pilot.visited_countries = [];
          if (!pilot.visited_countries.includes(airport.country)) {
            pilot.visited_countries.push(airport.country);
          }
        }
      }

      // Clear any accepted/stale jobs and regenerate for the new home airport
      const activeJob = await Job.findOne({ status: 'accepted' });
      if (activeJob) {
        await Job.findByIdAndDelete(activeJob._id);
        await flightStateMachine.clearActiveJob();
      }
      await Job.deleteMany({ status: { $in: ['completed', 'failed'] } });

      try {
        await simConnectBridge.teleportToAirport(targetIcao);
      } catch (tpErr) {
        console.warn('[Onboarding] Teleport notice:', tpErr.message);
      }

      await generateJobsForAirport(targetIcao, { aircraft: pilot.active_aircraft });
    }

    if (pilot) {
      await pilot.save();
    }

    const updated = saveSettings({ hasCompletedOnboarding: true });
    res.json({ success: true, settings: updated, pilot });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/settings/seed-airports/status
 * Returns live progress status of the airport database seeding
 */
router.get('/seed-airports/status', (req, res) => {
  res.json(getSyncStatus());
});

/**
 * POST /api/settings/seed-airports
 * Starts background sync of ~49,000 active MSFS airports
 */
router.post('/seed-airports', async (req, res) => {
  try {
    const status = await startAirportSync();
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/settings/seed-airports/stream
 * Server-Sent Events stream for real-time airport seeding progress bar updates
 */
router.get('/seed-airports/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial snapshot immediately
  res.write(`data: ${JSON.stringify(getSyncStatus())}\n\n`);

  const onProgress = (status) => {
    try {
      res.write(`data: ${JSON.stringify(status)}\n\n`);
    } catch {}
  };

  airportSyncEmitter.on('progress', onProgress);

  req.on('close', () => {
    airportSyncEmitter.off('progress', onProgress);
    res.end();
  });
});

export default router;
