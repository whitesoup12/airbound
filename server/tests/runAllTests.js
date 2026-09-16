import assert from 'assert';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Airport from '../src/models/Airport.js';
import Job from '../src/models/Job.js';
import Pilot from '../src/models/Pilot.js';
import { seedAirports } from '../src/seeds/seedAirports.js';
import { calculateDistanceNm, calculateBearing } from '../src/services/geoUtils.js';
import { generateJobsForAirport, calculatePayout } from '../src/services/jobGenerator.js';
import { FlightStateMachine, FLIGHT_PHASES } from '../src/services/stateMachine.js';

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

  // 2. Connect DB & Seed
  console.log('\nTesting Database & Seeding...');
  await connectDB();
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
    count: 4
  });

  console.log(`Generated ${jobs.length} jobs around KLAX:`);
  assert(jobs.length >= 3, `Expected at least 3 jobs, got ${jobs.length}`);

  for (const job of jobs) {
    console.log(
      ` - ${job.origin_icao} -> ${job.destination_icao} | ${job.distance_nm} NM | Cargo: ${job.cargo_lbs} lbs | Pax: ${job.pax_count} | Payout: $${job.payout}`
    );
    assert.strictEqual(job.origin_icao, 'KLAX');
    assert(job.distance_nm >= 20 && job.distance_nm <= 500, 'Distance within requested parameters');
    assert(job.payout > 0, 'Payout must be positive');
    assert.strictEqual(job.status, 'available');
  }

  // Verify Payout calculation formula
  const payoutTest = calculatePayout(100, 1000, 2, 5000);
  // (100 * 15) + (1000 * 1.25) + (2 * 150) = 1500 + 1250 + 300 = 3050
  assert.strictEqual(payoutTest, 3050, `Expected 3050, got ${payoutTest}`);

  // 4. Test Flight Phase State Machine
  console.log('\nTesting Flight Phase State Machine & Persistence...');
  const sm = new FlightStateMachine();

  const testJob = jobs[0];
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

  // 5. Verify Persistence in MongoDB
  console.log('\nVerifying Persistence after Completion...');
  const updatedJob = await Job.findById(testJob._id);
  assert.strictEqual(updatedJob.status, 'completed', 'Job status must be completed');
  assert(updatedJob.completed_at, 'Job must have completed_at timestamp');

  const pilotAfter = await Pilot.findOne();
  assert.strictEqual(
    pilotAfter.balance,
    initialBalance + testJob.payout,
    `Pilot balance must increase by payout ($${testJob.payout})`
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

  console.log('✅ ALL BACKEND TESTS PASSED SUCCESSFULLY!');
  await disconnectDB();
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

