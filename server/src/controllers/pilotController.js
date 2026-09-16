import Pilot from '../models/Pilot.js';
import Job from '../models/Job.js';
import Airport from '../models/Airport.js';
import flightStateMachine from '../services/stateMachine.js';

export async function getPilot(req, res) {
  try {
    let pilot = await Pilot.findOne();
    if (!pilot) {
      pilot = await Pilot.create({
        callsign: 'Airbound-1',
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

