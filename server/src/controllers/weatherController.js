import weatherService from '../services/weatherService.js';

export async function getAirportWeather(req, res) {
  try {
    const { icao } = req.params;
    if (!icao) {
      return res.status(400).json({ error: 'ICAO parameter is required' });
    }

    const data = await weatherService.getAirportWeatherAndRunways(icao);
    if (!data) {
      return res.status(404).json({ error: `Weather not found for ${icao}` });
    }

    res.json(data);
  } catch (err) {
    console.error('[WeatherController] Error getting airport weather:', err);
    res.status(500).json({ error: err.message || 'Failed to retrieve airport weather' });
  }
}

export async function getWeatherBriefing(req, res) {
  try {
    const { origin, dest } = req.query;

    if (!origin && !dest) {
      return res.status(400).json({ error: 'At least origin or dest query parameter is required' });
    }

    const data = await weatherService.getWeatherBriefing(origin, dest);
    res.json(data);
  } catch (err) {
    console.error('[WeatherController] Error getting weather briefing:', err);
    res.status(500).json({ error: err.message || 'Failed to retrieve weather briefing' });
  }
}
