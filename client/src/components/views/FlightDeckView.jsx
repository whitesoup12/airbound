import React from 'react';
import TelemetryDashboard from '../TelemetryDashboard.jsx';
import FlightMap from '../FlightMap.jsx';
import { Plane, Compass, ArrowRight, Radio, FileText } from 'lucide-react';

export function FlightDeckView({
  telemetry,
  phase,
  activeJob,
  aircraftValidation,
  destDist,
  originDist,
  onCancelJob,
  pilot,
  currentAirport,
  allAirports,
  onAcceptJob,
  onSwitchToDispatch,
  onOpenCareer,
  connectionStatus,
  onOpenConnectorStatus,
  onCompleteFlight,
  onOpenCharts
}) {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Flight Telemetry Instruments & Active Mission Card */}
      <TelemetryDashboard
        telemetry={telemetry}
        phase={phase}
        activeJob={activeJob}
        aircraftValidation={aircraftValidation}
        destDist={destDist}
        originDist={originDist}
        onCancelJob={onCancelJob}
        pilot={pilot}
        allAirports={allAirports}
        onOpenCareer={onOpenCareer}
        connectionStatus={connectionStatus}
        onOpenConnectorStatus={onOpenConnectorStatus}
        onCompleteFlight={onCompleteFlight}
        onOpenCharts={onOpenCharts}
      />

      {/* No Active Contract Banner */}
      {!activeJob && (
        <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-cyan-800/40 bg-gradient-to-r from-cyan-950/30 via-slate-900/60 to-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold font-mono text-white">
                NO ACTIVE CONTRACT ACCEPTED
              </h4>
              <p className="text-xs text-slate-400">
                You are currently parked at <strong className="text-cyan-300">{pilot?.current_icao || 'KLAX'}</strong> in your <strong className="text-white">{pilot?.active_aircraft?.name || 'Cessna 172'}</strong>. Select a contract to generate a flight plan.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenCharts && (
              <button
                type="button"
                onClick={() => onOpenCharts(pilot?.current_icao || 'KLAX')}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs font-bold transition flex items-center space-x-1.5 border border-slate-700 hover:border-cyan-500 cursor-pointer"
                title="Open airport charts & taxi diagram"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>AIRFIELD CHARTS</span>
              </button>
            )}

            {onSwitchToDispatch && (
              <button
                onClick={onSwitchToDispatch}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition flex items-center space-x-2 shadow-lg shadow-cyan-600/30 whitespace-nowrap"
              >
                <span>BROWSE DISPATCH CONTRACTS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Full-Screen Tactical Radar Map */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-mono uppercase tracking-wider text-slate-300 font-bold">
              TACTICAL FLIGHT RADAR & AIRSPACE
            </h3>
            {/* Quick Chart Triggers */}
            {onOpenCharts && (
              <div className="hidden sm:flex items-center space-x-1.5 ml-2">
                <button
                  type="button"
                  onClick={() => onOpenCharts(activeJob?.origin_icao || pilot?.current_icao || 'KLAX')}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 hover:bg-cyan-950 text-cyan-300 border border-slate-700 hover:border-cyan-500 transition flex items-center space-x-1 cursor-pointer"
                  title="View Departure Airport Charts & Diagrams"
                >
                  <FileText className="w-2.5 h-2.5 text-cyan-400" />
                  <span>DEP CHARTS ({activeJob?.origin_icao || pilot?.current_icao || 'KLAX'})</span>
                </button>
                {activeJob?.destination_icao && (
                  <button
                    type="button"
                    onClick={() => onOpenCharts(activeJob.destination_icao, activeJob.destination_airport?.name || activeJob.destination_name)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 transition flex items-center space-x-1 cursor-pointer"
                    title="View Destination Airport Approach Plates & Diagrams"
                  >
                    <FileText className="w-2.5 h-2.5 text-cyan-400" />
                    <span>DEST CHARTS ({activeJob.destination_icao})</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <span className="text-xs font-mono text-cyan-400">
            {telemetry?.simOnGround ? 'GROUND TAXI MODE' : 'AIRBORNE RADAR ACTIVE'}
          </span>
        </div>

        <FlightMap
          telemetry={telemetry}
          activeJob={activeJob}
          currentAirport={currentAirport}
          onAcceptJob={onAcceptJob}
          visitedAirports={pilot?.visited_airports || []}
          allAirports={allAirports}
          onOpenCharts={onOpenCharts}
          heightClass="h-[620px]"
        />
      </div>
    </div>
  );
}

export default FlightDeckView;

