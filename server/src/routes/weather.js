import express from 'express';
import { getAirportWeather, getWeatherBriefing } from '../controllers/weatherController.js';

const router = express.Router();

// GET /api/weather/briefing?origin=KLAX&dest=KDFW (placed before /:icao wildcard)
router.get('/briefing', getWeatherBriefing);

// GET /api/weather/:icao
router.get('/:icao', getAirportWeather);

export default router;
