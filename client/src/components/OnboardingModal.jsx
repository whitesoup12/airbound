import React, { useState, useEffect } from 'react';
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
  ExternalLink
} from 'lucide-react';
import {
  fetchSettings,
  testDatabaseConnection,
  updateDatabaseSetting,
  fetchMsfsLogbookStatus,
  importMsfsLogbook,
  completeOnboarding
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

  // Step 2: MSFS Logbook state
  const [logbookInfo, setLogbookInfo] = useState(null);
  const [scanningLogbook, setScanningLogbook] = useState(false);
  const [importingLogbook, setImportingLogbook] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setDbSaved(false);
    setTestResult(null);
    setImportResult(null);

    // Fetch initial settings
    fetchSettings()
      .then((data) => {
        if (data.settings?.database?.type) {
          setDbType(data.settings.database.type);
        }
        if (data.settings?.database?.hostedUri) {
          setHostedUri(data.settings.database.hostedUri);
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
  }, [isOpen]);

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

  const handleSaveDatabaseStep = async () => {
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
      <div className="bg-[#0e131f] border border-cyan-500/30 rounded-2xl w-full max-w-2xl shadow-2xl shadow-cyan-950/50 overflow-hidden flex flex-col max-h-[90vh]">
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
            1. Database
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
            2. Flight History
          </div>
          <div
            className={`py-2.5 px-4 text-center border-b-2 transition ${
              step === 3
                ? 'border-cyan-400 text-cyan-300 font-bold bg-cyan-950/20'
                : 'border-transparent text-slate-500'
            }`}
          >
            3. Takeoff
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* STEP 1: DATABASE SELECTION */}
          {step === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h4 className="text-base font-bold text-white mb-1">Choose Career Database Storage</h4>
                <p className="text-xs text-slate-400">
                  Select where your pilot earnings, aircraft fleet, and contracts are saved.
                </p>
              </div>

              {/* Mode Options Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDbType('local')}
                  className={`p-4 rounded-xl border text-left transition relative flex flex-col justify-between ${
                    dbType === 'local'
                      ? 'bg-cyan-950/30 border-cyan-400 ring-1 ring-cyan-400/50'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                        Default
                      </span>
                    </div>
                    <h5 className="font-bold text-sm text-slate-200">Local Database</h5>
                    <p className="text-xs text-slate-400 mt-1">
                      Zero configuration. Runs embedded MongoDB on your computer with full offline persistence.
                    </p>
                  </div>
                  <div className="mt-3 text-[11px] text-cyan-400 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready immediately
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDbType('hosted')}
                  className={`p-4 rounded-xl border text-left transition relative flex flex-col justify-between ${
                    dbType === 'hosted'
                      ? 'bg-cyan-950/30 border-cyan-400 ring-1 ring-cyan-400/50'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                        <Cloud className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800">
                        Cloud / Atlas
                      </span>
                    </div>
                    <h5 className="font-bold text-sm text-slate-200">Hosted MongoDB</h5>
                    <p className="text-xs text-slate-400 mt-1">
                      Connect to MongoDB Atlas or existing database. Seamlessly loads your existing pilot and fleet.
                    </p>
                  </div>
                  <div className="mt-3 text-[11px] text-purple-300 font-mono flex items-center gap-1">
                    <Database className="w-3.5 h-3.5" /> Multi-device sync
                  </div>
                </button>
              </div>

              {/* Hosted MongoDB Input */}
              {dbType === 'hosted' && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3 animate-slideDown">
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-300 mb-1">
                      MongoDB Connection URI
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
                  </div>

                  <div className="bg-cyan-950/30 border border-cyan-800/40 rounded-lg p-3 text-[11px] text-cyan-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-cyan-300">
                      <Sparkles className="w-3.5 h-3.5" /> Default Database Name: airbound
                    </div>
                    <p className="text-slate-300">
                      If no database name is specified in your connection string, Airbound automatically uses the database <strong className="text-white">airbound</strong> instead of MongoDB's default <strong className="text-white">test</strong>.
                    </p>
                    <p className="text-slate-400 text-[10px]">
                      Tip: You can use an existing MongoDB database from the web version; all your flight logs, aircraft fleet, and balance will be retained.
                    </p>
                  </div>

                  {testResult && (
                    <div
                      className={`p-3 rounded-lg text-xs font-mono flex items-center gap-2 ${
                        testResult.success
                          ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                          : 'bg-rose-950/60 border border-rose-500/50 text-rose-300'
                      }`}
                    >
                      {testResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                          <span>
                            Connected to cluster ({testResult.latencyMs}ms). Target DB: <strong>{testResult.dbName}</strong>
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                          <span>{testResult.error || 'Connection failed'}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: MSFS 2024 LOGBOOK SYNC */}
          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h4 className="text-base font-bold text-white mb-1">Sync MSFS 2024 Flight History</h4>
                <p className="text-xs text-slate-400">
                  Optionally import previous flights, visited airfields, and hours logged in Microsoft Flight Simulator 2024.
                </p>
              </div>

              {scanningLogbook ? (
                <div className="p-8 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                  <span>Scanning local disk for MSFS 2024 logbook files...</span>
                </div>
              ) : logbookInfo && logbookInfo.totalFlights > 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>MSFS 2024 Logbook Found!</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {logbookInfo.detected?.[0]?.source || 'Auto-Detected'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center font-mono py-2 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <div className="p-2">
                      <div className="text-lg font-bold text-cyan-400">{logbookInfo.totalFlights}</div>
                      <div className="text-[10px] text-slate-400 uppercase">Flights Logged</div>
                    </div>
                    <div className="p-2 border-x border-slate-800">
                      <div className="text-lg font-bold text-cyan-400">{logbookInfo.totalDurationHours}h</div>
                      <div className="text-[10px] text-slate-400 uppercase">Flight Hours</div>
                    </div>
                    <div className="p-2">
                      <div className="text-lg font-bold text-cyan-400">{logbookInfo.uniqueAirportsCount}</div>
                      <div className="text-[10px] text-slate-400 uppercase">Airports Visited</div>
                    </div>
                  </div>

                  {importResult ? (
                    <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-lg text-xs font-mono text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
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
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                    >
                      {importingLogbook ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Importing Flights into Logbook...</span>
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-4 h-4" />
                          <span>Import {logbookInfo.totalFlights} Flights into Airbound Logbook</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-center space-y-2">
                  <p className="text-xs text-slate-300">
                    No existing MSFS 2024 logbook detected yet, or simulator has not logged flights.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    You can start with a fresh logbook right now and import flight history at any time via Options.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: READY FOR DEPARTURE */}
          {step === 3 && (
            <div className="space-y-5 animate-fadeIn text-center py-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/40 flex items-center justify-center mx-auto text-cyan-400">
                <Compass className="w-8 h-8 animate-pulse" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-white mb-1">Preflight Checklist Complete</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Your aircraft is fueled, contracts are dispatched, and the SimConnect bridge is standing by.
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
                  <span className="text-[10px] text-slate-500 block uppercase">Database Storage</span>
                  <span className="font-bold text-slate-300">
                    {dbType === 'hosted' ? 'Hosted MongoDB' : 'Local Embedded'}
                  </span>
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
                onClick={handleSaveDatabaseStep}
                disabled={loading}
                className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold rounded-lg transition flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Next: Logbook Sync <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            )}

            {step === 2 && (
              <>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg transition"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold rounded-lg transition flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
                >
                  Continue <ArrowRight className="w-3.5 h-3.5" />
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
