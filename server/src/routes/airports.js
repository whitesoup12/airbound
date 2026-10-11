import express from 'express';
import {
  getAirports,
  getAirportByIcao,
  getAirportCharts,
  proxyChartPdf
} from '../controllers/airportController.js';

const router = express.Router();

router.get('/', getAirports);
router.get('/charts/proxy', proxyChartPdf);
router.get('/:icao/charts', getAirportCharts);
router.get('/:icao', getAirportByIcao);

export default router;

