import './setupTestEnv.js';
import assert from 'assert';
import http from 'http';
import { io as ClientIO } from 'socket.io-client';
import { app, server } from '../src/server.js';
import Pilot from '../src/models/Pilot.js';
import Job from '../src/models/Job.js';
import Airport from '../src/models/Airport.js';
import flightStateMachine, { FLIGHT_PHASES } from '../src/services/stateMachine.js';
import simConnectBridge from '../src/services/simconnect.js';

async function runE2E() {
  console.log('--- STARTING AIRBOUND END-TO-END SUITE ---');

  // Wait for server to be listening
  if (!server.listening) {
    await new Promise((resolve) => server.once('listening', resolve));
  }

  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Testing against running server at ${baseUrl}...`);

  // Ensure mock mode is active for synthetic telemetry injection in test suite
  simConnectBridge.isMockMode = true;

  // Connect Socket.IO client
  const socket = ClientIO(baseUrl, { transports: ['websocket'] });
  const receivedPhases = [];

  await new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log('Socket.IO test client connected.');
      resolve();
    });
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('Socket connection timeout')), 4000);
  });

  socket.on('phaseChange', ({ phase }) => {
    console.log(`[Socket Received] Phase changed to: ${phase}`);
    receivedPhases.push(phase);
  });

  // 1. Fetch Pilot Profile
  const pilotRes = await fetch(`${baseUrl}/api/pilot`).then((r) => r.json());
  assert(pilotRes.pilot, 'Pilot profile should exist');
  console.log(`Pilot loaded: ${pilotRes.pilot.callsign} | Balance: $${pilotRes.pilot.balance} | ICAO: ${pilotRes.pilot.current_icao}`);

  // 2. Fetch Jobs
  const jobsRes = await fetch(`${baseUrl}/api/jobs?icao=${pilotRes.pilot.current_icao}`).then((r) => r.json());
  assert(jobsRes.jobs && jobsRes.jobs.length >= 3, 'Should return at least 3 generated jobs');
  console.log(`Fetched ${jobsRes.jobs.length} jobs around ${pilotRes.pilot.current_icao}.`);

  const jobToAccept = jobsRes.jobs[0];
  console.log(`Accepting Job: ${jobToAccept.origin_icao} -> ${jobToAccept.destination_icao} ($${jobToAccept.payout})`);

  // 3. Accept Job
  const acceptRes = await fetch(`${baseUrl}/api/jobs/${jobToAccept._id}/accept`, {
    method: 'POST'
  }).then((r) => r.json());
  assert.strictEqual(acceptRes.job.status, 'accepted');
  assert.strictEqual(flightStateMachine.phase, FLIGHT_PHASES.IDLE);

  const origAirport = await Airport.findOne({ icao: jobToAccept.origin_icao });
  const destAirport = await Airport.findOne({ icao: jobToAccept.destination_icao });
  const [oLon, oLat] = origAirport.location.coordinates;
  const [dLon, dLat] = destAirport.location.coordinates;

  // 4. Simulate Takeoff -> DEPARTED
  console.log('Stepping to DEPARTED (airborne near origin)...');
  await simConnectBridge.injectTelemetry({
    latitude: oLat + 0.005,
    longitude: oLon + 0.005,
    altitude: 600,
    simOnGround: false,
    airspeedTrue: 110,
    groundSpeed: 110,
    parkingBrake: false,
    engineRunning: true
  });
  assert.strictEqual(flightStateMachine.phase, FLIGHT_PHASES.DEPARTED);

  // 5. Climb out -> EN ROUTE
  console.log('Stepping to EN ROUTE (cruise)...');
  await simConnectBridge.injectTelemetry({
    latitude: (oLat + dLat) / 2,
    longitude: (oLon + dLon) / 2,
    altitude: 7500,
    simOnGround: false,
    airspeedTrue: 155,
    groundSpeed: 160,
    parkingBrake: false,
    engineRunning: true
  });
  assert.strictEqual(flightStateMachine.phase, FLIGHT_PHASES.EN_ROUTE);

  // 6. Approach and Touchdown -> TOUCHDOWN
  console.log('Stepping to TOUCHDOWN at destination...');
  await simConnectBridge.injectTelemetry({
    latitude: dLat + 0.005,
    longitude: dLon + 0.005,
    altitude: 150,
    simOnGround: true,
    airspeedTrue: 45,
    groundSpeed: 45,
    parkingBrake: false,
    engineRunning: true
  });
  assert.strictEqual(flightStateMachine.phase, FLIGHT_PHASES.TOUCHDOWN);

  // 7. Rollout stop & parking brake -> COMPLETED
  console.log('Stepping to COMPLETED (stopped & secured)...');
  await simConnectBridge.injectTelemetry({
    latitude: dLat,
    longitude: dLon,
    altitude: 150,
    simOnGround: true,
    airspeedTrue: 0,
    groundSpeed: 0,
    parkingBrake: true,
    engineRunning: false
  });
  assert.strictEqual(flightStateMachine.phase, FLIGHT_PHASES.COMPLETED);

  // Give persistence event a moment to finish
  await new Promise((r) => setTimeout(r, 800));

  // 8. Verify Persisted Pilot State
  const updatedPilotRes = await fetch(`${baseUrl}/api/pilot`).then((r) => r.json());
  const updatedPilot = updatedPilotRes.pilot;
  assert.strictEqual(updatedPilotRes.activeJob, null, 'Active job returned by /api/pilot must be null after completion');

  const netEarned = updatedPilot.flight_log[0]?.net_payout ?? jobToAccept.payout;
  assert.strictEqual(
    updatedPilot.balance,
    pilotRes.pilot.balance + netEarned,
    'Pilot balance should be incremented by job net payout'
  );
  assert.strictEqual(
    updatedPilot.current_icao,
    jobToAccept.destination_icao,
    'Pilot current ICAO should be destination airport'
  );
  assert(
    updatedPilot.visited_airports.includes(jobToAccept.destination_icao),
    'Visited airports should include destination'
  );
  assert(
    updatedPilot.visited_countries.includes(destAirport.country),
    'Visited countries should include destination country'
  );
  assert(updatedPilot.flight_log.length >= 1, 'Flight log should have entry');

  // 9. Verify new jobs generated at new destination airport
  const newJobsRes = await fetch(`${baseUrl}/api/jobs?icao=${updatedPilot.current_icao}`).then((r) => r.json());
  assert(newJobsRes.jobs.length >= 3, 'New jobs should be auto-generated at destination');
  assert.strictEqual(newJobsRes.jobs[0].origin_icao, jobToAccept.destination_icao);

  console.log('✅ COMPLETE END-TO-END FLOW VERIFIED SUCCESSFULLY!');
  socket.disconnect();
  server.close();
  process.exit(0);
}

runE2E().catch((err) => {
  console.error('❌ E2E Test Failed:', err);
  process.exit(1);
});

