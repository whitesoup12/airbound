import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import http from 'http';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
let splashWindow = null;
let mainWindow = null;
let serverProcess = null;

/**
 * Fast health check for Express backend server
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
          setTimeout(check, 250);
        }
      }
    };
    check();
  });
}

function getServerScriptPath() {
  if (app.isPackaged) {
    const appDir = path.join(process.resourcesPath, 'app');
    const directServer = path.join(appDir, 'server', 'src', 'server.js');
    if (fs.existsSync(directServer)) return directServer;

    const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'src', 'server.js');
    if (fs.existsSync(unpacked)) return unpacked;

    const resourcesPath = path.join(process.resourcesPath, 'server', 'src', 'server.js');
    if (fs.existsSync(resourcesPath)) return resourcesPath;
  }
  return path.resolve(__dirname, '..', 'server', 'src', 'server.js');
}

function startBackendServer() {
  const serverScript = getServerScriptPath();

  // Set persistent data directory in AppData / userData (guaranteed user write permissions)
  const userDataDir = app.getPath('userData');
  const dataDir = path.join(userDataDir, 'data', 'db');
  fs.mkdirSync(dataDir, { recursive: true });

  const clientDistDir = app.isPackaged
    ? (fs.existsSync(path.join(process.resourcesPath, 'app', 'dist'))
        ? path.join(process.resourcesPath, 'app', 'dist')
        : (fs.existsSync(path.join(process.resourcesPath, 'app.asar.unpacked', 'dist'))
            ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist')
            : path.join(process.resourcesPath, 'dist')))
    : path.resolve(__dirname, '..', 'dist');

  const env = {
    ...process.env,
    PORT: String(PORT),
    AIRBOUND_DATA_DIR: dataDir,
    AIRBOUND_CLIENT_DIST: clientDistDir,
    AIRBOUND_DESKTOP: 'true',
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: '1'
  };

  console.log(`[Electron] Starting backend server from: ${serverScript}`);
  console.log(`[Electron] Database directory: ${dataDir}`);
  console.log(`[Electron] Static frontend directory: ${clientDistDir}`);

  const forkOptions = {
    env,
    stdio: 'inherit'
  };

  if (app.isPackaged) {
    forkOptions.execPath = process.execPath;
  }

  serverProcess = fork(serverScript, [], forkOptions);

  serverProcess.on('exit', (code) => {
    console.log(`[Electron] Backend server exited with code ${code}`);
    serverProcess = null;
  });
}

function createSplashWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  splashWindow = new BrowserWindow({
    width: 500,
    height: 320,
    frame: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    show: true,
    backgroundColor: '#0a0d14',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

async function createMainWindow() {
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

  // Log renderer console messages and load failures to diagnostic log
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console level ${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Renderer Fail Load] ${errorCode} - ${errorDescription} on ${validatedURL}`);
  });

  // Open external links (e.g. Navigraph / AirNav / SkyVector) in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Enable F12 DevTools toggle for easy debugging if ever needed
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  try {
    console.log('[Electron] Waiting for backend server on port ' + PORT + '...');
    await waitForServer(`http://localhost:${PORT}/api/health`);
    console.log('[Electron] Server ready, loading dashboard...');
    await mainWindow.loadURL(`http://localhost:${PORT}`);

    // Seamless handoff: Show main window and close splash screen
    mainWindow.show();
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
  } catch (err) {
    console.error('[Electron] Failed to connect to server:', err);
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    mainWindow.loadURL(`data:text/html,<html><body style="background:#0a0d14;color:#f87171;font-family:sans-serif;padding:40px;"><h2>Airbound Startup Error</h2><p>${err.message}</p><p style="color:#94a3b8;font-size:13px;">Please check whether another application is occupying port ${PORT} or check the backend logs.</p></body></html>`);
    mainWindow.show();
  }
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
    // 1. Show instant splash screen (< 200ms)
    createSplashWindow();

    // 2. Start Express / MongoDB backend in background
    startBackendServer();

    // 3. Create main window and wait for server
    await createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
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
