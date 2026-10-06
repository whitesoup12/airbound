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
  AlertCircle,
  Fuel,
  Clock,
  MapPin,
  Award,
  Plane,
  Radio
} from 'lucide-react';
import { calculateNavEstimates } from '../utils/navigation.js';

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

export function TelemetryDashboard({
  telemetry,
  phase,
  activeJob,
  aircraftValidation = null,
  destDist = null,
  originDist = null,
  onCancelJob,
  pilot,
  allAirports = [],
  onOpenCareer,
  connectionStatus,
  onOpenConnectorStatus
}) {
  const phaseInfo = PHASE_CONFIG[phase] || PHASE_CONFIG.STANDBY;

  const activeAircraft = pilot?.active_aircraft || {
    name: 'Cessna 172 Skyhawk',
    cruise_speed_kts: 120,
    fuel_burn_gph: 9.0,
    fuel_type: '100LL'
  };

  let estimatedFuelGallons = 0;
  let estimatedFuelCost = 0;
  let estimatedLandingFee = 0;
  let estimatedNetProfit = 0;

  if (activeJob) {
    const estHours = Math.max(0.08, activeJob.distance_nm / (activeAircraft.cruise_speed_kts || 120));
    estimatedFuelGallons = Math.round(estHours * (activeAircraft.fuel_burn_gph || 9) * 10) / 10;
    const fuelPrice = activeAircraft.fuel_type === 'Jet-A' ? 5.60 : 6.40;
    estimatedFuelCost = Math.round(estimatedFuelGallons * fuelPrice * 100) / 100;
    const runwayFt = activeJob.destination_airport?.longest_runway_ft || activeJob.destination_runway_ft || 5000;
    estimatedLandingFee = runwayFt >= 9500 ? 350 : (runwayFt >= 5000 ? 120 : 35);
    estimatedNetProfit = Math.max(0, Math.round(activeJob.payout - estimatedFuelCost - estimatedLandingFee));
  }

  // Compute live navigation estimates (Distance Remaining, Bearing, Closure Rate, ETE & ETA)
  const navEstimates = calculateNavEstimates({
    telemetry,
    activeJob,
    phase,
    activeAircraft,
    allAirports,
    destDistOverride: destDist
  });

  const remainingNm = navEstimates.remainingNm;
  const progressPct = navEstimates.progressPct;

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
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-xs uppercase font-mono tracking-widest text-slate-400">FLIGHT PHASE:</span>
              <span className="font-mono font-bold tracking-wider text-base sm:text-lg">{phaseInfo.label}</span>
              {telemetry?.isPaused && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500 text-slate-950 font-bold animate-pulse shadow-sm">
                  PAUSED
                </span>
              )}
              {/* Cockpit Connector Badge */}
              {onOpenConnectorStatus && (
                <button
                  type="button"
                  onClick={onOpenConnectorStatus}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider border flex items-center space-x-1.5 transition cursor-pointer ${
                    connectionStatus?.isMock
                      ? 'bg-purple-950/80 border-purple-500/60 text-purple-300'
                      : connectionStatus?.connectorActive && connectionStatus?.simConnected
                      ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                      : connectionStatus?.connectorActive && !connectionStatus?.simConnected
                      ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                      : 'bg-rose-950/80 border-rose-500/60 text-rose-300 hover:bg-rose-900'
                  }`}
                  title="Click to view simulator connector status"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connectionStatus?.isMock
                        ? 'bg-purple-400'
                        : connectionStatus?.connectorActive && connectionStatus?.simConnected
                        ? 'bg-emerald-400 animate-pulse'
                        : connectionStatus?.connectorActive && !connectionStatus?.simConnected
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-rose-400'
                    }`}
                  ></span>
                  <span>
                    {connectionStatus?.isMock
                      ? 'MOCK SIM'
                      : connectionStatus?.connectorActive && connectionStatus?.simConnected
                      ? 'CONNECTOR LINKED'
                      : connectionStatus?.connectorActive && !connectionStatus?.simConnected
                      ? 'WAITING FOR SIM'
                      : 'CONNECTOR OFFLINE'}
                  </span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-300/80">
              {telemetry?.isPaused ? 'Simulation paused in MSFS (flight timer frozen).' : phaseInfo.description}
            </p>
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

      {/* Desktop Connector Offline Helper Banner */}
      {!connectionStatus?.connectorActive && !connectionStatus?.isMock && (
        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs font-mono text-slate-400 shadow-lg">
          <div className="flex items-center space-x-2.5">
            <Radio className="w-4 h-4 text-rose-500 shrink-0 animate-pulse" />
            <span>
              <strong className="text-slate-200">MSFS Connector Offline:</strong> Run{' '}
              <code className="text-cyan-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 font-bold">
                start-connector.bat
              </code>{' '}
              on your PC to stream live MSFS 2024 / 2020 telemetry.
            </span>
          </div>
          {onOpenConnectorStatus && (
            <button
              onClick={onOpenConnectorStatus}
              className="px-3 py-1 rounded-lg bg-cyan-950/90 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 text-[11px] font-bold transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              How to Connect
            </button>
          )}
        </div>
      )}

      {/* Airframe Mismatch Alert Banner (Takes priority when mismatch is detected) */}
      {activeJob && aircraftValidation && !aircraftValidation.matches && (
        <div className="glass-panel rounded-2xl p-4 border border-rose-500/80 bg-gradient-to-r from-rose-950/80 via-red-950/60 to-slate-900/80 text-rose-200 shadow-xl shadow-rose-950/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-500 flex items-center justify-center text-rose-400 flex-shrink-0 mt-0.5 sm:mt-0">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-900/80 text-rose-200 border border-rose-700 uppercase font-bold">
                    TAKEOFF BLOCKED
                  </span>
                  <h4 className="text-sm sm:text-base font-bold font-mono text-rose-200">
                    AIRFRAME MISMATCH DETECTED
                  </h4>
                </div>
                <p className="text-xs text-rose-300 mt-1 font-mono">
                  Contract requires: <strong className="text-white underline">{aircraftValidation.expectedAircraft}</strong> | Detected in MSFS: <strong className="text-amber-300">{aircraftValidation.simAircraftTitle || 'Unknown Airframe'}</strong>
                </p>
                <p className="text-[11px] text-rose-300/80 mt-0.5">
                  Please return to the MSFS main menu and load the designated aircraft to fly this contract.
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right sm:flex-shrink-0">
              <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wide block">
                FLIGHT PHASE LOCKED
              </span>
              <span className="text-xs font-mono font-bold text-rose-300">
                GATED IN IDLE
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Flight Telemetry Gauges Grid (8 Primary Avionics Instruments) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* 1. Ground Speed */}
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
          <div className="mt-1 text-[10px] font-mono text-slate-400 truncate">
            TAS: {Math.round(telemetry?.airspeedTrue || 0)} KTS
          </div>
        </div>

        {/* 2. Altitude */}
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
          <div className="mt-1 text-[10px] font-mono text-slate-400 truncate">
            MSL Elevation
          </div>
        </div>

        {/* 3. Heading & Direct Bearing */}
        <div className="glass-panel rounded-xl p-3 border border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>HEADING</span>
            <Compass className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-bold font-mono text-white">
              {Math.round(telemetry?.heading || 0).toString().padStart(3, '0')}
            </span>
            <span className="text-xs font-mono text-slate-400">°</span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-cyan-400 truncate">
            {navEstimates.bearing !== null ? `BRG: ${navEstimates.bearing.toString().padStart(3, '0')}°` : 'TRUE NORTH'}
          </div>
        </div>

        {/* 4. Distance Remaining to Destination */}
        <div className="glass-panel rounded-xl p-3 border border-cyan-800/60 bg-gradient-to-b from-slate-900/80 to-cyan-950/20">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span className="text-cyan-300 font-semibold">DIST REMAINING</span>
            <MapPin className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className="text-2xl font-bold font-mono text-cyan-300">
              {activeJob ? navEstimates.remainingNm : '--'}
            </span>
            <span className="text-xs font-mono text-cyan-400/80">NM</span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-slate-400 truncate">
            {activeJob ? `DEST: ${activeJob.destination_icao}` : 'NO ACTIVE JOB'}
          </div>
        </div>

        {/* 5. Estimated Time En Route (ETE) */}
        <div className="glass-panel rounded-xl p-3 border border-emerald-800/60 bg-gradient-to-b from-slate-900/80 to-emerald-950/20">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span className="text-emerald-300 font-semibold">EST. TIME (ETE)</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className={`text-2xl font-bold font-mono ${navEstimates.isDiverging ? 'text-amber-400' : 'text-emerald-300'}`}>
              {activeJob ? navEstimates.formattedEte : '--'}
            </span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-slate-400 truncate">
            {navEstimates.formattedEta && navEstimates.formattedEta !== 'N/A'
              ? `ETA: ${navEstimates.formattedEta}`
              : navEstimates.isDiverging
              ? 'Off-track / Diverging'
              : navEstimates.isCruiseEst
              ? 'Cruise Plan Est'
              : 'Standby'}
          </div>
        </div>

        {/* 6. Track Advice & Closure Rate (VMG) */}
        <div className="glass-panel rounded-xl p-3 border border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>TRACK ADVICE</span>
            <Navigation className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-1">
            <span className={`text-base font-bold font-mono truncate ${
              navEstimates.turnAdvice === 'ON TRACK' || navEstimates.turnAdvice === 'OPEN ROAM'
                ? 'text-emerald-400'
                : 'text-amber-300'
            }`}>
              {activeJob ? navEstimates.turnAdvice : '--'}
            </span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-slate-400 truncate">
            {activeJob
              ? activeJob.is_free_flight && !activeJob.destination_icao
                ? 'Free Exploration'
                : `VMG: ${navEstimates.closureRate} KTS`
              : 'Straight Flight'}
          </div>
        </div>

        {/* 7. Surface State: SIM ON GROUND */}
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
          <div className="mt-1 text-[10px] font-mono text-slate-400 truncate">
            {phase} Phase
          </div>
        </div>

        {/* 8. Systems: Parking Brake & Engine Status */}
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

      {/* Active Contract / Free Flight Details Banner (when job is accepted) */}
      {activeJob ? (
        <div className={`glass-panel rounded-2xl p-4 sm:p-5 border shadow-xl ${
          activeJob.is_free_flight
            ? 'border-cyan-700/60 bg-gradient-to-r from-cyan-950/50 via-slate-900/80 to-slate-900/60 shadow-cyan-950/40'
            : 'border-cyan-800/50 bg-gradient-to-r from-cyan-950/40 via-slate-900/70 to-slate-900/40'
        }`}>
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Route & Destination */}
            <div className="flex items-center space-x-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-lg border ${
                activeJob.is_free_flight
                  ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-950/50'
                  : 'bg-cyan-900/50 border-cyan-500/50 text-cyan-300'
              }`}>
                {activeJob.is_free_flight ? (activeJob.destination_icao || 'ROAM') : activeJob.destination_icao}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs uppercase font-mono text-cyan-400">
                    {activeJob.is_free_flight ? 'FREE FLIGHT MISSION' : 'ACTIVE CONTRACT'}
                  </span>
                  {activeJob.is_free_flight ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/90 text-cyan-200 border border-cyan-700/70 font-bold">
                      {activeJob.destination_icao ? `${activeJob.distance_nm || '--'} NM ROUTE` : 'OPEN ROAM'}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-900/70 text-cyan-200">
                      {activeJob.distance_nm} NM
                    </span>
                  )}
                </div>
                <h4 className="text-lg font-bold text-white font-mono tracking-wide">
                  {activeJob.origin_icao} <span className="text-cyan-400">➔</span> {activeJob.destination_icao || 'Any Airfield (Open Roam)'}
                </h4>
                <p className="text-xs text-slate-300">
                  {activeJob.is_free_flight
                    ? activeJob.destination_icao
                      ? (activeJob.destination_airport?.name || activeJob.destination_name || 'Planned Destination Airfield')
                      : 'Fly anywhere. Touchdown and engine shutdown will auto-detect nearest airport.'
                    : (activeJob.destination_airport?.name || activeJob.destination_name || 'En Route to Destination')}
                  {activeJob.destination_airport?.city ? ` • ${activeJob.destination_airport.city}` : ''}
                </p>
              </div>
            </div>

            {/* Middle Specs Grid */}
            {activeJob.is_free_flight ? (
              <div className="grid grid-cols-3 gap-4 text-xs font-mono w-full lg:w-auto">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center space-x-1.5 text-slate-400">
                    <Plane className="w-3.5 h-3.5 text-amber-400" />
                    <span>AIRFRAME</span>
                  </div>
                  <p className="text-white font-bold mt-1 text-xs truncate max-w-[130px]" title={telemetry?.simAircraftTitle || activeAircraft.name}>
                    {telemetry?.simAircraftTitle || activeAircraft.name}
                  </p>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center space-x-1.5 text-slate-400">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    <span>DISPATCH</span>
                  </div>
                  <p className="text-white font-bold mt-1 text-sm">{activeJob.destination_icao ? 'Planned' : 'Open Roam'}</p>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center space-x-1.5 text-emerald-400">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>EXPENSES</span>
                  </div>
                  <p className={`font-bold mt-1 text-xs font-mono ${activeJob.deduct_fees ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {activeJob.deduct_fees ? 'Realistic ($)' : 'Casual ($0)'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-xs font-mono w-full lg:w-auto">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center space-x-1.5 text-slate-400">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                    <span>CARGO</span>
                  </div>
                  <p className="text-white font-bold mt-1 text-sm">{activeJob.cargo_lbs?.toLocaleString()} lbs</p>
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
                    ${activeJob.payout?.toLocaleString()}
                  </p>
                  {activeJob.seniority_bonus > 0 && (
                    <span
                      onClick={onOpenCareer}
                      className={`text-[10px] text-purple-300 font-mono block ${
                        onOpenCareer ? 'cursor-pointer hover:text-purple-200 hover:underline' : ''
                      }`}
                      title={onOpenCareer ? 'View Career Progression & Rank Multipliers' : undefined}
                    >
                      (+${activeJob.seniority_bonus.toLocaleString()} Seniority)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Progress & Live ETE Guidance */}
            <div className="w-full lg:w-60 flex flex-col justify-center">
              {activeJob.is_free_flight && !activeJob.destination_icao ? (
                <>
                  <div className="flex justify-between text-xs font-mono mb-1 text-slate-400">
                    <span>FLIGHT LOGGING</span>
                    <span className="text-cyan-300 font-bold">ACTIVE</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 animate-pulse"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-mono mt-1.5 text-slate-400">
                    <span>TOUCHDOWN:</span>
                    <span className="text-cyan-300 font-medium">Auto-Detect</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-xs font-mono mb-1 text-slate-400">
                    <span>DIST REMAINING</span>
                    <span className="text-cyan-300 font-bold">{remainingNm} NM</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  {/* Live ETE and Clock ETA */}
                  <div className="flex justify-between items-center text-[11px] font-mono mt-1.5 text-slate-400">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      <span>EST. TIME:</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className={`font-bold ${navEstimates.isDiverging ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {navEstimates.formattedEte}
                      </span>
                      {navEstimates.formattedEta && navEstimates.formattedEta !== 'N/A' && (
                        <span className="text-[10px] text-slate-400 font-normal">({navEstimates.formattedEta})</span>
                      )}
                    </div>
                  </div>

                  {/* Direct Bearing & Heading Deviation */}
                  {navEstimates.bearing !== null && (
                    <div className="flex justify-between items-center text-[10px] font-mono mt-0.5 text-slate-400">
                      <span>DIRECT BRG:</span>
                      <span className="text-cyan-400 font-medium">
                        {navEstimates.bearing.toString().padStart(3, '0')}°
                        {navEstimates.turnAdvice ? ` (${navEstimates.turnAdvice})` : ''}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Cancel Button */}
              {activeJob.is_free_flight ? (
                onCancelJob && (
                  <button
                    onClick={() => onCancelJob(activeJob._id)}
                    className="mt-2 text-[11px] text-rose-400 hover:text-rose-300 font-mono text-center hover:underline"
                  >
                    Cancel Free Flight
                  </button>
                )
              ) : (
                phase === 'IDLE' && onCancelJob && (
                  <button
                    onClick={() => onCancelJob(activeJob._id)}
                    className="mt-2 text-[11px] text-rose-400 hover:text-rose-300 font-mono text-center hover:underline"
                  >
                    Cancel Contract
                  </button>
                )
              )}
            </div>
          </div>

          {/* Operating Expenses & Estimated Settlement Strip */}
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] font-mono gap-2 text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-400 flex items-center space-x-1.5">
                <span>Aircraft:</span>
                <strong className={!activeJob.is_free_flight && aircraftValidation && !aircraftValidation.matches ? 'text-rose-400' : 'text-cyan-300'}>
                  {activeJob.is_free_flight ? (telemetry?.simAircraftTitle || activeAircraft.name) : activeAircraft.name}
                </strong>
                {aircraftValidation && !activeJob.is_free_flight && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      aircraftValidation.matches
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                        : 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
                    }`}
                  >
                    {aircraftValidation.matches
                      ? `✓ MSFS: ${aircraftValidation.simAircraftTitle}`
                      : `✗ MSFS: ${aircraftValidation.simAircraftTitle || 'Mismatch'}`}
                  </span>
                )}
                {activeJob.is_free_flight && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-700/60">
                    Free Flight Mode
                  </span>
                )}
              </span>

              {activeJob.is_free_flight ? (
                activeJob.deduct_fees ? (
                  <>
                    <span className="flex items-center space-x-1">
                      <Fuel className="w-3 h-3 text-amber-400" />
                      <span>Est. Fuel: <strong className="text-amber-300">~{estimatedFuelGallons} gal (${estimatedFuelCost.toFixed(2)})</strong></span>
                    </span>
                    <span>
                      Est. Landing Fee: <strong className="text-rose-400">${estimatedLandingFee}</strong>
                    </span>
                  </>
                ) : (
                  <span className="text-emerald-400">
                    Fees Waived: <strong className="text-emerald-300">$0.00 (Casual Flight)</strong>
                  </span>
                )
              ) : (
                <>
                  <span className="flex items-center space-x-1">
                    <Fuel className="w-3 h-3 text-amber-400" />
                    <span>Est. Fuel: <strong className="text-amber-300">~{estimatedFuelGallons} gal (${estimatedFuelCost.toFixed(2)})</strong></span>
                  </span>
                  <span>
                    Est. Landing Fee: <strong className="text-rose-400">${estimatedLandingFee}</strong>
                  </span>
                </>
              )}

              <span
                onClick={onOpenCareer}
                className={`flex items-center space-x-1 text-purple-300 ${
                  onOpenCareer ? 'cursor-pointer hover:text-purple-200 transition' : ''
                }`}
                title={onOpenCareer ? 'View Career Progression & Rank' : undefined}
              >
                <Award className="w-3 h-3 text-purple-400" />
                <span>XP Reward: <strong className="text-purple-300">+{activeJob.xp_reward || (activeJob.distance_nm ? activeJob.distance_nm : 'Flight')} XP</strong></span>
              </span>
            </div>

            {activeJob.is_free_flight ? (
              <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border ${
                activeJob.deduct_fees
                  ? 'bg-amber-950/60 border-amber-800/50'
                  : 'bg-emerald-950/60 border-emerald-800/50'
              }`}>
                <span className={activeJob.deduct_fees ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {activeJob.deduct_fees ? 'EST. EXPENSES:' : 'EXPENSES WAIVED:'}
                </span>
                <span className={`font-bold text-xs ${activeJob.deduct_fees ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {activeJob.deduct_fees ? `-$${(estimatedFuelCost + estimatedLandingFee).toFixed(2)}` : '$0.00'}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/50">
                <span className="text-emerald-400 font-bold">EST. NET PROFIT:</span>
                <span className="text-emerald-300 font-bold text-xs">${estimatedNetProfit.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TelemetryDashboard;

