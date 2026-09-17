import React, { useMemo } from 'react';
import {
  Award,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Sparkles,
  Plane,
  MapPin,
  Clock,
  Compass,
  DollarSign,
  Globe,
  ChevronRight,
  TrendingUp,
  Gauge,
  Zap,
  Calendar,
  ArrowUpRight,
  Star,
  Layers,
  ArrowRight
} from 'lucide-react';
import { PILOT_RANKS, getPilotRank, formatLandingRating } from '../../utils/xpUtils.js';

export function CareerProgressView({
  pilot,
  currentAirport,
  allAirports = [],
  onOpenChangeBase,
  onSwitchToDispatch,
  onSwitchToLogbook
}) {
  const rankInfo = useMemo(() => getPilotRank(pilot?.xp || 0), [pilot?.xp]);
  const flightLog = pilot?.flight_log || [];

  const totalEarnings = useMemo(
    () => flightLog.reduce((acc, f) => acc + (f.net_payout || f.payout || 0), 0),
    [flightLog]
  );
  const totalGrossRevenue = useMemo(
    () => flightLog.reduce((acc, f) => acc + (f.gross_payout || f.payout || 0), 0),
    [flightLog]
  );
  const totalNm = useMemo(
    () => flightLog.reduce((acc, f) => acc + (f.distance_nm || 0), 0),
    [flightLog]
  );
  const totalDurationSec = useMemo(
    () => flightLog.reduce((acc, f) => acc + (f.duration_seconds || 0), 0),
    [flightLog]
  );

  const formatDuration = (sec) => {
    if (!sec || sec < 60) return `${sec || 0}s`;
    const mins = Math.floor(sec / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m ${sec % 60}s`;
  };

  // Touchdown telemetry analysis across flight history
  const landingStats = useMemo(() => {
    let butterCount = 0;
    let cleanCount = 0;
    let firmCount = 0;
    let hardCount = 0;
    let severeCount = 0;
    let recordedLandingsCount = 0;
    let totalFpmSum = 0;
    let bestTouchdown = null;
    let totalLandingBonusXp = 0;

    for (const f of flightLog) {
      if (f.touchdown_fpm !== null && f.touchdown_fpm !== undefined) {
        const fpm = Number(f.touchdown_fpm);
        const absFpm = Math.abs(Math.round(fpm));
        totalFpmSum += absFpm;
        recordedLandingsCount++;

        if (!bestTouchdown || absFpm < Math.abs(bestTouchdown.fpm)) {
          bestTouchdown = {
            fpm,
            airport: f.destination_icao,
            date: f.completed_at
          };
        }

        if (absFpm <= 160) {
          butterCount++;
        } else if (absFpm <= 320) {
          cleanCount++;
        } else if (absFpm <= 500) {
          firmCount++;
        } else if (absFpm <= 750) {
          hardCount++;
        } else {
          severeCount++;
        }
      }
    }

    const totalLandings = flightLog.length;
    const avgFpm = recordedLandingsCount > 0 ? Math.round(totalFpmSum / recordedLandingsCount) : null;

    return {
      butterCount,
      cleanCount,
      firmCount,
      hardCount,
      severeCount,
      recordedLandingsCount,
      totalLandings,
      avgFpm,
      bestTouchdown,
      totalLandingBonusXp: 0
    };
  }, [flightLog]);

  // Estimate XP Sources distribution
  const xpSources = useMemo(() => {
    const distanceXp = Math.round(totalNm);
    const arrivalsXp = flightLog.length * 50;
    const explorationXp = (pilot?.visited_airports?.length || 1) * 100;
    const runwayXp = flightLog.reduce(
      (acc, f) => acc + (f.destination_runway_ft && f.destination_runway_ft < 4000 ? 75 : 0),
      0
    );

    return {
      distanceXp,
      arrivalsXp,
      explorationXp,
      runwayXp
    };
  }, [totalNm, flightLog, pilot?.visited_airports]);

  const activeAircraft = pilot?.active_aircraft || {
    name: 'Cessna 172 Skyhawk',
    tail_number: 'N172AB',
    category: 'single_prop'
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      {/* 1. HERO: Pilot Command Dossier & Seniority Standing */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950 shadow-2xl relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Pilot Identity & Rank Badge */}
          <div className="flex items-start sm:items-center space-x-5">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-purple-950/80 via-indigo-950 to-slate-900 border-2 border-purple-500/50 flex flex-col items-center justify-center shadow-xl shadow-purple-950/50">
                <span className="text-2xl sm:text-3xl font-black font-mono text-purple-300">
                  L{rankInfo.level}
                </span>
                <span className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider mt-0.5">
                  RANK
                </span>
              </div>
              <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shadow-md">
                <Star className="w-4 h-4 fill-current" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-xs font-mono uppercase text-slate-400 tracking-wider font-semibold">
                  PILOT COMMAND PROFILE
                </span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 text-[10px] font-mono font-bold">
                  COMMERCIAL PILOT
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700/60 text-[10px] font-mono font-bold flex items-center space-x-1 shadow-sm">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>+{rankInfo.bonusPercent}% SENIORITY PAYOUT</span>
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white font-mono tracking-wide flex items-center space-x-3">
                <span>{pilot?.callsign || 'James'}</span>
                <span className="text-slate-600 font-light text-xl sm:text-2xl">•</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-200 to-amber-200">
                  {rankInfo.title}
                </span>
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400 pt-0.5">
                <div className="flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Base: <strong className="text-cyan-300">{pilot?.current_icao}</strong></span>
                  {currentAirport && <span className="text-slate-500">({currentAirport.name})</span>}
                  {onOpenChangeBase && (
                    <button
                      onClick={onOpenChangeBase}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 hover:border-cyan-500 transition ml-1"
                    >
                      Change
                    </button>
                  )}
                </div>

                <span className="text-slate-600">•</span>

                <div className="flex items-center space-x-1.5">
                  <Plane className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cockpit: <strong className="text-white">{activeAircraft.name}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center space-x-3 w-full lg:w-auto justify-start lg:justify-end">
            {onSwitchToDispatch && (
              <button
                onClick={onSwitchToDispatch}
                className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition flex items-center space-x-2 shadow-lg shadow-cyan-600/30"
              >
                <span>DISPATCH CONTRACTS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {onSwitchToLogbook && (
              <button
                onClick={onSwitchToLogbook}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold border border-slate-700 transition flex items-center space-x-2"
              >
                <span>VIEW FLIGHT LOG</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic XP Progress Bar & Promotion Countdown */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between text-xs font-mono gap-2">
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-purple-400" />
              <span className="text-slate-300 font-bold uppercase tracking-wider">
                CAREER REPUTATION STANDING:
              </span>
              <span className="text-purple-300 font-bold">
                {rankInfo.currentXp.toLocaleString()} XP
              </span>
              <span className="text-slate-500">
                ({rankInfo.progressPercent}% of Level {rankInfo.level})
              </span>
            </div>

            <div className="text-right">
              {rankInfo.isMaxRank ? (
                <span className="text-amber-300 font-bold">MAXIMUM RANK ACHIEVED 🏆</span>
              ) : (
                <span className="text-slate-400">
                  <strong className="text-amber-300">{rankInfo.xpToNextLevel.toLocaleString()} XP</strong> needed for{' '}
                  <strong className="text-white">Level {rankInfo.level + 1} ({PILOT_RANKS[rankInfo.level]?.title})</strong>
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden relative shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-400 rounded-full transition-all duration-700 shadow-md shadow-purple-500/50"
              style={{ width: `${rankInfo.progressPercent}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[11px] font-mono text-slate-500">
            <span>{rankInfo.prevLevelXp.toLocaleString()} XP (Level {rankInfo.level})</span>
            <span>{rankInfo.nextLevelXp ? `${rankInfo.nextLevelXp.toLocaleString()} XP (Level ${rankInfo.level + 1})` : 'Master Aviator'}</span>
          </div>
        </div>

        {/* Career Vital Statistics Strip */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block uppercase">FLIGHTS LOGGED</span>
            <span className="text-xl font-bold text-white mt-0.5 block">{flightLog.length}</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Recorded MSFS Flights</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block uppercase">TOTAL AIR MILES</span>
            <span className="text-xl font-bold text-cyan-400 mt-0.5 block">
              {Math.round(totalNm).toLocaleString()} NM
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">1 NM = 1 Base XP</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block uppercase">TOTAL FLIGHT TIME</span>
            <span className="text-xl font-bold text-amber-400 mt-0.5 block">
              {formatDuration(totalDurationSec)}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Airborne time tracked</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-slate-400 text-[10px] block uppercase">CAREER EARNINGS</span>
            <span className="text-xl font-bold text-emerald-400 mt-0.5 block">
              ${totalEarnings.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Net Contract Profits</span>
          </div>
        </div>
      </div>

      {/* 2. THE 10-TIER RANK PROGRESSION ROADMAP */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 bg-slate-900/40 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold text-white font-mono tracking-wide uppercase">
                THE AVIATOR'S GRIND: RANK ROADMAP
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Progressive reputation tiers granting permanent seniority contract payout bonuses.
            </p>
          </div>

          <span className="px-3 py-1 rounded-xl bg-purple-950/60 border border-purple-800 text-purple-300 text-xs font-mono font-bold">
            CURRENT: LEVEL {rankInfo.level} ({rankInfo.title.toUpperCase()})
          </span>
        </div>

        {/* 10-Tier Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {PILOT_RANKS.map((tier) => {
            const isCompleted = rankInfo.level > tier.level;
            const isCurrent = rankInfo.level === tier.level;
            const isLocked = rankInfo.level < tier.level;
            const xpNeededToReach = Math.max(0, tier.minXp - rankInfo.currentXp);

            return (
              <div
                key={tier.level}
                className={`rounded-2xl p-4 border transition-all duration-300 flex flex-col justify-between select-none ${
                  isCurrent
                    ? 'bg-gradient-to-br from-purple-950/80 via-slate-900 to-indigo-950/60 border-purple-500 ring-2 ring-purple-500/50 shadow-xl shadow-purple-950/60 transform scale-[1.02]'
                    : isCompleted
                    ? 'bg-slate-900/60 border-emerald-800/50 hover:border-emerald-700'
                    : 'bg-slate-950/50 border-slate-800/80 opacity-75'
                }`}
              >
                <div>
                  {/* Card Header: Level Badge & Status */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`w-8 h-8 rounded-xl font-mono font-bold text-xs flex items-center justify-center border ${
                        isCurrent
                          ? 'bg-purple-500 text-slate-950 border-purple-400 shadow-md'
                          : isCompleted
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : 'bg-slate-900 text-slate-500 border-slate-800'
                      }`}
                    >
                      L{tier.level}
                    </span>

                    {isCompleted ? (
                      <span className="flex items-center space-x-1 text-emerald-400 text-[11px] font-mono font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>ACHIEVED</span>
                      </span>
                    ) : isCurrent ? (
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/50 text-[10px] font-mono font-bold animate-pulse">
                        ACTIVE RANK
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-slate-500 text-[11px] font-mono">
                        <Lock className="w-3.5 h-3.5" />
                        <span>LOCKED</span>
                      </span>
                    )}
                  </div>

                  {/* Title & XP Range */}
                  <h3 className="text-base font-bold font-mono text-white mt-3 leading-tight">
                    {tier.title}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400 mt-1">
                    {tier.minXp.toLocaleString()} {tier.maxXp === Infinity ? '+ XP' : `– ${tier.maxXp.toLocaleString()} XP`}
                  </p>

                  {/* Seniority Bonus Pill */}
                  <div className="mt-3">
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-mono font-bold inline-flex items-center space-x-1 border ${
                        isCurrent
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : isCompleted
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      <Award className="w-3 h-3 text-amber-400" />
                      <span>+{tier.bonusPercent}% Payout Bonus</span>
                    </span>
                  </div>
                </div>

                {/* Footer: Progress or Lock status */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-mono">
                  {isCurrent ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-slate-400">
                        <span>Tier Progress</span>
                        <span className="text-purple-300 font-bold">{rankInfo.progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${rankInfo.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  ) : isCompleted ? (
                    <span className="text-emerald-400/80 block">Completed milestone</span>
                  ) : (
                    <span className="text-slate-500 block">
                      {xpNeededToReach.toLocaleString()} XP to unlock
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. LANDING SMOOTHNESS & TOUCHDOWN TELEMETRY ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Landing Quality Ratings Breakdown */}
        <div className="lg:col-span-2 glass-panel rounded-3xl p-6 sm:p-7 border border-slate-800 bg-slate-900/40 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <Gauge className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white font-mono uppercase tracking-wide">
                  LANDING QUALITY & TOUCHDOWN TELEMETRY
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                SimConnect vertical speed captured at touchdown threshold (telemetry tracking only).
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2.5 py-1 rounded-lg">
              {landingStats.recordedLandingsCount} Touchdowns Logged
            </span>
          </div>

          {/* 5 Rating Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 font-mono text-xs">
            {/* Butter Landing */}
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-emerald-300 font-bold text-sm">
                  <span>🧈</span>
                  <span>BUTTER / GREASER</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">|FPM| ≤ 160</p>
                <p className="text-xs text-emerald-400 font-semibold mt-2">Smooth Touchdown</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-emerald-400 block">
                  {landingStats.butterCount}
                </span>
                <span className="text-[10px] text-slate-500">
                  {landingStats.recordedLandingsCount > 0
                    ? `${Math.round((landingStats.butterCount / landingStats.recordedLandingsCount) * 100)}%`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Clean Landing */}
            <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-cyan-300 font-bold text-sm">
                  <span>✈️</span>
                  <span>CLEAN LANDING</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">160 – 320 FPM</p>
                <p className="text-xs text-cyan-400 font-semibold mt-2">Clean Touchdown</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-cyan-400 block">
                  {landingStats.cleanCount}
                </span>
                <span className="text-[10px] text-slate-500">
                  {landingStats.recordedLandingsCount > 0
                    ? `${Math.round((landingStats.cleanCount / landingStats.recordedLandingsCount) * 100)}%`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Firm Landing */}
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-amber-300 font-bold text-sm">
                  <span>⚡</span>
                  <span>FIRM LANDING</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">320 – 500 FPM</p>
                <p className="text-xs text-amber-400 font-semibold mt-2">Firm Contact</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-amber-400 block">
                  {landingStats.firmCount}
                </span>
                <span className="text-[10px] text-slate-500">
                  {landingStats.recordedLandingsCount > 0
                    ? `${Math.round((landingStats.firmCount / landingStats.recordedLandingsCount) * 100)}%`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Hard Landing */}
            <div className="p-3.5 rounded-xl bg-orange-950/40 border border-orange-800/60 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-orange-300 font-bold text-sm">
                  <span>⚠️</span>
                  <span>HARD LANDING</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">500 – 750 FPM</p>
                <p className="text-xs text-orange-400 font-semibold mt-2">Hard Contact</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-orange-400 block">
                  {landingStats.hardCount}
                </span>
                <span className="text-[10px] text-slate-500">
                  {landingStats.recordedLandingsCount > 0
                    ? `${Math.round((landingStats.hardCount / landingStats.recordedLandingsCount) * 100)}%`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Severe Landing */}
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-rose-300 font-bold text-sm">
                  <span>💥</span>
                  <span>SEVERE IMPACT</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">&gt; 750 FPM</p>
                <p className="text-xs text-rose-400 font-semibold mt-2">High Impact</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-rose-400 block">
                  {landingStats.severeCount}
                </span>
                <span className="text-[10px] text-slate-500">
                  {landingStats.recordedLandingsCount > 0
                    ? `${Math.round((landingStats.severeCount / landingStats.recordedLandingsCount) * 100)}%`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Touchdown Telemetry Logging Status */}
            <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-800/60 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-purple-300 font-bold text-sm">
                  <Gauge className="w-4 h-4 text-purple-400" />
                  <span>TOUCHDOWN LOGS</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Telemetry Sensor</p>
                <p className="text-xs text-purple-400 font-semibold mt-2">Active logging</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-purple-300 block">
                  {landingStats.recordedLandingsCount}
                </span>
                <span className="text-[10px] text-slate-500">
                  {landingStats.recordedLandingsCount === 1 ? 'Flight' : 'Flights'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Telemetry Records & Touchdown Highlights */}
        <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-slate-800 bg-slate-900/40 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white font-mono uppercase tracking-wide">
                TOUCHDOWN RECORDS
              </h3>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              {/* Best Touchdown */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase">CAREER BEST TOUCHDOWN</span>
                {landingStats.bestTouchdown ? (
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-emerald-400">
                      {landingStats.bestTouchdown.fpm} FPM
                    </span>
                    <span className="text-xs text-cyan-300 font-bold">
                      at {landingStats.bestTouchdown.airport}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-400 mt-1 block">Telemetry logging active</span>
                )}
                <span className="text-[10px] text-slate-500 mt-1 block">Butter / Greaser threshold (≤ 160 FPM)</span>
              </div>

              {/* Average Touchdown Rate */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase">AVERAGE TOUCHDOWN RATE</span>
                <span className="text-2xl font-bold text-cyan-400 mt-1 block">
                  {landingStats.avgFpm !== null ? `-${landingStats.avgFpm} FPM` : 'Active'}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">Average vertical speed at contact</span>
              </div>

              {/* Unvisited Discovery Network */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase">UNVISITED AIRPORT NETWORK</span>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-purple-300">
                    {pilot?.visited_airports?.length || 1}
                  </span>
                  <span className="text-xs text-purple-400 font-bold">
                    Airports Visited
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">+100 XP per newly discovered airfield</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CAREER MILESTONES & XP SOURCES BREAKDOWN */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 bg-slate-900/40 space-y-5">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Layers className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-base font-bold text-white font-mono uppercase tracking-wide">
              XP SOURCES & CAREER EARNINGS BREAKDOWN
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Itemized ledger of experience points accrued across career operations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 font-mono text-xs">
          {/* Distance XP */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center space-x-1.5 text-cyan-400 font-bold">
              <Compass className="w-4 h-4" />
              <span>DISTANCE XP</span>
            </div>
            <span className="text-2xl font-bold text-white mt-2 block">
              +{xpSources.distanceXp.toLocaleString()} XP
            </span>
            <p className="text-[10px] text-slate-400 mt-1">1 XP earned per nautical mile flown across all routes.</p>
          </div>

          {/* Airport Exploration XP */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center space-x-1.5 text-purple-400 font-bold">
              <Globe className="w-4 h-4" />
              <span>EXPLORATION</span>
            </div>
            <span className="text-2xl font-bold text-purple-300 mt-2 block">
              +{xpSources.explorationXp.toLocaleString()} XP
            </span>
            <p className="text-[10px] text-slate-400 mt-1">+100 XP discovery reward per unique airfield visited.</p>
          </div>

          {/* Runway Challenge XP */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center space-x-1.5 text-amber-400 font-bold">
              <Zap className="w-4 h-4" />
              <span>SHORT RUNWAY</span>
            </div>
            <span className="text-2xl font-bold text-amber-300 mt-2 block">
              +{xpSources.runwayXp.toLocaleString()} XP
            </span>
            <p className="text-[10px] text-slate-400 mt-1">+75 XP for high-precision landings on runways &lt; 4,000 ft.</p>
          </div>

          {/* Flight Arrivals XP */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center space-x-1.5 text-blue-400 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>FLIGHT ARRIVALS</span>
            </div>
            <span className="text-2xl font-bold text-blue-300 mt-2 block">
              +{xpSources.arrivalsXp.toLocaleString()} XP
            </span>
            <p className="text-[10px] text-slate-400 mt-1">+50 XP upon shutdown and securing aircraft at destination.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CareerProgressView;

