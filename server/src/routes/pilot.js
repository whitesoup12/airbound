import express from 'express';
import { getPilot, resetPilot } from '../controllers/pilotController.js';

const router = express.Router();

router.get('/', getPilot);
router.post('/reset', resetPilot);

export default router;

