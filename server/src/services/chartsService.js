import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pre-bundled compressed index for instantaneous serverless startup on Vercel
const BUNDLED_INDEX_FILE = path.resolve(__dirname, '../data/charts_index.json.gz');

class ChartsService {
  constructor() {
    this.currentCycle = '2611'; // Default fallback cycle
    this.airportMap = new Map();
    this.isInitialized = false;
    this.initPromise = null;
  }

  /**
   * Discovers current AIRAC cycle from aeronav.faa.gov or falls back to known cycle
   */
  async detectCurrentCycle() {
    try {
      const res = await fetch('https://aeronav.faa.gov/d-tpp/', {
        headers: { 'User-Agent': 'Airbound-Sim/1.0' },
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const html = await res.text();
        const matches = [...html.matchAll(/\/d-tpp\/([0-9]{4})\//g)].map((m) => m[1]);
        if (matches && matches.length > 0) {
          const candidates = Array.from(new Set(matches)).sort().reverse();
          for (const cycleCandidate of candidates) {
            try {
              const probeRes = await fetch(
                `https://aeronav.faa.gov/d-tpp/${cycleCandidate}/xml_data/d-TPP_Metafile.xml`,
                {
                  headers: { 'User-Agent': 'Airbound-Sim/1.0', Range: 'bytes=0-150' },
                  signal: AbortSignal.timeout(4000)
                }
              );
              if (probeRes.ok || probeRes.status === 206) {
                const sample = await probeRes.text();
                if (sample.includes('<digital_tpp')) {
                  this.currentCycle = cycleCandidate;
                  console.log(`[ChartsService] Active FAA d-TPP cycle detected: ${this.currentCycle}`);
                  return this.currentCycle;
                }
              }
            } catch (_) {
              // Try next candidate
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[ChartsService] Could not auto-detect cycle, using fallback ${this.currentCycle}:`, err.message);
    }
    return this.currentCycle;
  }

  /**
   * Initializes the in-memory chart database from disk cache or aeronav download
   */
  async ensureInitialized() {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // Priority 1: Instant load from pre-bundled compressed index (ideal for Vercel Serverless)
        if (fs.existsSync(BUNDLED_INDEX_FILE)) {
          const t0 = Date.now();
          const buf = fs.readFileSync(BUNDLED_INDEX_FILE);
          const decompressed = zlib.gunzipSync(buf).toString('utf8');
          const parsed = JSON.parse(decompressed);
          if (parsed && parsed.airports) {
            this.currentCycle = parsed.cycle || this.currentCycle;
            this.airportMap = new Map(Object.entries(parsed.airports));
            this.isInitialized = true;
            console.log(`[ChartsService] Loaded bundled charts index (${this.airportMap.size} airports, cycle ${this.currentCycle}) in ${Date.now() - t0}ms.`);
            return;
          }
        }

        // Priority 2: Safe cache directory in local data directory
        const cacheDir = process.env.AIRBOUND_DATA_DIR
          ? path.resolve(process.env.AIRBOUND_DATA_DIR, 'charts')
          : path.resolve(__dirname, '../../data/charts');

        try {
          if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
          }
        } catch (_) {}

        await this.detectCurrentCycle();
        const cacheFile = path.join(cacheDir, `d-tpp_metafile_${this.currentCycle}.xml`);

        let xml = '';
        if (fs.existsSync(cacheFile)) {
          console.log(`[ChartsService] Loading cached d-TPP metafile for cycle ${this.currentCycle}...`);
          xml = fs.readFileSync(cacheFile, 'utf8');
        } else {
          console.log(`[ChartsService] Downloading FAA d-TPP metafile for cycle ${this.currentCycle}...`);
          const res = await fetch(
            `https://aeronav.faa.gov/d-tpp/${this.currentCycle}/xml_data/d-TPP_Metafile.xml`,
            {
              headers: { 'User-Agent': 'Airbound-Sim/1.0' },
              signal: AbortSignal.timeout(20000)
            }
          );
          if (!res.ok) {
            throw new Error(`FAA Aeronav server returned ${res.status}`);
          }
          xml = await res.text();
          try {
            fs.writeFileSync(cacheFile, xml, 'utf8');
            console.log(`[ChartsService] Cached d-TPP metafile to disk (${(xml.length / 1024 / 1024).toFixed(2)} MB).`);
          } catch (_) {}
        }

        this.parseAndIndexXml(xml);
        this.isInitialized = true;
        console.log(`[ChartsService] Indexed ${this.airportMap.size} airport identifiers.`);
      } catch (err) {
        console.error('[ChartsService] Initialization error:', err.message);
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Parses the XML metafile into an in-memory Map for O(1) airport lookups
   */
  parseAndIndexXml(xml) {
    const t0 = Date.now();
    const airportRegex = /<airport_name\b([^>]*)>([\s\S]*?)<\/airport_name>/gi;
    let match;

    while ((match = airportRegex.exec(xml)) !== null) {
      const attrs = match[1];
      const body = match[2];

      const icaoMatch = attrs.match(/icao_ident="([^"]+)"/i);
      const aptMatch = attrs.match(/apt_ident="([^"]+)"/i);
      const icao = icaoMatch ? icaoMatch[1].toUpperCase() : (aptMatch ? 'K' + aptMatch[1].toUpperCase() : null);
      if (!icao) continue;

      const records = [];
      const recordRegex = /<record>([\s\S]*?)<\/record>/gi;
      let rMatch;
      while ((rMatch = recordRegex.exec(body)) !== null) {
        const rec = rMatch[1];
        const getTag = (tag) => {
          const m = rec.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
          return m ? m[1].trim() : '';
        };

        const chartCode = getTag('chart_code');
        const chartName = getTag('chart_name');
        const pdfName = getTag('pdf_name');

        if (!pdfName) continue;

        records.push({
          chart_code: chartCode,
          chart_name: chartName,
          pdf_name: pdfName,
          url: `https://aeronav.faa.gov/d-tpp/${this.currentCycle}/${pdfName}`
        });
      }

      this.airportMap.set(icao, records);
      if (aptMatch && aptMatch[1]) {
        this.airportMap.set(aptMatch[1].toUpperCase(), records);
      }
    }

    console.log(`[ChartsService] Index built in ${Date.now() - t0}ms`);
  }

  /**
   * Classifies chart type for UI categorizing (Diagram, Approach, SID, STAR, Minima)
   */
  classifyChart(rec) {
    const code = (rec.chart_code || '').toUpperCase();
    const name = (rec.chart_name || '').toUpperCase();

    if (code === 'APD' || name.includes('AIRPORT DIAGRAM')) {
      return 'diagram';
    }
    if (code === 'IAP' || name.startsWith('ILS') || name.startsWith('RNAV') || name.startsWith('VOR') || name.startsWith('LOC')) {
      return 'approach';
    }
    if (code === 'DP' || name.includes('DEPARTURE') || name.includes('OBSTACLE')) {
      return 'departure';
    }
    if (code === 'STAR' || name.includes('ARRIVAL')) {
      return 'arrival';
    }
    if (code === 'MIN' || name.includes('MINIMUMS') || name.includes('TAKEOFF')) {
      return 'minimums';
    }
    return 'other';
  }

  /**
   * Retrieves categorized terminal procedures for an airport
   */
  async getChartsForAirport(rawIcao) {
    if (!rawIcao) return null;
    await this.ensureInitialized();

    const icao = rawIcao.toUpperCase().trim();
    const withoutK = icao.startsWith('K') && icao.length === 4 ? icao.slice(1) : icao;

    const rawRecords = this.airportMap.get(icao) || this.airportMap.get(withoutK) || [];

    const diagrams = [];
    const approaches = [];
    const departures = [];
    const arrivals = [];
    const minimums = [];
    const other = [];

    for (const rec of rawRecords) {
      const category = this.classifyChart(rec);
      const enriched = {
        ...rec,
        category,
        proxyUrl: `/api/airports/charts/proxy?pdf=${encodeURIComponent(rec.pdf_name)}&cycle=${this.currentCycle}`
      };

      if (category === 'diagram') diagrams.push(enriched);
      else if (category === 'approach') approaches.push(enriched);
      else if (category === 'departure') departures.push(enriched);
      else if (category === 'arrival') arrivals.push(enriched);
      else if (category === 'minimums') minimums.push(enriched);
      else other.push(enriched);
    }

    // Default primary diagram
    const primaryDiagram = diagrams[0] || null;

    return {
      icao,
      cycle: this.currentCycle,
      hasFaaCharts: rawRecords.length > 0,
      totalCharts: rawRecords.length,
      primaryDiagram,
      categories: {
        diagrams,
        approaches,
        departures,
        arrivals,
        minimums,
        other
      },
      externalLinks: {
        chartfox: `https://chartfox.org/${icao}`,
        airnav: `https://www.airnav.com/airport/${icao}`,
        skyvector: `https://skyvector.com/airport/${icao}`,
        flightaware: `https://www.flightaware.com/resources/airport/${icao}`
      }
    };
  }

  /**
   * Proxies PDF downloads from aeronav.faa.gov to avoid browser CORS/iframe blocking
   */
  async proxyChartPdf(pdfName, cycle, res) {
    const safeCycle = (cycle || this.currentCycle).replace(/[^0-9]/g, '');
    const safePdf = path.basename(pdfName || '').replace(/[^A-Za-z0-9_.-]/g, '');

    if (!safePdf || !safePdf.endsWith('.PDF') && !safePdf.endsWith('.pdf')) {
      return res.status(400).send('Invalid PDF name requested');
    }

    const targetUrl = `https://aeronav.faa.gov/d-tpp/${safeCycle}/${safePdf}`;

    try {
      const response = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Airbound-Sim/1.0' },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        return res.status(response.status).send(`FAA aeronav returned ${response.status}`);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${safePdf}"`);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h

      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err) {
      res.status(502).send(`Failed to stream PDF: ${err.message}`);
    }
  }
}

export const chartsService = new ChartsService();
export default chartsService;
