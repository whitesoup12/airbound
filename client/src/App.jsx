import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar.jsx';
import PilotHUD from './components/PilotHUD.jsx';
import TelemetryDashboard from './components/TelemetryDashboard.jsx';
import FlightMap from './components/FlightMap.jsx';
import JobBoard from './components/JobBoard.jsx';
import LogbookModal from './components/LogbookModal.jsx';
import SimulatorControlBar from './components/SimulatorControlBar.jsx';
import { useTelemetry } from './hooks/useTelemetry.js';
import {
  fetchPilot,
  resetPilot,
  fetchJobs,
  refreshJobs,
  acceptJob,
  cancelJob,
  fetchAirports
} from './api/client.js';
import { CheckCircle, Trophy, DollarSign, X } from 'lucide-react';

export function App() {
  const [pilot, setPilot] = useState(null);
  const [currentAirport, setCurrentAirport] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [allAirports, setAllAirports] = useState([]);
  const [isLogbookOpen, setIsLogbookOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completionBanner, setCompletionBanner] = useState(null);

  // Load initial pilot & airport data
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const pilotData = await fetchPilot();
      setPilot(pilotData.pilot);
      setCurrentAirport(pilotData.currentAirport);

      const jobData = await fetchJobs(pilotData.pilot?.current_icao);
      setJobs(jobData.jobs || []);

      const airportsData = await fetchAirports();
      setAllAirports(airportsData || []);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Callback when flight reaches COMPLETED state
  const handleFlightCompleted = useCallback(
    async (result) => {
      console.log('[App] Flight completed event received:', result);
      setCompletionBanner(result);

      // Refresh pilot and jobs for new airport
      try {
        const pilotData = await fetchPilot();
        setPilot(pilotData.pilot);
        setCurrentAirport(pilotData.currentAirport);

        const jobData = await fetchJobs(pilotData.pilot?.current_icao);
        setJobs(jobData.jobs || []);
      } catch (err) {
        console.error('Error updating state after completion:', err);
      }
    },
    []
  );

  // Telemetry stream hook
  const {
    telemetry,
    phase,
    connectionStatus,
    activeJob,
    setActiveJob
  } = useTelemetry(handleFlightCompleted);

  // Actions
  const handleAcceptJob = async (jobId) => {
    try {
      const res = await acceptJob(jobId);
      setActiveJob(res.job);
      // Remove accepted job from available jobs list
      setJobs((prev) => prev.filter((j) => j._id !== jobId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCancelJob = async (jobId) => {
    if (!confirm('Are you sure you want to cancel this contract?')) return;
    try {
      await cancelJob(jobId);
      setActiveJob(null);
      // Refresh available jobs
      const jobData = await fetchJobs(pilot?.current_icao);
      setJobs(jobData.jobs || []);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRefreshJobs = async () => {
    if (!pilot?.current_icao) return;
    try {
      const res = await refreshJobs(pilot.current_icao);
      setJobs(res.jobs || []);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResetPilot = async () => {
    if (
      !confirm(
        'Warning: This will reset your career balance back to $15,000, clear flight logs, and reposition you at KLAX. Proceed?'
      )
    ) {
      return;
    }
    try {
      await resetPilot();
      setActiveJob(null);
      await loadInitialData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black pb-28">
      {/* Top Navigation */}
      <Navbar
        pilot={pilot}
        connectionStatus={connectionStatus}
        onOpenLogbook={() => setIsLogbookOpen(true)}
        onResetPilot={handleResetPilot}
      />

      {/* Completion Banner Alert */}
      {completionBanner && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white p-4 shadow-xl flex items-center justify-between border-b border-emerald-400/40 animate-slideDown">
          <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-yellow-300" />
              </div>
              <div>
                <h4 className="font-bold text-sm sm:text-base font-mono">
                  FLIGHT CONTRACT COMPLETED! +${completionBanner.payout?.toLocaleString()} CREDITED
                </h4>
                <p className="text-xs text-emerald-100 font-mono">
                  Landed and secured at {completionBanner.newIcao}. Destination airport & country added to pilot logbook.
                </p>
              </div>
            </div>

            <button
              onClick={() => setCompletionBanner(null)}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 w-full">
        {/* Pilot HUD Strip */}
        <PilotHUD pilot={pilot} currentAirport={currentAirport} />

        {/* Live Telemetry Instruments & Active Contract */}
        <TelemetryDashboard
          telemetry={telemetry}
          phase={phase}
          activeJob={activeJob}
          onCancelJob={handleCancelJob}
        />

        {/* Interactive Flight Map */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-mono uppercase tracking-wider text-slate-400">
              TACTICAL FLIGHT RADAR & VISITED AIRPORTS
            </h3>
            <span className="text-xs font-mono text-cyan-400">
              {telemetry?.simOnGround ? 'GROUND TAXI MODE' : 'AIRBORNE RADAR ACTIVE'}
            </span>
          </div>
          <FlightMap
            telemetry={telemetry}
            activeJob={activeJob}
            visitedAirports={pilot?.visited_airports || []}
            allAirports={allAirports}
          />
        </div>

        {/* Job Dispatch Board */}
        <JobBoard
          jobs={jobs}
          activeJob={activeJob}
          currentIcao={pilot?.current_icao || 'KLAX'}
          onAcceptJob={handleAcceptJob}
          onRefreshJobs={handleRefreshJobs}
          loading={loading}
        />
      </main>

      {/* Pilot Logbook Modal */}
      <LogbookModal
        isOpen={isLogbookOpen}
        onClose={() => setIsLogbookOpen(false)}
        pilot={pilot}
      />

      {/* Interactive Simulator Control Bar */}
      <SimulatorControlBar
        currentPhase={phase}
        activeJob={activeJob}
        isMock={connectionStatus?.isMock}
        onPhaseStepSuccess={(phaseName) => {
          if (phaseName === 'COMPLETED') {
            // refresh data
            loadInitialData();
          }
        }}
      />
    </div>
  );
}

export default App;

