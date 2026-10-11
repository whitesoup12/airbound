import express from 'express';

const router = express.Router();

/**
 * GET /api/auth/status
 * Informs frontend whether the backend requires a pilot passcode
 */
router.get('/status', (req, res) => {
  const configured = (process.env.PILOT_PASSCODE || process.env.AIRBOUND_PASSCODE || '').trim();
  res.json({
    authRequired: Boolean(configured.length > 0)
  });
});

/**
 * POST /api/auth/verify
 * Validates a pilot passcode entered in the browser
 */
router.post('/verify', (req, res) => {
  const configured = (process.env.PILOT_PASSCODE || process.env.AIRBOUND_PASSCODE || '').trim();
  const { passcode } = req.body || {};

  // If no passcode is configured on the server, any access is approved
  if (!configured) {
    return res.json({
      success: true,
      authRequired: false,
      message: 'No passcode configured on server'
    });
  }

  if (passcode && passcode.trim() === configured) {
    return res.json({
      success: true,
      authRequired: true,
      message: 'Pilot authorization granted'
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Invalid Pilot Passcode. Access denied.',
    authRequired: true
  });
});

export default router;
