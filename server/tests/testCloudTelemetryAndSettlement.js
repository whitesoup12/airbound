import './setupTestEnv.js';
import assert from 'assert';
import request from 'http';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Airport from '../src/models/Airport.js';
import Pilot from '../src/models/Pilot.js';
import Job from '../src/models/Job.js';
import app from '../src/app.js';

let serverInstance = null;
let serverPort = null;

function makeRequest(method, path, body = null) {
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
  console.log('--- TESTING CLOUD TELEMETRY REST API & SETTLEMENT ENGINE ---');

  await connectDB();
  await Pilot.deleteMany({});
  await Job.deleteMany({});
  await Airport.deleteMany({});

  // Seed origin and destination airports
  const klax = await Airport.create({
    icao: 'KLAX',
    name: 'Los Angeles International Airport',
    city: 'Los Angeles',
    country: 'US',
    longest_runway_ft: 12000,
    location: { type: 'Point', coordinates: [-118.408, 33.942] }
  });

  const klas = await Airport.create({
    icao: 'KLAS',
    name: 'Harry Reid International Airport',
    city: 'Las Vegas',
    country: 'US',
    longest_runway_ft: 14500,
    location: { type: 'Point', coordinates: [-115.152, 36.080] }
  });

  // Create pilot profile
  const pilot = await Pilot.create({
    callsign: 'James',
    balance: 15000,
    current_icao: 'KLAX',
    visited_airports: ['KLAX'],
    visited_countries: ['US'],
    xp: 0,
    level: 1,
    rank_title: 'Junior Aviator',
    active_aircraft: {
      name: 'Cessna 172 Skyhawk',
      model_id: 'c172',
      tail_number: 'N172AB',
      category: 'single_prop',
      fuel_burn_gph: 9.0,
      fuel_type: '100LL'
    }
  });

  // Start temporary test HTTP server using Express app
  await new Promise((resolve) => {
    serverInstance = app.listen(0, '127.0.0.1', () => {
      serverPort = serverInstance.address().port;
      resolve();
    });
  });

  try {
    // 1. Test POST /api/telemetry (Connector push)
    console.log('1. Testing telemetry ingestion via POST /api/telemetry...');
    const pushRes = await makeRequest('POST', '/api/telemetry', {
      callsign: 'James',
      telemetry: {
        latitude: 33.942,
        longitude: -118.408,
        altitude: 125,
        heading: 250,
        simOnGround: true,
        airspeedTrue: 0,
        groundSpeed: 0,
        parkingBrake: true,
        engineRunning: true,
        verticalSpeed: 0
      },
      phase: 'IDLE',
      originDist: 0.1,
      destDist: 205.2,
      flightSeconds: 0,
      airborneSeconds: 0,
      app: 'MSFS 2024'
    });

    assert.strictEqual(pushRes.status, 200, 'Expected HTTP 200 on telemetry push');
    assert.strictEqual(pushRes.body.success, true);
    console.log('✓ Successfully ingested telemetry snapshot from connector.');

    // 2. Test GET /api/telemetry (Web client poll)
    console.log('2. Testing client polling via GET /api/telemetry...');
    const getRes = await makeRequest('GET', '/api/telemetry');
    assert.strictEqual(getRes.status, 200, 'Expected HTTP 200 on telemetry get');
    assert.strictEqual(getRes.body.connected, true, 'Telemetry should report connected');
    assert.strictEqual(getRes.body.connectorStatus.connectorActive, true, 'Connector should report active');
    assert.strictEqual(getRes.body.connectorStatus.simConnected, true, 'SimConnect should report connected');
    assert.strictEqual(getRes.body.connectorStatus.source, 'remote_connector');
    assert.strictEqual(getRes.body.phase, 'IDLE');
    assert.strictEqual(getRes.body.telemetry.altitude, 125);
    console.log('✓ Client poll returned active telemetry and rich connector status.');

    // 3. Test GET /api/telemetry/active-flight with an accepted contract
    console.log('3. Testing active flight sync via GET /api/telemetry/active-flight...');
    const job = await Job.create({
      origin_icao: 'KLAX',
      destination_icao: 'KLAS',
      distance_nm: 205,
      cargo_lbs: 250,
      pax_count: 0,
      payout: 3500,
      status: 'accepted',
      accepted_at: new Date()
    });

    const activeFlightRes = await makeRequest('GET', '/api/telemetry/active-flight');
    assert.strictEqual(activeFlightRes.status, 200);
    assert.strictEqual(activeFlightRes.body.hasActiveFlight, true);
    assert.strictEqual(activeFlightRes.body.activeJob.destination_icao, 'KLAS');
    assert.strictEqual(activeFlightRes.body.destinationAirport.name, 'Harry Reid International Airport');
    console.log('✓ Connector active flight sync correctly resolved origin and destination airports.');

    // 4. Test POST /api/flight/complete (Settling completed flight)
    console.log('4. Testing cloud flight completion via POST /api/flight/complete...');
    const completeRes = await makeRequest('POST', '/api/flight/complete', {
      job,
      telemetry: {
        latitude: 36.080,
        longitude: -115.152,
        altitude: 2181,
        heading: 10,
        simOnGround: true,
        groundSpeed: 0,
        parkingBrake: true,
        engineRunning: false
      },
      touchdownFpm: -130, // Butter landing
      approachSpeedKts: 65,
      flightSeconds: 4200, // 1.16 hours
      airborneSeconds: 3900,
      departedAt: new Date(Date.now() - 4200000).toISOString(),
      touchdownAt: new Date().toISOString()
    });

    assert.strictEqual(completeRes.status, 200, 'Expected HTTP 200 on flight complete');
    assert.strictEqual(completeRes.body.success, true);
    const flightResult = completeRes.body.flight;
    assert.ok(flightResult.payout > 3000, `Expected positive payout, got ${flightResult.payout}`);
    assert.strictEqual(flightResult.newIcao, 'KLAS');
    assert.strictEqual(flightResult.touchdownFpm, -130);
    assert.ok(flightResult.flightXp.totalXp > 0, 'Expected XP awarded');
    console.log(`✓ Flight settled: Payout $${flightResult.payout}, XP +${flightResult.flightXp.totalXp} (${flightResult.landingRating})`);

    // Verify pilot database state after completion
    const updatedPilot = await Pilot.findOne();
    assert.strictEqual(updatedPilot.current_icao, 'KLAS', 'Pilot current airfield should update to destination');
    assert.ok(updatedPilot.visited_airports.includes('KLAS'), 'KLAS should be in visited airports');
    assert.ok(updatedPilot.flight_log.length === 1, 'Flight log should record 1 flight');
    assert.strictEqual(updatedPilot.flight_log[0].destination_icao, 'KLAS');
    assert.ok(updatedPilot.balance > 15000, 'Balance should increase');

    // 5. Test completion acknowledgment via POST /api/telemetry/ack-completion
    console.log('5. Testing completion acknowledgment via POST /api/telemetry/ack-completion...');
    const polledBeforeAck = await makeRequest('GET', '/api/telemetry');
    assert.ok(polledBeforeAck.body.completedFlight != null, 'completedFlight should be present before ack');

    const ackRes = await makeRequest('POST', '/api/telemetry/ack-completion');
    assert.strictEqual(ackRes.status, 200);
    assert.strictEqual(ackRes.body.acknowledged, true);

    const polledAfterAck = await makeRequest('GET', '/api/telemetry');
    assert.strictEqual(polledAfterAck.body.completedFlight, null, 'completedFlight should be cleared after ack');
    console.log('✓ Completion banner acknowledgment successfully cleared modal state.');

    console.log('\n✅ ALL CLOUD TELEMETRY & SETTLEMENT TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
    await disconnectDB();
  }
}

runTests().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
