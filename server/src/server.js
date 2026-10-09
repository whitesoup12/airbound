import http from 'http';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app.js';
import { connectDB } from './config/db.js';
import { seedAirports } from './seeds/seedAirports.js';
import Airport from './models/Airport.js';
import Job from './models/Job.js';
import Pilot from './models/Pilot.js';
import simConnectBridge from './services/simconnect.js';
import flightStateMachine from './services/stateMachine.js';
import { seedAircraftCatalog } from './seeds/seedAircraft.js';
import { healPilotData } from './controllers/pilotController.js';
import { calculateDistanceNm } from './services/geoUtils.js';

dotenv.config();

const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Setup Socket.IO for real-time telemetry stream (1-2 Hz)
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  const isDesktop = process.env.AIRBOUND_DESKTOP === 'true';

  let initialOriginDist = null;
  let initialDestDist = null;
  if (flightStateMachine.activeJob && simConnectBridge.telemetry) {
    if (flightStateMachine.originAirport?.location?.coordinates) {
      const [oLon, oLat] = flightStateMachine.originAirport.location.coordinates;
      initialOriginDist = calculateDistanceNm(
        simConnectBridge.telemetry.latitude,
        simConnectBridge.telemetry.longitude,
        oLat,
        oLon
      );
    }
    if (flightStateMachine.destinationAirport?.location?.coordinates) {
      const [dLon, dLat] = flightStateMachine.destinationAirport.location.coordinates;
      initialDestDist = calculateDistanceNm(
        simConnectBridge.telemetry.latitude,
        simConnectBridge.telemetry.longitude,
        dLat,
        dLon
      );
    }
  }

  socket.emit('connectionStatus', {
    connected: simConnectBridge.isConnected,
    connectorActive: true,
    simConnected: simConnectBridge.isConnected,
    isDesktop,
    isMock: simConnectBridge.isMockMode,
    app: simConnectBridge.appName || 'MSFS 2024',
    source: isDesktop ? 'desktop' : 'local',
    lastSeenAgoSeconds: 0,
    simAircraftTitle: simConnectBridge.telemetry?.simAircraftTitle || null
  });

  socket.emit('telemetry', {
    telemetry: simConnectBridge.telemetry,
    phase: flightStateMachine.phase,
    activeJob: flightStateMachine.activeJob,
    originDist: initialOriginDist,
    destDist: initialDestDist,
    aircraftValidation: flightStateMachine.lastAircraftValidation || null,
    flightSeconds: Math.round(flightStateMachine.activeFlightSeconds),
    airborneSeconds: Math.round(flightStateMachine.airborneSeconds),
    isPaused: flightStateMachine.isPaused,
    isMock: simConnectBridge.isMockMode
  });
});

// Broadcast SimConnect connection changes
simConnectBridge.on('connectionStatus', (status) => {
  const isDesktop = process.env.AIRBOUND_DESKTOP === 'true';
  io.emit('connectionStatus', {
    ...status,
    connectorActive: true,
    simConnected: status.connected,
    isDesktop,
    source: isDesktop ? 'desktop' : 'local',
    lastSeenAgoSeconds: 0
  });
});

// Broadcast Telemetry updates (1-2 Hz)
simConnectBridge.on('telemetry', (data) => {
  io.emit('telemetry', {
    ...data,
    activeJob: flightStateMachine.activeJob
  });
});

// Handle State Machine phase changes and completion
flightStateMachine.setCallbacks({
  onPhaseChange: (phase, details) => {
    io.emit('phaseChange', { phase, details });
  },
  onFlightCompleted: (result) => {
    io.emit('flightCompleted', result);
  }
});

// Startup Initialization
async function startServer() {
  try {
    await connectDB();

    // Background pilot profile validation & auto-healing (runs once on startup)
    healPilotData().catch((e) => console.warn('[Server] healPilotData note:', e.message));

    // Ensure dealership catalog is seeded
    await seedAircraftCatalog();

    // Ensure database is seeded
    const airportCount = await Airport.countDocuments();
    if (airportCount === 0) {
      console.log('[Server] Database empty, seeding initial curated airports...');
      await seedAirports({ full: false, closeConnection: false });
    }

    // Resume active job if server restarted mid-flight
    // Resume active job or active free flight if server restarted mid-flight
    const activeJob = await Job.findOne({ status: 'accepted' });
    if (activeJob) {
      console.log(`[Server] Resuming active accepted job: ${activeJob.origin_icao} -> ${activeJob.destination_icao}`);
      await flightStateMachine.setActiveJob(activeJob);
    } else {
      const pilot = await Pilot.findOne();
      if (pilot?.active_free_flight?.active) {
        console.log(
          `[Server] Resuming active free flight: ${pilot.active_free_flight.origin_icao} -> ${pilot.active_free_flight.destination_icao || 'Open Roam'}`
        );
        await flightStateMachine.setActiveJob({
          is_free_flight: true,
          origin_icao: pilot.active_free_flight.origin_icao,
          destination_icao: pilot.active_free_flight.destination_icao,
          deduct_fees: pilot.active_free_flight.deduct_fees,
          status: 'accepted',
          accepted_at: pilot.active_free_flight.created_at || new Date()
        });
      }
    }

    // Initialize SimConnect / Mock Bridge
    await simConnectBridge.init();

    // Position initial mock telemetry at pilot's active location instead of defaulting to KLAX
    if (!simConnectBridge.isConnected) {
      const currentPilot = await Pilot.findOne();
      if (currentPilot && currentPilot.current_icao) {
        await simConnectBridge.teleportToAirport(currentPilot.current_icao);
        console.log(`[Server] Initial telemetry synced to pilot airfield: ${currentPilot.current_icao}`);
      }
    }

    server.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`  ✈️  AIRBOUND Desktop Server running on http://localhost:${PORT}`);
      console.log(`  SimConnect Bridge: ${simConnectBridge.isConnected ? (simConnectBridge.isMockMode ? 'MOCK TELEMETRY' : `${simConnectBridge.appName || 'MSFS 2024'} CONNECTED`) : 'SEARCHING FOR SIMULATOR'}`);
      console.log(`  Database: ${Airport.db.name}`);
      console.log(`====================================================`);

      if (process.argv.includes('--open') || process.env.AIRBOUND_AUTO_OPEN === 'true') {
        const url = `http://localhost:${PORT}`;
        const startCmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
        import('child_process').then(({ exec }) => {
          exec(startCmd);
        }).catch(() => {});
      }
    });
  } catch (err) {
    console.error('[Server Error]: Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

export { app, server, io };

