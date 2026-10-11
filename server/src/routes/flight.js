import express from 'express';
import { settleCompletedFlight } from '../services/flightSettlement.js';
import flightStateMachine from '../services/stateMachine.js';

const router = express.Router();

/**
 * POST /api/flight/complete
 * Settle a completed flight, compute payout, fuel, landing fee, and XP, and persist to pilot logbook.
 * Can be called by:
 *  1. Remote local connector upon landing & parking
 *  2. Simulator UI test controls
 */
router.post('/complete', async (req, res) => {
  try {
    const {
      job = null,
      telemetry = {},
      touchdownFpm = null,
      approachSpeedKts = null,
      flightSeconds = 0,
      airborneSeconds = 0,
      departedAt = null,
      touchdownAt = null
    } = req.body || {};

    const completedResult = await settleCompletedFlight({
      job: job || flightStateMachine.activeJob,
      telemetry,
      touchdownFpm,
      approachSpeedKts,
      flightSeconds,
      airborneSeconds,
      departedAt,
      touchdownAt
    });

    // If local state machine is active, reset its internal active flight pointer
    if (flightStateMachine.activeJob) {
      flightStateMachine.activeJob = null;
      flightStateMachine.originAirport = null;
      flightStateMachine.destinationAirport = null;
      flightStateMachine.phase = 'STANDBY';
    }

    res.json({
      success: true,
      message: 'Flight successfully settled and saved to pilot logbook.',
      flight: completedResult
    });
  } catch (err) {
    console.error('[Flight Completion Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
