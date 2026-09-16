import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { connectDB } from './config/db.js';
import { seedAirports } from './seeds/seedAirports.js';
import Airport from './models/Airport.js';
import Job from './models/Job.js';
import Pilot from './models/Pilot.js';
import simConnectBridge from './services/simconnect.js';
import flightStateMachine from './services/stateMachine.js';

import pilotRoutes from './routes/pilot.js';
import jobsRoutes from './routes/jobs.js';
import airportsRoutes from './routes/airports.js';
import simulatorRoutes from './routes/simulator.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// REST Routes
app.use('/api/pilot', pilotRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/airports', airportsRoutes);
app.use('/api/simulator', simulatorRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    simConnectConnected: simConnectBridge.isConnected,
    isMockMode: simConnectBridge.isMockMode,
    currentPhase: flightStateMachine.phase,
    activeJob: flightStateMachine.activeJob?._id || null
  });
});

// Setup Socket.IO for real-time telemetry stream (1-2 Hz)
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  // Send immediate state to newly connected client
  socket.emit('connectionStatus', {
    connected: simConnectBridge.isConnected,
    isMock: simConnectBridge.isMockMode
  });

  socket.emit('telemetry', {
    telemetry: simConnectBridge.telemetry,
    phase: flightStateMachine.phase,
    activeJob: flightStateMachine.activeJob,
    isMock: simConnectBridge.isMockMode
  });
});

// Broadcast SimConnect connection changes
simConnectBridge.on('connectionStatus', (status) => {
  io.emit('connectionStatus', status);
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

    // Ensure database is seeded
    const airportCount = await Airport.countDocuments();
    if (airportCount === 0) {
      console.log('[Server] Database empty, seeding initial curated airports...');
      await seedAirports({ full: false, closeConnection: false });
    }

    // Resume active job if server restarted mid-flight
    const activeJob = await Job.findOne({ status: 'accepted' });
    if (activeJob) {
      console.log(`[Server] Resuming active accepted job: ${activeJob.origin_icao} -> ${activeJob.destination_icao}`);
      await flightStateMachine.setActiveJob(activeJob);
    }

    // Initialize SimConnect / Mock Bridge
    await simConnectBridge.init();

    server.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`  AIRBOUND MSFS Tracker Server running on port ${PORT}`);
      console.log(`  SimConnect Bridge: ${simConnectBridge.isMockMode ? 'MOCK TELEMETRY' : 'MSFS 2024 CONNECTED'}`);
      console.log(`  Database: ${Airport.db.name}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('[Server Error]: Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

export { app, server, io };

