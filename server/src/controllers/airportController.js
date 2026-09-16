import Airport from '../models/Airport.js';

export async function getAirports(req, res) {
  try {
    const { q, limit = 50 } = req.query;
    const filter = {};

    if (q) {
      const searchRegex = new RegExp(q.trim(), 'i');
      filter.$or = [
        { icao: searchRegex },
        { name: searchRegex },
        { city: searchRegex },
        { country: searchRegex }
      ];
    }

    const airports = await Airport.find(filter)
      .limit(parseInt(limit, 10))
      .sort({ icao: 1 });

    res.json(airports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getAirportByIcao(req, res) {
  try {
    const { icao } = req.params;
    const airport = await Airport.findOne({ icao: icao.toUpperCase() });
    if (!airport) {
      return res.status(404).json({ error: 'Airport not found' });
    }
    res.json(airport);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

