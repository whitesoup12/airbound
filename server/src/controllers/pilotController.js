import Pilot from '../models/Pilot.js';
import Job from '../models/Job.js';
import Airport from '../models/Airport.js';
import flightStateMachine from '../services/stateMachine.js';
import simConnectBridge from '../services/simconnect.js';
import { generateJobsForAirport } from '../services/jobGenerator.js';
import { normalizeTo4CharIcao } from '../utils/icaoUtils.js';
import { getPilotRank, calculateRetroactiveXp } from '../services/xpService.js';

import { getCachedAirport, getCachedAirportsList } from '../services/airportCache.js';
export { getCachedAirport, getCachedAirportsList };

export async function getPilot(req, res) {
  try {
    const pilot = await Pilot.findOne().lean();
    if (!pilot) {
      const created = await Pilot.create({
        callsign: 'James',
        balance: 15000,
        current_icao: 'KLAX',
        visited_airports: ['KLAX'],
        visited_countries: ['US'],
        flight_log: [],
        active_aircraft: {
          model_id: 'c172',
          name: 'Cessna 172 Skyhawk',
          tail_number: 'N172AB',
          category: 'single_prop',
          cruise_speed_kts: 120,
          max_range_nm: 500,
          max_cargo_lbs: 500,
          max_pax: 3,
          min_runway_ft: 1600,
          fuel_type: '100LL',
          fuel_burn_gph: 9.0
        },
        fleet: [
          {
            model_id: 'c172',
            name: 'Cessna 172 Skyhawk',
            tail_number: 'N172AB',
            category: 'single_prop',
            is_rental: false,
            purchased_at: new Date(),
            flight_hours: 0
          }
        ]
      });
      return res.json({
        pilot: created,
        rankInfo: getPilotRank(created.xp || 0),
        activeJob: null,
        currentAirport: null,
        visitedAirportsDetails: [],
        phase: flightStateMachine.phase
      });
    }

    const rankInfo = getPilotRank(pilot.xp || 0);
    const activeJob =
      flightStateMachine.activeJob && flightStateMachine.activeJob.status === 'accepted'
        ? flightStateMachine.activeJob
        : await Job.findOne({ status: 'accepted' }).lean();
    const currentAirport = await getCachedAirport(pilot.current_icao);
    const visitedAirportsDetails = await getCachedAirportsList(pilot.visited_airports || []);

    res.json({
      pilot,
      rankInfo,
      activeJob,
      currentAirport,
      visitedAirportsDetails,
      phase: flightStateMachine.phase
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Startup background data healing and migration function
 * Runs once at server start, never blocks incoming HTTP GET requests
 */
export async function healPilotData() {
  try {
    const pilot = await Pilot.findOne();
    if (!pilot) return;

    let needsSave = false;

    // Auto-heal current_icao if 3 characters (e.g. JLN -> KJLN)
    const normCurrent = await normalizeTo4CharIcao(pilot.current_icao);
    if (normCurrent && normCurrent !== pilot.current_icao) {
      pilot.current_icao = normCurrent;
      needsSave = true;
    }

    // Auto-heal visited_airports if any 3-char aliases exist
    if (pilot.visited_airports && pilot.visited_airports.length > 0) {
      const threeCharCodes = pilot.visited_airports.filter((c) => c && c.length === 3);
      if (threeCharCodes.length > 0) {
        const candidateCodes = threeCharCodes.map((c) => 'K' + c.toUpperCase());
        const foundAirports = await Airport.find({ icao: { $in: candidateCodes } }).select('icao').lean();
        const validKSet = new Set(foundAirports.map((a) => a.icao));
        const normalizedVisited = Array.from(new Set(
          pilot.visited_airports.map((c) => {
            if (c && c.length === 3) {
              const kCode = 'K' + c.toUpperCase();
              return validKSet.has(kCode) ? kCode : c.toUpperCase();
            }
            return c.toUpperCase();
          })
        ));
        if (
          normalizedVisited.length !== pilot.visited_airports.length ||
          normalizedVisited.some((c, idx) => c !== pilot.visited_airports[idx])
        ) {
          pilot.visited_airports = normalizedVisited;
          needsSave = true;
        }
      }
    }

    if (!pilot.active_aircraft || !pilot.active_aircraft.model_id) {
      pilot.active_aircraft = {
        model_id: 'c172',
        name: 'Cessna 172 Skyhawk',
        tail_number: 'N172AB',
        category: 'single_prop',
        cruise_speed_kts: 120,
        max_range_nm: 500,
        max_cargo_lbs: 500,
        max_pax: 3,
        min_runway_ft: 1600,
        fuel_type: '100LL',
        fuel_burn_gph: 9.0
      };
      needsSave = true;
    }

    if (!pilot.fleet || pilot.fleet.length === 0) {
      pilot.fleet = [
        {
          model_id: 'c172',
          name: 'Cessna 172 Skyhawk',
          tail_number: 'N172AB',
          category: 'single_prop',
          is_rental: false,
          purchased_at: new Date(),
          flight_hours: 0
        }
      ];
      needsSave = true;
    }

    if (pilot.flight_log && pilot.flight_log.length > 0) {
      const retroXp = calculateRetroactiveXp(pilot.flight_log);
      if (retroXp !== pilot.xp) {
        pilot.xp = retroXp;
        const r = getPilotRank(pilot.xp);
        pilot.level = r.level;
        pilot.rank_title = r.title;
        needsSave = true;
      }
    }

    // Synchronize rental rates for any leased aircraft in fleet or active_aircraft with catalog
    try {
      const Aircraft = (await import('../models/Aircraft.js')).default;
      const catalogModels = await Aircraft.find().lean();
      const modelMap = new Map(catalogModels.map((m) => [m.model_id, m]));

      if (pilot.active_aircraft && pilot.active_aircraft.is_rental && !pilot.active_aircraft.is_loaner) {
        const cat = modelMap.get(pilot.active_aircraft.model_id);
        if (cat && cat.rental_price_per_flight && pilot.active_aircraft.rental_price_per_flight !== cat.rental_price_per_flight) {
          pilot.active_aircraft.rental_price_per_flight = cat.rental_price_per_flight;
          needsSave = true;
        }
      }

      if (pilot.fleet && pilot.fleet.length > 0) {
        for (const plane of pilot.fleet) {
          if (plane.is_rental && !plane.is_loaner) {
            const cat = modelMap.get(plane.model_id);
            if (cat && cat.rental_price_per_flight && plane.rental_price_per_flight !== cat.rental_price_per_flight) {
              plane.rental_price_per_flight = cat.rental_price_per_flight;
              needsSave = true;
            }
          }
        }
      }
    } catch (catErr) {
      console.warn('[Pilot] Could not synchronize rental catalog rates:', catErr.message);
    }

    if (needsSave) {
      await pilot.save();
      console.log('[Pilot] Pilot profile healed and synchronized at startup.');
    }
  } catch (err) {
    console.warn('[Pilot] Background healing warning:', err.message);
  }
}

export async function resetPilot(req, res) {
  try {
    const { homeBase, icao, startingBalance } = req.body || {};
    let targetIcao = ((homeBase || icao || 'KXNA') + '').trim().toUpperCase();
    targetIcao = await normalizeTo4CharIcao(targetIcao);

    // Check airport
    let airport = await Airport.findOne({ icao: targetIcao });
    if (!airport) {
      if (homeBase || icao) {
        return res.status(404).json({ error: `Airport '${targetIcao}' not found in database.` });
      }
      airport = await Airport.findOne();
      if (airport) {
        targetIcao = airport.icao;
      }
    }

    let pilot = await Pilot.findOne();
    if (!pilot) {
      pilot = new Pilot();
    }
    pilot.callsign = pilot.callsign || 'James';
    pilot.balance = startingBalance !== undefined && !isNaN(Number(startingBalance)) ? Number(startingBalance) : 15000;
    pilot.current_icao = targetIcao;
    if (!pilot.visited_airports || pilot.visited_airports.length === 0) {
      pilot.visited_airports = [targetIcao];
    } else if (!pilot.visited_airports.includes(targetIcao)) {
      pilot.visited_airports.push(targetIcao);
    }
    if (airport?.country) {
      if (!pilot.visited_countries || pilot.visited_countries.length === 0) {
        pilot.visited_countries = [airport.country];
      } else if (!pilot.visited_countries.includes(airport.country)) {
        pilot.visited_countries.push(airport.country);
      }
    }
    // Flight logs are permanently preserved across career resets
    pilot.flight_log = pilot.flight_log || [];
    pilot.active_aircraft = {
      model_id: 'c172',
      name: 'Cessna 172 Skyhawk',
      tail_number: 'N172AB',
      category: 'single_prop',
      cruise_speed_kts: 120,
      max_range_nm: 500,
      max_cargo_lbs: 500,
      max_pax: 3,
      min_runway_ft: 1600,
      fuel_type: '100LL',
      fuel_burn_gph: 9.0
    };
    pilot.fleet = [
      {
        model_id: 'c172',
        name: 'Cessna 172 Skyhawk',
        tail_number: 'N172AB',
        category: 'single_prop',
        is_rental: false,
        purchased_at: new Date(),
        flight_hours: 0
      }
    ];
    await pilot.save();

    await Job.deleteMany({});
    await flightStateMachine.clearActiveJob();

    try {
      await simConnectBridge.teleportToAirport(targetIcao);
    } catch (e) {
      console.warn('[Pilot Reset] Teleport note:', e.message);
    }

    await generateJobsForAirport(targetIcao, { aircraft: pilot.active_aircraft });

    res.json({ message: 'Pilot career reset successfully', pilot, currentAirport: airport });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Update the pilot's base airport
 */
export async function updateBaseAirport(req, res) {
  try {
    const { icao } = req.body;
    if (!icao) return res.status(400).json({ error: 'ICAO is required' });

    const targetIcao = await normalizeTo4CharIcao(icao.trim().toUpperCase());
    const airport = await Airport.findOne({ icao: targetIcao });
    if (!airport) {
      return res.status(404).json({ error: `Airport '${targetIcao}' not found in database.` });
    }

    let pilot = await Pilot.findOne();
    if (!pilot) {
      pilot = new Pilot({ callsign: 'James' });
    }

    pilot.current_icao = targetIcao;
    if (!pilot.visited_airports.includes(targetIcao)) {
      pilot.visited_airports.push(targetIcao);
    }
    if (airport.country && !pilot.visited_countries.includes(airport.country)) {
      pilot.visited_countries.push(airport.country);
    }
    await pilot.save();

    // Cancel any active accepted job if base airport changed
    const activeJob = await Job.findOne({ status: 'accepted' });
    if (activeJob) {
      activeJob.status = 'failed';
      await activeJob.save();
      await flightStateMachine.clearActiveJob();
    }

    // Teleport aircraft to new airport
    await simConnectBridge.teleportToAirport(targetIcao);

    // Generate fresh jobs for new base airport scaled to active aircraft
    const newJobs = await generateJobsForAirport(targetIcao, { aircraft: pilot.active_aircraft });

    res.json({
      message: `Base airport updated to ${targetIcao}`,
      pilot,
      currentAirport: airport,
      jobs: newJobs,
      telemetry: simConnectBridge.telemetry
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Import MSFS 2024 flights into pilot's career logbook
 */
export async function importMsfsLogs(req, res) {
  try {
    const { importMsfsLogbook } = await import('../scripts/importMsfsLogbook.js');
    const result = await importMsfsLogbook({ closeConnection: false });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
