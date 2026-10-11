import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pre-bundled compressed index for instantaneous serverless startup on Vercel
const BUNDLED_RUNWAYS_FILE = path.resolve(__dirname, '../data/runways_index.json.gz');

const DATA_DIR = process.env.AIRBOUND_DATA_DIR
  ? path.resolve(process.env.AIRBOUND_DATA_DIR, 'weather')
  : path.resolve(__dirname, '../../data');
const RUNWAYS_FILE = path.join(DATA_DIR, 'runways.csv');
const RUNWAYS_URL = 'https://davidmegginson.github.io/ourairports-data/runways.csv';

// Cache TTLs
const METAR_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class WeatherService {
  constructor() {
    this.metarCache = new Map(); // icao -> { data, expiresAt }
    this.runwayMap = new Map(); // icao -> Array<RunwayEnd>
    this.isRunwaysLoaded = false;
    this.runwaysLoadPromise = null;
  }

  /**
   * Ensures OurAirports runways dataset is available on disk and parsed in memory
   */
  async ensureRunwaysLoaded() {
    if (this.isRunwaysLoaded) return;
    if (this.runwaysLoadPromise) return this.runwaysLoadPromise;

    this.runwaysLoadPromise = (async () => {
      try {
        // Priority 1: Instant load from pre-bundled compressed index (ideal for Vercel Serverless)
        if (fs.existsSync(BUNDLED_RUNWAYS_FILE)) {
          const t0 = Date.now();
          const buf = fs.readFileSync(BUNDLED_RUNWAYS_FILE);
          const decompressed = zlib.gunzipSync(buf).toString('utf8');
          const parsed = JSON.parse(decompressed);
          if (parsed && typeof parsed === 'object') {
            this.runwayMap = new Map(Object.entries(parsed));
            this.isRunwaysLoaded = true;
            console.log(`[WeatherService] Loaded bundled runways index (${this.runwayMap.size} airfields) in ${Date.now() - t0}ms.`);
            return;
          }
        }

        // Priority 2: Fallback to downloading or reading local CSV (safe tmpdir for Vercel)
        try {
          if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
          }
        } catch (_) {}

        if (!fs.existsSync(RUNWAYS_FILE)) {
          console.log('[WeatherService] Downloading OurAirports runways.csv cache...');
          const res = await fetch(RUNWAYS_URL, {
            headers: { 'User-Agent': 'Airbound-Sim/1.0' },
            signal: AbortSignal.timeout(20000)
          });
          if (res.ok) {
            const buf = await res.arrayBuffer();
            try {
              fs.writeFileSync(RUNWAYS_FILE, Buffer.from(buf));
              console.log(`[WeatherService] Cached runways.csv (${(buf.byteLength / 1024 / 1024).toFixed(2)} MB).`);
            } catch (_) {}
          } else {
            console.warn(`[WeatherService] Failed to download runways.csv: HTTP ${res.status}`);
          }
        }

        if (fs.existsSync(RUNWAYS_FILE)) {
          const t0 = Date.now();
          const csvText = fs.readFileSync(RUNWAYS_FILE, 'utf8');
          this.parseRunwaysCsv(csvText);
          this.isRunwaysLoaded = true;
          console.log(`[WeatherService] Indexed runways for ${this.runwayMap.size} airfields in ${Date.now() - t0}ms.`);
        }
      } catch (err) {
        console.error('[WeatherService] Error loading runways dataset:', err.message);
      } finally {
        this.runwaysLoadPromise = null;
      }
    })();

    return this.runwaysLoadPromise;
  }

  /**
   * Parses OurAirports runways CSV into an in-memory map of runway ends
   */
  parseRunwaysCsv(csvText) {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return;

    // Header index discovery
    const header = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
    const identIdx = header.indexOf('airport_ident');
    const lenIdx = header.indexOf('length_ft');
    const widthIdx = header.indexOf('width_ft');
    const surfIdx = header.indexOf('surface');
    const lightIdx = header.indexOf('lighted');
    const closedIdx = header.indexOf('closed');
    const leIdentIdx = header.indexOf('le_ident');
    const leHdgIdx = header.indexOf('le_heading_degT');
    const heIdentIdx = header.indexOf('he_ident');
    const heHdgIdx = header.indexOf('he_heading_degT');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle simple CSV splitting with quotes
      const parts = this.parseCsvLine(line);
      const airportIdent = (parts[identIdx] || '').toUpperCase().trim();
      if (!airportIdent) continue;

      const lengthFt = parseInt(parts[lenIdx], 10) || 0;
      const widthFt = parseInt(parts[widthIdx], 10) || 0;
      const surface = (parts[surfIdx] || 'ASP').toUpperCase().trim();
      const isClosed = parts[closedIdx] === '1';
      const isLighted = parts[lightIdx] === '1';

      const leIdent = (parts[leIdentIdx] || '').toUpperCase().trim();
      const heIdent = (parts[heIdentIdx] || '').toUpperCase().trim();

      let leHdg = parseFloat(parts[leHdgIdx]);
      let heHdg = parseFloat(parts[heHdgIdx]);

      // If headings are missing, infer from runway numbers
      if (isNaN(leHdg) && leIdent) {
        const num = parseInt(leIdent.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num)) leHdg = (num * 10) % 360;
      }
      if (isNaN(heHdg) && heIdent) {
        const num = parseInt(heIdent.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num)) {
          heHdg = (num * 10) % 360;
        } else if (!isNaN(leHdg)) {
          heHdg = (leHdg + 180) % 360;
        }
      }

      if (!isNaN(leHdg) && isNaN(heHdg)) {
        heHdg = (leHdg + 180) % 360;
      } else if (!isNaN(heHdg) && isNaN(leHdg)) {
        leHdg = (heHdg + 180) % 360;
      }

      const ends = [];

      if (leIdent && !isNaN(leHdg)) {
        ends.push({
          ident: leIdent,
          heading: Math.round(leHdg),
          lengthFt,
          widthFt,
          surface,
          closed: isClosed,
          lighted: isLighted,
          oppositeIdent: heIdent || null
        });
      }

      if (heIdent && !isNaN(heHdg)) {
        ends.push({
          ident: heIdent,
          heading: Math.round(heHdg),
          lengthFt,
          widthFt,
          surface,
          closed: isClosed,
          lighted: isLighted,
          oppositeIdent: leIdent || null
        });
      }

      if (ends.length > 0) {
        if (!this.runwayMap.has(airportIdent)) {
          this.runwayMap.set(airportIdent, []);
        }
        this.runwayMap.get(airportIdent).push(...ends);

        // Also add under stripped 3-letter ICAO if starts with K
        if (airportIdent.startsWith('K') && airportIdent.length === 4) {
          const stripped = airportIdent.slice(1);
          if (!this.runwayMap.has(stripped)) {
            this.runwayMap.set(stripped, []);
          }
          this.runwayMap.get(stripped).push(...ends);
        }
      }
    }
  }

  /**
   * Helper to parse CSV lines with quoted values
   */
  parseCsvLine(text) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  }

  /**
   * Retrieves runways for an airport ICAO
   */
  async getRunwaysForAirport(rawIcao) {
    if (!rawIcao) return [];
    await this.ensureRunwaysLoaded();

    const icao = rawIcao.toUpperCase().trim();
    const withoutK = icao.startsWith('K') && icao.length === 4 ? icao.slice(1) : icao;

    return this.runwayMap.get(icao) || this.runwayMap.get(withoutK) || [];
  }

  /**
   * Fetches live METAR observation from NOAA Aviation Weather Center
   */
  async fetchMetar(rawIcao) {
    if (!rawIcao) return null;
    const icao = rawIcao.toUpperCase().trim();

    // Check memory cache
    const cached = this.metarCache.get(icao);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const url = `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao)}&format=json`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Airbound-Sim/1.0' },
        signal: AbortSignal.timeout(8000)
      });

      if (!res.ok) {
        throw new Error(`NOAA returned status ${res.status}`);
      }

      const json = await res.json();
      const rawMetar = Array.isArray(json) && json.length > 0 ? json[0] : null;

      if (!rawMetar) {
        const fallback = {
          icao,
          hasMetar: false,
          raw: null,
          fltCat: 'VFR',
          message: 'No live METAR reported for this station'
        };
        this.metarCache.set(icao, { data: fallback, expiresAt: Date.now() + 60000 });
        return fallback;
      }

      const parsed = this.normalizeMetar(rawMetar, icao);
      this.metarCache.set(icao, { data: parsed, expiresAt: Date.now() + METAR_CACHE_TTL_MS });
      return parsed;
    } catch (err) {
      console.warn(`[WeatherService] Could not fetch live METAR for ${icao}:`, err.message);
      // Return basic structure with error flag
      return {
        icao,
        hasMetar: false,
        raw: null,
        fltCat: 'UNKNOWN',
        error: err.message
      };
    }
  }

  /**
   * Normalizes raw NOAA METAR payload into a clean, avionics-ready format
   */
  normalizeMetar(item, icao) {
    const rawOb = item.rawOb || '';

    // Wind direction & speed
    let wdir = item.wdir;
    let wspd = typeof item.wspd === 'number' ? item.wspd : 0;
    let wgst = typeof item.wgst === 'number' ? item.wgst : null;
    let isVariable = wdir === 'VRB' || (typeof wdir === 'string' && wdir.includes('V'));
    let isCalm = wspd === 0 || wdir === 0 && wspd === 0;

    // Fallback extraction from raw text if fields missing
    if (rawOb && (wdir === undefined || wspd === undefined)) {
      const windMatch = rawOb.match(/\b([0-9]{3}|VRB)([0-9]{2,3})(?:G([0-9]{2,3}))?KT\b/);
      if (windMatch) {
        wdir = windMatch[1] === 'VRB' ? 'VRB' : parseInt(windMatch[1], 10);
        wspd = parseInt(windMatch[2], 10);
        if (windMatch[3]) wgst = parseInt(windMatch[3], 10);
        isVariable = windMatch[1] === 'VRB';
        isCalm = wspd === 0;
      }
    }

    // Altimeter / Baro pressure (inHg and hPa)
    let altimInHg = 29.92;
    let altimHpa = 1013;

    if (item.altim) {
      altimHpa = Math.round(item.altim);
      altimInHg = parseFloat((item.altim * 0.02953).toFixed(2));
    }

    const aMatch = rawOb.match(/\bA([0-9]{4})\b/);
    if (aMatch) {
      altimInHg = parseFloat((parseInt(aMatch[1], 10) / 100).toFixed(2));
      altimHpa = Math.round(altimInHg / 0.02953);
    } else {
      const qMatch = rawOb.match(/\bQ([0-9]{4})\b/);
      if (qMatch) {
        altimHpa = parseInt(qMatch[1], 10);
        altimInHg = parseFloat((altimHpa * 0.02953).toFixed(2));
      }
    }

    // Flight Rules Category
    let fltCat = (item.fltCat || 'VFR').toUpperCase();
    if (!['VFR', 'MVFR', 'IFR', 'LIFR'].includes(fltCat)) {
      fltCat = 'VFR';
    }

    return {
      icao,
      hasMetar: true,
      raw: rawOb,
      fltCat,
      wind: {
        degrees: typeof wdir === 'number' ? wdir : null,
        speedKts: wspd,
        gustKts: wgst,
        isVariable,
        isCalm,
        label: isCalm
          ? 'Calm (0 kts)'
          : isVariable
          ? `VRB @ ${wspd}${wgst ? `G${wgst}` : ''} KTS`
          : `${wdir.toString().padStart(3, '0')}° @ ${wspd}${wgst ? `G${wgst}` : ''} KTS`
      },
      visibilitySm: item.visib !== undefined ? String(item.visib) : '10+',
      altimeter: {
        inHg: altimInHg,
        hPa: altimHpa
      },
      tempC: typeof item.temp === 'number' ? Math.round(item.temp) : null,
      dewpC: typeof item.dewp === 'number' ? Math.round(item.dewp) : null,
      clouds: Array.isArray(item.clouds) ? item.clouds : [],
      reportTime: item.reportTime || item.receiptTime || new Date().toISOString()
    };
  }

  /**
   * Calculates headwind and crosswind components for all runways and ranks the best runway
   */
  analyzeRunwaysWithWind(runways, wind) {
    if (!runways || runways.length === 0) {
      return {
        hasRunwayData: false,
        recommendedRunway: null,
        runways: []
      };
    }

    const windDir = typeof wind?.degrees === 'number' ? wind.degrees : null;
    const windSpeed = typeof wind?.speedKts === 'number' ? wind.speedKts : 0;
    const windGust = typeof wind?.gustKts === 'number' ? wind.gustKts : null;
    const effSpeed = windGust ? windSpeed + (windGust - windSpeed) * 0.5 : windSpeed;
    const isCalm = Boolean(wind?.isCalm) || effSpeed < 3 || windDir === null;

    const scoredRunways = runways.map((r) => {
      if (r.closed) {
        return {
          ...r,
          headwindKts: 0,
          tailwindKts: 0,
          crosswindKts: 0,
          crosswindDirection: 'none',
          score: -9999,
          statusLabel: 'CLOSED'
        };
      }

      if (isCalm) {
        // Under calm winds, prioritize the longest runway
        return {
          ...r,
          headwindKts: 0,
          tailwindKts: 0,
          crosswindKts: 0,
          crosswindDirection: 'none',
          score: r.lengthFt,
          statusLabel: 'CALM WINDS'
        };
      }

      // Wind trigonometry:
      // Delta angle between wind origin and runway heading
      const radDiff = ((windDir - r.heading) * Math.PI) / 180;
      const rawHw = effSpeed * Math.cos(radDiff);
      const rawXw = effSpeed * Math.sin(radDiff);

      const headwindKts = rawHw > 0 ? Math.round(rawHw) : 0;
      const tailwindKts = rawHw < 0 ? Math.round(-rawHw) : 0;
      const crosswindKts = Math.round(Math.abs(rawXw));

      let crosswindDirection = 'direct';
      if (rawXw > 0.8) crosswindDirection = 'right';
      else if (rawXw < -0.8) crosswindDirection = 'left';

      // Scoring formula: prioritize headwind (+), penalize crosswind (-), slight bonus for length
      const score = rawHw - Math.abs(rawXw) * 0.35 + (r.lengthFt || 5000) * 0.0001;

      return {
        ...r,
        headwindKts,
        tailwindKts,
        crosswindKts,
        crosswindDirection,
        score: Math.round(score * 10) / 10,
        statusLabel: tailwindKts > 0 ? `${tailwindKts} kt Tailwind` : `${headwindKts} kt Headwind`
      };
    });

    // Sort: open first, then by score descending
    scoredRunways.sort((a, b) => {
      if (a.closed !== b.closed) return a.closed ? 1 : -1;
      return b.score - a.score;
    });

    const openRunways = scoredRunways.filter((r) => !r.closed);
    const recommendedRunway = openRunways.length > 0 ? { ...openRunways[0], isRecommended: true } : null;

    return {
      hasRunwayData: true,
      recommendedRunway,
      runways: scoredRunways
    };
  }

  /**
   * Retrieves complete weather briefing & runway analysis for an airport
   */
  async getAirportWeatherAndRunways(icao) {
    if (!icao) return null;
    const clean = icao.toUpperCase().trim();

    const [metar, runways] = await Promise.all([
      this.fetchMetar(clean),
      this.getRunwaysForAirport(clean)
    ]);

    const runwayAnalysis = this.analyzeRunwaysWithWind(runways, metar?.wind);

    return {
      icao: clean,
      metar,
      runwayAnalysis,
      recommendedRunway: runwayAnalysis.recommendedRunway,
      allRunways: runwayAnalysis.runways
    };
  }

  /**
   * Batch retrieval for origin and destination in parallel
   */
  async getWeatherBriefing(originIcao, destIcao) {
    const promises = [];
    if (originIcao) promises.push(this.getAirportWeatherAndRunways(originIcao));
    else promises.push(Promise.resolve(null));

    if (destIcao) promises.push(this.getAirportWeatherAndRunways(destIcao));
    else promises.push(Promise.resolve(null));

    const [origin, destination] = await Promise.all(promises);

    return {
      origin,
      destination,
      timestamp: new Date().toISOString()
    };
  }
}

export const weatherService = new WeatherService();
export default weatherService;
