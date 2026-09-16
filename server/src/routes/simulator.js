import express from 'express';
import simConnectBridge from '../services/simconnect.js';
import flightStateMachine, { FLIGHT_PHASES } from '../services/stateMachine.js';
import Airport from '../models/Airport.js';

const router = express.Router();

/**
 * Step directly to a specified flight phase for rapid testing
 */
router.post('/step-phase', async (req, res) => {
  try {
    const { phase } = req.body;
    const activeJob = flightStateMachine.activeJob;

    if (!activeJob && phase !== FLIGHT_PHASES.STANDBY) {
      return res.status(400).json({ error: 'Cannot step flight phase without an active accepted job.' });
    }

    const orig = flightStateMachine.originAirport;
    const dest = flightStateMachine.destinationAirport;
    const [oLon, oLat] = orig?.location?.coordinates || [-118.408, 33.942];
    const [dLon, dLat] = dest?.location?.coordinates || [-115.152, 36.080];

    switch (phase) {
      case FLIGHT_PHASES.IDLE:
        await simConnectBridge.injectTelemetry({
          latitude: oLat,
          longitude: oLon,
          altitude: 125,
          simOnGround: true,
          airspeedTrue: 0,
          groundSpeed: 0,
          parkingBrake: true,
          engineRunning: true
        });
        break;

      case FLIGHT_PHASES.DEPARTED:
        // Position within 1 NM of origin, airborne
        await simConnectBridge.injectTelemetry({
          latitude: oLat + 0.01,
          longitude: oLon + 0.01,
          altitude: 800,
          simOnGround: false,
          airspeedTrue: 110,
          groundSpeed: 115,
          parkingBrake: false,
          engineRunning: true
        });
        break;

      case FLIGHT_PHASES.EN_ROUTE:
        // Midpoint airborne
        await simConnectBridge.injectTelemetry({
          latitude: (oLat + dLat) / 2,
          longitude: (oLon + dLon) / 2,
          altitude: 8500,
          simOnGround: false,
          airspeedTrue: 160,
          groundSpeed: 165,
          parkingBrake: false,
          engineRunning: true
        });
        break;

      case FLIGHT_PHASES.TOUCHDOWN:
        // Within 1 NM of destination on ground
        await simConnectBridge.injectTelemetry({
          latitude: dLat,
          longitude: dLon,
          altitude: 150,
          simOnGround: true,
          airspeedTrue: 45,
          groundSpeed: 45,
          parkingBrake: false,
          engineRunning: true
        });
        break;

      case FLIGHT_PHASES.COMPLETED:
        // Stopped and secured at destination
        await simConnectBridge.injectTelemetry({
          latitude: dLat,
          longitude: dLon,
          altitude: 150,
          simOnGround: true,
          airspeedTrue: 0,
          groundSpeed: 0,
          parkingBrake: true,
          engineRunning: false
        });
        break;
    }

    res.json({
      message: `Flight phase updated towards ${phase}`,
      currentPhase: flightStateMachine.phase,
      telemetry: simConnectBridge.telemetry
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Start automated mock flight along the route
 */
router.post('/start-mock-flight', (req, res) => {
  const { speedMultiplier = 1.0 } = req.body;
  const orig = flightStateMachine.originAirport;
  const dest = flightStateMachine.destinationAirport;

  if (!orig || !dest) {
    return res.status(400).json({ error: 'Please accept a job first to set origin and destination.' });
  }

  simConnectBridge.startAutomatedMockFlight(
    orig.location.coordinates,
    dest.location.coordinates,
    speedMultiplier
  );

  res.json({ message: 'Automated mock flight started', speedMultiplier });
});

/**
 * Stop mock flight
 */
router.post('/stop-mock-flight', (req, res) => {
  simConnectBridge.stopAutomatedMockFlight();
  res.json({ message: 'Automated mock flight stopped' });
});

/**
 * Teleport to airport
 */
router.post('/teleport', async (req, res) => {
  const { icao } = req.body;
  if (!icao) return res.status(400).json({ error: 'ICAO is required' });

  const success = await simConnectBridge.teleportToAirport(icao);
  if (success) {
    res.json({ message: `Teleported to ${icao}`, telemetry: simConnectBridge.telemetry });
  } else {
    res.status(404).json({ error: `Airport ${icao} not found` });
  }
});

export default router;

