import './setupTestEnv.js';
import assert from 'assert';
import request from 'http';
import { connectTestDB, disconnectDB } from '../src/config/db.js';
import Airport from '../src/models/Airport.js';
import Pilot from '../src/models/Pilot.js';
import { seedAirports } from '../src/seeds/seedAirports.js';
import { FlightStateMachine, FLIGHT_PHASES } from '../src/services/stateMachine.js';
import app from '../src/app.js';

async function testFreeFlight() {
  console.log('--- TESTING AIRBOUND FREE FLIGHT DISPATCH & EXECUTION ---');

  await connectTestDB();
  await Airport.deleteMany({});
  await Pilot.deleteMany({});

  await seedAirports({ full: false, closeConnection: false });

  // 1. Verify Free Flight Setup (Open Roam mode)
  console.log('1. Testing Open Roam Free Flight Initialization...');
  const pilot = await Pilot.findOne();
  pilot.balance = 20000;
  pilot.current_icao = 'KLAX';
  pilot.active_free_flight = {
    origin_icao: 'KLAX',
    destination_icao: null,
    deduct_fees: true,
    departed_at: new Date(),
    active: true
  };
  await pilot.save();

  const sm = new FlightStateMachine();
  await sm.setActiveJob({
    is_free_flight: true,
    origin_icao: 'KLAX',
    destination_icao: null,
    deduct_fees: true
  });

  assert.strictEqual(sm.phase, FLIGHT_PHASES.IDLE);
  assert.strictEqual(sm.activeJob.is_free_flight, true);
  assert.strictEqual(sm.activeJob.destination_icao, null);
  console.log('✓ Open Roam Free Flight session initialized in IDLE phase.');

  // 1b. Test IDLE Origin Auto-Detection (spawning at a different airport, e.g. KSAN)
  console.log('1b. Testing Free Flight Origin Auto-Detection on Ground in IDLE...');
  // Aircraft spawns on the ground at San Diego Intl (KSAN: 32.7338, -117.1933) while origin was set to KLAX
  await sm.processTelemetry({
    simAircraftTitle: 'Cessna 172 Skyhawk',
    simOnGround: true,
    latitude: 32.7338,
    longitude: -117.1933,
    altitude: 17,
    heading: 275,
    groundSpeed: 0,
    airspeedTrue: 0,
    parkingBrake: true,
    engineRunning: true
  });
  assert.strictEqual(sm.activeJob.origin_icao, 'KSAN', 'Origin airport should auto-update to KSAN when spawned there');
  console.log('✓ Flight Deck origin auto-detected KSAN while sitting on ground in IDLE.');

  // Reset plane back to KLAX for the rest of the flight test
  await sm.processTelemetry({
    simAircraftTitle: 'Boeing 787-10 Airbound Heavy',
    simOnGround: true,
    latitude: 33.9425,
    longitude: -118.4081,
    altitude: 125,
    heading: 250,
    groundSpeed: 0,
    airspeedTrue: 0,
    parkingBrake: true,
    engineRunning: true
  });
  assert.strictEqual(sm.activeJob.origin_icao, 'KLAX');

  // 2. Airframe Mismatch Bypass Test
  console.log('2. Testing Airframe Mismatch Bypass in Free Flight...');
  // Feed telemetry with completely unmatching aircraft: Boeing 787-10 Dreamliner
  const now = Date.now();
  await sm.processTelemetry({
    simAircraftTitle: 'Boeing 787-10 Airbound Heavy',
    simOnGround: true,
    latitude: 33.9425,
    longitude: -118.4081,
    altitude: 125,
    heading: 250,
    groundSpeed: 0,
    airspeedTrue: 0,
    parkingBrake: false,
    engineRunning: true
  });

  assert.strictEqual(sm.lastAircraftValidation.matches, true, 'Free Flight must bypass airframe restrictions');
  console.log('✓ Any simulator aircraft permitted in Free Flight mode without gating.');

  // 3. Takeoff & Climbout to DEPARTED and EN ROUTE
  console.log('3. Testing Free Flight Takeoff & Open Roam Cruise...');
  // Wheels up
  await sm.processTelemetry({
    simAircraftTitle: 'Boeing 787-10 Airbound Heavy',
    simOnGround: false,
    latitude: 33.9450,
    longitude: -118.4150,
    altitude: 400,
    altAboveGround: 275,
    heading: 250,
    groundSpeed: 160,
    airspeedTrue: 160,
    parkingBrake: false,
    engineRunning: true
  });
  assert.strictEqual(sm.phase, FLIGHT_PHASES.DEPARTED);

  // Climb out past 3 NM
  await sm.processTelemetry({
    simAircraftTitle: 'Boeing 787-10 Airbound Heavy',
    simOnGround: false,
    latitude: 33.9500,
    longitude: -118.4800,
    altitude: 3500,
    altAboveGround: 3375,
    heading: 260,
    groundSpeed: 280,
    airspeedTrue: 280,
    parkingBrake: false,
    engineRunning: true
  });
  assert.strictEqual(sm.phase, FLIGHT_PHASES.EN_ROUTE);
  console.log('✓ Clean climb-out into EN ROUTE without predefined destination.');

  // 4. Touchdown & Dynamic Arrival Airfield Detection
  console.log('4. Testing Open Roam Landing at Ontario International (KONT)...');
  // KONT coordinates: (34.0560, -117.6012)
  sm.activeFlightSeconds = 600; // 10 minutes simulated
  sm.airborneSeconds = 600; // 10 minutes simulated
  sm.airborneSamples = [
    { time: Date.now() - 1000, vs: -180, tas: 130, gs: 130 },
    { time: Date.now() - 500, vs: -150, tas: 125, gs: 125 }
  ];

  await sm.processTelemetry({
    simAircraftTitle: 'Boeing 787-10 Airbound Heavy',
    simOnGround: true,
    latitude: 34.0560,
    longitude: -117.6012,
    altitude: 944,
    altAboveGround: 0,
    heading: 80,
    groundSpeed: 110,
    airspeedTrue: 110,
    verticalSpeed: -140,
    parkingBrake: false,
    engineRunning: true
  });

  assert.strictEqual(sm.phase, FLIGHT_PHASES.TOUCHDOWN);
  assert.strictEqual(sm.activeJob.destination_icao, 'KONT', 'Should auto-detect KONT as nearest touchdown airfield');
  console.log('✓ Dynamic landing airfield auto-detected nearest airport: KONT');

  // 5. Engine Shutdown & Flight Logging Persistence
  console.log('5. Testing Flight Completion & Fee Deductions...');
  const balanceBefore = (await Pilot.findOne()).balance;

  await sm.processTelemetry({
    simAircraftTitle: 'Boeing 787-10 Airbound Heavy',
    simOnGround: true,
    latitude: 34.0560,
    longitude: -117.6012,
    altitude: 944,
    altAboveGround: 0,
    heading: 80,
    groundSpeed: 0,
    airspeedTrue: 0,
    verticalSpeed: 0,
    parkingBrake: true,
    engineRunning: false
  });

  assert.strictEqual(sm.phase, FLIGHT_PHASES.COMPLETED);

  const updatedPilot = await Pilot.findOne();
  assert.strictEqual(updatedPilot.current_icao, 'KONT', 'Pilot current ICAO should update to KONT');
  assert(updatedPilot.visited_airports.includes('KONT'), 'KONT should be marked visited');
  assert(!updatedPilot.active_free_flight || !updatedPilot.active_free_flight.active, 'active_free_flight should be cleared');

  // Verify flight log entry
  const lastFlight = updatedPilot.flight_log[updatedPilot.flight_log.length - 1];
  assert.strictEqual(lastFlight.source, 'free_flight');
  assert.strictEqual(lastFlight.origin_icao, 'KLAX');
  assert.strictEqual(lastFlight.destination_icao, 'KONT');
  assert.strictEqual(lastFlight.aircraft_name, 'Boeing 787-10 Airbound Heavy');
  assert(lastFlight.fuel_cost > 0, 'Realistic fuel expense should be charged');
  assert(lastFlight.landing_fee > 0, 'Landing fee should be charged');
  assert(updatedPilot.balance < balanceBefore, 'Pilot wallet should be deducted for realistic operating fees');

  console.log(`✓ Free Flight logged with source: 'free_flight', fuel: $${lastFlight.fuel_cost}, landing fee: $${lastFlight.landing_fee}`);
  console.log(`✓ Pilot balance settled from $${balanceBefore} to $${updatedPilot.balance}`);

  // 6. Test Casual / $0 Fee Mode
  console.log('6. Testing Casual Mode ($0 fee waiver)...');
  const smCasual = new FlightStateMachine();
  await smCasual.setActiveJob({
    is_free_flight: true,
    origin_icao: 'KONT',
    destination_icao: 'KPSP',
    deduct_fees: false // Casual mode
  });

  smCasual.phase = FLIGHT_PHASES.EN_ROUTE;
  smCasual.airborneSeconds = 300;
  smCasual.touchdownAt = new Date();
  smCasual.departedAt = new Date(Date.now() - 300000);

  // Complete flight
  await smCasual._handleFlightCompleted({
    simAircraftTitle: 'Extra 330LT Aerobatics',
    groundSpeed: 0
  });

  const pilotCasual = await Pilot.findOne();
  const casualFlight = pilotCasual.flight_log[pilotCasual.flight_log.length - 1];
  assert.strictEqual(casualFlight.source, 'free_flight');
  assert.strictEqual(casualFlight.fuel_cost, 0);
  assert.strictEqual(casualFlight.landing_fee, 0);
  assert.strictEqual(casualFlight.net_payout, 0);
  console.log('✓ Casual Mode verified: $0 fuel, $0 landing fees, $0 wallet deduction.');

  // 7. Test REST API Endpoints (/api/free-flight/start, status, cancel)
  console.log('7. Testing Free Flight REST API endpoints...');
  let serverInstance = null;
  let serverPort = null;
  const makeRequest = (method, path, body = null) => {
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
  };

  await new Promise((resolve) => {
    serverInstance = app.listen(0, '127.0.0.1', () => {
      serverPort = serverInstance.address().port;
      resolve();
    });
  });

  try {
    // 7a. Start Open Roam flight (destination_icao = null)
    const openRoamRes = await makeRequest('POST', '/api/free-flight/start', {
      destination_icao: null,
      deduct_fees: false
    });
    assert.strictEqual(openRoamRes.status, 200, `Expected 200 from free-flight start, got: ${JSON.stringify(openRoamRes.body)}`);
    assert.strictEqual(openRoamRes.body.activeJob.is_free_flight, true);
    assert.strictEqual(openRoamRes.body.activeJob.destination_icao, null);
    assert.strictEqual(openRoamRes.body.activeJob.distance_nm, 0);
    console.log('✓ POST /api/free-flight/start with null destination succeeded without destIcao error.');

    // 7b. Check status
    const statusRes = await makeRequest('GET', '/api/free-flight/status');
    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusRes.body.isFreeFlight, true);
    console.log('✓ GET /api/free-flight/status reported active free flight.');

    // 7c. Cancel flight
    const cancelRes = await makeRequest('POST', '/api/free-flight/cancel');
    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.body.activeJob, null);
    console.log('✓ POST /api/free-flight/cancel cleared active free flight.');

    // 7d. Start destination-specified free flight (destination_icao = 'KSFO')
    const destRes = await makeRequest('POST', '/api/free-flight/start', {
      destination_icao: 'KSFO',
      deduct_fees: true
    });
    assert.strictEqual(destRes.status, 200, `Expected 200, got: ${JSON.stringify(destRes.body)}`);
    assert.strictEqual(destRes.body.activeJob.destination_icao, 'KSFO');
    assert(destRes.body.activeJob.distance_nm > 0, 'Distance to KSFO should be greater than 0');
    console.log(`✓ POST /api/free-flight/start with KSFO destination succeeded (Distance: ${destRes.body.activeJob.distance_nm} NM).`);

    // Clean up
    await makeRequest('POST', '/api/free-flight/cancel');
  } finally {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
  }

  await disconnectDB();
  console.log('\n✅ ALL FREE FLIGHT TESTS PASSED SUCCESSFULLY!');
}

testFreeFlight().catch((err) => {
  console.error('❌ Free Flight test failed:', err);
  process.exit(1);
});
