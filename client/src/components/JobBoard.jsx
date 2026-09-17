import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  RefreshCw,
  Navigation,
  Package,
  Users,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Plane,
  Eye,
  Clock,
  Fuel,
  Zap,
  Compass,
  Layers,
  Sparkles,
  Award
} from 'lucide-react';

function getDistanceTiers(category = 'single_prop') {
  switch (category) {
    case 'airliner':
      return {
        short: { min: 80, max: 350, label: 'Short (< 350 NM)' },
        medium: { min: 350, max: 1000, label: 'Medium (350–1,000 NM)' },
        long: { min: 1000, max: 2800, label: 'Long (1,000+ NM)' }
      };
    case 'jet':
      return {
        short: { min: 60, max: 250, label: 'Short (< 250 NM)' },
        medium: { min: 250, max: 700, label: 'Medium (250–700 NM)' },
        long: { min: 700, max: 2000, label: 'Long (700+ NM)' }
      };
    case 'turboprop':
      return {
        short: { min: 40, max: 180, label: 'Short (< 180 NM)' },
        medium: { min: 180, max: 450, label: 'Medium (180–450 NM)' },
        long: { min: 450, max: 1200, label: 'Long (450+ NM)' }
      };
    case 'twin_prop':
      return {
        short: { min: 30, max: 130, label: 'Short (< 130 NM)' },
        medium: { min: 130, max: 320, label: 'Medium (130–320 NM)' },
        long: { min: 320, max: 800, label: 'Long (320+ NM)' }
      };
    case 'single_prop':
    default:
      return {
        short: { min: 20, max: 90, label: 'Short (< 90 NM)' },
        medium: { min: 90, max: 220, label: 'Medium (90–220 NM)' },
        long: { min: 220, max: 450, label: 'Long (220+ NM)' }
      };
  }
}

function classifyJobTier(distanceNm, category = 'single_prop') {
  const tiers = getDistanceTiers(category);
  if (distanceNm < tiers.short.max) return 'short';
  if (distanceNm < tiers.medium.max) return 'medium';
  return 'long';
}

export function JobBoard({
  jobs = [],
  activeJob = null,
  currentIcao = 'KLAX',
  selectedJobId = null,
  activeAircraft = null,
  pilot = null,
  onSelectJob,
  onAcceptJob,
  onRefreshJobs,
  loading = false
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTier, setActiveTier] = useState('short'); // 'short' | 'medium' | 'long' | 'all'

  const aircraftCategory = activeAircraft?.category || 'single_prop';
  const distanceTiers = useMemo(() => getDistanceTiers(aircraftCategory), [aircraftCategory]);

  // Visited set and jobs classification
  const visitedSet = useMemo(() => {
    return new Set((pilot?.visited_airports || []).map((i) => i.toUpperCase()));
  }, [pilot?.visited_airports]);

  const jobsWithTier = useMemo(() => {
    return jobs.map((job) => {
      const isUnvisited = job.is_unvisited !== undefined
        ? Boolean(job.is_unvisited)
        : !visitedSet.has(job.destination_icao?.toUpperCase());
      const isFeatured = Boolean(job.is_featured_destination && isUnvisited);
      return {
        ...job,
        resolvedTier: job.tier || classifyJobTier(job.distance_nm, aircraftCategory),
        isUnvisited,
        isFeatured
      };
    });
  }, [jobs, aircraftCategory, visitedSet]);

  const unvisitedCount = useMemo(() => {
    return jobsWithTier.filter((j) => j.isUnvisited).length;
  }, [jobsWithTier]);

  const shortJobs = useMemo(() => jobsWithTier.filter((j) => j.resolvedTier === 'short'), [jobsWithTier]);
  const mediumJobs = useMemo(() => jobsWithTier.filter((j) => j.resolvedTier === 'medium'), [jobsWithTier]);
  const longJobs = useMemo(() => jobsWithTier.filter((j) => j.resolvedTier === 'long'), [jobsWithTier]);

  const displayedJobs = useMemo(() => {
    if (activeTier === 'short') return shortJobs;
    if (activeTier === 'medium') return mediumJobs;
    if (activeTier === 'long') return longJobs;
    return jobsWithTier;
  }, [activeTier, shortJobs, mediumJobs, longJobs, jobsWithTier]);

  // Rental economics status
  const isRental = Boolean(activeAircraft?.is_rental && !activeAircraft?.is_loaner);
  const rentalPricePerFlight = activeAircraft?.rental_price_per_flight || 0;
  const rentalPaidFlights = activeAircraft?.rental_flights_paid ?? 0;
  const needsRentalPayment = isRental && rentalPaidFlights === 0;
  const pilotBalance = pilot?.balance ?? 0;
  const hasInsufficientRentalFunds = needsRentalPayment && pilotBalance < rentalPricePerFlight;
  const rentalShortage = hasInsufficientRentalFunds ? rentalPricePerFlight - pilotBalance : 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshJobs();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-950/50 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-white text-base tracking-wide font-mono">
                DISPATCH BOARD
              </h3>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-xs font-mono text-cyan-400 border border-slate-700">
                ORIGIN: {currentIcao}
              </span>
              {unvisitedCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-xs font-mono text-emerald-300 border border-emerald-500/40 flex items-center space-x-1 shadow-sm">
                  <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span>{unvisitedCount} UNVISITED</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Click any contract to plot and preview its route on the radar map.
            </p>
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading || Boolean(activeJob)}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-mono transition border ${
            activeJob
              ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-cyan-500'
          }`}
          title={activeJob ? 'Complete active flight before generating new jobs' : 'Refresh available contracts'}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
          <span>{refreshing ? 'GENERATING...' : 'REFRESH CONTRACTS'}</span>
        </button>
      </div>

      {/* Notice if a job is already active */}
      {activeJob && (
        <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-xs font-mono text-cyan-300 flex items-center space-x-2.5">
          <Plane className="w-4 h-4 text-cyan-400 animate-pulse flex-shrink-0" />
          <span>
            Contract active to <strong>{activeJob.destination_icao}</strong>. Complete your flight to claim <strong>${activeJob.payout?.toLocaleString()}</strong> and unlock new dispatch jobs at destination.
          </span>
        </div>
      )}

      {/* Insufficient Rental Funds Alert Card */}
      {hasInsufficientRentalFunds && !activeJob && (
        <div className="glass-panel p-4 rounded-2xl border border-rose-500/60 bg-gradient-to-r from-rose-950/60 via-red-950/40 to-slate-900/60 text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-rose-950/40">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-xl bg-rose-950 border border-rose-500 flex items-center justify-center text-rose-400 flex-shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold font-mono text-rose-300">
                INSUFFICIENT FUNDS FOR RENTAL FLIGHT
              </h4>
              <p className="text-xs text-rose-200/90 mt-0.5">
                Your active aircraft is a rental (<strong>{activeAircraft?.name}</strong>) requiring <strong>${rentalPricePerFlight.toLocaleString()}</strong> per flight. Your current balance is <strong>${pilotBalance.toLocaleString()}</strong> (<strong>${rentalShortage.toLocaleString()}</strong> more needed). Please switch to an owned aircraft or return this rental in the Fleet hangar to continue.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Rental Fee Pre-Acceptance Notice */}
      {needsRentalPayment && !hasInsufficientRentalFunds && !activeJob && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs font-mono text-amber-300 flex items-center space-x-2.5">
          <DollarSign className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>
            Active Rental: <strong>${rentalPricePerFlight.toLocaleString()}</strong> rental fee will be charged for this flight upon contract acceptance.
          </span>
        </div>
      )}

      {/* Distance Tier Tabs */}
      {jobs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-1.5 glass-panel rounded-2xl border border-slate-800 bg-slate-950/40">
          {[
            {
              id: 'short',
              label: 'SHORT FLIGHTS',
              range: `< ${distanceTiers.short.max} NM`,
              count: shortJobs.length,
              icon: Zap,
              color: 'text-amber-400',
              activeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-950/40'
            },
            {
              id: 'medium',
              label: 'MEDIUM FLIGHTS',
              range: `${distanceTiers.medium.min}–${distanceTiers.medium.max} NM`,
              count: mediumJobs.length,
              icon: Compass,
              color: 'text-cyan-400',
              activeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-950/40'
            },
            {
              id: 'long',
              label: 'LONG FLIGHTS',
              range: `${distanceTiers.long.min}+ NM`,
              count: longJobs.length,
              icon: Navigation,
              color: 'text-indigo-400',
              activeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-indigo-950/40'
            },
            {
              id: 'all',
              label: 'ALL FLIGHTS',
              range: 'Any Range',
              count: jobs.length,
              icon: Layers,
              color: 'text-slate-300',
              activeColor: 'bg-slate-700/50 text-white border-slate-600 shadow-slate-950/40'
            }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTier === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTier(tab.id)}
                className={`flex-1 min-w-[130px] flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-all duration-200 ${
                  isActive
                    ? `${tab.activeColor} shadow-md`
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center space-x-2 text-left">
                  <Icon className={`w-3.5 h-3.5 ${isActive ? tab.color : 'text-slate-500'}`} />
                  <div>
                    <div className="font-bold tracking-wide">{tab.label}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{tab.range}</div>
                  </div>
                </div>
                <span
                  className={`ml-2 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                    isActive
                      ? 'bg-slate-900/90 text-white border border-slate-700'
                      : 'bg-slate-800/80 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Job Cards Grid */}
      {jobs.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 border border-slate-800 text-center">
          <Briefcase className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-mono text-slate-400">No contracts available at this airfield.</p>
          <button
            onClick={handleRefresh}
            className="mt-3 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono"
          >
            Generate Jobs Now
          </button>
        </div>
      ) : displayedJobs.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 border border-slate-800 text-center">
          <Briefcase className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-mono text-slate-400">
            No {activeTier} flights currently available at this airfield.
          </p>
          <div className="mt-3 flex items-center justify-center space-x-3">
            <button
              onClick={() => setActiveTier('all')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700"
            >
              View All ({jobs.length})
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading || Boolean(activeJob)}
              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono"
            >
              Refresh Contracts
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedJobs.map((job) => {
            const isShortRunway = job.destination_runway_ft && job.destination_runway_ft < 4500;
            const isJobActive = activeJob?._id === job._id;
            const isSelected = selectedJobId === job._id;
            const isFeatured = job.isFeatured;
            const isUnvisited = job.isUnvisited;

            // Performance & Fuel Consumption estimates based on active aircraft
            const cruiseSpeed = activeAircraft?.cruise_speed_kts || 120;
            const fuelBurnGph = activeAircraft?.fuel_burn_gph || 9.0;
            const fuelType = activeAircraft?.fuel_type || '100LL';
            const fuelPrice = fuelType === 'Jet-A' ? 5.60 : 6.40;

            const distance = job.distance_nm || 0;
            const flightHours = distance / cruiseSpeed;
            const totalMinutes = Math.max(1, Math.round(flightHours * 60));
            const formattedEte =
              totalMinutes < 60
                ? `${totalMinutes}m`
                : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;

            const burnHours = Math.max(0.08, flightHours);
            const estGallons = Math.round(burnHours * fuelBurnGph * 10) / 10;
            const estFuelCost = Math.round(estGallons * fuelPrice);

            return (
              <div
                key={job._id}
                onClick={() => onSelectJob && onSelectJob(job)}
                className={`glass-panel rounded-2xl p-4 sm:p-5 border transition-all duration-200 flex flex-col justify-between cursor-pointer select-none ${
                  isJobActive
                    ? 'border-cyan-500 bg-cyan-950/30 glow-cyan ring-1 ring-cyan-500/50'
                    : isSelected
                    ? 'border-amber-400 bg-amber-950/20 ring-2 ring-amber-400/60 shadow-lg shadow-amber-950/40 transform scale-[1.01]'
                    : isFeatured
                    ? 'border-emerald-500/60 bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-900/90 ring-1 ring-emerald-500/40 shadow-lg shadow-emerald-950/30 hover:border-emerald-400 transform hover:scale-[1.01]'
                    : 'border-slate-800 hover:border-slate-600 bg-slate-900/60 hover:bg-slate-900/90'
                }`}
              >
                <div>
                  {/* Card Header: Destination & Distance */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xl font-bold font-mono text-white tracking-wider">
                          {job.destination_icao}
                        </span>
                        {isFeatured ? (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center space-x-1 shadow-sm"
                            title="Unvisited Airport: Expanding your career network with this discovery flight!"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                            <span>NEW DESTINATION</span>
                          </span>
                        ) : isUnvisited ? (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center space-x-1"
                            title="Unvisited Airport"
                          >
                            <span>UNVISITED</span>
                          </span>
                        ) : null}
                        {isSelected && !isJobActive && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500 text-slate-950 font-bold flex items-center space-x-1 shadow-sm">
                            <Eye className="w-2.5 h-2.5" />
                            <span>MAPPED</span>
                          </span>
                        )}
                        {isShortRunway && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800 flex items-center space-x-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>SHORT RWY</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 line-clamp-1 mt-0.5">
                        {job.destination_name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {job.destination_city ? `${job.destination_city}, ` : ''}{job.destination_country}
                      </p>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-800 text-xs font-mono text-cyan-300 border border-slate-700">
                        <Navigation className="w-3 h-3 text-cyan-400" />
                        <span>{job.distance_nm} NM</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-semibold border ${
                            job.resolvedTier === 'short'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                              : job.resolvedTier === 'medium'
                              ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60'
                              : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60'
                          }`}
                        >
                          {job.resolvedTier}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950/70 text-purple-300 border border-purple-800/60 flex items-center space-x-1"
                          title="Pilot Experience (XP) reward upon flight completion"
                        >
                          <Award className="w-2.5 h-2.5 text-purple-400" />
                          <span>+{job.xp_reward || job.distance_nm} XP</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Specifications Grid */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-xs font-mono">
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">RUNWAY</span>
                      <span className="text-white font-bold">
                        {job.destination_runway_ft?.toLocaleString() || '3,000'} ft
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                        <Package className="w-2.5 h-2.5 text-amber-400" />
                        <span>CARGO</span>
                      </div>
                      <span className="text-white font-bold">{job.cargo_lbs.toLocaleString()} lbs</span>
                    </div>

                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                        <Users className="w-2.5 h-2.5 text-blue-400" />
                        <span>PAX</span>
                      </div>
                      <span className="text-white font-bold">{job.pax_count}</span>
                    </div>
                  </div>

                  {/* Aircraft Flight Profile Estimates: Time & Fuel Burn */}
                  <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800/90 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-cyan-400 text-[11px]">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>EST TIME</span>
                      </div>
                      <span className="text-white font-bold">~{formattedEte}</span>
                    </div>

                    <div className="bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800/90 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-rose-400 text-[11px]">
                        <Fuel className="w-3 h-3 text-rose-400" />
                        <span>EST BURN</span>
                      </div>
                      <span className="text-white font-bold">
                        ~{estGallons} gal <span className="text-[10px] text-slate-400 font-normal">(${estFuelCost})</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Payout & Accept Button */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">CONTRACT PAYOUT</span>
                      {job.exploration_bonus > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-0.5 shadow-sm">
                          <Sparkles className="w-2 h-2 text-emerald-400" />
                          <span>+${job.exploration_bonus} DISCOVERY</span>
                        </span>
                      )}
                      {job.seniority_bonus > 0 && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center space-x-0.5 shadow-sm"
                          title={`Seniority standing bonus (+${Math.round(((job.seniority_multiplier || 1) - 1) * 100)}%)`}
                        >
                          <Award className="w-2 h-2 text-purple-400" />
                          <span>+${job.seniority_bonus.toLocaleString()} SENIORITY</span>
                        </span>
                      )}
                    </div>
                    <span className="text-xl font-bold font-mono text-emerald-400 flex items-center">
                      <DollarSign className="w-4 h-4 -mr-0.5" />
                      {job.payout.toLocaleString()}
                    </span>
                  </div>

                  {isJobActive ? (
                    <div className="flex items-center space-x-1 text-xs font-mono text-cyan-400 bg-cyan-950/80 px-3 py-2 rounded-xl border border-cyan-800">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                      <span>IN PROGRESS</span>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcceptJob(job._id);
                      }}
                      disabled={Boolean(activeJob) || hasInsufficientRentalFunds}
                      className={`flex items-center space-x-1 px-4 py-2 rounded-xl text-xs font-mono font-bold transition shadow-lg ${
                        activeJob || hasInsufficientRentalFunds
                          ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30 hover:scale-[1.02]'
                      }`}
                      title={
                        hasInsufficientRentalFunds
                          ? `Need $${rentalPricePerFlight.toLocaleString()} to rent for this flight (Balance: $${pilotBalance.toLocaleString()})`
                          : undefined
                      }
                    >
                      {hasInsufficientRentalFunds ? (
                        <span>FUNDS NEEDED (${rentalPricePerFlight.toLocaleString()})</span>
                      ) : (
                        <>
                          <span>ACCEPT</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default JobBoard;
