import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  Globe,
  Download,
  Layers,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Info
} from 'lucide-react';
import {
  fetchSettings,
  testDatabaseConnection,
  updateDatabaseSetting,
  fetchMsfsLogbookStatus,
  importMsfsLogbook,
  fetchAirportSyncStatus,
  triggerAirportSync,
  subscribeAirportSyncStream
} from '../../api/client.js';
import DialogModal from '../common/DialogModal.jsx';

export function OptionsView({
  pilot,
  onPilotUpdated,
  onSwitchToLogbook,
  onOpenOnboarding,
  onResetPilot
}) {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    details: '',
    type: 'info',
    confirmText: 'OK',
    cancelText: null,
    onConfirm: null
  });

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

  // Airport Database Sync state with Progress Bar
  const [airportSyncStatus, setAirportSyncStatus] = useState({
    active: false,
    stage: 'idle',
    percent: 0,
    current: 0,
    total: 0,
    message: 'Ready to sync MSFS airports.',
    error: null
  });
  const streamUnsubscribeRef = useRef(null);

  // Initial load
  useEffect(() => {
    loadSettings();
    scanLogbook();

    fetchAirportSyncStatus()
      .then((status) => {
        if (status) {
          setAirportSyncStatus(status);
          if (status.active) {
            subscribeToProgressStream();
          }
        }
      })
      .catch(() => {});

    return () => {
      if (streamUnsubscribeRef.current) {
        streamUnsubscribeRef.current();
        streamUnsubscribeRef.current = null;
      }
    };
  }, []);

  const subscribeToProgressStream = () => {
    if (streamUnsubscribeRef.current) streamUnsubscribeRef.current();

    streamUnsubscribeRef.current = subscribeAirportSyncStream(
      (status) => {
        setAirportSyncStatus(status);
        if (status.stage === 'completed') {
          loadSettings();
        }
      },
      () => {
        // Fallback polling
        const interval = setInterval(() => {
          fetchAirportSyncStatus().then((s) => {
            setAirportSyncStatus(s);
            if (!s.active) {
              clearInterval(interval);
              loadSettings();
            }
          }).catch(() => clearInterval(interval));
        }, 1000);
      }
    );
  };

  const handleStartAirportSync = async () => {
    try {
      subscribeToProgressStream();
      await triggerAirportSync();
    } catch (err) {
      setDialogState({
        isOpen: true,
        title: 'Airport Synchronization Error',
        type: 'warning',
        message: 'Could not initialize airport download & database synchronization.',
        details: err.message,
        confirmText: 'Understood',
        cancelText: null
      });
    }
  };

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
      if (data?.airportSync) {
        setAirportSyncStatus(data.airportSync);
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

        {/* Informative Merge & Count Explainer */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs font-mono space-y-1.5">
          <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-[11px] uppercase tracking-wide">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Non-Destructive Merge & MSFS Logbook Counts</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            • <strong className="text-slate-300">Non-Destructive Merge:</strong> Re-importing will never erase or overwrite your existing Airbound flights, company balance, or fleet. Any flight already in your logbook is safely kept with zero duplicates.
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            • <strong className="text-slate-300">Why disk file counts differ from MSFS:</strong> MSFS writes every loaded session into its raw data file (<code className="text-cyan-300">sr_logbook</code>)—including aborted departures, restarts, or quick tests under 2–3 minutes. The in-game MSFS pilot profile hides flights without recorded landings, while the raw file logs all spawned sessions.
          </p>
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
                  {importResult.success ? 'Logbook Successfully Merged!' : 'Import Error'}
                </span>
                <span className="text-xs opacity-90">
                  {importResult.success
                    ? importResult.imported === 0
                      ? `All ${importResult.skipped} flights are already recorded in Airbound. Your existing logbook was safely preserved with zero duplicates.`
                      : importResult.skipped > 0
                      ? `Successfully merged ${importResult.imported} new flights into your logbook! (${importResult.skipped} existing flights safely kept, 0 duplicates). Career XP awarded: +${importResult.xpAwarded?.toLocaleString()} XP.`
                      : `Successfully imported ${importResult.imported} flights into your logbook (+${importResult.xpAwarded?.toLocaleString()} Career XP awarded).`
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

      {/* SECTION 3: WORLD AIRPORT DATABASE SEEDING */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/90 bg-slate-900/60 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5 text-cyan-300">
            <Globe className="w-5 h-5" />
            <h3 className="font-bold text-base text-white">World Airport Database</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Active in DB: <strong className="text-cyan-400">{(liveStatus?.totalAirports || 123).toLocaleString()} Airfields</strong>
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-200">
                Sync ~49,000 Active MSFS Fixed-Wing Airfields
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Populates all major international, regional hubs, GA, and seaplane bases modeled in Microsoft Flight Simulator.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-400 shrink-0">
              Clean MSFS Dataset
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px] font-mono">
            <div className="bg-slate-950/70 border border-slate-800 p-2 rounded-lg">
              <div className="font-bold text-white text-xs">1,175</div>
              <div className="text-slate-400 uppercase">Major Intl</div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 p-2 rounded-lg">
              <div className="font-bold text-white text-xs">4,105</div>
              <div className="text-slate-400 uppercase">Regional Hubs</div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 p-2 rounded-lg">
              <div className="font-bold text-white text-xs">42,804</div>
              <div className="text-slate-400 uppercase">General Aviation</div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 p-2 rounded-lg">
              <div className="font-bold text-white text-xs">1,273</div>
              <div className="text-slate-400 uppercase">Seaplane Bases</div>
            </div>
          </div>

          {/* Progress Bar Container */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-slate-300 flex items-center gap-2">
                {airportSyncStatus.active && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
                {airportSyncStatus.stage === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                <span>Seeding Progress</span>
              </span>
              <span className="text-cyan-400 font-bold">
                {airportSyncStatus.percent}%
              </span>
            </div>

            <div className="w-full bg-slate-900 rounded-full h-3 p-0.5 border border-slate-800 overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  airportSyncStatus.stage === 'completed'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/50'
                    : airportSyncStatus.stage === 'error'
                    ? 'bg-rose-500'
                    : 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 shadow-md shadow-cyan-500/50'
                }`}
                style={{ width: `${Math.max(airportSyncStatus.percent > 0 ? 3 : 0, airportSyncStatus.percent)}%` }}
              />
            </div>

            <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>{airportSyncStatus.message}</span>
              {airportSyncStatus.total > 0 && airportSyncStatus.stage === 'ingesting' && (
                <span className="text-slate-500 text-[11px]">
                  {airportSyncStatus.current.toLocaleString()} / {airportSyncStatus.total.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Action Trigger Button */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <span className="text-xs text-slate-500 font-mono">
              Downloads runway lengths and builds 2dsphere index for instant dispatch matching.
            </span>
            <button
              type="button"
              onClick={handleStartAirportSync}
              disabled={airportSyncStatus.active}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition flex items-center space-x-2 shadow-lg shadow-cyan-950/50 cursor-pointer"
            >
              {airportSyncStatus.active ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Seeding in Progress...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-slate-950" />
                  <span>{airportSyncStatus.stage === 'completed' ? 'Re-Sync Airport Database' : 'Download & Seed 49,000 MSFS Airports'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: DANGER ZONE • CAREER RESET */}
      <div className="glass-panel rounded-2xl p-5 border border-rose-500/40 bg-rose-950/20 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0 shadow-md">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-200 font-mono tracking-wider flex items-center gap-2">
                DANGER ZONE • CAREER RESET
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Reset your company funds, fleet, and base airport back to standard starting conditions.
              </p>
            </div>
          </div>

          {onResetPilot && (
            <button
              type="button"
              onClick={onResetPilot}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-mono font-bold text-xs transition flex items-center space-x-2 shadow-lg shadow-rose-950/60 cursor-pointer shrink-0 border border-rose-400/50"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Reset Pilot Career</span>
            </button>
          )}
        </div>

        <div className="p-3 bg-slate-950/80 rounded-xl border border-rose-900/40 text-[11px] font-mono text-slate-400 space-y-1.5">
          <p className="text-rose-300 font-semibold flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            Career Reset Safety Information:
          </p>
          <ul className="list-disc list-inside space-y-0.5 pl-1 text-slate-400 text-[11px]">
            <li>Resets company balance to standard starting funds ($15,000).</li>
            <li>Resets active fleet back to starting Cessna 152.</li>
            <li>Relocates home base and generates fresh contracts for your selected airport.</li>
            <li><strong className="text-emerald-400 font-bold">Your complete flight logbook, recorded flight hours, and career XP progression remain permanently preserved.</strong></li>
          </ul>
        </div>
      </div>

      {/* SECTION 4: SYSTEM DIAGNOSTICS */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800/80 bg-slate-900/40 text-xs text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="font-bold text-slate-300">Airbound Desktop v1.0.0</span>
          <p className="text-[11px] text-slate-500 flex items-center flex-wrap gap-1">
            <span>Pilot: <strong className="text-cyan-400">{pilot?.callsign || 'James'}</strong></span>
            <span>•</span>
            <span>Current Base: <strong className="text-white">{pilot?.current_icao || 'KLAX'}</strong></span>
            <span>•</span>
            <span>Fleet: <strong className="text-white">{pilot?.fleet?.length || 1} aircraft</strong></span>
            {onOpenOnboarding && (
              <>
                <span>•</span>
                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  className="text-cyan-400 hover:text-cyan-300 underline font-mono text-[11px] cursor-pointer"
                >
                  Edit in Setup Wizard
                </button>
              </>
            )}
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

      <DialogModal
        {...dialogState}
        onClose={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default OptionsView;
