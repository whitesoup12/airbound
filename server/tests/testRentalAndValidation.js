import './setupTestEnv.js';
import assert from 'assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Pilot from '../src/models/Pilot.js';
import Aircraft from '../src/models/Aircraft.js';
import Job from '../src/models/Job.js';
import Airport from '../src/models/Airport.js';
import { validateAircraftMatch } from '../src/utils/aircraftValidator.js';
import { flightStateMachine, FLIGHT_PHASES } from '../src/services/stateMachine.js';
import { rentAircraft, selectActiveAircraft } from '../src/controllers/fleetController.js';
import { acceptJob, cancelJob } from '../src/controllers/jobController.js';

console.log('--- TESTING AIRBOUND RENTAL ECONOMICS & AIRFRAME VALIDATION ---');

let mongod;

async function setup() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Seed sample aircraft
  await Aircraft.create([
    {
      model_id: 'c172',
      name: 'Cessna 172 Skyhawk',
      category: 'single_prop',
      purchase_price: 135000,
      rental_price_per_flight: 250,
      cruise_speed_kts: 120,
      max_range_nm: 500,
      max_cargo_lbs: 500,
      max_pax: 3,
      min_runway_ft: 1600,
      fuel_type: '100LL',
      fuel_burn_gph: 9.0
    },
    {
      model_id: 'tbm930',
      name: 'Daher TBM 930',
      category: 'turboprop',
      purchase_price: 4300000,
      rental_price_per_flight: 2500,
      cruise_speed_kts: 330,
      max_range_nm: 1730,
      max_cargo_lbs: 1400,
      max_pax: 5,
      min_runway_ft: 2800,
      fuel_type: 'Jet-A',
      fuel_burn_gph: 60.0
    },
    {
      model_id: 'da62',
      name: 'Diamond DA62',
      category: 'twin_prop',
      purchase_price: 1450000,
      rental_price_per_flight: 950,
      cruise_speed_kts: 192,
      max_range_nm: 1280,
      max_cargo_lbs: 1400,
      max_pax: 6,
      min_runway_ft: 1800,
      fuel_type: 'Jet-A',
      fuel_burn_gph: 15.0
    }
  ]);

  // Seed airports
  await Airport.create([
    {
      icao: 'KLAX',
      name: 'Los Angeles Intl',
      location: { type: 'Point', coordinates: [-118.4081, 33.9425] },
      longest_runway_ft: 12000
    },
    {
      icao: 'KLAS',
      name: 'Harry Reid Intl',
      location: { type: 'Point', coordinates: [-115.1523, 36.084] },
      longest_runway_ft: 14000
    }
  ]);

  // Seed pilot with $3,000 balance
  await Pilot.create({
    callsign: 'TestPilot',
    balance: 3000,
    current_icao: 'KLAX',
    fleet: [
      {
        model_id: 'c172',
        name: 'Cessna 172 Skyhawk',
        tail_number: 'N172TP',
        is_rental: false,
        flight_hours: 0
      }
    ],
    active_aircraft: {
      model_id: 'c172',
      name: 'Cessna 172 Skyhawk',
      tail_number: 'N172TP',
      category: 'single_prop',
      is_rental: false,
      rental_price_per_flight: 0,
      rental_flights_paid: 0,
      is_loaner: false
    }
  });
}

function mockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.data = obj;
      return this;
    }
  };
  return res;
}

async function runTests() {
  await setup();

  console.log('1. Testing Airframe Validator Match Engine...');
  // Match C172 with real MSFS 2024 strings
  const msfsC172Telemetry = {
    simAircraftTitle: 'C172SP G1000 Cargo',
    simAircraftModel: 'ATCCOM.AC_MODEL C172.0.text'
  };
  const v1 = validateAircraftMatch({ model_id: 'c172', name: 'Cessna 172 Skyhawk' }, msfsC172Telemetry);
  assert.strictEqual(v1.matches, true, 'Should match C172');

  // Mismatch TBM930 when MSFS is flying C172
  const v2 = validateAircraftMatch({ model_id: 'tbm930', name: 'Daher TBM 930' }, msfsC172Telemetry);
  assert.strictEqual(v2.matches, false, 'Should fail match when TBM 930 is expected but C172 is in sim');
  assert.ok(v2.reason.includes('Daher TBM 930'), 'Should state expected aircraft in reason');
  console.log('✓ Airframe validator correctly validates matches and identifies mismatches.');

  console.log('2. Testing Takeoff Departure Gating on Airframe Mismatch...');
  const testJob = await Job.create({
    origin_icao: 'KLAX',
    destination_icao: 'KLAS',
    distance_nm: 205,
    payout: 5000,
    status: 'accepted'
  });
  await flightStateMachine.setActiveJob(testJob);
  assert.strictEqual(flightStateMachine.phase, FLIGHT_PHASES.IDLE);

  // Set pilot active aircraft to TBM 930 in DB
  const pilot = await Pilot.findOne();
  pilot.active_aircraft = {
    model_id: 'tbm930',
    name: 'Daher TBM 930',
    tail_number: 'N930TB',
    category: 'turboprop',
    is_rental: false
  };
  await pilot.save();

  // Try to take off with MSFS flying C172
  await flightStateMachine.processTelemetry({
    latitude: 33.9425,
    longitude: -118.4081,
    simOnGround: false, // Wheels lift off
    groundSpeed: 100,
    airspeedTrue: 100,
    altAboveGround: 50,
    simAircraftTitle: 'C172SP G1000 Cargo',
    simAircraftModel: 'ATCCOM.AC_MODEL C172.0.text'
  });
  assert.strictEqual(flightStateMachine.phase, FLIGHT_PHASES.IDLE, 'Should block departure if airframe mismatches');
  console.log('✓ State machine blocked departure due to airframe mismatch.');

  // Reset aircraft on ground before liftoff
  await flightStateMachine.processTelemetry({
    latitude: 33.9425,
    longitude: -118.4081,
    simOnGround: true,
    groundSpeed: 0,
    airspeedTrue: 0,
    altAboveGround: 0,
    simAircraftTitle: 'TBM 930 Asobo',
    simAircraftModel: 'TBM9'
  });

  // Now take off with matching TBM in MSFS
  await flightStateMachine.processTelemetry({
    latitude: 33.9425,
    longitude: -118.4081,
    simOnGround: false,
    groundSpeed: 100,
    airspeedTrue: 100,
    altAboveGround: 50,
    simAircraftTitle: 'TBM 930 Asobo',
    simAircraftModel: 'TBM9'
  });
  assert.strictEqual(flightStateMachine.phase, FLIGHT_PHASES.DEPARTED, 'Should depart when airframe matches');
  console.log('✓ State machine permitted departure with matching airframe.');

  await flightStateMachine.clearActiveJob();
  await Job.deleteMany({});

  console.log('3. Testing Per-Flight Rental Economics...');
  // Rent TBM 930: Rental fee $2,500, balance $3,000 -> remaining $500
  const rentReq = { body: { modelId: 'tbm930' } };
  const rentRes = mockRes();
  await rentAircraft(rentReq, rentRes);
  if (rentRes.statusCode !== 200) {
    console.error('rentAircraft error:', rentRes.data);
  }
  assert.strictEqual(rentRes.statusCode, 200);

  const updatedPilot = await Pilot.findOne();
  assert.strictEqual(updatedPilot.balance, 500, 'Balance should be $500 after renting TBM 930');
  assert.strictEqual(updatedPilot.active_aircraft.is_rental, true);
  assert.strictEqual(updatedPilot.active_aircraft.rental_flights_paid, 1, 'First flight should be prepaid');
  console.log('✓ Initial rental charged $2,500 and granted 1 prepaid flight.');

  // Accept Flight 1: Already prepaid (rental_flights_paid === 1), so no extra deduction
  const job1 = await Job.create({
    origin_icao: 'KLAX',
    destination_icao: 'KLAS',
    distance_nm: 205,
    payout: 4000,
    status: 'available'
  });
  const acceptRes1 = mockRes();
  await acceptJob({ params: { id: job1._id } }, acceptRes1);
  assert.strictEqual(acceptRes1.statusCode, 200);

  const pilotAfterJob1 = await Pilot.findOne();
  assert.strictEqual(pilotAfterJob1.balance, 500, 'Balance should remain $500 for prepaid flight 1');
  console.log('✓ Prepaid flight accepted without charging duplicate rental fee.');

  // Complete Flight 1
  await flightStateMachine.forceSetPhase(FLIGHT_PHASES.COMPLETED, { simOnGround: true });

  const pilotAfterFlight1 = await Pilot.findOne();
  assert.strictEqual(pilotAfterFlight1.active_aircraft.rental_flights_paid, 0, 'Prepaid flights should reset to 0 upon completion');
  console.log('✓ Prepaid rental flight status reset to 0 upon landing.');

  // Now attempt to accept Flight 2 ("another flight") when balance is insufficient ($500 balance vs $2,500 fee)
  // Let's reset balance to $500 in case settlement credited payout
  pilotAfterFlight1.balance = 500;
  await pilotAfterFlight1.save();

  const job2 = await Job.create({
    origin_icao: 'KLAS',
    destination_icao: 'KLAX',
    distance_nm: 205,
    payout: 4000,
    status: 'available'
  });
  const acceptRes2 = mockRes();
  await acceptJob({ params: { id: job2._id } }, acceptRes2);
  assert.strictEqual(acceptRes2.statusCode, 400, 'Should reject job acceptance due to insufficient rental funds');
  assert.ok(acceptRes2.data.error.includes('Insufficient funds to rent'), 'Should provide clear shortage alert');
  console.log('✓ Insufficient funds alert triggered and blocked contract acceptance.');

  // Give pilot enough funds ($3,000) and accept Flight 2
  pilotAfterFlight1.balance = 3000;
  await pilotAfterFlight1.save();

  const acceptRes3 = mockRes();
  await acceptJob({ params: { id: job2._id } }, acceptRes3);
  assert.strictEqual(acceptRes3.statusCode, 200, 'Should accept job once funds are available');

  const pilotAfterAccept2 = await Pilot.findOne();
  assert.strictEqual(pilotAfterAccept2.balance, 500, '$2,500 rental fee deducted for flight 2 (3000 - 2500 = 500)');
  assert.strictEqual(pilotAfterAccept2.active_aircraft.rental_flights_paid, 1);
  console.log('✓ Rental fee of $2,500 successfully charged for flight 2.');

  // Test Pre-flight Cancellation Refund
  const cancelRes = mockRes();
  await cancelJob({ params: { id: job2._id } }, cancelRes);
  assert.strictEqual(cancelRes.statusCode, 200);

  // 4. Test Diamond DA62 Rental
  console.log('4. Testing Diamond DA62 Rental...');
  const rentDa62Req = { body: { modelId: 'da62' } };
  const rentDa62Res = mockRes();
  await rentAircraft(rentDa62Req, rentDa62Res);
  assert.strictEqual(rentDa62Res.statusCode, 200, 'Renting DA62 should return 200');
  const pilotWithDa62 = await Pilot.findOne();
  assert.strictEqual(pilotWithDa62.active_aircraft.model_id, 'da62');
  assert.strictEqual(pilotWithDa62.active_aircraft.name, 'Diamond DA62');
  assert.strictEqual(pilotWithDa62.active_aircraft.category, 'twin_prop');
  assert.strictEqual(pilotWithDa62.active_aircraft.is_rental, true);
  assert.strictEqual(pilotWithDa62.active_aircraft.rental_price_per_flight, 950);
  assert.strictEqual(pilotWithDa62.balance, 3000 - 950, 'DA62 rental fee $950 deducted from balance');
  console.log('✓ Diamond DA62 ($950/flight, Twin Prop) rental verified successfully.');

  console.log('\n✅ ALL RENTAL AND AIRFRAME VALIDATION TESTS PASSED!');
  await mongoose.disconnect();
  await mongod.stop();
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
