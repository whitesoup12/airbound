import express from 'express';
import {
  getPilot,
  resetPilot,
  updateBaseAirport,
  importMsfsLogs,
  updatePilotProfile
} from '../controllers/pilotController.js';

const router = express.Router();

router.get('/', getPilot);
router.post('/reset', resetPilot);
router.post('/base-airport', updateBaseAirport);
router.post('/import-msfs', importMsfsLogs);
router.post('/profile', updatePilotProfile);
router.put('/profile', updatePilotProfile);

export default router;
