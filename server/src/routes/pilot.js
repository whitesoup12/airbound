import express from 'express';
import { getPilot, resetPilot, updateBaseAirport, importMsfsLogs } from '../controllers/pilotController.js';

const router = express.Router();

router.get('/', getPilot);
router.post('/reset', resetPilot);
router.post('/base-airport', updateBaseAirport);
router.post('/import-msfs', importMsfsLogs);

export default router;
