import Airport from '../models/Airport.js';

export async function getAirports(req, res) {
  try {
    const { q, limit = 200 } = req.query;
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

    const maxLimit = Math.min(1000, parseInt(limit, 10) || 200);
    const airports = await Airport.find(filter)
      .limit(maxLimit)
      .sort({ icao: 1 });

    res.json(airports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getAirportByIcao(req, res) {
  try {
    const { icao } = req.params;
    const targetIcao = icao.toUpperCase().trim();
    let airport = await Airport.findOne({ icao: targetIcao });

    if (!airport) {
      return res.status(404).json({ error: `Airport '${targetIcao}' not found in database.` });
    }

    res.json(airport);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
