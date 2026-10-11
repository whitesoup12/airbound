import express from 'express';
import Pilot from '../models/Pilot.js';
import Job from '../models/Job.js';
import Airport from '../models/Airport.js';
import simConnectBridge from '../services/simconnect.js';
import flightStateMachine from '../services/stateMachine.js';
import { calculateDistanceNm } from '../services/geoUtils.js';

const router = express.Router();

/**
 * GET /api/telemetry
 * Returns current telemetry snapshot, flight phase, distances, and connection status.
 * Polled at 1-2 Hz by the web client when running on Vercel or when Socket.IO is absent.
 */
router.get('/', async (req, res) => {
  try {
    const pilot = await Pilot.findOne();
    const stored = pilot?.active_telemetry || {};

    // Check if the local SimConnect bridge is actively connected in this process
    const isDesktop = process.env.AIRBOUND_DESKTOP === 'true';
    const isLocalBridgeConnected = Boolean(simConnectBridge?.isConnected);

    // Check if a remote connector pushed telemetry within the last 7 seconds
    const now = Date.now();
    const lastSeenTime = stored.lastSeen ? new Date(stored.lastSeen).getTime() : 0;
    const isRemoteConnectorActive = (now - lastSeenTime) <= 7000;
    const lastSeenAgoMs = lastSeenTime > 0 ? Math.max(0, now - lastSeenTime) : null;
    const lastSeenAgoSeconds = lastSeenAgoMs !== null ? Math.round(lastSeenAgoMs / 1000) : null;

    const isConnectorActive = isDesktop || isLocalBridgeConnected || isRemoteConnectorActive;
    const isSimConnected = isLocalBridgeConnected
      ? Boolean(simConnectBridge.isConnected)
      : (isRemoteConnectorActive && (stored.simConnected !== undefined ? Boolean(stored.simConnected) : true));

    const isConnected = isLocalBridgeConnected || isRemoteConnectorActive;
    const isMock = isLocalBridgeConnected ? simConnectBridge.isMockMode : Boolean(stored.isMock);
    const app = isLocalBridgeConnected
      ? (simConnectBridge.appName || 'MSFS 2024')
      : (stored.app || (isRemoteConnectorActive ? (stored.simConnected ? 'MSFS 2024' : 'Waiting for MSFS') : 'MSFS 2024'));

    // Priority: live local bridge telemetry if connected, otherwise stored cloud telemetry
    const telemetry = isLocalBridgeConnected
      ? simConnectBridge.telemetry
      : (stored.telemetry || {
          latitude: 33.9425,
          longitude: -118.4081,
          altitude: 125,
          heading: 250,
          simOnGround: true,
          airspeedTrue: 0,
          groundSpeed: 0,
          parkingBrake: true,
          engineRunning: true,
          timestamp: now
        });

    const connectorStatus = {
      connected: isConnected,
      connectorActive: isConnectorActive,
      simConnected: isSimConnected,
      isDesktop,
      lastSeenAgoSeconds: isDesktop ? 0 : (isLocalBridgeConnected ? 0 : lastSeenAgoSeconds),
      lastSeen: stored.lastSeen || null,
      source: isDesktop ? 'desktop' : (isLocalBridgeConnected ? 'local' : (isRemoteConnectorActive ? 'remote_connector' : 'none')),
      app,
      isMock,
      simAircraftTitle: telemetry?.simAircraftTitle || stored.telemetry?.simAircraftTitle || null,
      simAircraftModel: telemetry?.simAircraftModel || stored.telemetry?.simAircraftModel || null,
      connectorVersion: stored.connectorVersion || '1.2.0'
    };

    // Active Job / Free Flight resolution
    let activeJob = flightStateMachine.activeJob;
    if (!activeJob) {
      const accepted = await Job.findOne({ status: 'accepted' }).lean();
      if (accepted) {
        const dest = await Airport.findOne({ icao: accepted.destination_icao }).lean();
        const orig = await Airport.findOne({ icao: accepted.origin_icao }).lean();
        activeJob = {
          ...accepted,
          origin_airport: orig,
          destination_airport: dest
        };
      } else if (pilot?.active_free_flight?.active) {
        const orig = await Airport.findOne({ icao: pilot.active_free_flight.origin_icao }).lean();
        const dest = pilot.active_free_flight.destination_icao
          ? await Airport.findOne({ icao: pilot.active_free_flight.destination_icao }).lean()
          : null;
        activeJob = {
          is_free_flight: true,
          origin_icao: pilot.active_free_flight.origin_icao,
          destination_icao: pilot.active_free_flight.destination_icao,
          deduct_fees: pilot.active_free_flight.deduct_fees,
          status: 'accepted',
          accepted_at: pilot.active_free_flight.created_at,
          origin_airport: orig,
          destination_airport: dest
        };
      }
    }

    // Distance calculation fallback if not already provided
    let originDist = isLocalBridgeConnected ? null : (stored.originDist ?? null);
    let destDist = isLocalBridgeConnected ? null : (stored.destDist ?? null);

    if (activeJob && telemetry?.latitude && telemetry?.longitude) {
      if (originDist == null && activeJob.origin_airport?.location?.coordinates) {
        const [oLon, oLat] = activeJob.origin_airport.location.coordinates;
        originDist = calculateDistanceNm(telemetry.latitude, telemetry.longitude, oLat, oLon);
      }
      if (destDist == null && activeJob.destination_airport?.location?.coordinates) {
        const [dLon, dLat] = activeJob.destination_airport.location.coordinates;
        destDist = calculateDistanceNm(telemetry.latitude, telemetry.longitude, dLat, dLon);
      }
    }

    const phase = isLocalBridgeConnected ? flightStateMachine.phase : (stored.phase || (activeJob ? 'IDLE' : 'STANDBY'));

    res.json({
      connected: isConnected,
      isMock,
      app,
      connectorStatus,
      telemetry,
      phase,
      activeJob,
      originDist,
      destDist,
      aircraftValidation: stored.aircraftValidation || flightStateMachine.lastAircraftValidation || null,
      flightSeconds: isLocalBridgeConnected ? Math.round(flightStateMachine.activeFlightSeconds) : (stored.flightSeconds || 0),
      airborneSeconds: isLocalBridgeConnected ? Math.round(flightStateMachine.airborneSeconds) : (stored.airborneSeconds || 0),
      isPaused: isLocalBridgeConnected ? flightStateMachine.isPaused : Boolean(stored.isPaused),
      completedFlight: stored.completedFlight || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/telemetry
 * Ingests telemetry updates from the standalone local desktop connector.
 */
router.post('/', async (req, res) => {
  try {
    const {
      callsign = 'James',
      telemetry,
      phase,
      originDist,
      destDist,
      flightSeconds,
      airborneSeconds,
      isPaused,
      isMock = false,
      app = 'MSFS 2024',
      simConnected = true,
      connectorActive = true,
      connectorVersion = '1.2.0',
      aircraftValidation = null,
      touchdownFpm = null,
      approachSpeedKts = null,
      landingRating = ''
    } = req.body;

    if (!telemetry) {
      return res.status(400).json({ error: 'Missing telemetry payload' });
    }

    const updateDoc = {
      'active_telemetry.telemetry': telemetry,
      'active_telemetry.phase': phase || 'STANDBY',
      'active_telemetry.originDist': originDist,
      'active_telemetry.destDist': destDist,
      'active_telemetry.flightSeconds': flightSeconds || 0,
      'active_telemetry.airborneSeconds': airborneSeconds || 0,
      'active_telemetry.isPaused': Boolean(isPaused),
      'active_telemetry.isMock': Boolean(isMock),
      'active_telemetry.app': app,
      'active_telemetry.simConnected': Boolean(simConnected),
      'active_telemetry.connectorActive': Boolean(connectorActive),
      'active_telemetry.connectorVersion': connectorVersion,
      'active_telemetry.aircraftValidation': aircraftValidation,
      'active_telemetry.touchdownFpm': touchdownFpm,
      'active_telemetry.approachSpeedKts': approachSpeedKts,
      'active_telemetry.landingRating': landingRating,
      'active_telemetry.connected': true,
      'active_telemetry.lastSeen': new Date()
    };

    const pilot = await Pilot.findOneAndUpdate(
      callsign ? { callsign } : {},
      { $set: updateDoc },
      { new: true, upsert: true }
    );

    res.json({ success: true, lastSeen: updateDoc['active_telemetry.lastSeen'] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/telemetry/active-flight
 * Called by the desktop connector to sync the currently active accepted contract or Free Flight session.
 */
router.get('/active-flight', async (req, res) => {
  try {
    const pilot = await Pilot.findOne();
    let activeJob = await Job.findOne({ status: 'accepted' }).lean();
    let isFreeFlight = false;

    if (!activeJob && pilot?.active_free_flight?.active) {
      isFreeFlight = true;
      activeJob = {
        is_free_flight: true,
        origin_icao: pilot.active_free_flight.origin_icao,
        destination_icao: pilot.active_free_flight.destination_icao,
        deduct_fees: pilot.active_free_flight.deduct_fees,
        status: 'accepted',
        accepted_at: pilot.active_free_flight.created_at
      };
    }

    let originAirport = null;
    let destinationAirport = null;

    if (activeJob?.origin_icao) {
      originAirport = await Airport.findOne({ icao: activeJob.origin_icao }).lean();
    }
    if (activeJob?.destination_icao) {
      destinationAirport = await Airport.findOne({ icao: activeJob.destination_icao }).lean();
    }

    res.json({
      hasActiveFlight: Boolean(activeJob),
      activeJob,
      isFreeFlight,
      originAirport,
      destinationAirport,
      activeAircraft: pilot?.active_aircraft || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/telemetry/ack-completion
 * Clears the completedFlight flag once the web UI has received and presented the flight summary banner.
 */
router.post('/ack-completion', async (req, res) => {
  try {
    await Pilot.updateOne({}, { $set: { 'active_telemetry.completedFlight': null } });
    res.json({ acknowledged: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
