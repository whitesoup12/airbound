/**
 * Pilot Passcode Authentication Middleware
 * If PILOT_PASSCODE (or AIRBOUND_PASSCODE) is configured on the server,
 * verifies that requests include a matching secret passcode.
 * If no passcode is set in environment variables, requests pass through freely (local dev friendly).
 */
export function requirePilotAuth(req, res, next) {
  const configuredPasscode = process.env.PILOT_PASSCODE || process.env.AIRBOUND_PASSCODE;

  // If no passcode is set on the server, open access is permitted
  if (!configuredPasscode || configuredPasscode.trim() === '') {
    return next();
  }

  // Allow public access to health check, auth verification, and chart PDF proxy
  const fullUrl = (req.originalUrl || req.url || req.path || '').toLowerCase();
  if (fullUrl.includes('/health') || fullUrl.includes('/auth') || fullUrl.includes('/charts/proxy')) {
    return next();
  }

  const incomingPasscode =
    req.headers['x-pilot-passcode'] ||
    req.headers['x-api-key'] ||
    (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].slice(7).trim() : null) ||
    req.query?.passcode;

  if (!incomingPasscode || incomingPasscode.trim() !== configuredPasscode.trim()) {
    return res.status(401).json({
      error: 'Unauthorized: Pilot passcode is required or invalid.',
      authRequired: true
    });
  }

  next();
}

export default requirePilotAuth;
