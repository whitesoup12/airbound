import React from 'react';
import {
  Plane,
  Radio,
  BookOpen,
  DollarSign,
  Compass,
  Briefcase,
  Warehouse,
  Award,
  Lock,
  FileText,
  Settings,
  ArrowRight,
  User,
  ShieldCheck,
  HelpCircle
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
      label: 'Flight Deck',
      icon: Compass,
      badge: isEnRoute ? phase : null,
      badgeColor: isEnRoute ? 'bg-cyan-950 text-cyan-300 border-cyan-500/60 animate-pulse' : null
    },
    {
      id: 'dispatch',
      label: 'Dispatch',
      icon: Briefcase,
      badge: availableJobsCount > 0 ? `${availableJobsCount}` : null,
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700'
    },
    {
      id: 'fleet',
      label: 'Fleet',
      icon: Warehouse,
      badge: pilot?.active_aircraft?.tail_number || 'N152AB',
      badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-700/60'
    },
    {
      id: 'cash-flow',
      label: 'Cash Flow',
      icon: DollarSign,
      badge: `$${(pilot?.balance || 0).toLocaleString()}`,
      badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
      isMatched: (t) => t === 'cash-flow' || t === 'finances'
    },
    {
      id: 'progression',
      label: 'Career',
      icon: Award,
      badge: `L${rankInfo.level}`,
      badgeColor: 'bg-purple-950/80 text-purple-300 border-purple-700/60',
      isMatched: (t) => t === 'progression' || t === 'career'
    },
    {
      id: 'logbook',
      label: 'Logbook',
      icon: BookOpen,
      badge: `${pilot?.flight_log?.length || 0}`,
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700'
    },
    {
      id: 'guide',
      label: 'Pilot Guide',
      icon: HelpCircle,
      isMatched: (t) => t === 'guide' || t === 'handbook'
    },
    {
      id: 'options',
      label: 'Options',
      icon: Settings,
      isMatched: (t) => t === 'options' || t === 'settings'
    }
  ];

  return (
    <aside className="w-60 md:w-64 shrink-0 bg-[#090d16] border-r border-slate-800/80 h-screen sticky top-0 flex flex-col justify-between z-40 select-none shadow-2xl">
      {/* Top Header & Brand */}
      <div className="flex flex-col">
        <div
          onClick={() => onTabChange && onTabChange('flight-deck')}
          className="p-4 sm:p-5 flex items-center space-x-3 cursor-pointer group border-b border-slate-800/80 hover:bg-slate-900/40 transition"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/40 group-hover:scale-105 transition-transform shrink-0">
            <Plane className="w-5 h-5 text-white transform -rotate-45" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold tracking-wider text-white text-base font-mono truncate">
                AIRBOUND
              </span>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-semibold">
                2024
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight">Career & Telemetry</p>
          </div>
        </div>

        {/* Navigation Tabs List */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-270px)]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.isMatched ? tab.isMatched(currentTab) : currentTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange && onTabChange(tab.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-mono transition group text-left cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-950/80 to-slate-900 border border-cyan-500/50 text-cyan-300 font-bold shadow-md shadow-cyan-950/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  />
                  <span className="truncate">{tab.label}</span>
                </div>

                {tab.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 font-bold ml-1 ${
                      tab.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active En Route Flight Banner (if outside Flight Deck tab) */}
        {isEnRoute && currentTab !== 'flight-deck' && (
          <div className="px-3 pt-1">
            <button
              onClick={() => onTabChange && onTabChange('flight-deck')}
              className="w-full p-2.5 rounded-xl bg-cyan-950/90 border border-cyan-500/70 text-cyan-300 font-mono text-xs animate-pulse hover:border-cyan-400 transition flex items-center justify-between shadow-lg shadow-cyan-950/60 cursor-pointer"
              title="Flight in progress. Click to view Flight Deck cockpit."
            >
              <div className="flex items-center space-x-2 truncate">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                <span className="truncate font-bold">
                  {activeJob.origin_icao} ➔ {activeJob.destination_icao}
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Footer Controls & Diagnostics */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 space-y-2.5">
        {/* Pilot ID Card */}
        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-white font-bold block truncate text-[11px]">
                {pilot?.callsign || 'James'}
              </span>
              <span className="text-[10px] text-purple-400 block truncate font-semibold">
                L{rankInfo.level} {rankInfo.title}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0 pl-1">
            <span className="text-[10px] text-slate-500 block">BASE</span>
            <span className="text-cyan-400 font-bold text-[11px]">{pilot?.current_icao || 'KLAX'}</span>
          </div>
        </div>

        {/* SimConnect Telemetry Bridge Status */}
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
            label = 'MOCK SIMULATOR';
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
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-[11px] font-mono transition cursor-pointer group ${pillClass}`}
              title={tooltip}
            >
              <div className="flex items-center space-x-2 truncate">
                <span className="relative flex h-2 w-2 shrink-0">
                  {(connectorActive || isDesktop) && (
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotPing}`}></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`}></span>
                </span>
                <Radio className={`w-3.5 h-3.5 shrink-0 ${radioClass} group-hover:scale-110 transition-transform`} />
                <span className="font-bold tracking-wider truncate">{label}</span>
              </div>
            </button>
          );
        })()}

        {/* Quick Charts & Lock Cockpit row */}
        <div className="flex items-center space-x-2">
          {onOpenCharts && (
            <button
              type="button"
              onClick={() => onOpenCharts(activeJob?.destination_icao || pilot?.current_icao || 'KLAX')}
              className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-cyan-950/70 border border-slate-800 hover:border-cyan-500/60 text-[11px] font-mono text-cyan-400 transition cursor-pointer"
              title="Open Airport Charts & Approach Plates"
            >
              <FileText className="w-3 h-3" />
              <span className="font-bold">CHARTS</span>
            </button>
          )}

          {onLockCockpit && isAuthRequired && (
            <button
              type="button"
              onClick={onLockCockpit}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800 hover:border-cyan-800 transition cursor-pointer"
              title="Lock Cockpit"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Navbar;
