import { execSync } from 'child_process';
import fs from 'fs';

console.log('[Build] Building React client with Vite...');
execSync('npm --prefix client run build', { stdio: 'inherit' });

console.log('[Build] Synchronizing client/dist to root dist/ for Vercel...');
if (fs.existsSync('client/dist')) {
  fs.cpSync('client/dist', 'dist', { recursive: true });
}

console.log('[Build] Build complete! Output available in both ./dist and ./client/dist');
