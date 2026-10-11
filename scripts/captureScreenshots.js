import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.join(ROOT_DIR, 'docs', 'screenshots');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function getBrowserPath() {
  if (fs.existsSync(EDGE_PATH)) return EDGE_PATH;
  if (fs.existsSync(CHROME_PATH)) return CHROME_PATH;
  throw new Error('Neither Microsoft Edge nor Google Chrome found for capturing screenshots.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (_) {}
    await sleep(500);
  }
  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms`);
}

async function run() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const browserPath = getBrowserPath();
  console.log(`[Screenshot Tool] Using browser engine: ${browserPath}`);

  // 1. Start local backend server with mock simulation enabled
  console.log('[Screenshot Tool] Launching Airbound server on port 3001...');
  const serverProcess = spawn('node', ['server/src/server.js'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: '3001',
      NODE_ENV: 'production',
      AIRBOUND_DESKTOP: 'true',
      USE_MOCK_SIMCONNECT: 'true'
    },
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error('[Screenshot Tool] Server process failed to start:', err);
  });

  let browser = null;

  try {
    await waitForServer('http://localhost:3001/api/health');
    console.log('[Screenshot Tool] Server is live and healthy at http://localhost:3001.\n');

    // 2. Seed mock career data directly via server endpoint
    console.log('[Screenshot Tool] Seeding mock career data into server database...');
    const seedRes = await fetch('http://localhost:3001/api/simulator/seed-mock-career', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const seedData = await seedRes.json();
    console.log(`[Screenshot Tool] ${seedData.message || 'Seeded successfully.'}\n`);

    // 3. Launch Puppeteer with Edge
    console.log('[Screenshot Tool] Launching headless browser...');
    browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: true,
      defaultViewport: {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1
      },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--hide-scrollbars'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Helper to capture a tab
    const capture = async (hash, filename, prepFn = null) => {
      const targetUrl = `http://localhost:3001/#${hash}`;
      const outputPath = path.join(SCREENSHOTS_DIR, filename);
      console.log(`📸 Capturing [${hash}] -> docs/screenshots/${filename}...`);

      if (prepFn) {
        await prepFn();
      }

      await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 35000 });

      // Wait for main glass-panel container
      await page.waitForSelector('.glass-panel', { timeout: 12000 }).catch(() => {});

      // If page has a loading spinner, wait for it to disappear
      await page.waitForFunction(() => {
        const loadingEl = document.querySelector('.animate-bounce');
        return !loadingEl;
      }, { timeout: 12000 }).catch(() => {});

      // For map views, wait for tiles to render
      if (['flight-deck', 'dispatch'].includes(hash)) {
        await page.waitForSelector('.leaflet-tile-loaded', { timeout: 15000 }).catch(() => {});
        // Settle delay for full tile rasterization
        await sleep(4000);
      } else {
        await sleep(3000);
      }

      await page.screenshot({ path: outputPath, type: 'png' });
      const stats = fs.statSync(outputPath);
      console.log(`   ✓ Saved ${filename} (${Math.round(stats.size / 1024)} KB)`);
    };

    // 1. Flight Deck: step to EN ROUTE with an active mission so HUD, gauges, and route line are active
    await capture('flight-deck', 'flight-deck.png', async () => {
      try {
        console.log('   -> Stepping simulation to EN ROUTE for flight deck capture...');
        await fetch('http://localhost:3001/api/simulator/step-phase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phase: 'EN ROUTE' })
        });
        await sleep(1500);
      } catch (e) {
        console.warn('   Step phase note:', e.message);
      }
    });

    // 2. Dispatch: cancel active job so full commercial contract board and route preview are visible
    await capture('dispatch', 'dispatch.png', async () => {
      try {
        console.log('   -> Resetting active job to display full dispatch contract board...');
        await fetch('http://localhost:3001/api/jobs/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        await sleep(1500);
      } catch (e) {
        console.warn('   Cancel job note:', e.message);
      }
    });

    // 3. Fleet Dealership: catalog of airplanes
    await capture('fleet', 'fleet-dealership.png');

    // 4. Cash Flow & Finances
    await capture('cash-flow', 'cash-flow.png');

    // 5. Career Progression & Rank Roadmap
    await capture('progression', 'career-progression.png');

    // 6. Logbook: 10 historical flights with ratings & visited airports
    await capture('logbook', 'logbook.png');

    // 7. Pilot Handbook / Guide
    await capture('guide', 'pilot-guide.png');

    console.log('\n✨ All screenshots captured successfully in docs/screenshots/!');
  } finally {
    if (browser) {
      console.log('[Screenshot Tool] Closing browser...');
      await browser.close().catch(() => {});
    }
    console.log('[Screenshot Tool] Shutting down background server process...');
    serverProcess.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error('[Screenshot Tool] Fatal error:', err);
  process.exit(1);
});
