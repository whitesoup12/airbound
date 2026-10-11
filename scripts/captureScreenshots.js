import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

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

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (_) {}
    await sleep(400);
  }
  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms`);
}

async function captureTab(browserPath, tabHash, outputFilename, waitTimeSeconds = 4) {
  const targetUrl = `http://localhost:3001/#${tabHash}`;
  const outputPath = path.join(SCREENSHOTS_DIR, outputFilename);

  console.log(`📸 Capturing [${tabHash}] -> docs/screenshots/${outputFilename}...`);

  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--window-size=1920,1080',
      '--hide-scrollbars',
      `--screenshot=${outputPath}`,
      targetUrl
    ];

    const child = spawn(browserPath, args, { stdio: 'ignore' });
    child.on('exit', async (code) => {
      // Allow disk write to settle
      await sleep(1500);
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log(`   ✓ Saved ${outputFilename} (${Math.round(stats.size / 1024)} KB)`);
        resolve();
      } else {
        reject(new Error(`Failed to capture ${outputFilename} (process exited with code ${code})`));
      }
    });
    child.on('error', reject);
  });
}

async function run() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const browserPath = getBrowserPath();
  console.log(`[Screenshot Tool] Using browser engine: ${browserPath}`);

  // 1. Start local backend server with mock simulation enabled for rich screenshot telemetry
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
    stdio: 'ignore'
  });

  serverProcess.on('error', (err) => {
    console.error('[Screenshot Tool] Server process failed to start:', err);
  });

  try {
    await waitForServer('http://localhost:3001/api/health');
    console.log('[Screenshot Tool] Server is live and healthy at http://localhost:3001.\n');

    // Allow mock telemetry and initial jobs to populate
    await sleep(2500);

    const tabsToCapture = [
      { hash: 'flight-deck', file: 'flight-deck.png' },
      { hash: 'dispatch', file: 'dispatch.png' },
      { hash: 'fleet', file: 'fleet-dealership.png' },
      { hash: 'cash-flow', file: 'cash-flow.png' },
      { hash: 'progression', file: 'career-progression.png' },
      { hash: 'logbook', file: 'logbook.png' },
      { hash: 'guide', file: 'pilot-guide.png' }
    ];

    for (const t of tabsToCapture) {
      await captureTab(browserPath, t.hash, t.file);
      await sleep(1000);
    }

    console.log('\n✨ All screenshots captured successfully in docs/screenshots/!');
  } finally {
    console.log('[Screenshot Tool] Shutting down background server process...');
    serverProcess.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error('[Screenshot Tool] Fatal error:', err);
  process.exit(1);
});
