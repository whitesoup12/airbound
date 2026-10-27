import './setupTestEnv.js';
import assert from 'assert';
import { connectTestDB, disconnectDB } from '../src/config/db.js';
import Pilot from '../src/models/Pilot.js';
import Aircraft from '../src/models/Aircraft.js';
import Airport from '../src/models/Airport.js';
import { seedAircraftCatalog } from '../src/seeds/seedAircraft.js';
import { getPilot, resetPilot } from '../src/controllers/pilotController.js';
import { sellAircraft, returnAircraft, getCatalog, getHangar } from '../src/controllers/fleetController.js';
import { validateAircraftMatch } from '../src/utils/aircraftValidator.js';

async function runC152Tests() {
  console.log('--- TESTING CESSNA 152 CATALOG & DEFAULT FLEET INTEGRATION ---');

  await connectTestDB();
  await Pilot.deleteMany({});
  await Aircraft.deleteMany({});
  await Airport.deleteMany({});

  // 1. Verify Catalog Seeding includes c152
  console.log('1. Testing Aircraft Catalog Seeding with C152...');
  await seedAircraftCatalog();

  const c152Model = await Aircraft.findOne({ model_id: 'c152' });
  assert.ok(c152Model, 'Cessna 152 must exist in catalog');
  assert.strictEqual(c152Model.name, 'Cessna 152');
  assert.strictEqual(c152Model.category, 'single_prop');
  assert.strictEqual(c152Model.purchase_price, 75000);
  assert.strictEqual(c152Model.rental_price_per_flight, 1200);
  assert.strictEqual(c152Model.cruise_speed_kts, 105);
  assert.strictEqual(c152Model.max_range_nm, 415);
  assert.strictEqual(c152Model.max_cargo_lbs, 200);
  assert.strictEqual(c152Model.max_pax, 1);
  assert.strictEqual(c152Model.min_runway_ft, 1350);
  assert.strictEqual(c152Model.fuel_type, '100LL');
  assert.strictEqual(c152Model.fuel_burn_gph, 6.0);
  console.log('✓ Cessna 152 verified in catalog with complete specifications.');

  // 2. Test New Career Profile Creation Defaults to C152
  console.log('2. Testing New Career Profile Creation Defaults to C152...');
  let responseData = null;
  const mockRes = {
    json: (d) => { responseData = d; return mockRes; },
    status: (s) => mockRes
  };

  await getPilot({}, mockRes);
  assert.ok(responseData?.pilot, 'Pilot profile should be created');
  assert.strictEqual(responseData.pilot.active_aircraft.model_id, 'c152', 'Active aircraft must be c152');
  assert.strictEqual(responseData.pilot.active_aircraft.name, 'Cessna 152');
  assert.strictEqual(responseData.pilot.active_aircraft.tail_number, 'N152AB');
  assert.strictEqual(responseData.pilot.fleet.length, 1, 'Starter fleet must have 1 aircraft');
  assert.strictEqual(responseData.pilot.fleet[0].model_id, 'c152', 'Starter fleet aircraft must be c152');
  assert.strictEqual(responseData.pilot.fleet[0].is_rental, false, 'Starter plane must be owned');
  console.log('✓ New career defaults to owned Cessna 152 (N152AB).');

  // 3. Test Career Reset Defaults to C152
  console.log('3. Testing Career Reset Defaults to C152...');
  const resetReq = { body: { homeBase: 'KLAX' } };
  let resetData = null;
  const resetRes = {
    json: (d) => { resetData = d; return resetRes; },
    status: (s) => resetRes
  };

  await resetPilot(resetReq, resetRes);
  const resetPilotDoc = await Pilot.findOne();
  assert.strictEqual(resetPilotDoc.active_aircraft.model_id, 'c152', 'Reset active aircraft must be c152');
  assert.strictEqual(resetPilotDoc.fleet[0].model_id, 'c152', 'Reset fleet starter plane must be c152');
  assert.strictEqual(resetPilotDoc.fleet[0].tail_number, 'N152AB');
  console.log('✓ Resetting career restores fleet to owned starter Cessna 152.');

  // 4. Test Selling All Aircraft Automatically Grants C152 Loaner
  console.log('4. Testing Selling All Aircraft Grants C152 Loaner...');
  const starterTail = resetPilotDoc.fleet[0].tail_number;
  let sellData = null;
  const sellRes = {
    json: (d) => { sellData = d; return sellRes; },
    status: (s) => sellRes
  };

  await sellAircraft({ body: { tailNumber: starterTail } }, sellRes);
  assert.strictEqual(sellData.loanerProvided, true, 'Loaner must be provided when all aircraft sold');
  assert.strictEqual(sellData.activeAircraft.model_id, 'c152', 'Loaner model must be c152');
  assert.strictEqual(sellData.activeAircraft.is_loaner, true, 'Loaner flag must be true');
  assert.ok(sellData.activeAircraft.name.includes('Cessna 152'), 'Loaner name must include Cessna 152');

  const pilotAfterSale = await Pilot.findOne();
  assert.strictEqual(pilotAfterSale.fleet.length, 1, 'Hangar should contain loaner plane');
  assert.strictEqual(pilotAfterSale.fleet[0].model_id, 'c152', 'Hangar plane must be c152 loaner');
  assert.strictEqual(pilotAfterSale.fleet[0].is_loaner, true);
  console.log('✓ Selling all aircraft provided free Cessna 152 loaner.');

  // 5. Test Returning All Aircraft Grants C152 Loaner
  console.log('5. Testing Returning Rented/Loaner Aircraft Grants C152 Loaner...');
  const loanerTail = pilotAfterSale.fleet[0].tail_number;
  let returnData = null;
  const returnRes = {
    json: (d) => { returnData = d; return returnRes; },
    status: (s) => returnRes
  };

  await returnAircraft({ body: { tailNumber: loanerTail } }, returnRes);
  assert.strictEqual(returnData.loanerProvided, true, 'Loaner must be provided when hangar becomes empty');
  assert.strictEqual(returnData.activeAircraft.model_id, 'c152', 'Replacement loaner must be c152');

  const pilotAfterReturn = await Pilot.findOne();
  assert.strictEqual(pilotAfterReturn.fleet.length, 1);
  assert.strictEqual(pilotAfterReturn.fleet[0].model_id, 'c152');
  console.log('✓ Returning loaner when hangar empty replenished with a fresh Cessna 152 loaner.');

  // 6. Test Airframe Matching for MSFS 2024 C152 Titles
  console.log('6. Testing Airframe Validator for MSFS 2024 C152 strings...');
  const v1 = validateAircraftMatch({ model_id: 'c152', name: 'Cessna 152' }, {
    simAircraftTitle: 'Cessna 152 Asobo',
    simAircraftModel: 'ATCCOM.AC_MODEL C152.0.text'
  });
  assert.strictEqual(v1.matches, true, 'Should match Cessna 152 Asobo');

  const v2 = validateAircraftMatch({ model_id: 'c152', name: 'Cessna 152' }, {
    simAircraftTitle: 'C152 Aerobat',
    simAircraftModel: 'C152'
  });
  assert.strictEqual(v2.matches, true, 'Should match C152 Aerobat');

  const v3 = validateAircraftMatch({ model_id: 'c152', name: 'Cessna 152' }, {
    simAircraftTitle: 'Boeing 737 MAX 8',
    simAircraftModel: 'B38M'
  });
  assert.strictEqual(v3.matches, false, 'Should reject Boeing 737 when expecting C152');
  console.log('✓ Airframe validator correctly identifies MSFS 2024 Cessna 152.');

  await disconnectDB();
  console.log('\n✅ ALL CESSNA 152 DEFAULT INTEGRATION TESTS PASSED!\n');
}

runC152Tests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
