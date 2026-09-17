import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar.jsx';
import FlightDeckView from './components/views/FlightDeckView.jsx';
import DispatchView from './components/views/DispatchView.jsx';
import FleetView from './components/views/FleetView.jsx';
import CareerLogbookView from './components/views/CareerLogbookView.jsx';
import ChangeBaseModal from './components/ChangeBaseModal.jsx';
import ResetCareerModal from './components/ResetCareerModal.jsx';
import { useTelemetry } from './hooks/useTelemetry.js';
import {
  fetchPilot,
  resetPilot,
  fetchJobs,
  refreshJobs,
  acceptJob,
  cancelJob,
  fetchAirports,
  updateBaseAirport
} from './api/client.js';
import { Trophy, X } from 'lucide-react';

function getInitialTab() {
  const hash = window.location.hash.replace('#', '');
  if (['flight-deck', 'dispatch', 'fleet', 'career'].includes(hash)) {
    return hash;
  }
  return 'flight-deck';
}

export function App() {
  const [currentTab, setCurrentTab] = useState(getInitialTab);
  const [pilot, setPilot] = useState(null);
  const [currentAirport, setCurrentAirport] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [previewJob, setPreviewJob] = useState(null);
  const [allAirports, setAllAirports] = useState([]);
  const [visitedAirportsDetails, setVisitedAirportsDetails] = useState([]);
  const [isChangeBaseOpen, setIsChangeBaseOpen] = useState(false);
  const [isResetCareerOpen, setIsResetCareerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completionBanner, setCompletionBanner] = useState(null);

  // Sync hash changes with tab state
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['flight-deck', 'dispatch', 'fleet', 'career'].includes(hash)) {
        setCurrentTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabChange = (tabId) => {
    setCurrentTab(tabId);
    window.location.hash = tabId;
  };

  // Load initial pilot & airport data
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const pilotData = await fetchPilot();
      setPilot(pilotData.pilot);
      setCurrentAirport(pilotData.currentAirport);

      const jobData = await fetchJobs(pilotData.pilot?.current_icao);
      const fetchedJobs = jobData.jobs || [];
      setJobs(fetchedJobs);
      setVisitedAirportsDetails(pilotData.visitedAirportsDetails || []);
      if (fetchedJobs.length > 0 && !jobData.activeJob) {
        setPreviewJob(fetchedJobs[0]);
      }

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
        setVisitedAirportsDetails(pilotData.visitedAirportsDetails || []);

        const jobData = await fetchJobs(pilotData.pilot?.current_icao);
        const newJobs = jobData.jobs || [];
        setJobs(newJobs);
        if (newJobs.length > 0) {
          setPreviewJob(newJobs[0]);
        }
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
    setActiveJob,
    aircraftValidation,
    destDist,
    originDist
  } = useTelemetry(handleFlightCompleted);

  // Contract Actions
  const handleAcceptJob = async (jobId) => {
    try {
      const res = await acceptJob(jobId);
      setActiveJob(res.job);
      if (res.pilot) {
        setPilot(res.pilot);
      }
      setPreviewJob(null);
      // Remove accepted job from available jobs list
      setJobs((prev) => prev.filter((j) => j._id !== jobId));
      // Automatically switch user to the Flight Deck cockpit!
      handleTabChange('flight-deck');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCancelJob = async (jobId) => {
    if (!confirm('Are you sure you want to cancel this contract?')) return;
    try {
      const res = await cancelJob(jobId);
      setActiveJob(null);
      if (res.pilot) {
        setPilot(res.pilot);
      }
      // Refresh available jobs
      const jobData = await fetchJobs(pilot?.current_icao);
      const refreshed = jobData.jobs || [];
      setJobs(refreshed);
      if (refreshed.length > 0) {
        setPreviewJob(refreshed[0]);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRefreshJobs = async () => {
    if (!pilot?.current_icao) return;
    try {
      const res = await refreshJobs(pilot.current_icao);
      const refreshed = res.jobs || [];
      setJobs(refreshed);
      if (refreshed.length > 0) {
        setPreviewJob(refreshed[0]);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSelectBaseAirport = async (icao) => {
    const res = await updateBaseAirport(icao);
    setPilot(res.pilot);
    setCurrentAirport(res.currentAirport);
    const newJobs = res.jobs || [];
    setJobs(newJobs);
    setActiveJob(null);
    if (newJobs.length > 0) {
      setPreviewJob(newJobs[0]);
    }
  };

  const handleResetPilot = () => {
    setIsResetCareerOpen(true);
  };

  const handleConfirmResetCareer = async (homeBase) => {
    const res = await resetPilot({ homeBase, startingBalance: 15000 });
    setActiveJob(null);
    await loadInitialData();
    return res;
  };

  const handleAircraftChanged = async (updatedPilot) => {
    setPilot(updatedPilot);
    const jobData = await fetchJobs(updatedPilot?.current_icao);
    const newJobs = jobData.jobs || [];
    setJobs(newJobs);
    if (newJobs.length > 0) {
      setPreviewJob(newJobs[0]);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black pb-8">
      {/* Top Multi-Tab Navigation */}
      <Navbar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        pilot={pilot}
        connectionStatus={connectionStatus}
        activeJob={activeJob}
        phase={phase}
        destDist={destDist}
        availableJobsCount={jobs.length}
        onResetPilot={handleResetPilot}
        onOpenChangeBase={() => setIsChangeBaseOpen(true)}
      />

      {/* Completion Banner Alert with Financial Ledger */}
      {completionBanner && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white p-4 shadow-xl border-b border-emerald-400/40 animate-slideDown">
          <div className="max-w-[1600px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-yellow-300" />
              </div>
              <div>
                <h4 className="font-bold text-sm sm:text-base font-mono flex items-center space-x-2">
                  <span>FLIGHT COMPLETED!</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded text-white text-xs">
                    NET PROFIT: +${completionBanner.payout?.toLocaleString()}
                  </span>
                </h4>
                <div className="text-xs text-emerald-100 font-mono mt-0.5 flex flex-wrap items-center gap-3">
                  <span>Landed at {completionBanner.newIcao}</span>
                  {completionBanner.settlement && (
                    <>
                      <span>• Gross: ${completionBanner.settlement.grossPayout?.toLocaleString()}</span>
                      <span>• Fuel: -${completionBanner.settlement.fuelCost?.toFixed(2)} ({completionBanner.settlement.fuelGallons} gal)</span>
                      <span>• Landing Fee: -${completionBanner.settlement.landingFee}</span>
                    </>
                  )}
                  {completionBanner.insufficientRentalFunds && (
                    <span className="bg-rose-900/90 text-rose-200 px-2 py-0.5 rounded text-[11px] font-bold">
                      ⚠️ Balance insufficient for active rental renewal (${completionBanner.rentalPrice?.toLocaleString()} required)
                    </span>
                  )}
                </div>
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

      {/* Main Multi-Tab View Workspace */}
      <main className="flex-1 max-w-[1600px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {currentTab === 'flight-deck' && (
          <FlightDeckView
            telemetry={telemetry}
            phase={phase}
            activeJob={activeJob}
            aircraftValidation={aircraftValidation}
            destDist={destDist}
            originDist={originDist}
            onCancelJob={handleCancelJob}
            pilot={pilot}
            currentAirport={currentAirport}
            allAirports={allAirports}
            onAcceptJob={handleAcceptJob}
            onSwitchToDispatch={() => handleTabChange('dispatch')}
          />
        )}

        {currentTab === 'dispatch' && (
          <DispatchView
            jobs={jobs}
            activeJob={activeJob}
            previewJob={previewJob}
            currentIcao={pilot?.current_icao || 'KLAX'}
            currentAirport={currentAirport}
            allAirports={allAirports}
            pilot={pilot}
            onSelectJob={(job) => setPreviewJob(job)}
            onAcceptJob={handleAcceptJob}
            onRefreshJobs={handleRefreshJobs}
            onOpenChangeBase={() => setIsChangeBaseOpen(true)}
            loading={loading}
            telemetry={telemetry}
          />
        )}

        {currentTab === 'fleet' && (
          <FleetView
            pilot={pilot}
            onAircraftChanged={handleAircraftChanged}
          />
        )}

        {currentTab === 'career' && (
          <CareerLogbookView
            pilot={pilot}
            currentAirport={currentAirport}
            visitedAirportsDetails={visitedAirportsDetails}
            allAirports={allAirports}
            onOpenChangeBase={() => setIsChangeBaseOpen(true)}
            onReloadPilot={loadInitialData}
          />
        )}
      </main>

      {/* Change Base Airport Modal */}
      <ChangeBaseModal
        isOpen={isChangeBaseOpen}
        onClose={() => setIsChangeBaseOpen(false)}
        currentIcao={pilot?.current_icao || 'KXNA'}
        allAirports={allAirports}
        onSelectBaseAirport={handleSelectBaseAirport}
      />

      {/* Reset Career Modal */}
      <ResetCareerModal
        isOpen={isResetCareerOpen}
        onClose={() => setIsResetCareerOpen(false)}
        currentIcao={pilot?.current_icao || 'KXNA'}
        allAirports={allAirports}
        onConfirmReset={handleConfirmResetCareer}
      />
    </div>
  );
}

export default App;
