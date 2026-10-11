import express from 'express';
import {
  getCatalog,
  getHangar,
  buyAircraft,
  rentAircraft,
  selectActiveAircraft,
  sellAircraft,
  returnAircraft
} from '../controllers/fleetController.js';

const router = express.Router();

router.get('/catalog', getCatalog);
router.get('/hangar', getHangar);
router.post('/buy', buyAircraft);
router.post('/rent', rentAircraft);
router.post('/select', selectActiveAircraft);
router.post('/sell', sellAircraft);
router.post('/return', returnAircraft);

export default router;


