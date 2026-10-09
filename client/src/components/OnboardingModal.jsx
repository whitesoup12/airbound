import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Cloud,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Plane,
  Compass,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  BookOpen,
  Loader2,
  X,
  Globe,
  Download,
  RefreshCw,
  Layers
} from 'lucide-react';
import {
  fetchSettings,
  testDatabaseConnection,
  updateDatabaseSetting,
  fetchMsfsLogbookStatus,
  importMsfsLogbook,
  completeOnboarding,
  fetchAirportSyncStatus,
  triggerAirportSync,
  subscribeAirportSyncStream
} from '../api/client.js';

export function OnboardingModal({ isOpen, onClose, onComplete, pilot }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Database state
  const [dbType, setDbType] = useState('local'); // 'local' | 'hosted'
  const [hostedUri, setHostedUri] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testingDb, setTestingDb] = useState(false);
  const [dbSaved, setDbSaved] = useState(false);

  // Step 1: MSFS Logbook state
  const [logbookInfo, setLogbookInfo] = useState(null);
  const [scanningLogbook, setScanningLogbook] = useState(false);
  const [importingLogbook, setImportingLogbook] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Step 2: Airport Seeding state with Progress Bar
  const [airportSyncStatus, setAirportSyncStatus] = useState({
    active: false,
    stage: 'idle',
    percent: 0,
    current: 0,
    total: 0,
    message: 'Ready to sync MSFS airports.',
    error: null
  });
  const [totalDbAirports, setTotalDbAirports] = useState(123);
  const streamUnsubscribeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setDbSaved(false);
    setTestResult(null);
    setImportResult(null);

    // Fetch initial settings & database stats
    fetchSettings()
      .then((data) => {
        if (data.settings?.database?.type) {
          setDbType(data.settings.database.type);
        }
        if (data.settings?.database?.hostedUri) {
          setHostedUri(data.settings.database.hostedUri);
        }
        if (data.liveStatus?.totalAirports) {
          setTotalDbAirports(data.liveStatus.totalAirports);
        }
        if (data.airportSync) {
          setAirportSyncStatus(data.airportSync);
        }
      })
      .catch(() => {});

    // Pre-scan for MSFS Logbook
    setScanningLogbook(true);
    fetchMsfsLogbookStatus()
      .then((data) => {
        setLogbookInfo(data);
      })
      .catch(() => {})
      .finally(() => setScanningLogbook(false));

    // Check airport sync status
    fetchAirportSyncStatus()
      .then((status) => {
        if (status) setAirportSyncStatus(status);
      })
      .catch(() => {});

    return () => {
      if (streamUnsubscribeRef.current) {
        streamUnsubscribeRef.current();
        streamUnsubscribeRef.current = null;
      }
    };
  }, [isOpen]);

  // Subscribe to real-time airport seeding progress stream
  const startProgressSubscription = () => {
    if (streamUnsubscribeRef.current) streamUnsubscribeRef.current();

    streamUnsubscribeRef.current = subscribeAirportSyncStream(
      (status) => {
        setAirportSyncStatus(status);
        if (status.stage === 'completed' && status.total) {
          setTotalDbAirports(status.total);
        }
      },
      () => {
        // Fallback polling if SSE disconnects
        const interval = setInterval(() => {
          fetchAirportSyncStatus().then((s) => {
            setAirportSyncStatus(s);
            if (!s.active) clearInterval(interval);
          }).catch(() => clearInterval(interval));
        }, 1000);
      }
    );
  };

  if (!isOpen) return null;

  const handleTestDb = async () => {
    if (!hostedUri) return;
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

  const handleSaveStep1 = async () => {
    if (dbType === 'hosted' && !hostedUri) {
      alert('Please enter your MongoDB connection URI or choose Local Database.');
      return;
    }

    try {
      setLoading(true);
      await updateDatabaseSetting({
        type: dbType,
        uri: dbType === 'hosted' ? hostedUri : null,
        migrateLocalData: true
      });
      setDbSaved(true);
      setStep(2);
    } catch (err) {
      alert(`Database setup error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportLogbook = async () => {
    setImportingLogbook(true);
    try {
      const res = await importMsfsLogbook();
      setImportResult(res);
    } catch (err) {
      setImportResult({ success: false, error: err.message });
    } finally {
      setImportingLogbook(false);
    }
  };

  const handleStartAirportSeeding = async () => {
    try {
      startProgressSubscription();
      await triggerAirportSync();
    } catch (err) {
      alert(`Could not start airport sync: ${err.message}`);
    }
  };

  const handleFinishOnboarding = async () => {
    try {
      setLoading(true);
      await completeOnboarding();
      if (onComplete) onComplete();
      if (onClose) onClose();
    } catch (err) {
      console.warn('Could not complete onboarding:', err.message);
      if (onClose) onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0e131f] border border-cyan-500/30 rounded-2xl w-full max-w-2xl shadow-2xl shadow-cyan-950/50 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Plane className="w-5 h-5 rotate-45" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-mono tracking-wider text-white flex items-center gap-2">
                AIRBOUND ONBOARDING
                <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Step {step} of 3
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Microsoft Flight Simulator 2024 Career System Setup
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              title="Close Setup Wizard"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress Stepper Bar */}
        <div className="grid grid-cols-3 border-b border-slate-800 text-[11px] font-mono">
          <div
            className={`py-2.5 px-4 text-center border-b-2 transition ${
              step === 1
                ? 'border-cyan-400 text-cyan-300 font-bold bg-cyan-950/20'
                : step > 1
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-500'
            }`}
          >
            1. Database & Logbook
          </div>
          <div
            className={`py-2.5 px-4 text-center border-b-2 transition ${
              step === 2
                ? 'border-cyan-400 text-cyan-300 font-bold bg-cyan-950/20'
                : step > 2
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-500'
            }`}
          >
            2. Seed Airports
          </div>
          <div
            className={`py-2.5 px-4 text-center border-b-2 transition ${
              step === 3
                ? 'border-cyan-400 text-cyan-300 font-bold bg-cyan-950/20'
                : 'border-transparent text-slate-500'
            }`}
          >
            3. Departure
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* STEP 1: DATABASE SETUP & MSFS LOGBOOK SYNC */}
          {step === 1 && (
            <div className="space-y-6 animate-fadeIn">
              {/* Part A: Database Selection */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-cyan-400" />
                    1. Career Database Storage
                  </h4>
                  <p className="text-xs text-slate-400">
                    Choose local offline storage or connect a hosted MongoDB database.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDbType('local')}
                    className={`p-3.5 rounded-xl border text-left transition relative flex flex-col justify-between ${
                      dbType === 'local'
                        ? 'bg-cyan-950/30 border-cyan-400 ring-1 ring-cyan-400/50'
                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                          <HardDrive className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          Recommended
                        </span>
                      </div>
                      <h5 className="font-bold text-xs text-slate-200">Local Database (WiredTiger)</h5>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Zero setup. Fast, persistent, 100% offline-ready embedded database.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDbType('hosted')}
                    className={`p-3.5 rounded-xl border text-left transition relative flex flex-col justify-between ${
                      dbType === 'hosted'
                        ? 'bg-cyan-950/30 border-cyan-400 ring-1 ring-cyan-400/50'
                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                          <Cloud className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800">
                          Atlas / Remote
                        </span>
                      </div>
                      <h5 className="font-bold text-xs text-slate-200">Hosted MongoDB</h5>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Connect to MongoDB Atlas. Retains your existing pilot, fleet, and progress.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Hosted MongoDB Input */}
                {dbType === 'hosted' && (
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5 animate-slideDown">
                    <label className="block text-xs font-mono font-bold text-slate-300">
                      Connection String (URI)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={hostedUri}
                        onChange={(e) => setHostedUri(e.target.value)}
                        placeholder="mongodb+srv://user:pass@cluster.mongodb.net/airbound"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        onClick={handleTestDb}
                        disabled={testingDb || !hostedUri}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-mono text-slate-200 rounded-lg transition flex items-center gap-1.5"
                      >
                        {testingDb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test'}
                      </button>
                    </div>

                    <div className="text-[11px] text-cyan-300 font-mono flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>Defaults to database <strong>'airbound'</strong> if omitted. Existing data is preserved.</span>
                    </div>

                    {testResult && (
                      <div
                        className={`p-2.5 rounded-lg text-xs font-mono flex items-center gap-2 ${
                          testResult.success
                            ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                            : 'bg-rose-950/60 border border-rose-500/50 text-rose-300'
                        }`}
                      >
                        {testResult.success ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Connected ({testResult.latencyMs}ms). DB: <strong>{testResult.dbName}</strong></span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>{testResult.error || 'Connection failed'}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Part B: MSFS Logbook Import */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    2. Import MSFS 2024 Flight History
                  </h4>
                  <p className="text-xs text-slate-400">
                    Sync flight hours and visited airfields from your Microsoft Flight Simulator 2024 logbook.
                  </p>
                </div>

                {scanningLogbook ? (
                  <div className="p-4 bg-slate-900/40 rounded-xl text-center text-slate-400 font-mono text-xs flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Scanning disk for MSFS 2024 logbook files...</span>
                  </div>
                ) : logbookInfo && logbookInfo.totalFlights > 0 ? (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>MSFS 2024 Logbook Detected</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {logbookInfo.detected?.[0]?.source || 'Auto-Detected'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center font-mono py-1.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                      <div>
                        <div className="text-base font-bold text-cyan-400">{logbookInfo.totalFlights}</div>
                        <div className="text-[10px] text-slate-400 uppercase">Flights</div>
                      </div>
                      <div className="border-x border-slate-800">
                        <div className="text-base font-bold text-cyan-400">{logbookInfo.totalDurationHours}h</div>
                        <div className="text-[10px] text-slate-400 uppercase">Hours</div>
                      </div>
                      <div>
                        <div className="text-base font-bold text-cyan-400">{logbookInfo.uniqueAirportsCount}</div>
                        <div className="text-[10px] text-slate-400 uppercase">Airports</div>
                      </div>
                    </div>

                    {importResult ? (
                      <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/50 rounded-lg text-xs font-mono text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          Imported <strong>{importResult.imported}</strong> flights (+{importResult.xpAwarded?.toLocaleString()} XP).
                          {importResult.skipped > 0 && ` (${importResult.skipped} duplicate flights skipped).`}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleImportLogbook}
                        disabled={importingLogbook}
                        className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {importingLogbook ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Importing Flights into Logbook...</span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Import {logbookInfo.totalFlights} Flights into Career Logbook</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-center text-xs text-slate-400">
                    No existing MSFS 2024 logbook detected. You can start fresh or import later via Options.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: AIRPORT DATABASE SEEDING WITH PROGRESS BAR */}
          {step === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h4 className="text-base font-bold text-white mb-1 flex items-center gap-2 font-mono">
                  <Globe className="w-5 h-5 text-cyan-400" />
                  Seed World Airport Database
                </h4>
                <p className="text-xs text-slate-400">
                  Populate your database with the complete set of ~49,000 active fixed-wing airfields modeled in Microsoft Flight Simulator.
                </p>
              </div>

              {/* Categorization Specs Pill Banner */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    MSFS Fixed-Wing Dataset
                  </span>
                  <span className="text-cyan-400 font-bold">~49,000 Airfields</span>
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

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ✓ Automatically filters out 23k+ rooftop helipads and 13k+ abandoned grass pastures so dispatch contracts only target real flyable runways in MSFS.
                </p>
              </div>

              {/* PROGRESS BAR COMPONENT */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-white flex items-center gap-2">
                    {airportSyncStatus.active && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />}
                    {airportSyncStatus.stage === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>Seeding Progress</span>
                  </span>
                  <span className="text-cyan-400 font-bold text-sm">
                    {airportSyncStatus.percent}%
                  </span>
                </div>

                {/* Progress Track */}
                <div className="w-full bg-slate-950 rounded-full h-3.5 p-0.5 border border-slate-800 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                      airportSyncStatus.stage === 'completed'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/50'
                        : airportSyncStatus.stage === 'error'
                        ? 'bg-rose-500'
                        : 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 shadow-lg shadow-cyan-500/50'
                    }`}
                    style={{ width: `${Math.max(2, airportSyncStatus.percent)}%` }}
                  />
                </div>

                {/* Status Message Text */}
                <div className="text-xs font-mono text-slate-300 flex items-center justify-between">
                  <span>{airportSyncStatus.message}</span>
                  {airportSyncStatus.total > 0 && airportSyncStatus.stage === 'ingesting' && (
                    <span className="text-slate-400 text-[11px]">
                      {airportSyncStatus.current.toLocaleString()} / {airportSyncStatus.total.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  {airportSyncStatus.stage !== 'completed' ? (
                    <button
                      type="button"
                      onClick={handleStartAirportSeeding}
                      disabled={airportSyncStatus.active}
                      className="flex-1 py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-mono text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 disabled:opacity-50"
                    >
                      {airportSyncStatus.active ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Seeding Database in Background...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Download & Seed 49,000 MSFS Airports</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex-1 py-2.5 px-4 bg-emerald-950/70 border border-emerald-500/50 rounded-lg text-emerald-300 text-xs font-mono font-bold flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Airport Database Fully Seeded ({totalDbAirports.toLocaleString()} Airfields)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Starter Set Note */}
              <p className="text-[11px] text-slate-500 text-center font-mono">
                Current database has {totalDbAirports.toLocaleString()} airports. You can proceed with the starter set and sync the rest anytime from Options.
              </p>
            </div>
          )}

          {/* STEP 3: PREFLIGHT COMPLETE • TAKEOFF */}
          {step === 3 && (
            <div className="space-y-5 animate-fadeIn text-center py-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/40 flex items-center justify-center mx-auto text-cyan-400">
                <Compass className="w-8 h-8 animate-pulse" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-white mb-1">Preflight Checklist Complete</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Your aircraft is fueled, the world airport catalog is indexed, and SimConnect bridge is standing by.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left font-mono text-xs bg-slate-900/50 border border-slate-800 rounded-xl p-4 max-w-md mx-auto">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Pilot Callsign</span>
                  <span className="font-bold text-white">{pilot?.callsign || 'James'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Home Base</span>
                  <span className="font-bold text-cyan-400">{pilot?.current_icao || 'KLAX'}</span>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase">Starting Funds</span>
                  <span className="font-bold text-emerald-400">${(pilot?.balance || 15000).toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase">Database Airfields</span>
                  <span className="font-bold text-cyan-300">{totalDbAirports.toLocaleString()} Airports</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold rounded-lg transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {step === 1 && (
              <button
                type="button"
                onClick={handleSaveStep1}
                disabled={loading}
                className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold rounded-lg transition flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Next: Seed Airports <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            )}

            {step === 2 && (
              <>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg transition"
                >
                  {airportSyncStatus.stage === 'completed' ? 'Continue' : 'Skip For Now'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold rounded-lg transition flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
                >
                  Next: Ready for Flight <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleFinishOnboarding}
                disabled={loading}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold font-mono text-xs rounded-lg transition flex items-center gap-2 shadow-lg shadow-emerald-500/30"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Enter Cockpit & Fly <Plane className="w-4 h-4 rotate-45" /></>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingModal;
