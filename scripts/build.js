import { execSync } from 'child_process';
import fs from 'fs';

console.log('[Build] Checking client dependencies for production build...');
if (!fs.existsSync('client/node_modules') || !fs.existsSync('client/node_modules/vite')) {
  console.log('[Build] Installing client dependencies (npm --prefix client install)...');
  execSync('npm --prefix client install --include=dev', { stdio: 'inherit' });
}

console.log('[Build] Building React client with Vite...');
execSync('npm --prefix client run build', { stdio: 'inherit' });

console.log('[Build] Synchronizing client/dist to root dist/ for Vercel...');
if (fs.existsSync('client/dist')) {
  fs.cpSync('client/dist', 'dist', { recursive: true });
}

console.log('[Build] Ensuring server/bin directory exists...');
if (!fs.existsSync('server/bin')) {
  fs.mkdirSync('server/bin', { recursive: true });
}

console.log('[Build] Build complete! Output available in both ./dist and ./client/dist');

