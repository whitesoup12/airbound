import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar.jsx';
import FlightDeckView from './components/views/FlightDeckView.jsx';
import DispatchView from './components/views/DispatchView.jsx';
import FleetView from './components/views/FleetView.jsx';
import CashFlowView from './components/views/CashFlowView.jsx';
import CareerLogbookView from './components/views/CareerLogbookView.jsx';
import CareerProgressView from './components/views/CareerProgressView.jsx';
import GuideView from './components/views/GuideView.jsx';
import OptionsView from './components/views/OptionsView.jsx';
import ChangeBaseModal from './components/ChangeBaseModal.jsx';
import ResetCareerModal from './components/ResetCareerModal.jsx';
import CockpitLockModal from './components/CockpitLockModal.jsx';
import ConnectorStatusModal from './components/ConnectorStatusModal.jsx';
import AirportChartsModal from './components/AirportChartsModal.jsx';
import OnboardingModal from './components/OnboardingModal.jsx';
import DialogModal from './components/common/DialogModal.jsx';
import { useTelemetry } from './hooks/useTelemetry.js';
import {
  fetchPilot,
  resetPilot,
  fetchJobs,
  refreshJobs,
  acceptJob,
  cancelJob,
  fetchAirports,
  updateBaseAirport,
  startFreeFlight,
  cancelFreeFlight,
  completeFlightApi,
  checkAuthStatus,
  getStoredPasscode,
  clearStoredPasscode,
  fetchSettings
} from './api/client.js';
import { Trophy, X, Award, Sparkles } from 'lucide-react';
import { formatLandingRating } from './utils/xpUtils.js';

function getInitialTab() {
  const hash = window.location.hash.replace('#', '');
  if (['flight-deck', 'dispatch', 'fleet', 'cash-flow', 'finances', 'progression', 'logbook', 'career', 'guide', 'handbook', 'options', 'settings'].includes(hash)) {
    if (hash === 'career') return 'progression';
    if (hash === 'finances') return 'cash-flow';
    if (hash === 'handbook') return 'guide';
    if (hash === 'settings') return 'options';
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
  const [isConnectorStatusOpen, setIsConnectorStatusOpen] = useState(false);
  const [chartsModalOpen, setChartsModalOpen] = useState(false);
  const [selectedChartsAirport, setSelectedChartsAirport] = useState({ icao: '', name: '' });
  const [loading, setLoading] = useState(true);
  const [completionBanner, setCompletionBanner] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isAuthRequired, setIsAuthRequired] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    details: '',
    type: 'confirm',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: null
  });

  const handleOpenCharts = useCallback((icao, name = '') => {
    if (!icao) return;
    setSelectedChartsAirport({ icao: icao.toUpperCase().trim(), name: name || '' });
    setChartsModalOpen(true);
  }, []);

  // Check auth requirement and onboarding status on startup
  useEffect(() => {
    checkAuthStatus()
      .then((status) => {
        if (status?.authRequired) {
          setIsAuthRequired(true);
          if (!getStoredPasscode()) {
            setIsLocked(true);
          }
        }
      })
      .catch(() => {});

    // Check if initial startup / onboarding is needed
    fetchSettings()
      .then((data) => {
        if (data?.settings && data.settings.hasCompletedOnboarding === false) {
          setIsOnboardingOpen(true);
        }
      })
      .catch(() => {});

    const handleUnauthorized = () => {
      setIsLocked(true);
    };
    window.addEventListener('airbound:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('airbound:unauthorized', handleUnauthorized);
  }, []);

  const handleUnlockSuccess = () => {
    setIsLocked(false);
    loadInitialData();
  };

  const handleLockCockpit = () => {
    clearStoredPasscode();
    setIsLocked(true);
  };

  // Sync hash changes with tab state
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['flight-deck', 'dispatch', 'fleet', 'cash-flow', 'finances', 'progression', 'logbook', 'career', 'guide', 'handbook', 'options', 'settings'].includes(hash)) {
        if (hash === 'career') setCurrentTab('progression');
        else if (hash === 'finances') setCurrentTab('cash-flow');
        else if (hash === 'handbook') setCurrentTab('guide');
        else if (hash === 'settings') setCurrentTab('options');
        else setCurrentTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleTabChange = (tabId) => {
    setCurrentTab(tabId);
    window.location.hash = tabId;
  };

  // Load initial pilot & airport data concurrently
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [pilotData, airportsData] = await Promise.all([
        fetchPilot(),
        fetchAirports()
      ]);
      setPilot(pilotData.pilot);
      setCurrentAirport(pilotData.currentAirport);
      setVisitedAirportsDetails(pilotData.visitedAirportsDetails || []);
      setAllAirports(airportsData || []);

      const jobData = await fetchJobs(pilotData.pilot?.current_icao);
      const fetchedJobs = jobData.jobs || [];
      setJobs(fetchedJobs);
      if (fetchedJobs.length > 0 && !jobData.activeJob) {
        setPreviewJob(fetchedJobs[0]);
      }
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
    originDist,
    flightSeconds = 0,
    airborneSeconds = 0
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
      setDialogState({
        isOpen: true,
        title: 'Contract Acceptance Notice',
        type: 'warning',
        message: err.message,
        confirmText: 'Understood',
        cancelText: null
      });
    }
  };

  const handleCancelJob = (jobId) => {
    const isFree = Boolean(activeJob?.is_free_flight);
    setDialogState({
      isOpen: true,
      title: isFree ? 'Cancel Free Flight' : 'Cancel Flight Contract',
      type: 'danger',
      message: isFree
        ? 'Are you sure you want to cancel this Free Flight session?'
        : 'Are you sure you want to cancel this flight contract? Any penalty fee or forfeited deposit will be deducted.',
      confirmText: isFree ? 'Cancel Flight' : 'Cancel Contract',
      cancelText: 'Keep Flying',
      onConfirm: async () => {
        setDialogState((prev) => ({ ...prev, isOpen: false }));
        try {
          if (isFree) {
            await cancelFreeFlight();
          } else {
            const res = await cancelJob(jobId);
            if (res.pilot) setPilot(res.pilot);
          }
          setActiveJob(null);
          // Refresh available jobs
          const jobData = await fetchJobs(pilot?.current_icao);
          const refreshed = jobData.jobs || [];
          setJobs(refreshed);
          if (refreshed.length > 0) {
            setPreviewJob(refreshed[0]);
          }
        } catch (err) {
          setDialogState({
            isOpen: true,
            title: 'Cancellation Error',
            type: 'warning',
            message: err.message,
            confirmText: 'Understood',
            cancelText: null
          });
        }
      }
    });
  };

  const handleStartFreeFlight = async ({ destination_icao, deduct_fees }) => {
    try {
      const res = await startFreeFlight({ destination_icao, deduct_fees });
      setActiveJob(res.activeJob);
      if (res.pilot) {
        setPilot(res.pilot);
      }
      return res;
    } catch (err) {
      console.error('[App] Failed to start free flight:', err);
      throw err;
    }
  };

  const handleCancelFreeFlight = async () => {
    try {
      await cancelFreeFlight();
      setActiveJob(null);
      await loadInitialData();
    } catch (err) {
      console.error('[App] Failed to cancel free flight:', err);
      throw err;
    }
  };

  const handleManualCompleteFlight = async () => {
    try {
      setLoading(true);
      const res = await completeFlightApi({
        job: activeJob,
        telemetry,
        flightSeconds,
        airborneSeconds
      });
      if (res?.flight) {
        await handleFlightCompleted(res.flight);
      }
    } catch (err) {
      console.error('[App] Manual flight completion error:', err);
      setDialogState({
        isOpen: true,
        title: 'Flight Settlement Notice',
        type: 'warning',
        message: 'Could not settle active flight with server.',
        details: err.message,
        confirmText: 'Understood',
        cancelText: null
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshJobs = async (direction = 'any') => {
    const targetDir = typeof direction === 'string' && direction ? direction : 'any';
    if (!pilot?.current_icao) return;
    try {
      const res = await refreshJobs(pilot.current_icao, 3000, targetDir);
      const refreshed = res.jobs || [];
      setJobs(refreshed);
      if (refreshed.length > 0) {
        setPreviewJob(refreshed[0]);
      }
    } catch (err) {
      setDialogState({
        isOpen: true,
        title: 'Contract Generation Notice',
        type: 'warning',
        message: err.message,
        confirmText: 'Understood',
        cancelText: null
      });
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
    setPilot((prev) => ({
      ...prev,
      ...updatedPilot,
      flight_log: updatedPilot?.flight_log || prev?.flight_log || []
    }));
    try {
      const jobData = await fetchJobs(updatedPilot?.current_icao);
      const newJobs = jobData.jobs || [];
      setJobs(newJobs);
      if (newJobs.length > 0) {
        setPreviewJob(newJobs[0]);
      }
    } catch (err) {
      console.warn('[App] Could not refresh jobs after aircraft change:', err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-row selection:bg-cyan-500 selection:text-black">
      {/* Left Multi-Tab Navigation Sidebar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        pilot={pilot}
        connectionStatus={connectionStatus}
        activeJob={activeJob}
        phase={phase}
        destDist={destDist}
        availableJobsCount={jobs.length}
        onLockCockpit={handleLockCockpit}
        isAuthRequired={isAuthRequired}
        onOpenConnectorStatus={() => setIsConnectorStatusOpen(true)}
        onOpenCharts={handleOpenCharts}
      />

      {/* Main Content & Scroll View */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-x-hidden">

      {/* Completion Banner Alert with Financial Ledger & XP Breakdown */}
      {completionBanner && (() => {
        const landingRatingInfo = formatLandingRating(
          completionBanner.touchdownFpm,
          completionBanner.landingRating,
          {
            landingClass: completionBanner.flightXp?.aircraftClass || completionBanner.summary?.landing_class,
            aircraftName: completionBanner.aircraftName || completionBanner.summary?.aircraft_name,
            category: completionBanner.summary?.category,
            approachKts: completionBanner.summary?.approach_speed_kts
          }
        );
        const flightXp = completionBanner.flightXp;
        const rankInfo = completionBanner.rankInfo;

        return (
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white p-4 shadow-xl border-b border-emerald-400/40 animate-slideDown space-y-2.5">
            {/* Level-Up Promotion Banner */}
            {completionBanner.leveledUp && rankInfo && (
              <div className="bg-amber-400 text-slate-950 px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center justify-between shadow-lg shadow-amber-950/40 animate-pulse">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-slate-950 animate-spin" />
                  <span>
                    🎉 CAREER PROMOTION! You reached Level {rankInfo.level}: {rankInfo.title.toUpperCase()}! Seniority bonus increased to +{rankInfo.bonusPercent}%.
                  </span>
                </div>
                <span className="hidden sm:inline bg-slate-950 text-amber-300 px-2 py-0.5 rounded text-[10px]">
                  NEW RANK UNLOCKED
                </span>
              </div>
            )}

            <div className="max-w-[1600px] 2xl:max-w-[1760px] mx-auto w-full flex items-start sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
                  <Trophy className="w-6 h-6 text-yellow-300" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-sm sm:text-base font-mono">
                      FLIGHT COMPLETED!
                      {completionBanner.summary?.source === 'free_flight' ? 'FREE FLIGHT COMPLETED!' : 'FLIGHT COMPLETED!'}
                    </h4>
                    <span className="bg-white/20 px-2 py-0.5 rounded text-white text-xs font-mono font-bold">
                      NET PROFIT: +${completionBanner.payout?.toLocaleString()}
                    </span>
                    {completionBanner.summary?.source === 'free_flight' ? (
                      <span className="bg-white/20 px-2 py-0.5 rounded text-white text-xs font-mono font-bold">
                        {completionBanner.payout < 0
                          ? `EXPENSES: -$${Math.abs(completionBanner.payout)?.toFixed(2)}`
                          : 'FREE FLIGHT • $0 EXPENSE'}
                      </span>
                    ) : (
                      <span className="bg-white/20 px-2 py-0.5 rounded text-white text-xs font-mono font-bold">
                        NET PROFIT: +${completionBanner.payout?.toLocaleString()}
                      </span>
                    )}

                    {/* XP Reward Badge */}
                    {flightXp?.totalXp ? (
                      <span className="bg-purple-950/90 border border-purple-400/50 text-purple-200 px-2.5 py-0.5 rounded text-xs font-mono font-bold flex items-center space-x-1 shadow-sm">
                        <Award className="w-3.5 h-3.5 text-purple-300" />
                        <span>+{flightXp.totalXp.toLocaleString()} XP</span>
                      </span>
                    ) : null}

                    {/* Touchdown Rating Badge */}
                    {completionBanner.touchdownFpm !== null && completionBanner.touchdownFpm !== undefined ? (
                      <span className="bg-slate-950/80 border border-slate-700/80 px-2 py-0.5 rounded text-xs font-mono flex items-center space-x-1.5 shadow-sm text-slate-200">
                        <span>{landingRatingInfo.icon}</span>
                        <span>Touchdown: <strong>{Math.round(completionBanner.touchdownFpm)} FPM</strong></span>
                        <span className={`font-bold ${landingRatingInfo.color}`}>
                          • {landingRatingInfo.label} Landing {flightXp?.landingXp !== undefined && flightXp?.landingXp !== null ? (
                            flightXp.landingXp > 0
                              ? `(+${flightXp.landingXp} XP)`
                              : flightXp.landingXp < 0
                              ? `(${flightXp.landingXp} XP)`
                              : '(+0 XP)'
                          ) : ''}
                        </span>
                      </span>
                    ) : null}
                  </div>

                  <div className="text-xs text-emerald-100 font-mono mt-1 flex flex-wrap items-center gap-3">
                    <span>Landed at <strong>{completionBanner.newIcao}</strong></span>
                    {completionBanner.settlement && (
                      <>
                        <span>• Gross: ${completionBanner.settlement.grossPayout?.toLocaleString()}</span>
                        <span>• Fuel: -${completionBanner.settlement.fuelCost?.toFixed(2)} ({completionBanner.settlement.fuelGallons} gal)</span>
                        <span>• Landing Fee: -${completionBanner.settlement.landingFee}</span>
                      </>
                    )}
                    {completionBanner.rentToOwn?.isRental && completionBanner.rentToOwn?.equityEarned > 0 && (
                      <span className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 px-2 py-0.5 rounded text-[11px] font-bold">
                        🏷️ Rent-to-Own: +${completionBanner.rentToOwn.equityEarned.toLocaleString()} Equity Credited! (Total Banked: ${completionBanner.rentToOwn.totalEquity.toLocaleString()})
                      </span>
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
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        );
      })()}

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
            onOpenCareer={() => handleTabChange('progression')}
            connectionStatus={connectionStatus}
            onOpenConnectorStatus={() => setIsConnectorStatusOpen(true)}
            onCompleteFlight={handleManualCompleteFlight}
            onOpenCharts={handleOpenCharts}
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
            onStartFreeFlight={handleStartFreeFlight}
            onCancelFreeFlight={handleCancelFreeFlight}
            onOpenCharts={handleOpenCharts}
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

        {(currentTab === 'cash-flow' || currentTab === 'finances') && (
          <CashFlowView
            pilot={pilot}
            allAirports={allAirports}
            onSwitchToDispatch={() => handleTabChange('dispatch')}
            onSwitchToFleet={() => handleTabChange('fleet')}
          />
        )}

        {(currentTab === 'progression' || currentTab === 'career') && (
          <CareerProgressView
            pilot={pilot}
            currentAirport={currentAirport}
            allAirports={allAirports}
            onOpenChangeBase={() => setIsChangeBaseOpen(true)}
            onSwitchToDispatch={() => handleTabChange('dispatch')}
            onSwitchToLogbook={() => handleTabChange('logbook')}
          />
        )}

        {currentTab === 'logbook' && (
          <CareerLogbookView
            pilot={pilot}
            currentAirport={currentAirport}
            visitedAirportsDetails={visitedAirportsDetails}
            allAirports={allAirports}
            onOpenChangeBase={() => setIsChangeBaseOpen(true)}
            onReloadPilot={loadInitialData}
            onSwitchToProgression={() => handleTabChange('progression')}
            onOpenCharts={handleOpenCharts}
          />
        )}

        {(currentTab === 'guide' || currentTab === 'handbook') && (
          <GuideView
            pilot={pilot}
            onNavigateTab={handleTabChange}
          />
        )}

        {(currentTab === 'options' || currentTab === 'settings') && (
          <OptionsView
            pilot={pilot}
            onPilotUpdated={(updatedPilot) => setPilot(updatedPilot)}
            onSwitchToLogbook={() => handleTabChange('logbook')}
            onOpenOnboarding={() => setIsOnboardingOpen(true)}
            onResetPilot={handleResetPilot}
          />
        )}
      </main>
      </div>

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

      {/* Cockpit Security Lock Modal */}
      <CockpitLockModal
        isOpen={isLocked}
        onSuccess={handleUnlockSuccess}
      />

      {/* Simulator Connector Diagnostics Modal */}
      <ConnectorStatusModal
        isOpen={isConnectorStatusOpen}
        onClose={() => setIsConnectorStatusOpen(false)}
        connectionStatus={connectionStatus}
      />

      {/* Airport Aeronautical Charts & Plates Modal */}
      <AirportChartsModal
        isOpen={chartsModalOpen}
        onClose={() => setChartsModalOpen(false)}
        icao={selectedChartsAirport.icao}
        airportName={selectedChartsAirport.name}
      />

      {/* Initial Startup / Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={() => {
          setIsOnboardingOpen(false);
          loadInitialData();
        }}
        pilot={pilot}
        allAirports={allAirports}
      />

      {/* Reusable Styled Dialog Modal */}
      <DialogModal
        {...dialogState}
        onClose={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default App;
