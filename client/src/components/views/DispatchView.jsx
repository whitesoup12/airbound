import React from 'react';
import JobBoard from '../JobBoard.jsx';
import FlightMap from '../FlightMap.jsx';
import { MapPin, Plane, RefreshCw, Layers, Compass, ArrowRight, ShieldCheck } from 'lucide-react';

export function DispatchView({
  jobs,
  activeJob,
  previewJob,
  currentIcao,
  currentAirport,
  allAirports,
  pilot,
  onSelectJob,
  onAcceptJob,
  onRefreshJobs,
  onOpenChangeBase,
  loading,
  telemetry
}) {
  const activeAircraft = {
    name: pilot?.active_aircraft?.name || 'Cessna 172 Skyhawk',
    tail_number: pilot?.active_aircraft?.tail_number || 'N172AB',
    category: pilot?.active_aircraft?.category || 'single_prop',
    is_rental: Boolean(pilot?.active_aircraft?.is_rental),
    rental_price_per_flight: pilot?.active_aircraft?.rental_price_per_flight || 0,
    rental_flights_paid: pilot?.active_aircraft?.rental_flights_paid ?? 0,
    is_loaner: Boolean(pilot?.active_aircraft?.is_loaner),
    cruise_speed_kts: pilot?.active_aircraft?.cruise_speed_kts || 120,
    fuel_burn_gph: pilot?.active_aircraft?.fuel_burn_gph || 9.0,
    fuel_type: pilot?.active_aircraft?.fuel_type || '100LL',
    max_cargo_lbs: pilot?.active_aircraft?.max_cargo_lbs || 500,
    max_pax: pilot?.active_aircraft?.max_pax || 3,
    max_range_nm: pilot?.active_aircraft?.max_range_nm || 500
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Dispatch Station Header */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800/90 bg-slate-900/60 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-cyan-950/70 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shadow-md">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                DISPATCH ORIGIN AIRPORT
              </span>
              {onOpenChangeBase && (
                <button
                  onClick={onOpenChangeBase}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 hover:border-cyan-500 transition"
                  title="Change departure base"
                >
                  Change Base
                </button>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white font-mono tracking-wide">
              {currentAirport ? `${currentAirport.name} (${currentAirport.icao})` : currentIcao}
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              {currentAirport?.city ? `${currentAirport.city}, ${currentAirport.country}` : 'Active Location'} • Runway:{' '}
              <strong className="text-slate-200">{currentAirport?.longest_runway_ft?.toLocaleString() || 5000} ft</strong>
            </p>
          </div>
        </div>

        {/* Active Aircraft Capabilities Pill */}
        <div className="flex items-center space-x-3 bg-slate-950/70 px-4 py-2.5 rounded-xl border border-slate-800 text-xs font-mono">
          <Plane className="w-4 h-4 text-amber-400" />
          <div>
            <span className="text-slate-400 block text-[10px]">CURRENT COCKPIT PLANE:</span>
            <span className="text-amber-300 font-bold">
              {activeAircraft.name} ({activeAircraft.tail_number})
            </span>
          </div>
          <div className="hidden lg:flex items-center space-x-2 pl-3 border-l border-slate-800 text-[11px] text-slate-400">
            <span>Cruise: <strong className="text-white">{activeAircraft.cruise_speed_kts} KTS</strong></span>
            <span>• Burn: <strong className="text-white">{activeAircraft.fuel_burn_gph} GPH ({activeAircraft.fuel_type})</strong></span>
            <span>• Range: <strong className="text-white">{activeAircraft.max_range_nm} NM</strong></span>
          </div>
        </div>
      </div>

      {/* Interactive Route Preview Map */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <Compass className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-mono uppercase tracking-wider text-slate-300 font-bold">
              ROUTE PLANNING & DESTINATION RADAR
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Select a contract below to preview flight path
          </span>
        </div>

        <FlightMap
          telemetry={telemetry}
          activeJob={activeJob}
          previewJob={previewJob}
          currentAirport={currentAirport}
          onAcceptJob={onAcceptJob}
          visitedAirports={pilot?.visited_airports || []}
          allAirports={allAirports}
          activeAircraft={activeAircraft}
          heightClass="h-[380px]"
        />
      </div>

      {/* Job Dispatch Board */}
      <JobBoard
        jobs={jobs}
        activeJob={activeJob}
        currentIcao={currentIcao}
        selectedJobId={activeJob?._id || previewJob?._id}
        activeAircraft={activeAircraft}
        pilot={pilot}
        onSelectJob={onSelectJob}
        onAcceptJob={onAcceptJob}
        onRefreshJobs={onRefreshJobs}
        loading={loading}
      />
    </div>
  );
}

export default DispatchView;

