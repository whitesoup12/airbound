import './setupTestEnv.js';
import assert from 'assert';
import request from 'http';
import fs from 'fs';
import path from 'path';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Pilot from '../src/models/Pilot.js';
import Airport from '../src/models/Airport.js';
import app from '../src/app.js';
import {
  detectLogbookFiles,
  parseBinaryLogbook,
  importFlightsToPilot
} from '../src/services/msfsLogbookParser.js';

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
  console.log('--- TESTING SETTINGS API & MSFS 2024 LOGBOOK IMPORTER ---');

  await connectDB();
  await Pilot.deleteMany({});
  await Airport.deleteMany({});

  // Seed sample airports for distance and location calculation
  await Airport.create({
    icao: 'KADM',
    name: 'Ardmore Municipal Airport',
    city: 'Ardmore',
    country: 'US',
    location: { type: 'Point', coordinates: [-97.019, 34.303] }
  });
  await Airport.create({
    icao: 'KDTO',
    name: 'Denton Enterprise Airport',
    city: 'Denton',
    country: 'US',
    location: { type: 'Point', coordinates: [-97.199, 33.200] }
  });

  const pilot = await Pilot.create({
    callsign: 'TestAviator',
    balance: 20000,
    current_icao: 'KADM',
    visited_airports: ['KADM'],
    visited_countries: ['US'],
    flight_log: [],
    fleet: [
      {
        model_id: 'c172',
        name: 'Cessna 172 Skyhawk',
        tail_number: 'N172TB',
        category: 'single_prop',
        flight_hours: 0
      }
    ]
  });

  await new Promise((resolve) => {
    serverInstance = app.listen(0, '127.0.0.1', () => {
      serverPort = serverInstance.address().port;
      resolve();
    });
  });

  try {
    // 1. Test GET /api/settings
    console.log('1. Testing GET /api/settings...');
    const getSettingsRes = await makeRequest('GET', '/api/settings');
    assert.strictEqual(getSettingsRes.status, 200, 'Expected 200 from GET /api/settings');
    assert.strictEqual(getSettingsRes.body.settings.database.type, 'local');
    assert.strictEqual(getSettingsRes.body.liveStatus.isConnected, true);
    console.log('✓ Successfully fetched settings and live database status.');

    // 2. Test POST /api/settings/test-db with invalid URI
    console.log('2. Testing POST /api/settings/test-db with invalid connection string...');
    const testDbRes = await makeRequest('POST', '/api/settings/test-db', {
      uri: 'mongodb://invalid-host-that-does-not-exist:27017/airbound_test'
    });
    assert.strictEqual(testDbRes.body.success, false, 'Expected connection failure for invalid URI');
    console.log('✓ Invalid MongoDB connection string correctly caught and reported.');

    // 3. Test MSFS Logbook Detection
    console.log('3. Testing MSFS 2024 Logbook Detection...');
    const detectedFiles = detectLogbookFiles();
    assert(Array.isArray(detectedFiles), 'Expected array of detected files');
    console.log(`✓ Logbook detection completed. Found ${detectedFiles.length} candidate logbooks on system.`);

    // 4. Test MSFS 2024 Logbook Parsing
    const testLogbook = detectedFiles.find((d) => d.sim === 'MSFS 2024') || detectedFiles[0];
    if (testLogbook && fs.existsSync(testLogbook.path)) {
      console.log(`4. Testing binary parsing of: ${testLogbook.path}...`);
      const parsedFlights = parseBinaryLogbook(testLogbook.path);
      assert(parsedFlights.length > 0, 'Expected parsed flights from logbook');
      const sample = parsedFlights[0];
      assert(sample.origin_icao, 'Flight should have origin ICAO');
      assert(sample.destination_icao, 'Flight should have destination ICAO');
      assert(typeof sample.duration_seconds === 'number', 'Duration should be number');
      assert(sample.aircraft_title, 'Flight should have aircraft title');
      console.log(`✓ Parsed ${parsedFlights.length} flights with valid ICAOs and aircraft titles.`);

      // 5. Test POST /api/settings/msfs-logbook/import
      console.log('5. Testing POST /api/settings/msfs-logbook/import API endpoint...');
      const importRes = await makeRequest('POST', '/api/settings/msfs-logbook/import', {
        path: testLogbook.path
      });
      assert.strictEqual(importRes.status, 200, 'Expected HTTP 200 on logbook import');
      assert.strictEqual(importRes.body.success, true);
      assert(importRes.body.imported > 0, 'Expected imported flight count > 0');
      assert(importRes.body.totalFlights > 0, 'Expected total flights > 0');
      console.log(`✓ Successfully imported ${importRes.body.imported} flights into pilot career logbook.`);

      // 6. Test Idempotency (Re-importing should skip existing flights)
      console.log('6. Testing Idempotent Re-Import (Duplicate Prevention)...');
      const reimportRes = await makeRequest('POST', '/api/settings/msfs-logbook/import', {
        path: testLogbook.path
      });
      assert.strictEqual(reimportRes.status, 200);
      assert.strictEqual(reimportRes.body.imported, 0, 'Expected 0 newly imported flights on re-import');
      assert(reimportRes.body.skipped > 0, 'Expected skipped count > 0 on duplicate import');
      console.log(`✓ Idempotency verified: ${reimportRes.body.skipped} duplicate flights safely skipped.`);

      const updatedPilot = await Pilot.findOne();
      assert(updatedPilot.flight_log.length > 0, 'Pilot flight log should contain entries');
      assert(updatedPilot.xp > 0, 'Career XP should be awarded for imported flights');
      console.log(`✓ Pilot profile updated with ${updatedPilot.flight_log.length} flights and ${updatedPilot.xp} career XP.`);
    } else {
      console.log('4. Skipping binary parsing test (no local MSFS installation in test container).');
    }

    // 8. Test normalizeMongoUri
    console.log('8. Testing MongoDB URI Normalization (Default to "airbound" instead of "test")...');
    const { normalizeMongoUri } = await import('../src/services/settingsService.js');
    const uriWithoutDb = 'mongodb+srv://user:pass@airbound.uucohew.mongodb.net/?appName=airbound-local';
    const normalizedNoDb = normalizeMongoUri(uriWithoutDb);
    assert.strictEqual(
      normalizedNoDb,
      'mongodb+srv://user:pass@airbound.uucohew.mongodb.net/airbound?appName=airbound-local',
      'URI without DB name should default to /airbound'
    );

    const uriWithTest = 'mongodb+srv://user:pass@cluster.mongodb.net/test?retryWrites=true';
    const normalizedTest = normalizeMongoUri(uriWithTest);
    assert.strictEqual(
      normalizedTest,
      'mongodb+srv://user:pass@cluster.mongodb.net/airbound?retryWrites=true',
      'URI with /test should be remapped to /airbound'
    );

    const uriWithCustom = 'mongodb+srv://user:pass@cluster.mongodb.net/custom_career?retryWrites=true';
    const normalizedCustom = normalizeMongoUri(uriWithCustom);
    assert.strictEqual(
      normalizedCustom,
      uriWithCustom,
      'URI with custom DB name should remain unchanged'
    );

    const localMongoUri = 'mongodb://127.0.0.1:27017';
    assert.strictEqual(
      normalizeMongoUri(localMongoUri),
      'mongodb://127.0.0.1:27017/airbound',
      'Local MongoDB URI without DB should default to /airbound'
    );
    console.log('✓ MongoDB URI normalization verified: default DB name is "airbound".');

    // 9. Test POST /api/settings/complete-onboarding
    console.log('9. Testing POST /api/settings/complete-onboarding...');
    const onboardingRes = await makeRequest('POST', '/api/settings/complete-onboarding');
    assert.strictEqual(onboardingRes.status, 200);
    assert.strictEqual(onboardingRes.body.success, true);
    assert.strictEqual(onboardingRes.body.settings.hasCompletedOnboarding, true);
    console.log('✓ Onboarding completion flag saved successfully.');

    // 10. Test Job Distance Variety from KXNA
    console.log('10. Testing Job Distance Tier Variety (Short, Medium, Long)...');
    const { seedAirports } = await import('../src/seeds/seedAirports.js');
    await seedAirports({ full: false, closeConnection: false });
    const { generateJobsForAirport } = await import('../src/services/jobGenerator.js');
    const generatedJobs = await generateJobsForAirport('KXNA');
    assert.strictEqual(generatedJobs.length, 9, 'Expected 9 contracts generated');
    const tiersFound = new Set(generatedJobs.map((j) => j.tier));
    assert(tiersFound.has('short'), 'Dispatch board must include Short flights');
    assert(tiersFound.has('medium'), 'Dispatch board must include Medium flights');
    assert(tiersFound.has('long'), 'Dispatch board must include Long flights');
    console.log(`✓ Job variety verified: Generated 9 jobs spanning ${Array.from(tiersFound).join(', ')} tiers.`);

    console.log('\n✅ ALL SETTINGS, URI NORMALIZATION, ONBOARDING & JOB DIVERSITY TESTS PASSED!\n');
  } finally {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    await disconnectDB();
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
