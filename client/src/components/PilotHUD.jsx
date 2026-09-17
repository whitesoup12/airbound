import React from 'react';
import { Award, Compass, Globe, Plane, ShieldCheck, Star } from 'lucide-react';
import { getPilotRank } from '../utils/xpUtils.js';

export function PilotHUD({ pilot, rankInfo: propRankInfo, currentAirport, onOpenChangeBase, onOpenFleet }) {
  const rankInfo = propRankInfo || getPilotRank(pilot?.xp || 0);
  const totalEarnings = (pilot?.flight_log || []).reduce((acc, f) => acc + (f.payout || 0), 0);
  const totalNm = (pilot?.flight_log || []).reduce((acc, f) => acc + (f.distance_nm || 0), 0);
  const visitedAirportsCount = pilot?.visited_airports?.length || 1;
  const visitedCountriesCount = pilot?.visited_countries?.length || 1;
  const activeAircraft = pilot?.active_aircraft || {
    name: 'Cessna 172 Skyhawk',
    tail_number: 'N172AB',
    category: 'single_prop'
  };

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800/80 bg-slate-900/60 shadow-xl">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Callsign, Seniority Rank & XP Progress */}
        <div className="flex flex-col justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold font-mono shadow-sm shrink-0">
              <span className="text-xs">L{rankInfo.level}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5 flex-wrap">
                <h3 className="text-sm font-bold text-white tracking-wide truncate">{pilot?.callsign || 'James'}</h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {rankInfo.title}
                </span>
              </div>
              <div className="flex items-center space-x-1 mt-0.5">
                <span className="text-[10px] text-cyan-400 font-mono truncate max-w-[125px]">
                  {currentAirport ? `${currentAirport.name} (${currentAirport.icao})` : pilot?.current_icao}
                </span>
                {onOpenChangeBase && (
                  <button
                    onClick={onOpenChangeBase}
                    className="text-[9px] text-slate-400 hover:text-cyan-300 font-mono px-1 py-0.2 rounded bg-slate-800 border border-slate-700 hover:border-cyan-500 transition"
                    title="Change base airport"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* XP Progress Bar */}
          <div className="mt-2 pt-1.5 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
              <span className="text-amber-400/90 font-semibold">+{rankInfo.bonusPercent}% Payout</span>
              <span className="text-slate-400 text-[9px]">
                {rankInfo.currentXp.toLocaleString()} / {rankInfo.nextLevelXp ? rankInfo.nextLevelXp.toLocaleString() : 'MAX'} XP
              </span>
            </div>
            <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-yellow-400 h-1.5 rounded-full transition-all duration-500 shadow-sm shadow-amber-500/50"
                style={{ width: `${rankInfo.progressPercent}%` }}
                title={`${rankInfo.progressPercent}% to next rank (${rankInfo.xpToNextLevel.toLocaleString()} XP remaining)`}
              />
            </div>
          </div>
        </div>

        {/* Active Aircraft & Hangar */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">Active Plane</p>
              {onOpenFleet && (
                <button
                  onClick={onOpenFleet}
                  className="text-[10px] text-slate-400 hover:text-amber-300 font-mono px-1 py-0.2 rounded bg-slate-800 border border-slate-700 hover:border-amber-500 transition"
                  title="Open Fleet & Hangar"
                >
                  Fleet
                </button>
              )}
            </div>
            <h3 className="text-sm font-bold text-white font-mono truncate max-w-[140px]" title={activeAircraft.name}>
              {activeAircraft.name}
            </h3>
            <div className="flex items-center space-x-1">
              <span className="text-xs text-amber-300 font-mono">{activeAircraft.tail_number || 'N172AB'}</span>
              <span className="text-[10px] text-slate-400 uppercase">({activeAircraft.category?.replace('_', ' ')})</span>
            </div>
          </div>
        </div>

        {/* Total Career Earnings */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">Career Net Profit</p>
            <h3 className="text-base font-bold text-emerald-400 font-mono">${totalEarnings.toLocaleString()}</h3>
            <p className="text-xs text-slate-400 font-mono">{pilot?.flight_log?.length || 0} contracts completed</p>
          </div>
        </div>

        {/* Nautical Miles Flown */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">Distance Logged</p>
            <h3 className="text-base font-bold text-white font-mono">{Math.round(totalNm).toLocaleString()} NM</h3>
            <p className="text-xs text-slate-400">Airborne distance</p>
          </div>
        </div>

        {/* Exploration / Visited Count */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">Exploration</p>
            <h3 className="text-base font-bold text-white font-mono">
              {visitedAirportsCount} <span className="text-xs font-normal text-slate-400">ICAOs</span> / {visitedCountriesCount} <span className="text-xs font-normal text-slate-400">Countries</span>
            </h3>
            <div className="flex items-center space-x-1 mt-0.5">
              {(pilot?.visited_countries || ['US']).slice(0, 4).map((c) => (
                <span key={c} className="text-[10px] px-1 rounded bg-slate-800 text-purple-300 font-mono border border-slate-700">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PilotHUD;

