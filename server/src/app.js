import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
import settingsRoutes from './routes/settings.js';
import requirePilotAuth from './middleware/auth.js';
import { proxyChartPdf } from './controllers/airportController.js';

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

// Public Auth & Public Chart Proxy Endpoints
app.use('/api/auth', authRoutes);
app.get('/api/airports/charts/proxy', proxyChartPdf);

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
app.use('/api/settings', settingsRoutes);

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

// Serve production static frontend if built (Desktop / Standalone Mode)
const possibleDistPaths = [
  process.env.AIRBOUND_CLIENT_DIST,
  process.resourcesPath ? path.resolve(process.resourcesPath, 'app', 'dist') : null,
  path.resolve(__dirname, '../../dist'),
  path.resolve(__dirname, '../../client/dist'),
  process.resourcesPath ? path.resolve(process.resourcesPath, 'app.asar.unpacked', 'dist') : null,
  process.resourcesPath ? path.resolve(process.resourcesPath, 'dist') : null,
  path.resolve(process.cwd(), 'client', 'dist'),
  path.resolve(process.cwd(), 'dist')
].filter(Boolean);

const resolvedClientDist = possibleDistPaths.find((p) => fs.existsSync(p));
console.log(`[Server] Static frontend directory: ${resolvedClientDist || 'NOT FOUND (API-only mode)'}`);

if (resolvedClientDist) {
  app.use(express.static(resolvedClientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(resolvedClientDist, 'index.html'));
  });
}

// Global Express Error Handler
app.use((err, req, res, next) => {
  console.error('[API Server Error]:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default app;
export { app };
