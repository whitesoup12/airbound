import fs from 'fs';
import { execSync, fork } from 'child_process';

// 1. Verify and compile frontend if not yet built
const hasClientDist = fs.existsSync('client/dist') && fs.existsSync('client/dist/index.html');
const hasRootDist = fs.existsSync('dist') && fs.existsSync('dist/index.html');

if (!hasClientDist && !hasRootDist) {
  console.log('[Airbound Desktop] Compiling frontend on initial launch...');
  try {
    execSync('node scripts/build.js', { stdio: 'inherit' });
  } catch (err) {
    console.error('[Airbound Desktop] Build failed:', err.message);
    process.exit(1);
  }
}

// 2. Launch server in desktop mode with auto-open browser flag
console.log('[Airbound Desktop] Starting local server & MSFS SimConnect engine...');
const serverProcess = fork('server/src/server.js', ['--open'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    AIRBOUND_AUTO_OPEN: 'true'
  }
});

serverProcess.on('exit', (code) => {
  process.exit(code || 0);
});

process.on('SIGINT', () => {
  serverProcess.kill('SIGINT');
  process.exit(0);
});
