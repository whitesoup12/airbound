import './setupTestEnv.js';
import assert from 'assert';
import { connectTestDB, disconnectDB } from '../src/config/db.js';
import Airport from '../src/models/Airport.js';
import Job from '../src/models/Job.js';
import Pilot from '../src/models/Pilot.js';
import { seedAirports } from '../src/seeds/seedAirports.js';
import { calculateDistanceNm, calculateBearing } from '../src/services/geoUtils.js';
import {
  generateJobsForAirport,
  calculatePayout,
  getCardinalDirection,
  matchesDirection
} from '../src/services/jobGenerator.js';
import { FlightStateMachine, FLIGHT_PHASES } from '../src/services/stateMachine.js';
import { resetPilot } from '../src/controllers/pilotController.js';

async function runTests() {
  console.log('--- STARTING AIRBOUND BACKEND SUITE ---');

  // 1. Test Geo Utils
  console.log('Testing Geo Utils...');
  // KLAX (33.9425, -118.4081) to KLAS (36.0801, -115.1523) is approximately 205 NM
  const dist = calculateDistanceNm(33.9425, -118.4081, 36.0801, -115.1523);
  console.log(`Calculated KLAX -> KLAS distance: ${dist} NM`);
  assert(dist >= 190 && dist <= 220, `Expected distance ~205 NM, got ${dist}`);

  const bearing = calculateBearing(33.9425, -118.4081, 36.0801, -115.1523);
  console.log(`Calculated KLAX -> KLAS bearing: ${bearing.toFixed(1)}°`);
  assert(bearing >= 30 && bearing <= 60, `Expected bearing NE ~45°, got ${bearing}`);

  // 2. Connect DB & Seed (100% Isolated In-Memory RAM Database)
  console.log('\nTesting Database & Seeding (100% In-Memory RAM)...');
  await connectTestDB();
  await Airport.deleteMany({});
  await Job.deleteMany({});
  await Pilot.deleteMany({});

  await seedAirports({ full: false, closeConnection: false });

  const airportCount = await Airport.countDocuments();
  console.log(`Verified ${airportCount} airports in database.`);
  assert(airportCount >= 30, 'Should have seeded at least 30 airports');

  // 3. Test Job Generation Engine ($nearSphere & Formulas)
  console.log('\nTesting Job Generation Engine with $nearSphere...');
  const jobs = await generateJobsForAirport('KLAX', {
    minDistanceNm: 20,
    maxDistanceNm: 400,
    minRunwayFt: 4000,
    count: 4,
    visitedAirports: ['KLAX', 'KSAN']
  });

  console.log(`Generated ${jobs.length} jobs around KLAX:`);
  assert(jobs.length >= 3, `Expected at least 3 jobs, got ${jobs.length}`);

  let unvisitedFound = 0;
  for (const job of jobs) {
    console.log(
      ` - ${job.origin_icao} -> ${job.destination_icao} | ${job.distance_nm} NM | Cargo: ${job.cargo_lbs} lbs | Pax: ${job.pax_count} | Payout: $${job.payout} | Rwy: ${job.destination_runway_ft} ft | Unvisited: ${job.is_unvisited}`
    );
    assert.strictEqual(job.origin_icao, 'KLAX');
    assert(job.distance_nm >= 20 && job.distance_nm <= 500, 'Distance within requested parameters');
    assert(job.payout > 0, 'Payout must be positive');
    assert.strictEqual(job.status, 'available');
    // Non-small airports are favored (runways >= 4000 ft in this query)
    assert(job.destination_runway_ft >= 4000, 'Airport runway satisfies non-small threshold');
    if (job.is_unvisited) unvisitedFound++;
  }
  assert(unvisitedFound >= 1, 'Job generation must include unvisited destination jobs');

  // Verify multi-tier generation includes 1 or 2 featured unvisited exploration contracts
  const multiTierJobs = await generateJobsForAirport('KLAX', {
    visitedAirports: ['KLAX', 'KSAN']
  });
  const featuredJobs = multiTierJobs.filter((j) => j.is_featured_destination);
  console.log(`Multi-tier generated ${multiTierJobs.length} jobs with ${featuredJobs.length} featured unvisited destinations:`);
  for (const fj of featuredJobs) {
    console.log(`  🌟 Exploration: KLAX -> ${fj.destination_icao} (+$${fj.exploration_bonus} bonus)`);
    assert.strictEqual(fj.is_unvisited, true, 'Featured exploration job must be an unvisited airport');
    assert.strictEqual(fj.exploration_bonus, 500, 'Featured exploration job must have $500 bonus');
  }
  assert(featuredJobs.length >= 1 && featuredJobs.length <= 2, 'Must include 1 or 2 featured unvisited destination jobs');

  // Verify Payout calculation formula
  const payoutTest = calculatePayout(100, 1000, 2, 5000);
  // (100 * 15) + (1000 * 1.25) + (2 * 150) = 1500 + 1250 + 300 = 3050
  assert.strictEqual(payoutTest, 3050, `Expected 3050, got ${payoutTest}`);

  // Verify Payout with Exploration Bonus
  const payoutExploration = calculatePayout(100, 1000, 2, 5000, 'single_prop', 500);
  assert.strictEqual(payoutExploration, 3550, `Expected 3550 with $500 bonus, got ${payoutExploration}`);

  // Verify Directional Compass & Heading Logic
  console.log('\nTesting Directional Compass & Heading Logic...');
  assert.strictEqual(getCardinalDirection(0), 'N');
  assert.strictEqual(getCardinalDirection(90), 'E');
  assert.strictEqual(getCardinalDirection(180), 'S');
  assert.strictEqual(getCardinalDirection(270), 'W');
  assert.strictEqual(getCardinalDirection(45), 'NE');
  assert.strictEqual(matchesDirection(180, 'south'), true);
  assert.strictEqual(matchesDirection(0, 'south'), false);
  assert.strictEqual(matchesDirection(90, 'east'), true);
  assert.strictEqual(matchesDirection(270, 'west'), true);
  assert.strictEqual(matchesDirection(45, 'north'), true);
  assert.strictEqual(matchesDirection(180, 'any'), true);

  // Verify Directional Contract Generation (e.g. South from KLAX)
  console.log('Testing Directional Contract Generation (South from KLAX)...');
  const southJobs = await generateJobsForAirport('KLAX', {
    direction: 'south',
    count: 6,
    visitedAirports: []
  });
  assert(southJobs.length > 0, 'Should generate contracts when direction is specified');
  for (const sj of southJobs) {
    assert(sj.bearing !== null && sj.bearing !== undefined, 'Generated job must have bearing');
    assert(typeof sj.cardinal_direction === 'string' && sj.cardinal_direction.length > 0, 'Generated job must have cardinal_direction');
  }
  const matchingSouth = southJobs.filter((j) => matchesDirection(j.bearing, 'south'));
  console.log(`Generated ${southJobs.length} contracts with direction=south (${matchingSouth.length} heading south, e.g. ${southJobs[0].destination_icao} at ${southJobs[0].bearing}° ${southJobs[0].cardinal_direction})`);
  assert(matchingSouth.length >= 1, 'Should include destinations heading south');


  // 4. Test Flight Phase State Machine
  console.log('\nTesting Flight Phase State Machine & Persistence...');
  const sm = new FlightStateMachine();

  const testJob = southJobs[0];
  testJob.status = 'accepted';
  await Job.findByIdAndUpdate(testJob._id, { status: 'accepted' });
  await sm.setActiveJob(testJob);

  assert.strictEqual(sm.phase, FLIGHT_PHASES.IDLE, 'Phase must be IDLE on job acceptance');

  const origAirport = await Airport.findOne({ icao: testJob.origin_icao });
  const destAirport = await Airport.findOne({ icao: testJob.destination_icao });
  const [oLon, oLat] = origAirport.location.coordinates;
  const [dLon, dLat] = destAirport.location.coordinates;

  const pilotBefore = await Pilot.findOne();
  const initialBalance = pilotBefore.balance;

  // Step 1: Still on ground at origin -> remains IDLE
  await sm.processTelemetry({
    latitude: oLat,
    longitude: oLon,
    altitude: 120,
    simOnGround: true,
    airspeedTrue: 50,
    groundSpeed: 50,
    parkingBrake: false,
    engineRunning: true
  });
  assert.strictEqual(sm.phase, FLIGHT_PHASES.IDLE);

  // Step 2: Wheels off ground within 5 NM of origin -> DEPARTED
  await sm.processTelemetry({
    latitude: oLat + 0.01,
    longitude: oLon + 0.01,
    altitude: 500,
    simOnGround: false,
    airspeedTrue: 110,
    groundSpeed: 110,
    parkingBrake: false,
    engineRunning: true
  });
  assert.strictEqual(sm.phase, FLIGHT_PHASES.DEPARTED);

  // Step 3: Airborne climbing past 1000 ft -> EN ROUTE
  await sm.processTelemetry({
    latitude: (oLat + dLat) / 2,
    longitude: (oLon + dLon) / 2,
    altitude: 7500,
    simOnGround: false,
    airspeedTrue: 160,
    groundSpeed: 160,
    parkingBrake: false,
    engineRunning: true
  });
  assert.strictEqual(sm.phase, FLIGHT_PHASES.EN_ROUTE);

  // Step 4: Touchdown within 3 NM of destination -> TOUCHDOWN
  await sm.processTelemetry({
    latitude: dLat + 0.005,
    longitude: dLon + 0.005,
    altitude: 150,
    simOnGround: true,
    airspeedTrue: 55,
    groundSpeed: 55,
    parkingBrake: false,
    engineRunning: true
  });
  assert.strictEqual(sm.phase, FLIGHT_PHASES.TOUCHDOWN);

  // Step 5: Rollout stopped (speed < 5 kts) and Parking brake set / engine stopped -> COMPLETED
  await sm.processTelemetry({
    latitude: dLat,
    longitude: dLon,
    altitude: 150,
    simOnGround: true,
    airspeedTrue: 0,
    groundSpeed: 0,
    parkingBrake: true,
    engineRunning: false
  });
  assert.strictEqual(sm.phase, FLIGHT_PHASES.COMPLETED);
  assert.strictEqual(sm.activeJob, null, 'Active job in state machine must be cleared to null upon flight completion');

  // 5. Verify Persistence in MongoDB
  console.log('\nVerifying Persistence after Completion...');
  const updatedJob = await Job.findById(testJob._id);
  assert.strictEqual(updatedJob.status, 'completed', 'Job status must be completed');
  assert(updatedJob.completed_at, 'Job must have completed_at timestamp');

  const pilotAfter = await Pilot.findOne();
  assert(pilotAfter.balance > initialBalance, 'Pilot balance must increase after flight completion');
  assert.strictEqual(
    pilotAfter.balance,
    initialBalance + pilotAfter.flight_log[0].net_payout,
    `Pilot balance must increase by net payout ($${pilotAfter.flight_log[0].net_payout})`
  );
  assert.strictEqual(
    pilotAfter.current_icao,
    testJob.destination_icao,
    'Pilot current_icao must be updated to destination'
  );
  assert(
    pilotAfter.visited_airports.includes(testJob.destination_icao),
    'Visited airports must include destination ICAO'
  );
  assert(
    pilotAfter.visited_countries.includes(destAirport.country),
    'Visited countries must include destination country'
  );
  assert.strictEqual(pilotAfter.flight_log.length, 1, 'Flight log must have 1 entry');
  assert.strictEqual(pilotAfter.flight_log[0].destination_icao, testJob.destination_icao);

  // 6. Test Pilot Career Reset with Home Base Selection & $15k Seed Money
  console.log('\nTesting Pilot Career Reset with Custom Home Base & $15,000 Starting Funds...');
  const mockReq = { body: { homeBase: 'KXNA' } };
  let responseData = null;
  const mockRes = {
    json: (data) => { responseData = data; return mockRes; },
    status: (code) => mockRes
  };
  await resetPilot(mockReq, mockRes);

  const resetPilotDoc = await Pilot.findOne();
  assert.strictEqual(resetPilotDoc.balance, 15000, 'Reset balance must be $15,000');
  assert.strictEqual(resetPilotDoc.current_icao, 'KXNA', 'Home base must be reset to KXNA');
  assert(resetPilotDoc.visited_airports.includes('KXNA'), 'Visited airports must contain KXNA');
  assert.strictEqual(resetPilotDoc.flight_log.length, 1, 'Flight log must NOT be deleted on career reset');
  assert.strictEqual(resetPilotDoc.fleet.length, 1, 'Fleet must have 1 starter plane');
  assert.strictEqual(resetPilotDoc.fleet[0].is_rental, false, 'Starter plane must be owned');
  console.log('✓ Career Reset verified: Home Base KXNA, Balance $15,000, Starter C172 Owned, Flight Logs Retained');

  // 7. Test Flight Pause & Simulation Active Flight Time Tracking
  console.log('\nTesting Flight Pause & Active Simulation Time Tracking...');
  const pauseTestSM = new FlightStateMachine();
  const pauseJob = await Job.create({
    origin_icao: 'KLAX',
    destination_icao: 'KSAN',
    distance_nm: 95,
    cargo_lbs: 100,
    pax_count: 1,
    payout: 2000,
    status: 'accepted'
  });
  await pauseTestSM.setActiveJob(pauseJob);

  let simClock = 1700000000000;
  // Step A: Depart (takeoff)
  await pauseTestSM.processTelemetry({
    latitude: 33.9425,
    longitude: -118.4081,
    altitude: 500,
    simOnGround: false,
    airspeedTrue: 100,
    groundSpeed: 100,
    parkingBrake: false,
    engineRunning: true,
    isPaused: false,
    timestamp: simClock
  });
  assert.strictEqual(pauseTestSM.phase, FLIGHT_PHASES.DEPARTED);

  // Step B: Fly for 10 simulated seconds (1 sec increments)
  for (let i = 0; i < 10; i++) {
    simClock += 1000;
    await pauseTestSM.processTelemetry({
      latitude: 33.5,
      longitude: -117.8,
      altitude: 5500,
      simOnGround: false,
      airspeedTrue: 120,
      groundSpeed: 120,
      parkingBrake: false,
      engineRunning: true,
      isPaused: false,
      timestamp: simClock
    });
  }
  assert.strictEqual(Math.round(pauseTestSM.activeFlightSeconds), 10, 'Should have accumulated exactly 10 flight seconds');
  assert.strictEqual(Math.round(pauseTestSM.airborneSeconds), 10, 'Should have accumulated exactly 10 airborne seconds');

  // Step C: Pause the game for 60 seconds (simClock ticks while isPaused: true)
  for (let i = 0; i < 60; i++) {
    simClock += 1000;
    await pauseTestSM.processTelemetry({
      latitude: 33.5,
      longitude: -117.8,
      altitude: 5500,
      simOnGround: false,
      airspeedTrue: 120,
      groundSpeed: 120,
      parkingBrake: false,
      engineRunning: true,
      isPaused: true,
      timestamp: simClock
    });
  }
  assert.strictEqual(Math.round(pauseTestSM.activeFlightSeconds), 10, 'Flight seconds must NOT increment while paused');
  assert.strictEqual(Math.round(pauseTestSM.airborneSeconds), 10, 'Airborne seconds must NOT increment while paused');

  // Step D: Alt-tab / ESC menu pause (large time gap of 30 minutes / 1800 seconds)
  simClock += 1800000; // 30 minutes jump
  await pauseTestSM.processTelemetry({
    latitude: 33.5,
    longitude: -117.8,
    altitude: 5500,
    simOnGround: false,
    airspeedTrue: 120,
    groundSpeed: 120,
    parkingBrake: false,
    engineRunning: true,
    isPaused: false,
    timestamp: simClock
  });
  assert.strictEqual(Math.round(pauseTestSM.activeFlightSeconds), 10, 'Large time gaps (> 2.5s) must be discarded and NOT added to flight time');

  // Step E: Resume flying for 5 more active seconds
  for (let i = 0; i < 5; i++) {
    simClock += 1000;
    await pauseTestSM.processTelemetry({
      latitude: 33.5,
      longitude: -117.8,
      altitude: 5500,
      simOnGround: false,
      airspeedTrue: 120,
      groundSpeed: 120,
      parkingBrake: false,
      engineRunning: true,
      isPaused: false,
      timestamp: simClock
    });
  }
  assert.strictEqual(Math.round(pauseTestSM.activeFlightSeconds), 15, 'Should have exactly 15 active flight seconds (10 + 5)');
  assert.strictEqual(Math.round(pauseTestSM.airborneSeconds), 15, 'Should have exactly 15 airborne seconds');
  console.log('✓ Pause exclusion verified: Paused and stalled time successfully excluded from flight time.');

  console.log('✅ ALL BACKEND TESTS PASSED SUCCESSFULLY!');
  await disconnectDB();
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

