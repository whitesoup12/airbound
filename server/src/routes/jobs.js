import express from 'express';
import {
  getJobs,
  generateNewJobs,
  acceptJob,
  cancelJob
} from '../controllers/jobController.js';

const router = express.Router();

router.get('/', getJobs);
router.post('/generate', generateNewJobs);
router.post('/:id/accept', acceptJob);
router.post('/:id/cancel', cancelJob);

export default router;

