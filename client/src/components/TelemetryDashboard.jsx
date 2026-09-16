import React from 'react';
import {
  Gauge,
  Compass,
  ArrowUpRight,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Package,
  Users,
  Navigation,
  DollarSign,
  AlertCircle
} from 'lucide-react';

const PHASE_CONFIG = {
  STANDBY: {
    label: 'STANDBY',
    color: 'bg-slate-800 text-slate-300 border-slate-700',
    description: 'No active job selected. Select a job from the board below.'
  },
  IDLE: {
    label: 'IDLE / PARKED',
    color: 'bg-blue-950/80 text-blue-300 border-blue-600/80 shadow-blue-900/50',
    description: 'Active contract accepted. Ready for pre-flight, startup, and taxi.'
  },
  DEPARTED: {
    label: 'DEPARTED',
    color: 'bg-amber-950/80 text-amber-300 border-amber-500/80 shadow-amber-900/50',
    description: 'Wheels off ground within 5 NM of origin. Climbing out.'
  },
  'EN ROUTE': {
    label: 'EN ROUTE',
    color: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/80 shadow-cyan-900/50',
    description: 'Airborne cruise mode. Tracking live coordinates towards destination.'
  },
  TOUCHDOWN: {
    label: 'TOUCHDOWN',
    color: 'bg-purple-950/80 text-purple-300 border-purple-500/80 shadow-purple-900/50',
    description: 'Wheels touched down within 3 NM of destination airport.'
  },
  COMPLETED: {
    label: 'CONTRACT COMPLETED',
    color: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/80 shadow-emerald-900/50 glow-green',
    description: 'Aircraft stopped and secured. Payout credited to pilot balance!'
  }
};

export function TelemetryDashboard({ telemetry, phase, activeJob, onCancelJob }) {
  const phaseInfo = PHASE_CONFIG[phase] || PHASE_CONFIG.STANDBY;

  // Compute contract progress if active
  let progressPct = 0;
  let remainingNm = 0;
  if (activeJob) {
    const totalDist = activeJob.distance_nm || 1;
    if (phase === 'IDLE') {
      progressPct = 0;
      remainingNm = totalDist;
    } else if (phase === 'COMPLETED') {
      progressPct = 100;
      remainingNm = 0;
    } else {
      // Approximate progress based on destination distance
      const destCoords = activeJob.destination_airport?.location?.coordinates ||
        activeJob.destination_location?.coordinates;
      if (destCoords && telemetry.latitude) {
        // Compute distance to destination
        const dLon = destCoords[0];
        const dLat = destCoords[1];
        const R = 3440.065;
        const dLatRad = ((dLat - telemetry.latitude) * Math.PI) / 180;
        const dLonRad = ((dLon - telemetry.longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
          Math.cos((telemetry.latitude * Math.PI) / 180) *
            Math.cos((dLat * Math.PI) / 180) *
            Math.sin(dLonRad / 2) *
            Math.sin(dLonRad / 2);
        remainingNm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
        progressPct = Math.min(100, Math.max(0, Math.round(((totalDist - remainingNm) / totalDist) * 100)));
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Primary Flight Phase Banner */}
      <div
        className={`glass-panel rounded-2xl p-4 border transition-all duration-300 flex flex-col md:flex-row items-center justify-between gap-3 ${phaseInfo.color}`}
      >
        <div className="flex items-center space-x-3 text-center md:text-left">
          <div className="relative flex items-center justify-center">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-current"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-mono tracking-widest text-slate-400">FLIGHT PHASE:</span>
              <span className="font-mono font-bold tracking-wider text-base sm:text-lg">{phaseInfo.label}</span>
            </div>
            <p className="text-xs text-slate-300/80">{phaseInfo.description}</p>
          </div>
        </div>

        {/* Phase Step Badges */}
        <div className="flex items-center space-x-1.5 font-mono text-[11px] overflow-x-auto max-w-full pb-1">
          {['IDLE', 'DEPARTED', 'EN ROUTE', 'TOUCHDOWN', 'COMPLETED'].map((p, idx) => {
            const isCurrent = phase === p;
            const isPast =
              ['IDLE', 'DEPARTED', 'EN ROUTE', 'TOUCHDOWN', 'COMPLETED'].indexOf(phase) > idx;

            return (
              <div
                key={p}
                className={`px-2 py-1 rounded-md border flex items-center space-x-1 whitespace-nowrap transition ${
                  isCurrent
                    ? 'bg-white/10 text-white border-white/40 font-bold shadow-md'
                    : isPast
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                    : 'bg-slate-900/60 text-slate-500 border-slate-800/60'
                }`}
              >
                {isPast ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : null}
                <span>{p}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Flight Telemetry Gauges Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Ground Speed */}
        <div className="glass-panel rounded-xl p-3 border border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>GROUND SPEED</span>
            <Gauge className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-bold font-mono text-white">
              {Math.round(telemetry?.groundSpeed || 0)}
            </span>
            <span className="text-xs font-mono text-slate-400">KTS</span>
          </div>
        </div>

        {/* True Airspeed */}
        <div className="glass-panel rounded-xl p-3 border border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TRUE AIRSPEED</span>
            <ArrowUpRight className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-bold font-mono text-white">
              {Math.round(telemetry?.airspeedTrue || 0)}
            </span>
            <span className="text-xs font-mono text-slate-400">KTS</span>
          </div>
        </div>

        {/* Altitude */}
        <div className="glass-panel rounded-xl p-3 border border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>ALTITUDE</span>
            <Navigation className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-bold font-mono text-white">
              {Math.round(telemetry?.altitude || 0).toLocaleString()}
            </span>
            <span className="text-xs font-mono text-slate-400">FT</span>
          </div>
        </div>

        {/* Heading */}
        <div className="glass-panel rounded-xl p-3 border border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>HEADING</span>
            <Compass className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-bold font-mono text-white">
              {Math.round(telemetry?.heading || 0).toString().padStart(3, '0')}
            </span>
            <span className="text-xs font-mono text-slate-400">°</span>
          </div>
        </div>

        {/* Surface State: SIM ON GROUND */}
        <div className="glass-panel rounded-xl p-3 border border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>SURFACE</span>
            <span
              className={`w-2 h-2 rounded-full ${
                telemetry?.simOnGround ? 'bg-amber-400 shadow-sm shadow-amber-400/50' : 'bg-cyan-400 shadow-sm shadow-cyan-400/50'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span
              className={`text-base font-bold font-mono ${
                telemetry?.simOnGround ? 'text-amber-400' : 'text-cyan-400'
              }`}
            >
              {telemetry?.simOnGround ? 'ON GROUND' : 'AIRBORNE'}
            </span>
          </div>
        </div>

        {/* Parking Brake & Engine Status */}
        <div className="glass-panel rounded-xl p-3 border border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>SYSTEMS</span>
            <Flame
              className={`w-4 h-4 ${telemetry?.engineRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`}
            />
          </div>
          <div className="mt-1 flex flex-col space-y-1 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">BRAKE:</span>
              <span className={telemetry?.parkingBrake ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                {telemetry?.parkingBrake ? 'SET' : 'OFF'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">ENG 1:</span>
              <span className={telemetry?.engineRunning ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {telemetry?.engineRunning ? 'RUNNING' : 'OFF'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Contract Details Banner (when job is accepted) */}
      {activeJob ? (
        <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-cyan-800/50 bg-gradient-to-r from-cyan-950/40 via-slate-900/70 to-slate-900/40 shadow-xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Route & Destination */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-900/50 border border-cyan-500/50 flex items-center justify-center text-cyan-300 font-mono font-bold text-lg">
                {activeJob.destination_icao}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs uppercase font-mono text-cyan-400">ACTIVE CONTRACT</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-900/70 text-cyan-200">
                    {activeJob.distance_nm} NM
                  </span>
                </div>
                <h4 className="text-lg font-bold text-white font-mono tracking-wide">
                  {activeJob.origin_icao} <span className="text-cyan-400">➔</span> {activeJob.destination_icao}
                </h4>
                <p className="text-xs text-slate-300">
                  {activeJob.destination_airport?.name || activeJob.destination_name || 'En Route to Destination'}
                  {activeJob.destination_airport?.city ? ` • ${activeJob.destination_airport.city}` : ''}
                </p>
              </div>
            </div>

            {/* Payload & Payout Details */}
            <div className="grid grid-cols-3 gap-4 text-xs font-mono w-full lg:w-auto">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center space-x-1.5 text-slate-400">
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <span>CARGO</span>
                </div>
                <p className="text-white font-bold mt-1 text-sm">{activeJob.cargo_lbs.toLocaleString()} lbs</p>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center space-x-1.5 text-slate-400">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>PASSENGERS</span>
                </div>
                <p className="text-white font-bold mt-1 text-sm">{activeJob.pax_count} pax</p>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-emerald-900/50">
                <div className="flex items-center space-x-1.5 text-emerald-400">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>REWARD</span>
                </div>
                <p className="text-emerald-400 font-bold mt-1 text-sm font-mono">
                  ${activeJob.payout.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Progress & Cancel button */}
            <div className="w-full lg:w-48 flex flex-col justify-center">
              <div className="flex justify-between text-xs font-mono mb-1 text-slate-400">
                <span>REMAINING</span>
                <span className="text-cyan-400 font-bold">{remainingNm} NM</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {phase === 'IDLE' && onCancelJob && (
                <button
                  onClick={() => onCancelJob(activeJob._id)}
                  className="mt-2 text-[11px] text-rose-400 hover:text-rose-300 font-mono text-center hover:underline"
                >
                  Cancel Contract
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TelemetryDashboard;

