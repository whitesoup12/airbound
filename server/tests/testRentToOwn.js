import './setupTestEnv.js';
import assert from 'assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Pilot from '../src/models/Pilot.js';
import Aircraft from '../src/models/Aircraft.js';
import Job from '../src/models/Job.js';
import Airport from '../src/models/Airport.js';
import { calculateRentalEquityCredit, RENT_TO_OWN_EQUITY_RATIO } from '../src/services/economyService.js';
import { rentAircraft, buyAircraft, getCatalog, getHangar } from '../src/controllers/fleetController.js';
import { acceptJob, cancelJob } from '../src/controllers/jobController.js';

console.log('--- TESTING AIRBOUND RENT-TO-OWN (EQUITY LEASE) SYSTEM ---');

let mongod;

async function setup() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Seed Vision SF50
  await Aircraft.create([
    {
      model_id: 'sf50',
      name: 'Cirrus Vision SF50',
      category: 'jet',
      purchase_price: 2850000,
      rental_price_per_flight: 6800,
      cruise_speed_kts: 311,
      max_range_nm: 1275,
      max_cargo_lbs: 1200,
      max_pax: 4,
      min_runway_ft: 3160,
      fuel_type: 'Jet-A',
      fuel_burn_gph: 68.0
    }
  ]);

  await Airport.create([
    { icao: 'KLAX', name: 'Los Angeles Intl', location: { type: 'Point', coordinates: [-118.4081, 33.9425] }, longest_runway_ft: 12091, elevation_ft: 128 },
    { icao: 'KLAS', name: 'Harry Reid Intl', location: { type: 'Point', coordinates: [-115.1522, 36.0800] }, longest_runway_ft: 14510, elevation_ft: 2181 }
  ]);
}

function mockRes() {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
}

async function runTests() {
  try {
    await setup();

    // 1. Math verification
    console.log('1. Testing Rent-to-Own Equity Ratio Calculation...');
    assert.strictEqual(RENT_TO_OWN_EQUITY_RATIO, 0.75, 'Equity ratio should be 75%');
    assert.strictEqual(calculateRentalEquityCredit(6800), 5100, '75% of $6,800 is $5,100');
    assert.strictEqual(calculateRentalEquityCredit(0), 0, '0 fee yields 0 equity');
    console.log('✓ Equity calculation functions verified.');

    // 2. Initial lease creates banked equity
    console.log('2. Testing Aircraft Lease & Equity Accrual...');
    let pilot = await Pilot.create({
      callsign: 'TestCaptain',
      balance: 3000000,
      fleet: [],
      current_icao: 'KLAX'
    });

    const rentRes = mockRes();
    await rentAircraft({ body: { modelId: 'sf50' } }, rentRes);
    assert.strictEqual(rentRes.statusCode, 200);
    assert.ok(rentRes.data.pilot);

    pilot = await Pilot.findOne();
    assert.strictEqual(pilot.balance, 3000000 - 6800, 'Balance deducted $6,800 for lease initiation');
    assert.strictEqual(pilot.rent_to_own_equity['sf50'], 5100, '$5,100 accrued in pilot rent_to_own_equity');
    assert.strictEqual(pilot.fleet.length, 1);
    assert.strictEqual(pilot.fleet[0].model_id, 'sf50');
    assert.strictEqual(pilot.fleet[0].is_rental, true);
    assert.strictEqual(pilot.fleet[0].accumulated_equity, 5100, 'Airframe accumulated equity is $5,100');
    const airframeTail = pilot.fleet[0].tail_number;
    console.log(`✓ Initial lease accrued $5,100 equity toward ${pilot.fleet[0].name} (${airframeTail}).`);

    // 3. Catalog and Hangar enrichment
    console.log('3. Testing Catalog and Hangar Enrichment with Rent-to-Own Discount...');
    const catRes = mockRes();
    await getCatalog({}, catRes);
    const catSf50 = catRes.data.catalog.find((c) => c.model_id === 'sf50');
    assert.strictEqual(catSf50.accumulated_equity, 5100);
    assert.strictEqual(catSf50.effective_purchase_price, 2850000 - 5100);
    assert.strictEqual(catSf50.rental_equity_per_flight, 5100);

    const hangRes = mockRes();
    await getHangar({}, hangRes);
    const hangSf50 = hangRes.data.fleet.find((f) => f.model_id === 'sf50');
    assert.strictEqual(hangSf50.accumulated_equity, 5100);
    assert.strictEqual(hangSf50.remaining_buyout_price, 2850000 - 5100);
    assert.strictEqual(hangSf50.equity_percent, Math.round((5100 / 2850000) * 100));
    console.log(`✓ Catalog and Hangar correctly report $${hangSf50.remaining_buyout_price.toLocaleString()} buyout balance.`);

    // 4. Job flight rental payment credits additional equity
    console.log('4. Testing Job Flight Rental Fee Equity Credit...');
    pilot.fleet[0].rental_flights_paid = 0; // Rental needs fee for next flight
    pilot.active_aircraft.rental_flights_paid = 0;
    await pilot.save();

    const job = await Job.create({
      origin_icao: 'KLAX',
      destination_icao: 'KLAS',
      category: 'jet',
      aircraft_type: 'Cirrus Vision SF50',
      distance_nm: 236,
      cargo_lbs: 600,
      pax_count: 3,
      payout: 18000,
      fuel_cost_est: 900,
      landing_fee_est: 80,
      net_payout_est: 17020,
      status: 'available'
    });

    const acceptRes = mockRes();
    await acceptJob({ params: { id: job._id.toString() } }, acceptRes);
    assert.strictEqual(acceptRes.statusCode, 200);

    pilot = await Pilot.findOne();
    // Previous balance: 2993200 - 6800 = 2986400
    assert.strictEqual(pilot.rent_to_own_equity['sf50'], 5100 + 5100, 'Total equity should now be $10,200');
    assert.strictEqual(pilot.fleet[0].accumulated_equity, 10200);
    console.log('✓ Commercial flight rental fee credited +$5,100 (Total equity: $10,200).');

    // 5. Job cancellation reverses credited equity
    console.log('5. Testing Job Cancellation Reverses Credited Equity...');
    const cancelRes = mockRes();
    await cancelJob({ params: { id: job._id.toString() } }, cancelRes);
    assert.strictEqual(cancelRes.statusCode, 200);

    pilot = await Pilot.findOne();
    assert.strictEqual(pilot.rent_to_own_equity['sf50'], 5100, 'Cancelled job reversed equity back to $5,100');
    assert.strictEqual(pilot.fleet[0].accumulated_equity, 5100);
    console.log('✓ Job cancellation properly reversed equity back to $5,100.');

    // 6. Buying out the aircraft converts rental to owned, keeps logged flight hours, and deducts effective price
    console.log('6. Testing Airframe Buyout Conversion...');
    // Log 4.5 hours on the rental airframe
    pilot.fleet[0].flight_hours = 4.5;
    pilot.active_aircraft.flight_hours = 4.5;
    await pilot.save();

    const startingBalance = pilot.balance;
    const buyoutRes = mockRes();
    await buyAircraft({ body: { modelId: 'sf50', tailNumber: airframeTail } }, buyoutRes);
    assert.strictEqual(buyoutRes.statusCode, 200);
    assert.ok(buyoutRes.data.pilot);

    pilot = await Pilot.findOne();
    const expectedBuyoutCost = 2850000 - 5100;
    assert.strictEqual(pilot.balance, startingBalance - expectedBuyoutCost, 'Deducted buyout price');
    assert.strictEqual(pilot.rent_to_own_equity['sf50'], undefined, 'Banked equity cleared upon purchase');
    assert.strictEqual(pilot.fleet.length, 1, 'Still 1 aircraft in fleet');
    assert.strictEqual(pilot.fleet[0].tail_number, airframeTail, 'Preserved same tail number');
    assert.strictEqual(pilot.fleet[0].is_rental, false, 'Converted from rental to owned');
    assert.strictEqual(pilot.fleet[0].flight_hours, 4.5, 'Preserved 4.5 logged flight hours');
    assert.strictEqual(pilot.active_aircraft.is_rental, false);
    assert.strictEqual(pilot.active_aircraft.flight_hours, 4.5);
    console.log(`✓ Leased airframe (${airframeTail}) successfully bought out! Logged flight hours preserved (4.5 hrs).`);

    // 7. Test 100% equity scenario (Free claim)
    console.log('7. Testing 100% Equity Buyout (Claim Ownership Free)...');
    pilot.balance = 5000;
    pilot.rent_to_own_equity = { c172: 150000 }; // 172 purchase price is 135,000
    await pilot.save();

    await Aircraft.create({
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
    });

    const freeRes = mockRes();
    await buyAircraft({ body: { modelId: 'c172' } }, freeRes);
    assert.strictEqual(freeRes.statusCode, 200);
    pilot = await Pilot.findOne();
    assert.strictEqual(pilot.balance, 5000, 'Balance unchanged ($0 paid for free buyout)');
    const ownedC172 = pilot.fleet.find((p) => p.model_id === 'c172');
    assert.ok(ownedC172, 'C172 added to owned fleet');
    assert.strictEqual(ownedC172.is_rental, false);
    console.log('✓ 100% equity purchase allowed pilot to claim aircraft for free ($0).');

    console.log('\n✅ ALL RENT-TO-OWN INTEGRATION TESTS PASSED!');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runTests().catch((err) => {
  console.error('❌ Rent-to-Own Test failed:', err);
  process.exit(1);
});
