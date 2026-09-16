import React from 'react';
import { Plane, Radio, BookOpen, RotateCcw, DollarSign, MapPin } from 'lucide-react';

export function Navbar({ pilot, connectionStatus, onOpenLogbook, onResetPilot }) {
  const isMock = connectionStatus?.isMock;
  const isConnected = connectionStatus?.connected;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
            <Plane className="w-5 h-5 text-white transform -rotate-45" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-wider text-white text-lg font-mono">AIRBOUND</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                MSFS 2024
              </span>
            </div>
            <p className="text-xs text-slate-400">Career & Live Telemetry Tracker</p>
          </div>
        </div>

        {/* Center / SimConnect Status Pill */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
          <Radio
            className={`w-4 h-4 ${
              isConnected
                ? isMock
                  ? 'text-amber-400 animate-pulse'
                  : 'text-emerald-400 animate-pulse'
                : 'text-rose-500'
            }`}
          />
          <span className="text-xs font-mono">
            {isConnected
              ? isMock
                ? 'BRIDGE: MOCK SIMULATOR'
                : 'SIMCONNECT: MSFS 2024 ACTIVE'
              : 'SIMCONNECT: SEARCHING...'}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? isMock
                  ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                  : 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                : 'bg-rose-500'
            }`}
          />
        </div>

        {/* Pilot Stats & Actions */}
        <div className="flex items-center space-x-3">
          {/* Current Airport */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">BASE:</span>
            <span className="text-white font-bold">{pilot?.current_icao || 'KLAX'}</span>
          </div>

          {/* Balance Pill */}
          <div className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs font-mono">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-bold text-sm">
              {(pilot?.balance || 0).toLocaleString()}
            </span>
          </div>

          {/* Logbook Button */}
          <button
            onClick={onOpenLogbook}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition border border-slate-700/60"
            title="View Flight Logbook & Career Records"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Logbook</span>
            <span className="px-1.5 py-0.2 rounded bg-slate-900 text-[10px] text-slate-300">
              {pilot?.flight_log?.length || 0}
            </span>
          </button>

          {/* Reset Career */}
          <button
            onClick={onResetPilot}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 transition"
            title="Reset Pilot Career"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;

