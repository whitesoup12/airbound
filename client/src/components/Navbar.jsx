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
  ArrowRight,
  Award,
  Lock,
  FileText
} from 'lucide-react';
import { getPilotRank } from '../utils/xpUtils.js';

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
  onOpenChangeBase,
  onLockCockpit,
  isAuthRequired = false,
  onOpenConnectorStatus,
  onOpenCharts
}) {
  const isDesktop = Boolean(connectionStatus?.isDesktop) || connectionStatus?.source === 'desktop' || (typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent));
  const isMock = connectionStatus?.isMock;
  const connectorActive = isDesktop || connectionStatus?.connectorActive;
  const simConnected = connectionStatus?.simConnected;
  const appName = connectionStatus?.app || 'MSFS 2024';
  const lastSeenAgoSeconds = connectionStatus?.lastSeenAgoSeconds;
  const isEnRoute = activeJob && phase !== 'STANDBY';

  const rankInfo = getPilotRank(pilot?.xp || 0);

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
      label: 'FLEET',
      icon: Warehouse,
      badge: pilot?.active_aircraft?.tail_number || 'N172AB',
      badgeColor: 'bg-amber-950/60 text-amber-300 border-amber-800/60'
    },
    {
      id: 'cash-flow',
      label: 'CASH FLOW',
      icon: DollarSign,
      badge: `$${(pilot?.balance || 0).toLocaleString()}`,
      badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/70',
      isMatched: (t) => t === 'cash-flow' || t === 'finances'
    },
    {
      id: 'progression',
      label: 'CAREER',
      icon: Award,
      badge: `L${rankInfo.level}`,
      badgeColor: 'bg-purple-950/80 text-purple-300 border-purple-700/70',
      isMatched: (t) => t === 'progression' || t === 'career'
    },
    {
      id: 'logbook',
      label: 'LOGBOOK',
      icon: BookOpen,
      badge: `${pilot?.flight_log?.length || 0}`,
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700'
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
            const isActive = tab.isMatched ? tab.isMatched(currentTab) : currentTab === tab.id;

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
          {/* Connector & Telemetry Status Indicator */}
          {(() => {
            let pillClass = 'bg-slate-900/90 hover:bg-slate-800 border-rose-900/60 text-slate-300 hover:text-white shadow-sm';
            let dotPing = 'bg-rose-500';
            let dotColor = 'bg-rose-500';
            let radioClass = 'text-rose-500';
            let label = isDesktop ? 'SEARCHING FOR MSFS' : 'CONNECTOR OFFLINE';
            let tooltip = isDesktop
              ? 'Built-in MSFS connector is active. Launch Microsoft Flight Simulator to connect automatically.'
              : 'MSFS desktop connector is offline. Click to view quick connection guide.';

            if (isMock) {
              pillClass = 'bg-purple-950/70 hover:bg-purple-900/80 border-purple-700/60 text-purple-300';
              dotPing = 'bg-purple-400';
              dotColor = 'bg-purple-400';
              radioClass = 'text-purple-400 animate-pulse';
              label = 'MOCK SIM';
              tooltip = 'Synthetic mock flight telemetry active. Click for details.';
            } else if (simConnected) {
              pillClass = 'bg-emerald-950/70 hover:bg-emerald-900/80 border-emerald-600/70 text-emerald-300 shadow-sm shadow-emerald-950/50';
              dotPing = 'bg-emerald-400';
              dotColor = 'bg-emerald-400';
              radioClass = 'text-emerald-400 animate-pulse';
              label = appName || 'SIMULATOR LINKED';
              tooltip = `SimConnect linked to ${appName || 'MSFS 2024'} (${lastSeenAgoSeconds !== null ? `${lastSeenAgoSeconds}s ago` : 'Live'}). Click for details.`;
            } else if (connectorActive || isDesktop) {
              pillClass = 'bg-amber-950/70 hover:bg-amber-900/80 border-amber-600/70 text-amber-300 shadow-sm shadow-amber-950/50';
              dotPing = 'bg-amber-400';
              dotColor = 'bg-amber-400';
              radioClass = 'text-amber-400 animate-pulse';
              label = isDesktop ? 'SEARCHING FOR MSFS' : 'WAITING FOR SIM';
              tooltip = isDesktop
                ? 'Built-in MSFS connector is active. Launch Microsoft Flight Simulator to connect automatically.'
                : 'Connector active on PC, waiting for MSFS to launch or load flight. Click for details.';
            }

            return (
              <button
                type="button"
                onClick={onOpenConnectorStatus}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition cursor-pointer group ${pillClass}`}
                title={tooltip}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  {(connectorActive || isDesktop) && (
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotPing}`}></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`}></span>
                </span>
                <Radio className={`w-3.5 h-3.5 shrink-0 ${radioClass} group-hover:scale-110 transition-transform`} />
                <span className="hidden sm:inline font-bold tracking-wider">{label}</span>
              </button>
            );
          })()}

          {/* Current Airport Button */}
          <button
            onClick={onOpenChangeBase}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/60 text-xs font-mono transition group"
            title="Click to update departure airport"
          >
            <MapPin className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="text-white font-bold">{pilot?.current_icao || 'KLAX'}</span>
          </button>

          {/* Quick Charts Button */}
          {onOpenCharts && (
            <button
              type="button"
              onClick={() => onOpenCharts(activeJob?.destination_icao || pilot?.current_icao || 'KLAX')}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/70 border border-slate-800 hover:border-cyan-500/60 text-xs font-mono text-cyan-400 transition cursor-pointer group"
              title="Open Airport Charts & Approach Plates"
            >
              <FileText className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              <span className="hidden md:inline font-bold">CHARTS</span>
            </button>
          )}

          {/* Wallet Balance Pill */}
          <button
            type="button"
            onClick={() => onTabChange && onTabChange('cash-flow')}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-950/80 border border-emerald-800/40 hover:border-emerald-500/80 text-xs font-mono transition cursor-pointer group"
            title="Click to view Cash Flow & Financial Ledger"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-emerald-400 font-bold group-hover:text-emerald-300 transition-colors">
              {(pilot?.balance || 0).toLocaleString()}
            </span>
          </button>

          {/* Lock Cockpit Button */}
          {onLockCockpit && isAuthRequired && (
            <button
              type="button"
              onClick={onLockCockpit}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800 hover:border-cyan-800 transition"
              title="Lock Flight Deck"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          )}

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
