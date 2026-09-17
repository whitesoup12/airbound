import './setupTestEnv.js';
import assert from 'assert';
import express from 'express';
import { connectTestDB, disconnectDB } from '../src/config/db.js';
import fleetRoutes from '../src/routes/fleet.js';
import Aircraft from '../src/models/Aircraft.js';
import Pilot from '../src/models/Pilot.js';
import { seedAircraftCatalog } from '../src/seeds/seedAircraft.js';
import { seedAirports } from '../src/seeds/seedAirports.js';
import {
  calculateLandingFee,
  calculateFuelExpense,
  computeFlightSettlement,
  calculateAircraftResaleValue
} from '../src/services/economyService.js';
import { calculatePayout } from '../src/services/jobGenerator.js';

async function runFleetEconomyTests() {
  console.log('========================================================');
  console.log('  STARTING AIRBOUND FLEET & ECONOMY TEST SUITE (RAM ONLY)');
  console.log('========================================================\n');

  // 1. Test Economy Formulas (Pure Functions)
  console.log('1. Testing Economy Service formulas...');

  // Landing fees
  assert.strictEqual(calculateLandingFee(11000), 350, 'Hub runway >= 9500 ft fee must be $350');
  assert.strictEqual(calculateLandingFee(6500), 120, 'Medium runway 5000-9500 ft fee must be $120');
  assert.strictEqual(calculateLandingFee(3200), 35, 'Small runway < 5000 ft fee must be $35');
  console.log('  ✓ Landing fee calculations verified (Hub: $350, Medium: $120, Small: $35)');

  // Fuel expense
  const fuel100LL = calculateFuelExpense(3600, 9.0, '100LL'); // 1 hour @ 9 GPH @ $6.40/gal = $57.60
  assert.strictEqual(fuel100LL.gallons, 9.0);
  assert.strictEqual(fuel100LL.cost, 57.6);
  assert.strictEqual(fuel100LL.pricePerGal, 6.40);

  const fuelJetA = calculateFuelExpense(7200, 60.0, 'Jet-A'); // 2 hours @ 60 GPH @ $5.60/gal = 120 gal * 5.60 = $672
  assert.strictEqual(fuelJetA.gallons, 120.0);
  assert.strictEqual(fuelJetA.cost, 672.0);
  console.log('  ✓ Fuel expenses verified for 100LL ($6.40/gal) and Jet-A ($5.60/gal)');

  // Settlement
  const settlement = computeFlightSettlement({
    grossPayout: 5000,
    durationSeconds: 3600,
    fuelBurnGph: 9.0,
    fuelType: '100LL',
    destRunwayFt: 7000,
    aircraftName: 'Cessna 172 Skyhawk'
  });
  assert.strictEqual(settlement.grossPayout, 5000);
  assert.strictEqual(settlement.fuelCost, 57.6);
  assert.strictEqual(settlement.landingFee, 120);
  assert.strictEqual(settlement.netPayout, 4822); // 5000 - 58 - 120 = 4822
  console.log(`  ✓ Financial settlement ledger verified (Gross: $5,000 - Fuel: $57.60 - Landing: $120 = Net: $${settlement.netPayout})`);

  // Resale Depreciation
  const resaleNew = calculateAircraftResaleValue(180000, 0.0); // 15% discount -> 85%
  assert.strictEqual(resaleNew.resaleValue, 153000);
  assert.strictEqual(resaleNew.totalDepreciationPercent, 15);

  const resale10hr = calculateAircraftResaleValue(180000, 10.0); // 15% + 5% = 20% discount -> 80%
  assert.strictEqual(resale10hr.resaleValue, 144000);
  assert.strictEqual(resale10hr.totalDepreciationPercent, 20);

  const resale50hr = calculateAircraftResaleValue(180000, 50.0); // 15% + 25% = 40% discount -> 60%
  assert.strictEqual(resale50hr.resaleValue, 108000);
  assert.strictEqual(resale50hr.totalDepreciationPercent, 40);

  const resale200hr = calculateAircraftResaleValue(180000, 200.0); // 15% + 100% -> capped at 80% (20% floor)
  assert.strictEqual(resale200hr.resaleValue, 36000); // 180k * 0.20 = 36k
  assert.strictEqual(resale200hr.totalDepreciationPercent, 80);
  assert.strictEqual(resale200hr.salvageFloorReached, true);
  console.log('  ✓ Resale depreciation formula verified (0 hr: $153k, 10 hr: $144k, 50 hr: $108k, 200 hr salvage floor: $36k)');

  // 2. Test Category Payout Scaling
  console.log('\n2. Testing Category Payout Scaling...');
  const singlePropPayout = calculatePayout(200, 400, 2, 6000, 'single_prop');
  const twinPropPayout = calculatePayout(200, 400, 2, 6000, 'twin_prop');
  const turbopropPayout = calculatePayout(200, 400, 2, 6000, 'turboprop');
  const jetPayout = calculatePayout(200, 400, 2, 6000, 'jet');
  const airlinerPayout = calculatePayout(200, 400, 2, 6000, 'airliner');

  console.log(`  Single Prop: $${singlePropPayout}`);
  console.log(`  Twin Prop:   $${twinPropPayout}`);
  console.log(`  Turboprop:   $${turbopropPayout}`);
  console.log(`  Jet:         $${jetPayout}`);
  console.log(`  Airliner:    $${airlinerPayout}`);

  assert(twinPropPayout > singlePropPayout, 'Twin prop payouts should scale above single prop');
  assert(turbopropPayout > twinPropPayout, 'Turboprop payouts should scale above twin prop');
  assert(jetPayout > turbopropPayout, 'Jet VIP payouts should scale above turboprop');
  assert(airlinerPayout > turbopropPayout, 'Airliner payouts should scale above turboprop');
  console.log('  ✓ Category payout scaling confirmed across single_prop, twin_prop, turboprop, jet, airliner');

  // 3. Test REST API Endpoints with Ephemeral In-Memory Server
  console.log('\n3. Testing REST API Endpoints on 100% In-Memory Test Server...');
  await connectTestDB();
  await Aircraft.deleteMany({});
  await Pilot.deleteMany({});

  // Seed airports, aircraft catalog & test pilot in memory
  await seedAirports({ full: false, closeConnection: false });
  await seedAircraftCatalog();
  await Pilot.deleteMany({}); // remove default seed pilot so testPilot is primary
  const testPilot = await Pilot.create({
    callsign: 'TestPilot',
    balance: 500000,
    current_icao: 'KLAX',
    visited_airports: ['KLAX'],
    visited_countries: ['US'],
    flight_log: [],
    active_aircraft: {
      model_id: 'c172',
      name: 'Cessna 172 Skyhawk',
      tail_number: 'N172TEST',
      category: 'single_prop',
      is_rental: false
    },
    fleet: [
      {
        model_id: 'c172',
        name: 'Cessna 172 Skyhawk',
        tail_number: 'N172TEST',
        category: 'single_prop',
        is_rental: false,
        purchased_at: new Date(),
        flight_hours: 0
      }
    ]
  });

  // Spin up an isolated Express server on a free ephemeral port
  const app = express();
  app.use(express.json());
  app.use('/api/fleet', fleetRoutes);

  const testServer = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = testServer.address().port;
  const SERVER_URL = `http://127.0.0.1:${port}`;
  console.log(`  ✓ Ephemeral test server running at ${SERVER_URL} (Isolated RAM only)`);

  try {
    // Catalog
    const catRes = await fetch(`${SERVER_URL}/api/fleet/catalog`);
    assert(catRes.ok, 'Catalog request must succeed');
    const catData = await catRes.json();
    assert(catData.catalog.length >= 14, `Catalog should contain at least 14 models, got ${catData.catalog.length}`);
    console.log(`  ✓ Catalog retrieved: ${catData.catalog.length} MSFS 2024 aircraft models available.`);

    // Hangar
    const hangRes = await fetch(`${SERVER_URL}/api/fleet/hangar`);
    assert(hangRes.ok, 'Hangar request must succeed');
    const hangData = await hangRes.json();
    assert(hangData.fleet.length >= 1, 'Hangar should contain starter fleet plane');
    assert(hangData.activeAircraft, 'Active aircraft must be defined');
    console.log(`  ✓ Pilot hangar retrieved: ${hangData.fleet.length} planes in fleet. Active: ${hangData.activeAircraft.name} (${hangData.activeAircraft.tail_number})`);

    // Rent Aircraft
    const rentRes = await fetch(`${SERVER_URL}/api/fleet/rent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId: 'tbm930' })
    });
    assert(rentRes.ok, 'Rent request must succeed');
    const rentData = await rentRes.json();
    const rentedTail = rentData.activeAircraft.tail_number;
    assert.strictEqual(rentData.activeAircraft.model_id, 'tbm930');
    console.log(`  ✓ Aircraft rental verified: Rented Daher TBM 930 (${rentedTail}). Active aircraft updated.`);

    // 1. Verify rejection when trying to sell a rental lease
    const sellRentalRes = await fetch(`${SERVER_URL}/api/fleet/sell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tailNumber: rentedTail })
    });
    assert.strictEqual(sellRentalRes.status, 400, 'Attempting to sell a rental must return 400');
    const sellRentalErr = await sellRentalRes.json();
    assert(sellRentalErr.error.includes('rental lease'), 'Error message should specify it is a rental');
    console.log(`  ✓ Rental sell protection verified: Correctly rejected selling leased aircraft (${rentedTail}).`);

    // Return Rented Aircraft
    const returnRes = await fetch(`${SERVER_URL}/api/fleet/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tailNumber: rentedTail })
    });
    assert(returnRes.ok, 'Return rental request must succeed');
    const returnData = await returnRes.json();
    console.log(`  ✓ Return rental verified: Successfully returned ${rentedTail} to lessor.`);

    // 2. Add an owned test plane with 10.0 flight hours and test selling with depreciation
    const pilotDoc = await Pilot.findOne();
    pilotDoc.fleet.push({
      model_id: 'c172',
      name: 'Cessna 172 Skyhawk',
      tail_number: 'N999TEST',
      category: 'single_prop',
      is_rental: false,
      flight_hours: 10.0,
      purchased_at: new Date()
    });
    await pilotDoc.save();

    const sellOwnedRes = await fetch(`${SERVER_URL}/api/fleet/sell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tailNumber: 'N999TEST' })
    });
    assert(sellOwnedRes.ok, 'Selling owned aircraft must succeed');
    const sellOwnedData = await sellOwnedRes.json();
    assert.strictEqual(sellOwnedData.soldPlane.resaleValue, 108000, 'C172 ($135k) with 10 hrs (-20%) must resell for $108,000');
    assert.strictEqual(sellOwnedData.soldPlane.depreciationPercent, 20, 'Depreciation must be 20% (15% base + 5% hours)');
    assert.strictEqual(sellOwnedData.soldPlane.hourlyDepreciationPercent, 5);
    console.log(`  ✓ Sell owned aircraft verified: Sold N999TEST with 10.0 hrs for $${sellOwnedData.soldPlane.resaleValue.toLocaleString()} (-20% depreciation). Balance credited.`);

    // Switch Active Aircraft
    const selectRes = await fetch(`${SERVER_URL}/api/fleet/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId: 'c172' })
    });
    assert(selectRes.ok, 'Select active aircraft must succeed');
    const selectData = await selectRes.json();
    assert.strictEqual(selectData.activeAircraft.model_id, 'c172');
    console.log(`  ✓ Aircraft selection verified: Returned to ${selectData.activeAircraft.name} (${selectData.activeAircraft.tail_number}).`);
  } finally {
    testServer.close();
    await disconnectDB();
  }

  console.log('\n========================================================');
  console.log('  ✅ ALL FLEET & ECONOMY TESTS PASSED (100% IN-MEMORY)');
  console.log('========================================================');
}

runFleetEconomyTests().catch((err) => {
  console.error('❌ Fleet & Economy test failed:', err);
  process.exit(1);
});
