import express from 'express';
import { getPilot, resetPilot, updateBaseAirport } from '../controllers/pilotController.js';

const router = express.Router();

router.get('/', getPilot);
router.post('/reset', resetPilot);
router.post('/base-airport', updateBaseAirport);

export default router;
