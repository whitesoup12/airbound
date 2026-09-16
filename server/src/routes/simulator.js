import express from 'express';
import simConnectBridge from '../services/simconnect.js';
import flightStateMachine, { FLIGHT_PHASES } from '../services/stateMachine.js';
import Airport from '../models/Airport.js';
import Pilot from '../models/Pilot.js';
import Job from '../models/Job.js';
import { generateJobsForAirport } from '../services/jobGenerator.js';

const router = express.Router();

/**
 * Step directly to a specified flight phase for rapid testing
 */
router.post('/step-phase', async (req, res) => {
  try {
    const { phase } = req.body;
    let activeJob = flightStateMachine.activeJob;

    // If no active job is accepted yet, auto-accept a contract so the user can test immediately!
    if (!activeJob && phase !== FLIGHT_PHASES.STANDBY) {
      let pilot = await Pilot.findOne();
      const currentIcao = pilot?.current_icao || 'KLAX';

      let job = await Job.findOne({ origin_icao: currentIcao, status: 'available' });
      if (!job) {
        const generated = await generateJobsForAirport(currentIcao);
        job = generated[0];
      }

      if (job) {
        job = await Job.findById(job._id);
        job.status = 'accepted';
        job.accepted_at = new Date();
        await job.save();
        await flightStateMachine.setActiveJob(job);
        activeJob = job;
        console.log(`[Simulator] Auto-accepted contract ${job.origin_icao} -> ${job.destination_icao} for testing.`);
      } else {
        return res.status(400).json({ error: 'No contracts available to simulate. Please generate a contract first.' });
      }
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
          heading: 250,
          simOnGround: true,
          airspeedTrue: 0,
          groundSpeed: 0,
          parkingBrake: true,
          engineRunning: true
        });
        break;

      case FLIGHT_PHASES.DEPARTED:
        // Position within 1 NM of origin, airborne climbing
        await simConnectBridge.injectTelemetry({
          latitude: oLat + 0.01,
          longitude: oLon + 0.01,
          altitude: 800,
          heading: 70,
          simOnGround: false,
          airspeedTrue: 110,
          groundSpeed: 115,
          parkingBrake: false,
          engineRunning: true
        });
        break;

      case FLIGHT_PHASES.EN_ROUTE:
        // Midpoint airborne cruise
        await simConnectBridge.injectTelemetry({
          latitude: (oLat + dLat) / 2,
          longitude: (oLon + dLon) / 2,
          altitude: 8500,
          heading: 50,
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
          heading: 10,
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
          heading: 10,
          simOnGround: true,
          airspeedTrue: 0,
          groundSpeed: 0,
          parkingBrake: true,
          engineRunning: false
        });
        break;
    }

    // Force transition state machine
    await flightStateMachine.forceSetPhase(phase, simConnectBridge.telemetry);

    res.json({
      message: `Flight phase updated to ${phase}`,
      currentPhase: flightStateMachine.phase,
      activeJob: flightStateMachine.activeJob,
      telemetry: simConnectBridge.telemetry
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Start automated mock flight along the route
 */
router.post('/start-mock-flight', async (req, res) => {
  const { speedMultiplier = 1.0 } = req.body;
  let activeJob = flightStateMachine.activeJob;

  // Auto-accept if not yet accepted
  if (!activeJob) {
    let pilot = await Pilot.findOne();
    const currentIcao = pilot?.current_icao || 'KLAX';
    let job = await Job.findOne({ origin_icao: currentIcao, status: 'available' });
    if (!job) {
      const generated = await generateJobsForAirport(currentIcao);
      job = generated[0];
    }
    if (job) {
      job.status = 'accepted';
      job.accepted_at = new Date();
      await job.save();
      await flightStateMachine.setActiveJob(job);
      activeJob = job;
    } else {
      return res.status(400).json({ error: 'Please generate a job before starting auto flight.' });
    }
  }

  const orig = flightStateMachine.originAirport;
  const dest = flightStateMachine.destinationAirport;

  simConnectBridge.startAutomatedMockFlight(
    orig.location.coordinates,
    dest.location.coordinates,
    speedMultiplier
  );

  res.json({ message: 'Automated mock flight started', speedMultiplier, activeJob });
});

/**
 * Stop mock flight
 */
router.post('/stop-mock-flight', (req, res) => {
  simConnectBridge.stopAutomatedMockFlight();
  res.json({ message: 'Automated mock flight stopped' });
});

/**
 * Teleport to airport - moves aircraft position, updates base airport, and generates fresh contracts
 */
router.post('/teleport', async (req, res) => {
  try {
    const { icao } = req.body;
    if (!icao) return res.status(400).json({ error: 'ICAO is required' });

    const targetIcao = icao.trim().toUpperCase();
    const airport = await Airport.findOne({ icao: targetIcao });
    if (!airport) {
      return res.status(404).json({ error: `Airport '${targetIcao}' not found in database.` });
    }

    // Update pilot's current base location
    let pilot = await Pilot.findOne();
    if (!pilot) {
      pilot = new Pilot({ callsign: 'James' });
    }

    pilot.current_icao = targetIcao;
    if (!pilot.visited_airports.includes(targetIcao)) {
      pilot.visited_airports.push(targetIcao);
    }
    if (airport.country && !pilot.visited_countries.includes(airport.country)) {
      pilot.visited_countries.push(airport.country);
    }
    await pilot.save();

    // Clear any active job
    await Job.updateMany({ status: 'accepted' }, { status: 'failed' });
    await flightStateMachine.clearActiveJob();

    // Teleport aircraft coordinates
    await simConnectBridge.teleportToAirport(targetIcao);

    // Generate fresh jobs for new location
    const jobs = await generateJobsForAirport(targetIcao);

    res.json({
      message: `Successfully teleported to ${airport.name} (${targetIcao})`,
      pilot,
      currentAirport: airport,
      jobs,
      telemetry: simConnectBridge.telemetry
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
