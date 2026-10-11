import express from 'express';
import simConnectBridge from '../services/simconnect.js';
import flightStateMachine, { FLIGHT_PHASES } from '../services/stateMachine.js';
import Airport from '../models/Airport.js';
import Pilot from '../models/Pilot.js';
import Job from '../models/Job.js';
import { generateJobsForAirport } from '../services/jobGenerator.js';

const router = express.Router();

/**
 * Step directly to a specified flight phase for rapid testing
 */
router.post('/step-phase', async (req, res) => {
  try {
    const { phase } = req.body;
    let activeJob = flightStateMachine.activeJob;

    // If no active job is accepted yet, auto-accept a contract so the user can test immediately!
    if (!activeJob && phase !== FLIGHT_PHASES.STANDBY) {
      let pilot = await Pilot.findOne();
      const currentIcao = pilot?.current_icao || 'KLAX';

      let job = await Job.findOne({ origin_icao: currentIcao, status: 'available' });
      if (!job) {
        const generated = await generateJobsForAirport(currentIcao);
        job = generated[0];
      }

      if (job) {
        job = await Job.findById(job._id);
        job.status = 'accepted';
        job.accepted_at = new Date();
        await job.save();
        await flightStateMachine.setActiveJob(job);
        activeJob = job;
        console.log(`[Simulator] Auto-accepted contract ${job.origin_icao} -> ${job.destination_icao} for testing.`);
      } else {
        return res.status(400).json({ error: 'No contracts available to simulate. Please generate a contract first.' });
      }
    }

    const orig = flightStateMachine.originAirport;
    const dest = flightStateMachine.destinationAirport;
    const [oLon, oLat] = orig?.location?.coordinates || [-118.408, 33.942];
    const [dLon, dLat] = dest?.location?.coordinates || [-115.152, 36.080];

    switch (phase) {
      case FLIGHT_PHASES.IDLE:
        await simConnectBridge.injectTelemetry({
          latitude: oLat,
          longitude: oLon,
          altitude: 125,
          heading: 250,
          simOnGround: true,
          airspeedTrue: 0,
          groundSpeed: 0,
          parkingBrake: true,
          engineRunning: true
        });
        break;

      case FLIGHT_PHASES.DEPARTED:
        // Position within 1 NM of origin, airborne climbing
        await simConnectBridge.injectTelemetry({
          latitude: oLat + 0.01,
          longitude: oLon + 0.01,
          altitude: 800,
          heading: 70,
          simOnGround: false,
          airspeedTrue: 110,
          groundSpeed: 115,
          parkingBrake: false,
          engineRunning: true
        });
        break;

      case FLIGHT_PHASES.EN_ROUTE:
        // Midpoint airborne cruise
        await simConnectBridge.injectTelemetry({
          latitude: (oLat + dLat) / 2,
          longitude: (oLon + dLon) / 2,
          altitude: 8500,
          heading: 50,
          simOnGround: false,
          airspeedTrue: 160,
          groundSpeed: 165,
          parkingBrake: false,
          engineRunning: true
        });
        break;

      case FLIGHT_PHASES.TOUCHDOWN:
        // Within 1 NM of destination on ground
        await simConnectBridge.injectTelemetry({
          latitude: dLat,
          longitude: dLon,
          altitude: 150,
          heading: 10,
          simOnGround: true,
          airspeedTrue: 45,
          groundSpeed: 45,
          parkingBrake: false,
          engineRunning: true
        });
        break;

      case FLIGHT_PHASES.COMPLETED:
        // Stopped and secured at destination
        await simConnectBridge.injectTelemetry({
          latitude: dLat,
          longitude: dLon,
          altitude: 150,
          heading: 10,
          simOnGround: true,
          airspeedTrue: 0,
          groundSpeed: 0,
          parkingBrake: true,
          engineRunning: false
        });
        break;
    }

    // Force transition state machine
    await flightStateMachine.forceSetPhase(phase, simConnectBridge.telemetry);

    res.json({
      message: `Flight phase updated to ${phase}`,
      currentPhase: flightStateMachine.phase,
      activeJob: flightStateMachine.activeJob,
      telemetry: simConnectBridge.telemetry
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Start automated mock flight along the route
 */
router.post('/start-mock-flight', async (req, res) => {
  const { speedMultiplier = 1.0 } = req.body;
  let activeJob = flightStateMachine.activeJob;

  // Auto-accept if not yet accepted
  if (!activeJob) {
    let pilot = await Pilot.findOne();
    const currentIcao = pilot?.current_icao || 'KLAX';
    let job = await Job.findOne({ origin_icao: currentIcao, status: 'available' });
    if (!job) {
      const generated = await generateJobsForAirport(currentIcao);
      job = generated[0];
    }
    if (job) {
      job.status = 'accepted';
      job.accepted_at = new Date();
      await job.save();
      await flightStateMachine.setActiveJob(job);
      activeJob = job;
    } else {
      return res.status(400).json({ error: 'Please generate a job before starting auto flight.' });
    }
  }

  const orig = flightStateMachine.originAirport;
  const dest = flightStateMachine.destinationAirport;

  simConnectBridge.startAutomatedMockFlight(
    orig.location.coordinates,
    dest.location.coordinates,
    speedMultiplier
  );

  res.json({ message: 'Automated mock flight started', speedMultiplier, activeJob });
});

/**
 * Stop mock flight
 */
router.post('/stop-mock-flight', (req, res) => {
  simConnectBridge.stopAutomatedMockFlight();
  res.json({ message: 'Automated mock flight stopped' });
});

/**
 * Teleport to airport - moves aircraft position, updates base airport, and generates fresh contracts
 */
router.post('/teleport', async (req, res) => {
  try {
    const { icao } = req.body;
    if (!icao) return res.status(400).json({ error: 'ICAO is required' });

    const targetIcao = icao.trim().toUpperCase();
    const airport = await Airport.findOne({ icao: targetIcao });
    if (!airport) {
      return res.status(404).json({ error: `Airport '${targetIcao}' not found in database.` });
    }

    // Update pilot's current base location
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

    // Clear any active job
    await Job.updateMany({ status: 'accepted' }, { status: 'failed' });
    await flightStateMachine.clearActiveJob();

    // Teleport aircraft coordinates
    await simConnectBridge.teleportToAirport(targetIcao);

    // Generate fresh jobs for new location
    const jobs = await generateJobsForAirport(targetIcao);

    res.json({
      message: `Successfully teleported to ${airport.name} (${targetIcao})`,
      pilot,
      currentAirport: airport,
      jobs,
      telemetry: simConnectBridge.telemetry
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Seed rich mock career for screenshot capture & presentation
 */
router.post('/seed-mock-career', async (req, res) => {
  try {
    const now = Date.now();
    const day = 86400000;

    const flightLog = [
      {
        origin_icao: 'KLAX',
        destination_icao: 'KLAS',
        distance_nm: 205,
        cargo_lbs: 350,
        pax_count: 6,
        payout: 6450,
        gross_payout: 6450,
        fuel_cost: 380,
        fuel_gallons: 68,
        landing_fee: 350,
        rental_fee: 650,
        rent_to_own_equity_earned: 650,
        net_payout: 5070,
        exploration_bonus: 0,
        aircraft_name: 'Beechcraft King Air 350i',
        duration_seconds: 2820,
        airborne_seconds: 2580,
        departed_at: new Date(now - 1 * day - 3600000),
        completed_at: new Date(now - 1 * day),
        source: 'airbound_dispatch',
        xp_earned: 510,
        touchdown_fpm: -98,
        landing_rating: 'Butter',
        landing_class: 'Light Touchdown',
        approach_speed_kts: 105,
        category: 'turboprop'
      },
      {
        origin_icao: 'KLAS',
        destination_icao: 'KPHX',
        distance_nm: 222,
        cargo_lbs: 1400,
        pax_count: 0,
        payout: 6800,
        gross_payout: 6800,
        fuel_cost: 410,
        fuel_gallons: 73,
        landing_fee: 350,
        rental_fee: 650,
        rent_to_own_equity_earned: 650,
        net_payout: 5390,
        exploration_bonus: 500,
        aircraft_name: 'Beechcraft King Air 350i',
        duration_seconds: 2940,
        airborne_seconds: 2700,
        departed_at: new Date(now - 2 * day - 3600000),
        completed_at: new Date(now - 2 * day),
        source: 'airbound_dispatch',
        xp_earned: 490,
        touchdown_fpm: -145,
        landing_rating: 'Firm',
        landing_class: 'Good Landing',
        approach_speed_kts: 110,
        category: 'turboprop'
      },
      {
        origin_icao: 'KPHX',
        destination_icao: 'KSAN',
        distance_nm: 264,
        cargo_lbs: 500,
        pax_count: 4,
        payout: 7900,
        gross_payout: 7900,
        fuel_cost: 490,
        fuel_gallons: 87,
        landing_fee: 350,
        rental_fee: 650,
        rent_to_own_equity_earned: 650,
        net_payout: 6410,
        exploration_bonus: 500,
        aircraft_name: 'Beechcraft King Air 350i',
        duration_seconds: 3360,
        airborne_seconds: 3120,
        departed_at: new Date(now - 3 * day - 3600000),
        completed_at: new Date(now - 3 * day),
        source: 'airbound_dispatch',
        xp_earned: 540,
        touchdown_fpm: -110,
        landing_rating: 'Butter',
        landing_class: 'Light Touchdown',
        approach_speed_kts: 108,
        category: 'turboprop'
      },
      {
        origin_icao: 'KSAN',
        destination_icao: 'KPSP',
        distance_nm: 74,
        cargo_lbs: 80,
        pax_count: 2,
        payout: 2200,
        gross_payout: 2200,
        fuel_cost: 65,
        fuel_gallons: 10,
        landing_fee: 120,
        rental_fee: 0,
        rent_to_own_equity_earned: 0,
        net_payout: 2015,
        exploration_bonus: 500,
        aircraft_name: 'Cessna 172 Skyhawk',
        duration_seconds: 2400,
        airborne_seconds: 2220,
        departed_at: new Date(now - 4 * day - 3600000),
        completed_at: new Date(now - 4 * day),
        source: 'airbound_dispatch',
        xp_earned: 320,
        touchdown_fpm: -165,
        landing_rating: 'Firm',
        landing_class: 'Good Landing',
        approach_speed_kts: 65,
        category: 'single_prop'
      },
      {
        origin_icao: 'KPSP',
        destination_icao: 'KLAX',
        distance_nm: 96,
        cargo_lbs: 420,
        pax_count: 0,
        payout: 2850,
        gross_payout: 2850,
        fuel_cost: 85,
        fuel_gallons: 13,
        landing_fee: 350,
        rental_fee: 0,
        rent_to_own_equity_earned: 0,
        net_payout: 2415,
        exploration_bonus: 0,
        aircraft_name: 'Cessna 172 Skyhawk',
        duration_seconds: 3120,
        airborne_seconds: 2880,
        departed_at: new Date(now - 5 * day - 3600000),
        completed_at: new Date(now - 5 * day),
        source: 'airbound_dispatch',
        xp_earned: 360,
        touchdown_fpm: -85,
        landing_rating: 'Butter',
        landing_class: 'Greaser',
        approach_speed_kts: 62,
        category: 'single_prop'
      },
      {
        origin_icao: 'KLAX',
        destination_icao: 'KSFO',
        distance_nm: 293,
        cargo_lbs: 400,
        pax_count: 8,
        payout: 9200,
        gross_payout: 9200,
        fuel_cost: 540,
        fuel_gallons: 96,
        landing_fee: 350,
        rental_fee: 650,
        rent_to_own_equity_earned: 650,
        net_payout: 7660,
        exploration_bonus: 500,
        aircraft_name: 'Beechcraft King Air 350i',
        duration_seconds: 3720,
        airborne_seconds: 3480,
        departed_at: new Date(now - 6 * day - 3600000),
        completed_at: new Date(now - 6 * day),
        source: 'airbound_dispatch',
        xp_earned: 580,
        touchdown_fpm: -188,
        landing_rating: 'Firm',
        landing_class: 'Good Landing',
        approach_speed_kts: 112,
        category: 'turboprop'
      },
      {
        origin_icao: 'KSFO',
        destination_icao: 'KMRY',
        distance_nm: 67,
        cargo_lbs: 120,
        pax_count: 1,
        payout: 1950,
        gross_payout: 1950,
        fuel_cost: 60,
        fuel_gallons: 9,
        landing_fee: 120,
        rental_fee: 0,
        rent_to_own_equity_earned: 0,
        net_payout: 1770,
        exploration_bonus: 500,
        aircraft_name: 'Cessna 172 Skyhawk',
        duration_seconds: 2160,
        airborne_seconds: 1980,
        departed_at: new Date(now - 7 * day - 3600000),
        completed_at: new Date(now - 7 * day),
        source: 'free_flight',
        xp_earned: 290,
        touchdown_fpm: -118,
        landing_rating: 'Butter',
        landing_class: 'Light Touchdown',
        approach_speed_kts: 64,
        category: 'single_prop'
      },
      {
        origin_icao: 'KMRY',
        destination_icao: 'KLAX',
        distance_nm: 231,
        cargo_lbs: 1650,
        pax_count: 0,
        payout: 7800,
        gross_payout: 7800,
        fuel_cost: 430,
        fuel_gallons: 76,
        landing_fee: 350,
        rental_fee: 650,
        rent_to_own_equity_earned: 650,
        net_payout: 6370,
        exploration_bonus: 0,
        aircraft_name: 'Beechcraft King Air 350i',
        duration_seconds: 3000,
        airborne_seconds: 2760,
        departed_at: new Date(now - 8 * day - 3600000),
        completed_at: new Date(now - 8 * day),
        source: 'airbound_dispatch',
        xp_earned: 510,
        touchdown_fpm: -102,
        landing_rating: 'Butter',
        landing_class: 'Light Touchdown',
        approach_speed_kts: 106,
        category: 'turboprop'
      },
      {
        origin_icao: 'KLAX',
        destination_icao: 'KASE',
        distance_nm: 638,
        cargo_lbs: 600,
        pax_count: 5,
        payout: 16200,
        gross_payout: 16200,
        fuel_cost: 1180,
        fuel_gallons: 210,
        landing_fee: 350,
        rental_fee: 650,
        rent_to_own_equity_earned: 650,
        net_payout: 14020,
        exploration_bonus: 500,
        aircraft_name: 'Beechcraft King Air 350i',
        duration_seconds: 7800,
        airborne_seconds: 7440,
        departed_at: new Date(now - 10 * day - 7800000),
        completed_at: new Date(now - 10 * day),
        source: 'airbound_dispatch',
        xp_earned: 750,
        touchdown_fpm: -225,
        landing_rating: 'Hard',
        landing_class: 'Hard Landing',
        approach_speed_kts: 115,
        category: 'turboprop'
      },
      {
        origin_icao: 'KASE',
        destination_icao: 'KLAX',
        distance_nm: 638,
        cargo_lbs: 800,
        pax_count: 6,
        payout: 16800,
        gross_payout: 16800,
        fuel_cost: 1150,
        fuel_gallons: 205,
        landing_fee: 350,
        rental_fee: 650,
        rent_to_own_equity_earned: 650,
        net_payout: 14650,
        exploration_bonus: 0,
        aircraft_name: 'Beechcraft King Air 350i',
        duration_seconds: 7700,
        airborne_seconds: 7350,
        departed_at: new Date(now - 12 * day - 7700000),
        completed_at: new Date(now - 12 * day),
        source: 'airbound_dispatch',
        xp_earned: 760,
        touchdown_fpm: -130,
        landing_rating: 'Firm',
        landing_class: 'Good Landing',
        approach_speed_kts: 109,
        category: 'turboprop'
      }
    ];

    await Pilot.deleteMany({});
    const pilot = await Pilot.create({
      callsign: 'Captain Miller',
      balance: 84250,
      current_icao: 'KLAX',
      visited_airports: ['KLAX', 'KLAS', 'KSAN', 'KSFO', 'KPHX', 'KPSP', 'KSMO', 'KBUR', 'KVNY', 'KMRY', 'KRNO', 'KASE'],
      visited_countries: ['US'],
      xp: 54850,
      level: 4,
      rank_title: 'Flight Officer',
      active_aircraft: {
        model_id: 'b350',
        name: 'Beechcraft King Air 350i',
        tail_number: 'N350KA',
        category: 'turboprop',
        is_rental: true,
        rental_price_per_flight: 650,
        rental_flights_paid: 12,
        accumulated_equity: 68000,
        flight_hours: 28.4,
        cruise_speed_kts: 310,
        max_range_nm: 1800,
        max_cargo_lbs: 2500,
        max_pax: 9,
        min_runway_ft: 3300,
        fuel_type: 'Jet-A',
        fuel_burn_gph: 98.0
      },
      fleet: [
        {
          model_id: 'c172',
          name: 'Cessna 172 Skyhawk',
          tail_number: 'N172AB',
          category: 'single_prop',
          is_rental: false,
          purchased_at: new Date(now - 30 * day),
          flight_hours: 42.5
        },
        {
          model_id: 'b350',
          name: 'Beechcraft King Air 350i',
          tail_number: 'N350KA',
          category: 'turboprop',
          is_rental: true,
          rental_price_per_flight: 650,
          rental_flights_paid: 12,
          accumulated_equity: 68000,
          purchased_at: new Date(now - 14 * day),
          flight_hours: 28.4
        },
        {
          model_id: 'c208',
          name: 'Cessna 208B Grand Caravan',
          tail_number: 'N208EX',
          category: 'turboprop',
          is_rental: true,
          rental_price_per_flight: 450,
          rental_flights_paid: 7,
          accumulated_equity: 24500,
          purchased_at: new Date(now - 7 * day),
          flight_hours: 15.2
        }
      ],
      rent_to_own_equity: {
        b350: { accumulated_equity: 68000, flights_paid: 12 },
        c208: { accumulated_equity: 24500, flights_paid: 7 }
      },
      flight_log: flightLog
    });

    await Job.deleteMany({});
    const mockJobs = [
      {
        origin_icao: 'KLAX',
        destination_icao: 'KLAS',
        distance_nm: 205,
        cargo_lbs: 850,
        pax_count: 6,
        payout: 6450,
        status: 'available',
        tier: 'medium',
        is_featured_destination: true,
        exploration_bonus: 0,
        xp_reward: 510,
        bearing: 48
      },
      {
        origin_icao: 'KLAX',
        destination_icao: 'KSAN',
        distance_nm: 95,
        cargo_lbs: 1200,
        pax_count: 0,
        payout: 3200,
        status: 'available',
        tier: 'short',
        is_featured_destination: false,
        exploration_bonus: 0,
        xp_reward: 310,
        bearing: 135
      },
      {
        origin_icao: 'KLAX',
        destination_icao: 'KSFO',
        distance_nm: 293,
        cargo_lbs: 400,
        pax_count: 8,
        payout: 8900,
        status: 'available',
        tier: 'medium',
        is_featured_destination: false,
        exploration_bonus: 0,
        xp_reward: 580,
        bearing: 325
      },
      {
        origin_icao: 'KLAX',
        destination_icao: 'KPHX',
        distance_nm: 322,
        cargo_lbs: 2100,
        pax_count: 0,
        payout: 9400,
        status: 'available',
        tier: 'long',
        is_featured_destination: false,
        exploration_bonus: 0,
        xp_reward: 610,
        bearing: 95
      },
      {
        origin_icao: 'KLAX',
        destination_icao: 'KPSP',
        distance_nm: 96,
        cargo_lbs: 150,
        pax_count: 5,
        payout: 3150,
        status: 'available',
        tier: 'short',
        is_featured_destination: false,
        exploration_bonus: 0,
        xp_reward: 330,
        bearing: 98
      },
      {
        origin_icao: 'KLAX',
        destination_icao: 'KMRY',
        distance_nm: 231,
        cargo_lbs: 650,
        pax_count: 3,
        payout: 6800,
        status: 'available',
        tier: 'medium',
        is_featured_destination: false,
        exploration_bonus: 0,
        xp_reward: 490,
        bearing: 315
      },
      {
        origin_icao: 'KLAX',
        destination_icao: 'KAVX',
        distance_nm: 32,
        cargo_lbs: 900,
        pax_count: 2,
        payout: 2800,
        status: 'available',
        tier: 'short',
        is_featured_destination: true,
        exploration_bonus: 500,
        xp_reward: 380,
        bearing: 165
      },
      {
        origin_icao: 'KLAX',
        destination_icao: 'KRNO',
        distance_nm: 339,
        cargo_lbs: 1800,
        pax_count: 0,
        payout: 10200,
        status: 'available',
        tier: 'long',
        is_featured_destination: false,
        exploration_bonus: 0,
        xp_reward: 640,
        bearing: 350
      },
      {
        origin_icao: 'KLAX',
        destination_icao: 'KSMO',
        distance_nm: 6,
        cargo_lbs: 0,
        pax_count: 0,
        payout: 1100,
        status: 'available',
        tier: 'short',
        is_featured_destination: false,
        exploration_bonus: 0,
        xp_reward: 120,
        bearing: 340
      }
    ];

    await Job.insertMany(mockJobs);
    res.json({ success: true, message: 'Mock career successfully seeded in active database', pilot });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
