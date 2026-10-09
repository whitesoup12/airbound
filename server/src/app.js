import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';

import pilotRoutes from './routes/pilot.js';
import jobsRoutes from './routes/jobs.js';
import airportsRoutes from './routes/airports.js';
import simulatorRoutes from './routes/simulator.js';
import fleetRoutes from './routes/fleet.js';
import freeFlightRoutes from './routes/freeFlight.js';
import telemetryRoutes from './routes/telemetry.js';
import flightRoutes from './routes/flight.js';
import weatherRoutes from './routes/weather.js';
import authRoutes from './routes/auth.js';
import requirePilotAuth from './middleware/auth.js';

import simConnectBridge from './services/simconnect.js';
import flightStateMachine from './services/stateMachine.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Ensure MongoDB is connected on each incoming request (auto-connects or reuses pool)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('[API Database Connection Error]:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Database connection failed', details: err.message });
    }
  }
});

// Public Auth Endpoints
app.use('/api/auth', authRoutes);

// Protect all remaining /api/* routes with Pilot Passcode Authentication
app.use('/api', requirePilotAuth);

// Mount API REST Routes
app.use('/api/pilot', pilotRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/airports', airportsRoutes);
app.use('/api/simulator', simulatorRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/free-flight', freeFlightRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/flight', flightRoutes);
app.use('/api/weather', weatherRoutes);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    simConnectConnected: simConnectBridge?.isConnected || false,
    isMockMode: simConnectBridge?.isMockMode || false,
    app: simConnectBridge?.appName || 'MSFS 2024',
    currentPhase: flightStateMachine?.phase || 'STANDBY',
    activeJob: flightStateMachine?.activeJob?._id || null,
    mongooseState: mongoose.connection?.readyState,
    dbName: mongoose.connection?.name || null
  });
});

// 404 Fallback for unknown API routes (guarantees valid JSON response)
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.originalUrl} not found` });
});

// Global Express Error Handler
app.use((err, req, res, next) => {
  console.error('[API Server Error]:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default app;
export { app };
