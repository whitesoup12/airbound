import React, { useState } from 'react';
import {
  Radio,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  Laptop,
  Plane,
  Cloud,
  RefreshCw
} from 'lucide-react';

export function ConnectorStatusModal({ isOpen, onClose, connectionStatus, onRefresh }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const {
    connectorActive = false,
    simConnected = false,
    lastSeenAgoSeconds = null,
    isMock = false,
    app = 'MSFS 2024',
    simAircraftTitle = null,
    connectorVersion = '1.2.0'
  } = connectionStatus || {};

  const handleCopyCommand = () => {
    navigator.clipboard.writeText('cd connector && npm start');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusSummary = () => {
    if (isMock) {
      return {
        badge: 'MOCK SIMULATION ACTIVE',
        color: 'text-purple-400 bg-purple-950/70 border-purple-700/60',
        dot: 'bg-purple-400',
        summary: 'Synthetic simulated telemetry stream is currently running.'
      };
    }
    if (connectorActive && simConnected) {
      return {
        badge: 'CONNECTOR & SIMULATOR LINKED',
        color: 'text-emerald-400 bg-emerald-950/70 border-emerald-700/60',
        dot: 'bg-emerald-400',
        summary: `Live SimConnect telemetry streaming from ${app || 'MSFS 2024'} at 1 Hz.`
      };
    }
    if (connectorActive && !simConnected) {
      return {
        badge: 'CONNECTOR ONLINE • WAITING FOR MSFS',
        color: 'text-amber-400 bg-amber-950/70 border-amber-700/60',
        dot: 'bg-amber-400',
        summary: 'Desktop connector is heartbeating to Airbound, but MSFS is not running or SimConnect has not yet initialized.'
      };
    }
    return {
      badge: 'CONNECTOR OFFLINE',
      color: 'text-rose-400 bg-rose-950/70 border-rose-700/60',
      dot: 'bg-rose-500',
      summary: 'No active telemetry heartbeat from the local PC connector in the last 7 seconds.'
    };
  };

  const statusSummary = getStatusSummary();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-700/70 bg-slate-900/95 shadow-2xl shadow-cyan-950/30 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold font-mono text-base text-white flex items-center space-x-2">
                <span>SIMULATOR CONNECTOR</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                  v{connectorVersion}
                </span>
              </h3>
              <p className="text-xs text-slate-400">MSFS 2024 / 2020 Desktop Telemetry Bridge</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto font-mono">
          {/* Top Overall Status Pill */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between ${statusSummary.color}`}>
            <div className="flex items-center space-x-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusSummary.dot}`}
                ></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusSummary.dot}`}></span>
              </span>
              <span className="font-bold text-xs sm:text-sm tracking-wide">{statusSummary.badge}</span>
            </div>
            {lastSeenAgoSeconds !== null && connectorActive && (
              <span className="text-[11px] opacity-80">
                Ping: {lastSeenAgoSeconds === 0 ? 'Live' : `${lastSeenAgoSeconds}s ago`}
              </span>
            )}
          </div>

          {/* Architecture Status Diagram */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Box 1: Desktop Connector */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center space-x-1.5">
                  <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-bold">PC Connector</span>
                </span>
                {connectorActive ? (
                  <span className="text-emerald-400 flex items-center space-x-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>ONLINE</span>
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center space-x-1 font-bold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>OFFLINE</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {connectorActive
                  ? `Heartbeating to Airbound (${lastSeenAgoSeconds !== null ? `${lastSeenAgoSeconds}s ago` : 'Active'})`
                  : 'Run start-connector.bat on your flight sim PC'}
              </p>
            </div>

            {/* Box 2: MSFS SimConnect */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center space-x-1.5">
                  <Plane className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-bold">SimConnect (MSFS)</span>
                </span>
                {simConnected ? (
                  <span className="text-emerald-400 flex items-center space-x-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>LINKED</span>
                  </span>
                ) : connectorActive ? (
                  <span className="text-amber-400 flex items-center space-x-1 font-bold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>WAITING</span>
                  </span>
                ) : (
                  <span className="text-slate-500 font-bold">IDLE</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {simConnected
                  ? `${app || 'MSFS 2024'} active`
                  : connectorActive
                  ? 'Waiting for simulator to launch'
                  : 'Requires running simulator'}
              </p>
            </div>
          </div>

          {/* Active Detected Aircraft */}
          {simAircraftTitle && (
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Active MSFS Airframe:</span>
              <span className="font-bold text-cyan-300 truncate max-w-[240px]">{simAircraftTitle}</span>
            </div>
          )}

          {/* Step-by-Step Connection Instructions */}
          <div className="space-y-2.5 pt-1">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>How to Link Your Simulator</span>
            </h4>

            <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside bg-slate-950/50 p-3.5 rounded-xl border border-slate-800">
              <li>
                <strong className="text-slate-200">Start MSFS:</strong> Launch MSFS 2020 / 2024 and spawn at your departure airport.
              </li>
              <li>
                <strong className="text-slate-200">Start Connector:</strong> Double-click{' '}
                <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">
                  connector/start-connector.bat
                </code>{' '}
                on your PC.
              </li>
              <li>
                <strong className="text-slate-200">Telemetry Linked:</strong> Real-time altitude, airspeed, and GPS coordinates sync to the cloud automatically!
              </li>
            </ol>

            {/* Quick Terminal Command */}
            <div className="relative group">
              <div className="p-2.5 rounded-lg bg-black/60 border border-slate-800 text-[11px] text-cyan-400 flex items-center justify-between">
                <code>cd connector && npm start</code>
                <button
                  type="button"
                  onClick={handleCopyCommand}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center space-x-1 transition"
                  title="Copy command to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConnectorStatusModal;
