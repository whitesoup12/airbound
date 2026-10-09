import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import http from 'http';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
let mainWindow = null;
let serverProcess = null;

/**
 * Wait for Express server to be healthy and responsive
 */
function waitForServer(url, timeoutMs = 45000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });

      req.on('error', () => {
        retry();
      });

      function retry() {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Server startup timed out after ${timeoutMs}ms`));
        } else {
          setTimeout(check, 300);
        }
      }
    };
    check();
  });
}

function getServerScriptPath() {
  if (app.isPackaged) {
    const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'src', 'server.js');
    if (fs.existsSync(unpacked)) return unpacked;
    const resourcesPath = path.join(process.resourcesPath, 'server', 'src', 'server.js');
    if (fs.existsSync(resourcesPath)) return resourcesPath;
  }
  return path.resolve(__dirname, '..', 'server', 'src', 'server.js');
}

function startBackendServer() {
  const serverScript = getServerScriptPath();

  // Set persistent data directory in AppData / userData (standard for desktop Windows apps)
  const userDataDir = app.getPath('userData');
  const dataDir = path.join(userDataDir, 'data', 'db');
  fs.mkdirSync(dataDir, { recursive: true });

  const env = {
    ...process.env,
    PORT: String(PORT),
    AIRBOUND_DATA_DIR: dataDir,
    AIRBOUND_DESKTOP: 'true',
    NODE_ENV: 'production'
  };

  console.log(`[Electron] Starting backend server from: ${serverScript}`);
  console.log(`[Electron] Database directory: ${dataDir}`);

  serverProcess = fork(serverScript, [], {
    env,
    stdio: 'inherit'
  });

  serverProcess.on('exit', (code) => {
    console.log(`[Electron] Backend server exited with code ${code}`);
    serverProcess = null;
  });
}

async function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Airbound — MSFS 2024 Career Tracker',
    backgroundColor: '#0a0d14',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Open external links (e.g. Navigraph / AirNav / SkyVector) in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  try {
    console.log('[Electron] Waiting for backend server on port ' + PORT + '...');
    await waitForServer(`http://localhost:${PORT}/api/health`);
    console.log('[Electron] Server ready, loading dashboard...');
    await mainWindow.loadURL(`http://localhost:${PORT}`);
    mainWindow.show();
  } catch (err) {
    console.error('[Electron] Failed to connect to server:', err);
    mainWindow.loadURL(`data:text/html,<html><body style="background:#0a0d14;color:#f87171;font-family:sans-serif;padding:40px;"><h2>Airbound Startup Error</h2><p>${err.message}</p></body></html>`);
    mainWindow.show();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock (prevent multiple concurrent copies)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    startBackendServer();
    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('before-quit', () => {
    if (serverProcess) {
      console.log('[Electron] Shutting down backend server...');
      serverProcess.kill('SIGINT');
      serverProcess = null;
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
