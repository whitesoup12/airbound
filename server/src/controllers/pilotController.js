import Pilot from '../models/Pilot.js';
import Job from '../models/Job.js';
import Airport from '../models/Airport.js';
import flightStateMachine from '../services/stateMachine.js';
import simConnectBridge from '../services/simconnect.js';
import { generateJobsForAirport } from '../services/jobGenerator.js';

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
        flight_log: []
      });
    }

    // Check for an active accepted job
    const activeJob = await Job.findOne({ status: 'accepted' });

    // Airport details for current airport
    const currentAirport = await Airport.findOne({ icao: pilot.current_icao });

    res.json({
      pilot,
      activeJob,
      currentAirport,
      phase: flightStateMachine.phase
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function resetPilot(req, res) {
  try {
    let pilot = await Pilot.findOne();
    if (!pilot) {
      pilot = new Pilot();
    }
    pilot.callsign = 'James';
    pilot.balance = 15000;
    pilot.current_icao = 'KLAX';
    pilot.visited_airports = ['KLAX'];
    pilot.visited_countries = ['US'];
    pilot.flight_log = [];
    await pilot.save();

    await Job.deleteMany({});
    await flightStateMachine.clearActiveJob();

    res.json({ message: 'Pilot career reset successfully', pilot });
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

    const targetIcao = icao.trim().toUpperCase();
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

    // Generate fresh jobs for new base airport
    const newJobs = await generateJobsForAirport(targetIcao);

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
