import Airport from '../models/Airport.js';
import chartsService from '../services/chartsService.js';

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

export async function getAirportCharts(req, res) {
  try {
    const { icao } = req.params;
    const targetIcao = (icao || '').toUpperCase().trim();

    if (!targetIcao) {
      return res.status(400).json({ error: 'ICAO parameter is required' });
    }

    // Retrieve database info for runway and coordinates
    const airport = await Airport.findOne({ icao: targetIcao }).lean();
    const chartsData = await chartsService.getChartsForAirport(targetIcao);

    res.json({
      icao: targetIcao,
      airport: airport || null,
      ...chartsData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function proxyChartPdf(req, res) {
  try {
    const { pdf, cycle } = req.query;
    if (!pdf) {
      return res.status(400).send('Missing pdf parameter');
    }
    await chartsService.proxyChartPdf(pdf, cycle, res);
  } catch (err) {
    res.status(500).send(`Error retrieving chart PDF: ${err.message}`);
  }
}
