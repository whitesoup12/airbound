import express from 'express';
import { getAirports, getAirportByIcao } from '../controllers/airportController.js';

const router = express.Router();

router.get('/', getAirports);
router.get('/:icao', getAirportByIcao);

export default router;

