import express from 'express';
import Pilot from '../models/Pilot.js';
import Job from '../models/Job.js';
import Airport from '../models/Airport.js';
import flightStateMachine from '../services/stateMachine.js';
import simConnectBridge from '../services/simconnect.js';
import { calculateDistanceNm } from '../services/geoUtils.js';

const router = express.Router();

/**
 * GET /api/free-flight/status
 * Returns current free flight status
 */
router.get('/status', async (req, res) => {
  try {
    const isFreeFlight = Boolean(flightStateMachine.activeJob?.is_free_flight);
    res.json({
      isFreeFlight,
      activeFlight: isFreeFlight ? flightStateMachine.activeJob : null,
      phase: flightStateMachine.phase
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/free-flight/start
 * Commences a Free Flight session
 */
router.post('/start', async (req, res) => {
  try {
    const { destination_icao = null, deduct_fees = false } = req.body || {};

    // Check if commercial job contract is currently in progress
    const activeContract = await Job.findOne({ status: 'accepted' });
    if (activeContract || (flightStateMachine.activeJob && !flightStateMachine.activeJob.is_free_flight)) {
      return res.status(400).json({
        error: 'An active commercial contract is already in progress. Complete or abandon it before starting Free Flight.'
      });
    }

    const pilot = await Pilot.findOne();
    if (!pilot) {
      return res.status(404).json({ error: 'Pilot profile not found' });
    }

    let originIcao = pilot.current_icao || 'KLAX';
    let originAirport = null;

    // Auto-detect departure airport from live MSFS telemetry if available
    const liveTelemetry = simConnectBridge?.telemetry;
    const hasLiveLocation = liveTelemetry?.hasValidLocation !== undefined
      ? Boolean(liveTelemetry.hasValidLocation)
      : Number.isFinite(liveTelemetry?.latitude) &&
        Number.isFinite(liveTelemetry?.longitude) &&
        !(Math.abs(liveTelemetry.latitude) < 0.05 && Math.abs(liveTelemetry.longitude) < 0.05);

    if (hasLiveLocation) {
      try {
        const nearest = await Airport.findOne({
          location: {
            $nearSphere: {
              $geometry: { type: 'Point', coordinates: [liveTelemetry.longitude, liveTelemetry.latitude] },
              $maxDistance: 35000 // 35 km (~19 NM)
            }
          }
        });
        if (nearest) {
          originAirport = nearest;
          originIcao = nearest.icao;
          console.log(`[FreeFlight] Live MSFS location auto-detected origin: ${nearest.icao} (${nearest.name})`);
        }
      } catch (err) {
        console.warn('[FreeFlight] Auto origin lookup note:', err.message);
      }
    }

    if (!originAirport) {
      originAirport = await Airport.findOne({ icao: originIcao });
    }
    let destAirport = null;

    if (destIcao) {
      destAirport = await Airport.findOne({ icao: destIcao });
      if (originAirport?.location?.coordinates && destAirport?.location?.coordinates) {
        const [oLon, oLat] = originAirport.location.coordinates;
        const [dLon, dLat] = destAirport.location.coordinates;
        distanceNm = Math.round(calculateDistanceNm(oLat, oLon, dLat, dLon) * 10) / 10;
      }
    }

    const freeFlightJob = {
      is_free_flight: true,
      origin_icao: originIcao,
      destination_icao: destIcao,
      distance_nm: distanceNm,
      payout: 0,
      cargo_lbs: 0,
      pax_count: 0,
      deduct_fees: Boolean(deduct_fees),
      status: 'accepted',
      accepted_at: new Date()
    };

    // Persist active session in pilot document for server restarts
    pilot.active_free_flight = {
      origin_icao: originIcao,
      destination_icao: destIcao,
      deduct_fees: Boolean(deduct_fees),
      departed_at: null,
      created_at: new Date(),
      active: true
    };
    await pilot.save();

    await flightStateMachine.setActiveJob(freeFlightJob);

    res.json({
      message: 'Free Flight session commenced',
      activeJob: flightStateMachine.activeJob,
      phase: flightStateMachine.phase,
      pilot
    });
  } catch (err) {
    console.error('[FreeFlight] Error starting free flight:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/free-flight/cancel
 * Cancels the active Free Flight session
 */
router.post('/cancel', async (req, res) => {
  try {
    if (flightStateMachine.activeJob?.is_free_flight) {
      await flightStateMachine.clearActiveJob();
    }

    const pilot = await Pilot.findOne();
    if (pilot) {
      pilot.active_free_flight = null;
      await pilot.save();
    }

    res.json({
      message: 'Free Flight session canceled',
      phase: flightStateMachine.phase,
      activeJob: null
    });
  } catch (err) {
    console.error('[FreeFlight] Error canceling free flight:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

