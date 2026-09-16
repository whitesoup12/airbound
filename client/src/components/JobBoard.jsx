import React, { useState } from 'react';
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
  Eye
} from 'lucide-react';

export function JobBoard({
  jobs = [],
  activeJob = null,
  currentIcao = 'KLAX',
  selectedJobId = null,
  onSelectJob,
  onAcceptJob,
  onRefreshJobs,
  loading = false
}) {
  const [refreshing, setRefreshing] = useState(false);

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
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-white text-base tracking-wide font-mono">
                DISPATCH BOARD
              </h3>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-xs font-mono text-cyan-400 border border-slate-700">
                ORIGIN: {currentIcao}
              </span>
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => {
            const isShortRunway = job.destination_runway_ft && job.destination_runway_ft < 4500;
            const isJobActive = activeJob?._id === job._id;
            const isSelected = selectedJobId === job._id;

            return (
              <div
                key={job._id}
                onClick={() => onSelectJob && onSelectJob(job)}
                className={`glass-panel rounded-2xl p-4 sm:p-5 border transition-all duration-200 flex flex-col justify-between cursor-pointer select-none ${
                  isJobActive
                    ? 'border-cyan-500 bg-cyan-950/30 glow-cyan ring-1 ring-cyan-500/50'
                    : isSelected
                    ? 'border-amber-400 bg-amber-950/20 ring-2 ring-amber-400/60 shadow-lg shadow-amber-950/40 transform scale-[1.01]'
                    : 'border-slate-800 hover:border-slate-600 bg-slate-900/60 hover:bg-slate-900/90'
                }`}
              >
                <div>
                  {/* Card Header: Destination & Distance */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xl font-bold font-mono text-white tracking-wider">
                          {job.destination_icao}
                        </span>
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

                    <div className="text-right">
                      <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-800 text-xs font-mono text-cyan-300 border border-slate-700">
                        <Navigation className="w-3 h-3 text-cyan-400" />
                        <span>{job.distance_nm} NM</span>
                      </span>
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
                </div>

                {/* Card Footer: Payout & Accept Button */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">CONTRACT PAYOUT</span>
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
                      disabled={Boolean(activeJob)}
                      className={`flex items-center space-x-1 px-4 py-2 rounded-xl text-xs font-mono font-bold transition shadow-lg ${
                        activeJob
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30 hover:scale-[1.02]'
                      }`}
                    >
                      <span>ACCEPT</span>
                      <ArrowRight className="w-3.5 h-3.5" />
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
