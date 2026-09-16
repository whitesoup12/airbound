import React, { useState } from 'react';
import {
  Sliders,
  Play,
  Square,
  ChevronUp,
  ChevronDown,
  Navigation,
  Compass,
  FastForward,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import {
  stepFlightPhase,
  startMockFlight,
  stopMockFlight,
  teleportToAirport
} from '../api/client.js';

export function SimulatorControlBar({
  currentPhase,
  activeJob,
  isMock,
  onPhaseStepSuccess
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAutoFlying, setIsAutoFlying] = useState(false);
  const [teleportIcao, setTeleportIcao] = useState('KLAX');
  const [speedMultiplier, setSpeedMultiplier] = useState(5.0);
  const [statusMsg, setStatusMsg] = useState('');

  const handleStep = async (phase) => {
    try {
      setStatusMsg(`Stepping to ${phase}...`);
      await stepFlightPhase(phase);
      setStatusMsg(`Successfully stepped to ${phase}`);
      if (onPhaseStepSuccess) onPhaseStepSuccess(phase);
    } catch (err) {
      setStatusMsg(`Error: ${err.message}`);
    }
  };

  const handleToggleAutoFlight = async () => {
    if (isAutoFlying) {
      await stopMockFlight();
      setIsAutoFlying(false);
      setStatusMsg('Automated flight stopped.');
    } else {
      if (!activeJob) {
        setStatusMsg('Please accept a contract job before starting auto flight.');
        return;
      }
      await startMockFlight(speedMultiplier);
      setIsAutoFlying(true);
      setStatusMsg(`Auto-fly started at ${speedMultiplier}x speed.`);
    }
  };

  const handleTeleport = async (e) => {
    e.preventDefault();
    if (!teleportIcao) return;
    try {
      await teleportToAirport(teleportIcao);
      setStatusMsg(`Aircraft teleported to ${teleportIcao.toUpperCase()}`);
    } catch (err) {
      setStatusMsg(`Teleport error: ${err.message}`);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 transition-all duration-300">
      {/* Drawer Toggle Tab */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-end">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 px-4 py-1.5 rounded-t-xl bg-slate-900 border-t border-x border-slate-700 text-xs font-mono text-cyan-400 hover:text-cyan-300 shadow-xl"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>SIMULATOR TEST CONTROLS</span>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Drawer Content */}
      {isOpen && (
        <div className="glass-panel border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl p-4 sm:p-5 shadow-2xl">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              {/* State Machine Stepper */}
              <div>
                <span className="text-[11px] font-mono text-slate-400 uppercase block mb-1.5">
                  1-Click Flight Phase State Machine Stepper:
                </span>
                <div className="flex flex-wrap gap-2 font-mono text-xs">
                  <button
                    onClick={() => handleStep('IDLE')}
                    disabled={!activeJob}
                    className={`px-3 py-1.5 rounded-lg border transition ${
                      currentPhase === 'IDLE'
                        ? 'bg-blue-600 text-white border-blue-400'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border-slate-700'
                    }`}
                  >
                    1. IDLE (At Origin)
                  </button>

                  <button
                    onClick={() => handleStep('DEPARTED')}
                    disabled={!activeJob}
                    className={`px-3 py-1.5 rounded-lg border transition ${
                      currentPhase === 'DEPARTED'
                        ? 'bg-amber-600 text-white border-amber-400'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border-slate-700'
                    }`}
                  >
                    2. DEPARTED (Takeoff)
                  </button>

                  <button
                    onClick={() => handleStep('EN ROUTE')}
                    disabled={!activeJob}
                    className={`px-3 py-1.5 rounded-lg border transition ${
                      currentPhase === 'EN ROUTE'
                        ? 'bg-cyan-600 text-white border-cyan-400'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border-slate-700'
                    }`}
                  >
                    3. EN ROUTE (Airborne)
                  </button>

                  <button
                    onClick={() => handleStep('TOUCHDOWN')}
                    disabled={!activeJob}
                    className={`px-3 py-1.5 rounded-lg border transition ${
                      currentPhase === 'TOUCHDOWN'
                        ? 'bg-purple-600 text-white border-purple-400'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border-slate-700'
                    }`}
                  >
                    4. TOUCHDOWN (Destination)
                  </button>

                  <button
                    onClick={() => handleStep('COMPLETED')}
                    disabled={!activeJob}
                    className={`px-3 py-1.5 rounded-lg border transition ${
                      currentPhase === 'COMPLETED'
                        ? 'bg-emerald-600 text-white border-emerald-400'
                        : 'bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900 border-emerald-800'
                    }`}
                  >
                    5. COMPLETED (Shutdown & Persist)
                  </button>
                </div>
              </div>

              {/* Automated Flight & Teleport */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Auto Flight */}
                <div className="flex items-center space-x-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 font-mono text-xs">
                  <button
                    onClick={handleToggleAutoFlight}
                    disabled={!activeJob}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                      isAutoFlying
                        ? 'bg-rose-600 text-white shadow-rose-900/50'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/50'
                    }`}
                  >
                    {isAutoFlying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isAutoFlying ? 'STOP FLIGHT' : 'AUTO-FLY ROUTE'}</span>
                  </button>

                  <select
                    value={speedMultiplier}
                    onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
                    className="bg-slate-950 text-slate-300 px-2 py-1.5 rounded-lg border border-slate-800 text-xs font-mono"
                  >
                    <option value={1.0}>1x Speed</option>
                    <option value={3.0}>3x Speed</option>
                    <option value={6.0}>6x Speed</option>
                    <option value={12.0}>12x Speed</option>
                  </select>
                </div>

                {/* Teleport form */}
                <form onSubmit={handleTeleport} className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    value={teleportIcao}
                    onChange={(e) => setTeleportIcao(e.target.value.toUpperCase())}
                    placeholder="ICAO"
                    maxLength={4}
                    className="w-20 px-2.5 py-1.5 bg-slate-900 text-white font-mono text-xs rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500 uppercase"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-xl border border-slate-700 transition"
                  >
                    Teleport
                  </button>
                </form>
              </div>
            </div>

            {/* Status notification bar */}
            {statusMsg && (
              <p className="mt-2 text-xs font-mono text-cyan-400 bg-cyan-950/40 px-3 py-1 rounded-lg border border-cyan-800/40 inline-block">
                {statusMsg}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SimulatorControlBar;

