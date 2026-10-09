import React, { useState, useEffect } from 'react';
import {
  Database,
  BookOpen,
  Server,
  HardDrive,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  PlugZap,
  Save,
  Check,
  FolderOpen,
  ArrowRight,
  Plane,
  ShieldCheck,
  Cpu,
  Clock,
  Compass,
  Sparkles
} from 'lucide-react';
import {
  fetchSettings,
  testDatabaseConnection,
  updateDatabaseSetting,
  fetchMsfsLogbookStatus,
  importMsfsLogbook
} from '../../api/client.js';

export function OptionsView({
  pilot,
  onPilotUpdated,
  onSwitchToLogbook,
  onOpenOnboarding
}) {
  // Database configuration state
  const [dbMode, setDbMode] = useState('local'); // 'local' | 'hosted'
  const [hostedUri, setHostedUri] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [migrateData, setMigrateData] = useState(true);

  // Testing & Saving states
  const [testingDb, setTestingDb] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success, message, error }
  const [savingDb, setSavingDb] = useState(false);
  const [dbSaveSuccess, setDbSaveSuccess] = useState(null);

  // Live status from server
  const [liveStatus, setLiveStatus] = useState(null);

  // MSFS Logbook state
  const [logbookInfo, setLogbookInfo] = useState(null);
  const [customLogbookPath, setCustomLogbookPath] = useState('');
  const [scanningLogbook, setScanningLogbook] = useState(false);
  const [importingLogbook, setImportingLogbook] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Initial load
  useEffect(() => {
    loadSettings();
    scanLogbook();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await fetchSettings();
      if (data?.settings?.database) {
        setDbMode(data.settings.database.type || 'local');
        setHostedUri(data.settings.database.hostedUri || '');
      }
      if (data?.liveStatus) {
        setLiveStatus(data.liveStatus);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const scanLogbook = async (pathOverride = '') => {
    setScanningLogbook(true);
    try {
      const data = await fetchMsfsLogbookStatus(pathOverride);
      setLogbookInfo(data);
      if (data?.targetPath && !customLogbookPath) {
        setCustomLogbookPath(data.targetPath);
      }
    } catch (err) {
      console.error('Failed to scan MSFS logbook:', err);
    } finally {
      setScanningLogbook(false);
    }
  };

  const handleTestConnection = async () => {
    if (!hostedUri) {
      setTestResult({ success: false, error: 'Please enter a MongoDB connection URI.' });
      return;
    }
    setTestingDb(true);
    setTestResult(null);
    try {
      const res = await testDatabaseConnection(hostedUri);
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestingDb(false);
    }
  };

  const handleSaveDatabaseSetting = async () => {
    if (dbMode === 'hosted' && !hostedUri) {
      setTestResult({ success: false, error: 'Please enter a valid MongoDB connection string.' });
      return;
    }
    setSavingDb(true);
    setDbSaveSuccess(null);
    try {
      const res = await updateDatabaseSetting({
        type: dbMode,
        uri: hostedUri,
        migrateLocalData: migrateData
      });
      setDbSaveSuccess(res.message || 'Database configuration saved and connected successfully!');
      if (res.pilot && onPilotUpdated) {
        onPilotUpdated(res.pilot);
      }
      await loadSettings();
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setSavingDb(false);
    }
  };

  const handleImportLogbook = async () => {
    setImportingLogbook(true);
    setImportResult(null);
    try {
      const res = await importMsfsLogbook(customLogbookPath);
      setImportResult(res);
      if (res.pilot && onPilotUpdated) {
        onPilotUpdated(res.pilot);
      }
      // Re-scan to refresh stats
      await scanLogbook(customLogbookPath);
    } catch (err) {
      setImportResult({ success: false, error: err.message });
    } finally {
      setImportingLogbook(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto font-mono pb-12">
      {/* Top Header Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-700/80 bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-cyan-950/90 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shrink-0">
              <Database className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center space-x-2">
                <span>SYSTEM OPTIONS & INTEGRATIONS</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure database storage provider and sync flight logbooks from Microsoft Flight Simulator 2024.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {onOpenOnboarding && (
              <button
                type="button"
                onClick={onOpenOnboarding}
                className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 hover:bg-cyan-900/80 text-xs font-mono font-bold text-cyan-300 transition shadow-sm"
              >
                <Compass className="w-4 h-4" />
                <span>Run Setup Wizard</span>
              </button>
            )}

            {liveStatus && (
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
                <span className={`w-2.5 h-2.5 rounded-full ${liveStatus.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
                <span>
                  Active DB: <strong className="text-white">{liveStatus.currentType === 'hosted' ? 'Hosted MongoDB' : 'Local WiredTiger'}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 1: DATABASE STORAGE ENGINE */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/90 bg-slate-900/60 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5 text-cyan-300">
            <Server className="w-5 h-5" />
            <h3 className="font-bold text-base text-white">Database Storage Engine</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {liveStatus?.isEmbedded ? 'Offline Local Storage' : 'Cloud / Remote Storage'}
          </span>
        </div>

        {/* Database Mode Radio Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Local Embedded DB */}
          <button
            type="button"
            onClick={() => {
              setDbMode('local');
              setTestResult(null);
              setDbSaveSuccess(null);
            }}
            className={`p-4 rounded-xl border text-left transition relative flex flex-col justify-between ${
              dbMode === 'local'
                ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-lg shadow-cyan-950/40'
                : 'bg-slate-950/40 border-slate-800/90 text-slate-400 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm font-bold text-white">
                  <HardDrive className={`w-4 h-4 ${dbMode === 'local' ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span>Local Embedded Database</span>
                </div>
                {dbMode === 'local' && (
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Zero configuration. Uses high-performance WiredTiger engine stored locally on this machine (%APPDATA%\Airbound).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
              <span>Setup: Instant / Offline</span>
              <span className="text-emerald-400 font-semibold">Zero-Config</span>
            </div>
          </button>

          {/* Card 2: Hosted MongoDB */}
          <button
            type="button"
            onClick={() => {
              setDbMode('hosted');
              setTestResult(null);
              setDbSaveSuccess(null);
            }}
            className={`p-4 rounded-xl border text-left transition relative flex flex-col justify-between ${
              dbMode === 'hosted'
                ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-lg shadow-cyan-950/40'
                : 'bg-slate-950/40 border-slate-800/90 text-slate-400 hover:border-slate-700 hover:text-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm font-bold text-white">
                  <Cloud className={`w-4 h-4 ${dbMode === 'hosted' ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span>Hosted MongoDB</span>
                </div>
                {dbMode === 'hosted' && (
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Connect to any custom hosted MongoDB (MongoDB Atlas, Docker container, AWS DocumentDB, DigitalOcean, or private VPS).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
              <span>Multi-device Sync</span>
              <span className="text-cyan-400 font-semibold">Any Provider</span>
            </div>
          </button>
        </div>

        {/* Hosted DB Connection Input Form (Conditional when Hosted selected) */}
        {dbMode === 'hosted' && (
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4 animate-fadeIn">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wide">
                MongoDB Connection String (URI)
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={hostedUri}
                  onChange={(e) => {
                    setHostedUri(e.target.value);
                    setTestResult(null);
                    setDbSaveSuccess(null);
                  }}
                  placeholder="mongodb+srv://username:password@cluster.mongodb.net/airbound?retryWrites=true&w=majority"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-white transition"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Standard format: <code className="text-slate-400">mongodb+srv://user:pass@host/airbound</code> or <code className="text-slate-400">mongodb://localhost:27017/airbound</code>
              </p>
            </div>

            <div className="bg-cyan-950/30 border border-cyan-800/40 rounded-lg p-3 text-[11px] text-cyan-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-cyan-300">
                <Sparkles className="w-3.5 h-3.5" /> Default Database Name: airbound
              </div>
              <p className="text-slate-300">
                If no database name is specified in your URI, Airbound automatically uses the database <strong className="text-white">airbound</strong> instead of MongoDB's default <strong className="text-white">test</strong>.
              </p>
              <p className="text-slate-400 text-[10px]">
                Tip: You can use an existing MongoDB database from the web version; all your flight logs, aircraft fleet, and balance will be retained.
              </p>
            </div>

            {/* Migration Checkbox */}
            <label className="flex items-center space-x-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={migrateData}
                onChange={(e) => setMigrateData(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span>Migrate existing career pilot profile, hangar, and flights into this hosted database</span>
            </label>

            {/* Test Connection Result Alert */}
            {testResult && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-start space-x-2 animate-fadeIn ${
                  testResult.success
                    ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-700/60 text-rose-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{testResult.success ? 'Connection Successful' : 'Connection Failed'}</div>
                  <div className="text-[11px] opacity-90 mt-0.5">
                    {testResult.message || testResult.error}
                  </div>
                </div>
              </div>
            )}

            {/* Test Button */}
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingDb || !hostedUri}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
              >
                {testingDb ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    <span>Testing Connection...</span>
                  </>
                ) : (
                  <>
                    <PlugZap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Test Connection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Save Result Notification */}
        {dbSaveSuccess && (
          <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-600/70 text-emerald-300 text-xs flex items-center space-x-2 animate-fadeIn">
            <Check className="w-4 h-4 shrink-0" />
            <span>{dbSaveSuccess}</span>
          </div>
        )}

        {/* Save & Apply Button */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-800">
          <div className="text-xs text-slate-500">
            {dbMode === 'local'
              ? 'Local database will activate immediately.'
              : 'App will switch active Mongoose connection pool upon saving.'}
          </div>
          <button
            type="button"
            onClick={handleSaveDatabaseSetting}
            disabled={savingDb || (dbMode === 'hosted' && !hostedUri)}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs transition flex items-center space-x-2 shadow-lg shadow-cyan-950/50 cursor-pointer"
          >
            {savingDb ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Applying Configuration...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-slate-950" />
                <span>Save & Connect Database</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* SECTION 2: MSFS 2024 LOGBOOK IMPORTER */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/90 bg-slate-900/60 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5 text-amber-400">
            <BookOpen className="w-5 h-5" />
            <h3 className="font-bold text-base text-white">MSFS 2024 Simulator Logbook</h3>
          </div>
          <button
            type="button"
            onClick={() => scanLogbook(customLogbookPath)}
            disabled={scanningLogbook}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 transition cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 text-cyan-400 ${scanningLogbook ? 'animate-spin' : ''}`} />
            <span>Scan Logbook</span>
          </button>
        </div>

        {/* Auto-detected Logbook Information Card */}
        {logbookInfo?.targetPath ? (
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 border border-emerald-700 text-emerald-300">
                    LOGBOOK FOUND
                  </span>
                  <span className="text-xs font-bold text-white">
                    {logbookInfo.detected?.[0]?.sim || 'MSFS 2024'} ({logbookInfo.detected?.[0]?.edition || 'Steam'})
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-mono break-all">
                  {logbookInfo.targetPath}
                </p>
              </div>

              {/* Stats pill badges */}
              <div className="flex items-center space-x-2 shrink-0">
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <span className="block text-xs font-bold text-cyan-300 font-mono">
                    {logbookInfo.totalFlights}
                  </span>
                  <span className="block text-[9px] text-slate-500 uppercase">Flights</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <span className="block text-xs font-bold text-amber-300 font-mono">
                    {logbookInfo.totalDurationHours}h
                  </span>
                  <span className="block text-[9px] text-slate-500 uppercase">Sim Time</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <span className="block text-xs font-bold text-emerald-300 font-mono">
                    {logbookInfo.uniqueAirportsCount}
                  </span>
                  <span className="block text-[9px] text-slate-500 uppercase">Airfields</span>
                </div>
              </div>
            </div>

            {/* Latest Flight in Logbook */}
            {logbookInfo.latestFlight && (
              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800/80 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <Plane className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-slate-400">Most Recent Flight:</span>
                  <span className="font-bold text-white font-mono">
                    {logbookInfo.latestFlight.origin_icao} ➔ {logbookInfo.latestFlight.destination_icao}
                  </span>
                  <span className="text-slate-400">• {logbookInfo.latestFlight.aircraft_title}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {new Date(logbookInfo.latestFlight.date).toLocaleDateString()} ({Math.round(logbookInfo.latestFlight.duration_seconds / 60)} min)
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-start space-x-3">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-200">No MSFS 2024 Logbook Auto-Detected</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Ensure Microsoft Flight Simulator 2024 is installed, or specify the full path to your <code className="text-cyan-300">sr_logbook</code> file below.
              </p>
            </div>
          </div>
        )}

        {/* Custom Path Override Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide">
            Logbook File Location
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={customLogbookPath}
              onChange={(e) => setCustomLogbookPath(e.target.value)}
              placeholder="C:\Program Files (x86)\Steam\userdata\<SteamID>\2537590\remote\sr_logbook"
              className="flex-1 px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={() => scanLogbook(customLogbookPath)}
              disabled={scanningLogbook || !customLogbookPath}
              className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-bold transition whitespace-nowrap cursor-pointer"
            >
              Verify Path
            </button>
          </div>
        </div>

        {/* Import Results Banner */}
        {importResult && (
          <div
            className={`p-4 rounded-xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn ${
              importResult.success
                ? 'bg-emerald-950/70 border-emerald-600/70 text-emerald-200'
                : 'bg-rose-950/70 border-rose-600/70 text-rose-200'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {importResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div>
                <span className="font-bold text-sm block">
                  {importResult.success ? 'Logbook Successfully Imported!' : 'Import Error'}
                </span>
                <span className="text-xs opacity-90">
                  {importResult.success
                    ? `Imported ${importResult.imported} new flights (${importResult.skipped} already logged). Career XP awarded: +${importResult.xpAwarded?.toLocaleString()} XP.`
                    : importResult.error}
                </span>
              </div>
            </div>

            {importResult.success && onSwitchToLogbook && (
              <button
                type="button"
                onClick={onSwitchToLogbook}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-emerald-100 border border-emerald-500 text-xs font-bold transition flex items-center space-x-1.5 shrink-0 cursor-pointer"
              >
                <span>View in Logbook</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Import Button */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-800">
          <div className="text-xs text-slate-500">
            {logbookInfo?.totalFlights
              ? `Ready to import ${logbookInfo.totalFlights} flights into your Airbound career.`
              : 'Select or scan a logbook file to import.'}
          </div>
          <button
            type="button"
            onClick={handleImportLogbook}
            disabled={importingLogbook || !logbookInfo?.totalFlights}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition flex items-center space-x-2 shadow-lg shadow-amber-950/50 cursor-pointer"
          >
            {importingLogbook ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Importing Flights...</span>
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4 text-slate-950" />
                <span>Import Flights into Career</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* SECTION 3: SYSTEM DIAGNOSTICS */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800/80 bg-slate-900/40 text-xs text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="font-bold text-slate-300">Airbound Desktop v1.0.0</span>
          <p className="text-[11px] text-slate-500">
            Pilot: <strong className="text-cyan-400">{pilot?.callsign || 'James'}</strong> • Current Base: <strong className="text-white">{pilot?.current_icao || 'KLAX'}</strong> • Fleet: <strong className="text-white">{pilot?.fleet?.length || 1} aircraft</strong>
          </p>
        </div>
        <div className="flex items-center space-x-3 text-[11px]">
          <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400">
            {liveStatus?.isEmbedded ? 'Local WiredTiger DB' : 'Remote MongoDB'}
          </span>
          <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400">
            Native SimConnect (MSFS)
          </span>
        </div>
      </div>
    </div>
  );
}

export default OptionsView;
