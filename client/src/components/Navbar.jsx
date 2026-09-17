import React from 'react';
import {
  Plane,
  Radio,
  BookOpen,
  RotateCcw,
  DollarSign,
  MapPin,
  Compass,
  Briefcase,
  Warehouse,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export function Navbar({
  currentTab = 'flight-deck',
  onTabChange,
  pilot,
  connectionStatus,
  activeJob,
  phase,
  destDist = null,
  availableJobsCount = 0,
  onResetPilot,
  onOpenChangeBase
}) {
  const isMock = connectionStatus?.isMock;
  const isConnected = connectionStatus?.connected;
  const appName = connectionStatus?.app || 'MSFS 2024';
  const isEnRoute = activeJob && phase !== 'STANDBY';

  const tabs = [
    {
      id: 'flight-deck',
      label: 'FLIGHT DECK',
      icon: Compass,
      badge: isEnRoute ? phase : null,
      badgeColor: isEnRoute ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50' : null
    },
    {
      id: 'dispatch',
      label: 'DISPATCH',
      icon: Briefcase,
      badge: availableJobsCount > 0 ? `${availableJobsCount}` : null,
      badgeColor: 'bg-slate-800 text-slate-300'
    },
    {
      id: 'fleet',
      label: 'FLEET & HANGAR',
      icon: Warehouse,
      badge: pilot?.active_aircraft?.tail_number || 'N172AB',
      badgeColor: 'bg-amber-950/60 text-amber-300 border-amber-800/60'
    },
    {
      id: 'career',
      label: 'CAREER LOG',
      icon: BookOpen,
      badge: `${pilot?.flight_log?.length || 0}`,
      badgeColor: 'bg-purple-950/60 text-purple-300 border-purple-800/60'
    }
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-[1600px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-4">
        {/* Brand */}
        <div
          onClick={() => onTabChange && onTabChange('flight-deck')}
          className="flex items-center space-x-2.5 cursor-pointer group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30 group-hover:scale-105 transition-transform">
            <Plane className="w-4 h-4 text-white transform -rotate-45" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold tracking-wider text-white text-base font-mono">AIRBOUND</span>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                2024
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Career & Telemetry</p>
          </div>
        </div>

        {/* Center Tab Navigation */}
        <nav className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange && onTabChange(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition relative ${
                  isActive
                    ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full border hidden lg:inline ${
                      tab.badgeColor || 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active Flight Mini-Alert (if outside Flight Deck during flight) */}
        {isEnRoute && currentTab !== 'flight-deck' && (
          <button
            onClick={() => onTabChange && onTabChange('flight-deck')}
            className="hidden lg:flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 font-mono text-xs animate-pulse hover:border-cyan-400 transition shrink-0"
            title="Flight in progress. Click to view Flight Deck."
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>
              {activeJob.origin_icao} ➔ {activeJob.destination_icao}
              {destDist !== null && Number.isFinite(destDist) ? ` • ${Math.round(destDist)} NM` : ''} ({phase})
            </span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}

        {/* Right Status & Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* SimConnect Status Dot */}
          <div
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400"
            title={
              isConnected
                ? isMock
                  ? 'Mock Telemetry Active'
                  : `${appName} SimConnect Connected`
                : 'Searching for MSFS 2024...'
            }
          >
            <Radio
              className={`w-3.5 h-3.5 ${
                isConnected
                  ? isMock
                    ? 'text-amber-400 animate-pulse'
                    : 'text-emerald-400 animate-pulse'
                  : 'text-rose-500'
              }`}
            />
            <span className="hidden lg:inline">
              {isConnected ? (isMock ? 'MOCK SIM' : appName) : 'OFFLINE'}
            </span>
          </div>

          {/* Current Airport Button */}
          <button
            onClick={onOpenChangeBase}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/60 text-xs font-mono transition group"
            title="Click to update departure airport"
          >
            <MapPin className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="text-white font-bold">{pilot?.current_icao || 'KLAX'}</span>
          </button>

          {/* Wallet Balance Pill */}
          <div className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-800/40 text-xs font-mono">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-bold">
              {(pilot?.balance || 0).toLocaleString()}
            </span>
          </div>

          {/* Reset Career Button */}
          {onResetPilot && (
            <button
              onClick={onResetPilot}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 transition"
              title="Reset Pilot Career"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
