import './setupTestEnv.js';
import assert from 'assert';
import request from 'http';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Pilot from '../src/models/Pilot.js';
import app from '../src/app.js';

let serverInstance = null;
let serverPort = null;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const req = request.request(
      {
        hostname: '127.0.0.1',
        port: serverPort,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
          ...(dataString ? { 'Content-Length': Buffer.byteLength(dataString) } : {})
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const parsed = raw ? JSON.parse(raw) : null;
            resolve({ status: res.statusCode, body: parsed });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('--- TESTING PILOT PASSCODE AUTHENTICATION & SECURITY GATE ---');

  await connectDB();
  await Pilot.deleteMany({});
  await Pilot.create({ callsign: 'James', current_icao: 'KLAX' });

  await new Promise((resolve) => {
    serverInstance = app.listen(0, '127.0.0.1', () => {
      serverPort = serverInstance.address().port;
      resolve();
    });
  });

  try {
    // 1. Without passcode configured (open mode)
    delete process.env.PILOT_PASSCODE;
    delete process.env.AIRBOUND_PASSCODE;

    console.log('1. Testing Open Mode (no PILOT_PASSCODE set)...');
    const statusOpen = await makeRequest('GET', '/api/auth/status');
    assert.strictEqual(statusOpen.body.authRequired, false);

    const pilotOpen = await makeRequest('GET', '/api/pilot');
    assert.strictEqual(pilotOpen.status, 200);
    console.log('✓ In open mode, endpoints are accessible freely for local dev.');

    // 2. With passcode configured
    console.log('2. Testing Protected Mode with PILOT_PASSCODE="7479"...');
    process.env.PILOT_PASSCODE = '7479';

    const statusProtected = await makeRequest('GET', '/api/auth/status');
    assert.strictEqual(statusProtected.body.authRequired, true);

    // Unauthenticated request should be blocked
    const unauthReq = await makeRequest('GET', '/api/pilot');
    assert.strictEqual(unauthReq.status, 401, 'Expected 401 Unauthorized without passcode');
    assert.strictEqual(unauthReq.body.authRequired, true);
    console.log('✓ Unauthenticated request was blocked with 401 Unauthorized.');

    // Invalid passcode should be rejected
    const verifyFail = await makeRequest('POST', '/api/auth/verify', { passcode: 'wrong123' });
    assert.strictEqual(verifyFail.status, 401);
    console.log('✓ Incorrect passcode rejected with 401.');

    // Valid passcode verification
    const verifySuccess = await makeRequest('POST', '/api/auth/verify', { passcode: '7479' });
    assert.strictEqual(verifySuccess.status, 200);
    assert.strictEqual(verifySuccess.body.success, true);
    console.log('✓ Valid passcode successfully authorized via POST /api/auth/verify.');

    // Authenticated API request with x-pilot-passcode header
    const authReq = await makeRequest('GET', '/api/pilot', null, { 'x-pilot-passcode': '7479' });
    assert.strictEqual(authReq.status, 200);
    assert.strictEqual(authReq.body.pilot.callsign, 'James');
    console.log('✓ Request with matching x-pilot-passcode header succeeded.');

    // Authenticated API request with Bearer token
    const bearerReq = await makeRequest('GET', '/api/pilot', null, { Authorization: 'Bearer 7479' });
    assert.strictEqual(bearerReq.status, 200);
    console.log('✓ Request with Authorization: Bearer <passcode> header succeeded.');

    // Public chart PDF proxy should be accessible without credentials
    const chartProxyReq = await makeRequest('GET', '/api/airports/charts/proxy?pdf=00022AD.PDF&cycle=2611');
    assert.strictEqual(chartProxyReq.status, 200, 'Expected 200 OK for public chart proxy');
    console.log('✓ Public chart PDF proxy was accessible without auth in protected mode.');

    console.log('\n✅ ALL PASSCODE AUTHENTICATION TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    delete process.env.PILOT_PASSCODE;
    if (serverInstance) serverInstance.close();
    await disconnectDB();
  }
}

runTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
