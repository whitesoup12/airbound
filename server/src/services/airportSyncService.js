import https from 'https';
import csv from 'csv-parser';
import EventEmitter from 'events';
import Airport from '../models/Airport.js';
import Pilot from '../models/Pilot.js';

export const airportSyncEmitter = new EventEmitter();

// In-memory progress state tracker
let syncState = {
  active: false,
  stage: 'idle', // 'idle' | 'downloading_runways' | 'downloading_airports' | 'ingesting' | 'indexing' | 'completed' | 'error'
  percent: 0,
  current: 0,
  total: 0,
  message: 'Ready to sync MSFS airports.',
  error: null,
  completedAt: null
};

function updateState(partial) {
  syncState = { ...syncState, ...partial };
  airportSyncEmitter.emit('progress', syncState);
}

export function getSyncStatus() {
  return { ...syncState };
}

function downloadStream(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
      }
      resolve(res);
    }).on('error', reject);
  });
}

const ICAO_PREFIX_TO_COUNTRY = {
  K: 'US', C: 'CA', ED: 'DE', ET: 'DE', LF: 'FR', EG: 'GB', LI: 'IT', LE: 'ES',
  LP: 'PT', LG: 'GR', EB: 'BE', EH: 'NL', LS: 'CH', LO: 'AT', LK: 'CZ', LZ: 'SK',
  EP: 'PL', LH: 'HU', LR: 'RO', LB: 'BG', SC: 'CL', SA: 'AR', SB: 'BR', SK: 'CO',
  SV: 'VE', SP: 'PE', MM: 'MX', MY: 'BS', MK: 'JM', MD: 'DO', MT: 'HT', MU: 'CU',
  FM: 'MG', FA: 'ZA', OT: 'QA', OE: 'SA', OM: 'AE', RK: 'KR', RJ: 'JP', YB: 'AU',
  YM: 'AU', NZ: 'NZ', NT: 'PF'
};

function inferCountry(icao) {
  if (!icao) return 'US';
  const code = icao.toUpperCase().trim();
  const p2 = code.slice(0, 2);
  if (ICAO_PREFIX_TO_COUNTRY[p2]) return ICAO_PREFIX_TO_COUNTRY[p2];
  const p1 = code.slice(0, 1);
  if (ICAO_PREFIX_TO_COUNTRY[p1]) return ICAO_PREFIX_TO_COUNTRY[p1];
  return 'US';
}

/**
 * Initiates streaming download and ingestion of ~49,000 active MSFS fixed-wing airports
 */
export async function startAirportSync() {
  if (syncState.active) {
    return syncState;
  }

  updateState({
    active: true,
    stage: 'downloading_runways',
    percent: 5,
    current: 0,
    total: 0,
    message: 'Connecting to aviation database & downloading runway catalog (1/3)...',
    error: null
  });

  // Run in background so caller receives immediate response
  (async () => {
    try {
      // Step 1: Download & parse runways.csv
      const runwayStream = await downloadStream('https://davidmegginson.github.io/ourairports-data/runways.csv');
      const runwayMap = new Map();
      let runwayCount = 0;

      await new Promise((resolve, reject) => {
        runwayStream
          .pipe(csv())
          .on('data', (rw) => {
            runwayCount++;
            const ident = (rw.airport_ident || '').trim().toUpperCase();
            const len = parseInt(rw.length_ft, 10);
            if (ident && !isNaN(len) && len > 0) {
              const current = runwayMap.get(ident) || 0;
              if (len > current) runwayMap.set(ident, len);
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });

      console.log(`[Airport Sync] Mapped runways for ${runwayMap.size.toLocaleString()} airfields.`);
      updateState({
        stage: 'downloading_airports',
        percent: 25,
        message: `Parsed ${runwayMap.size.toLocaleString()} runways. Downloading MSFS airport catalog (2/3)...`
      });

      // Step 2: Download & filter airports.csv
      const airportStream = await downloadStream('https://davidmegginson.github.io/ourairports-data/airports.csv');
      const targetAirports = [];

      await new Promise((resolve, reject) => {
        airportStream
          .pipe(csv())
          .on('data', (a) => {
            const type = a.type;
            // Filter out closed, heliports, and balloonports
            // Preserves all small_airport, medium_airport, large_airport, and seaplane_base modeled in MSFS
            if (type === 'closed' || type === 'heliport' || type === 'balloonport') {
              return;
            }

            const ident = (a.ident || a.local_code || a.gps_code || '').trim().toUpperCase();
            const lat = parseFloat(a.latitude_deg);
            const lon = parseFloat(a.longitude_deg);
            if (!ident || isNaN(lat) || isNaN(lon)) return;

            targetAirports.push(a);
          })
          .on('end', resolve)
          .on('error', reject);
      });

      const totalAirports = targetAirports.length;
      console.log(`[Airport Sync] Filtered ${totalAirports.toLocaleString()} active MSFS fixed-wing airfields.`);

      updateState({
        stage: 'ingesting',
        percent: 40,
        total: totalAirports,
        current: 0,
        message: `Ingesting ${totalAirports.toLocaleString()} MSFS airports into database (3/3)...`
      });

      // Step 3: Batch upsert into MongoDB
      const bulkBatchSize = 2500;
      let bulkOps = [];
      let insertedCount = 0;

      for (const a of targetAirports) {
        const ident = (a.ident || '').trim().toUpperCase();
        const local = (a.local_code || '').trim().toUpperCase();
        const gps = (a.gps_code || '').trim().toUpperCase();
        const lat = parseFloat(a.latitude_deg);
        const lon = parseFloat(a.longitude_deg);

        const country = (a.iso_country || inferCountry(ident)).trim().toUpperCase();
        const name = a.name || ident;
        const city = (a.municipality || '').trim();

        let runwayFt = runwayMap.get(ident) || runwayMap.get(local) || runwayMap.get(gps);
        if (!runwayFt) {
          switch (a.type) {
            case 'large_airport': runwayFt = 10000; break;
            case 'medium_airport': runwayFt = 5500; break;
            case 'seaplane_base': runwayFt = 4000; break;
            default: runwayFt = 3200;
          }
        }

        // Standardize 3-letter US codes to 4-character ICAO (e.g. JLN -> KJLN)
        let primaryIcao = ident;
        if (ident.length === 3 && country === 'US' && /^[A-Z]{3}$/.test(ident)) {
          primaryIcao = 'K' + ident;
        }

        bulkOps.push({
          updateOne: {
            filter: { icao: primaryIcao },
            update: {
              $set: {
                icao: primaryIcao,
                name,
                city,
                country,
                longest_runway_ft: runwayFt,
                location: {
                  type: 'Point',
                  coordinates: [lon, lat]
                }
              }
            },
            upsert: true
          }
        });

        if (bulkOps.length >= bulkBatchSize) {
          await Airport.bulkWrite(bulkOps, { ordered: false });
          insertedCount += bulkOps.length;
          bulkOps = [];

          const currentPct = Math.min(95, Math.round(40 + (insertedCount / totalAirports) * 55));
          updateState({
            current: insertedCount,
            percent: currentPct,
            message: `Ingested ${insertedCount.toLocaleString()} / ${totalAirports.toLocaleString()} airports (${currentPct}%)...`
          });
        }
      }

      if (bulkOps.length > 0) {
        await Airport.bulkWrite(bulkOps, { ordered: false });
        insertedCount += bulkOps.length;
        bulkOps = [];
      }

      // Step 4: Indexing & sync
      updateState({
        stage: 'indexing',
        percent: 96,
        current: insertedCount,
        message: 'Building 2dsphere spatial index for instant radius dispatch...'
      });

      await Airport.createIndexes();

      // Optional pilot sync
      const pilot = await Pilot.findOne();
      if (pilot && pilot.visited_airports?.length > 0) {
        const visitedDocs = await Airport.find({ icao: { $in: pilot.visited_airports } }).select('country');
        const countries = new Set(visitedDocs.map((d) => d.country).filter(Boolean));
        if (countries.size > 0) {
          pilot.visited_countries = Array.from(countries).sort();
          await pilot.save();
        }
      }

      const totalInDb = await Airport.countDocuments();
      console.log(`[Airport Sync] Ingestion completed. Total airfields in DB: ${totalInDb.toLocaleString()}`);

      updateState({
        active: false,
        stage: 'completed',
        percent: 100,
        current: totalInDb,
        total: totalInDb,
        completedAt: new Date(),
        message: `Complete! ${totalInDb.toLocaleString()} Microsoft Flight Simulator airfields ready for dispatch.`
      });
    } catch (err) {
      console.error('[Airport Sync Error]:', err);
      updateState({
        active: false,
        stage: 'error',
        error: err.message || 'Airport sync failed',
        message: `Airport sync failed: ${err.message}`
      });
    }
  })();

  return syncState;
}

export default {
  airportSyncEmitter,
  getSyncStatus,
  startAirportSync
};
