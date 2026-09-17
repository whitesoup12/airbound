import Pilot from '../models/Pilot.js';
import Job from '../models/Job.js';
import Airport from '../models/Airport.js';
import flightStateMachine from '../services/stateMachine.js';
import simConnectBridge from '../services/simconnect.js';
import { generateJobsForAirport } from '../services/jobGenerator.js';
import { normalizeTo4CharIcao } from '../utils/icaoUtils.js';
import { getPilotRank, calculateRetroactiveXp } from '../services/xpService.js';

export async function getPilot(req, res) {
  try {
    let pilot = await Pilot.findOne();
    if (!pilot) {
      pilot = await Pilot.create({
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
    } else {
      let needsSave = false;

      // Auto-heal current_icao if 3 characters (e.g. JLN -> KJLN)
      const normCurrent = await normalizeTo4CharIcao(pilot.current_icao);
      if (normCurrent && normCurrent !== pilot.current_icao) {
        pilot.current_icao = normCurrent;
        needsSave = true;
      }

      // Auto-heal visited_airports if any 3-char aliases exist
      if (pilot.visited_airports && pilot.visited_airports.length > 0) {
        const normalizedVisited = [];
        const seenVisited = new Set();
        for (const code of pilot.visited_airports) {
          const norm = await normalizeTo4CharIcao(code);
          if (!seenVisited.has(norm)) {
            seenVisited.add(norm);
            normalizedVisited.push(norm);
          }
        }
        if (
          normalizedVisited.length !== pilot.visited_airports.length ||
          normalizedVisited.some((c, idx) => c !== pilot.visited_airports[idx])
        ) {
          pilot.visited_airports = normalizedVisited;
          needsSave = true;
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
      // Auto-compute/recalibrate career XP from flight log
      if (pilot.flight_log && pilot.flight_log.length > 0) {
        const retroXp = calculateRetroactiveXp(pilot.flight_log);
        if (retroXp !== pilot.xp) {
          pilot.xp = retroXp;
          const r = getPilotRank(pilot.xp);
          pilot.level = r.level;
          pilot.rank_title = r.title;
          needsSave = true;
          console.log(`[Pilot] Recalibrated career XP: ${retroXp} XP -> Level ${r.level} (${r.title})`);
        }

        // Backfill exploration_bonus from completed Job records if missing
        const missingBonusFlights = pilot.flight_log.filter(
          (f) => f.job_id && (f.exploration_bonus === undefined || f.exploration_bonus === 0)
        );
        if (missingBonusFlights.length > 0) {
          const jobIds = missingBonusFlights.map((f) => f.job_id);
          const bonusJobs = await Job.find({
            _id: { $in: jobIds },
            exploration_bonus: { $gt: 0 }
          }).select('_id exploration_bonus');
          if (bonusJobs.length > 0) {
            const bonusMap = new Map(bonusJobs.map((j) => [j._id.toString(), j.exploration_bonus]));
            for (const f of missingBonusFlights) {
              const bonus = bonusMap.get(f.job_id?.toString());
              if (bonus) {
                f.exploration_bonus = bonus;
                needsSave = true;
                console.log(`[Pilot] Backfilled exploration bonus of $${bonus} for flight ${f.origin_icao} -> ${f.destination_icao}`);
              }
            }
          }
        }

        // Backfill rental_fee for flights flown in rental aircraft
        const rentalPlanes = (pilot.fleet || []).filter((p) => p.is_rental && !p.is_loaner);
        if (rentalPlanes.length > 0) {
          for (const f of pilot.flight_log) {
            if (f.source === 'airbound_dispatch' && (!f.rental_fee || f.rental_fee === 0)) {
              const matchedRental = rentalPlanes.find((rp) =>
                f.aircraft_name && (
                  f.aircraft_name.toLowerCase().includes(rp.model_id.toLowerCase()) ||
                  rp.name.toLowerCase().includes(f.aircraft_name.toLowerCase())
                )
              );
              if (matchedRental && matchedRental.rental_price_per_flight > 0) {
                f.rental_fee = matchedRental.rental_price_per_flight;
                needsSave = true;
                console.log(`[Pilot] Backfilled rental fee of $${matchedRental.rental_price_per_flight} for flight ${f.origin_icao} -> ${f.destination_icao} in ${f.aircraft_name}`);
              }
            }
          }
        }
      }

      if (needsSave) {
        await pilot.save();
      }
    }

    const rankInfo = getPilotRank(pilot?.xp || 0);

    // Check for an active accepted job
    const activeJob = await Job.findOne({ status: 'accepted' });

    // Airport details for current airport
    const currentAirport = await Airport.findOne({ icao: pilot.current_icao });

    // Full details for all visited airports
    const visitedAirportsDetails = await Airport.find({
      icao: { $in: pilot.visited_airports || [] }
    }).lean();

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
