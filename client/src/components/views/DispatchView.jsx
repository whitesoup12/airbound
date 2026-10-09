import React, { useState } from 'react';
import JobBoard from '../JobBoard.jsx';
import FlightMap from '../FlightMap.jsx';
import FreeFlightDispatcher from '../FreeFlightDispatcher.jsx';
import WeatherBriefingCard from '../WeatherBriefingCard.jsx';
import {
  MapPin,
  Plane,
  RefreshCw,
  Layers,
  Compass,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  Globe,
  FileText,
  Wind
} from 'lucide-react';

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
  onStartFreeFlight,
  onCancelFreeFlight,
  onOpenCharts,
  loading,
  telemetry
}) {
  const [dispatchTab, setDispatchTab] = useState(
    activeJob?.is_free_flight ? 'free_flight' : 'commercial'
  );
  const [showOriginWeather, setShowOriginWeather] = useState(false);

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
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                DISPATCH ORIGIN AIRPORT
              </span>
              {onOpenChangeBase && (
                <button
                  type="button"
                  onClick={onOpenChangeBase}
                  className="text-xs text-cyan-300 hover:text-white font-mono font-bold px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 hover:border-cyan-400 transition flex items-center space-x-1.5 shadow-sm shadow-cyan-950/50 cursor-pointer"
                  title="Select a different departure airfield and refresh available contracts"
                >
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Change Departure Airport</span>
                </button>
              )}
              {onOpenCharts && (
                <button
                  type="button"
                  onClick={() => onOpenCharts(currentAirport?.icao || currentIcao, currentAirport?.name)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 hover:border-cyan-500 transition flex items-center space-x-1 cursor-pointer"
                  title={`View charts and taxi diagram for ${currentAirport?.icao || currentIcao}`}
                >
                  <FileText className="w-2.5 h-2.5 text-cyan-400" />
                  <span>CHARTS</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowOriginWeather(!showOriginWeather)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition flex items-center space-x-1 cursor-pointer ${
                  showOriginWeather
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:text-cyan-300 border-slate-700 hover:border-cyan-500'
                }`}
                title="Toggle Origin Airport METAR & Runway Analysis"
              >
                <Wind className="w-2.5 h-2.5 text-cyan-400" />
                <span>{showOriginWeather ? 'HIDE WEATHER' : 'WEATHER (METAR)'}</span>
              </button>
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

      {/* Origin Live Weather Briefing & Departure Runway */}
      {showOriginWeather && (
        <WeatherBriefingCard
          icao={currentAirport?.icao || currentIcao}
          airportName={currentAirport?.name}
          type="departure"
          showAllRunwaysDefault={true}
          onOpenCharts={onOpenCharts}
        />
      )}

      {/* Dispatch Operation Mode Switcher Tabs */}
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setDispatchTab('commercial')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
            dispatchTab === 'commercial'
              ? 'bg-amber-500/20 border border-amber-500/60 text-amber-300 shadow-lg shadow-amber-950/40'
              : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Briefcase className="w-4 h-4 text-amber-400" />
          <span>COMMERCIAL CONTRACTS</span>
          {jobs?.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-950 border border-amber-800 text-amber-300">
              {jobs.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setDispatchTab('free_flight')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
            dispatchTab === 'free_flight'
              ? 'bg-cyan-500/20 border border-cyan-500/60 text-cyan-300 shadow-lg shadow-cyan-950/40'
              : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Globe className="w-4 h-4 text-cyan-400" />
          <span>FREE FLIGHT DISPATCHER</span>
          {activeJob?.is_free_flight && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-950 border border-cyan-700 text-cyan-300 font-bold animate-pulse">
              ACTIVE
            </span>
          )}
        </button>
      </div>

      {dispatchTab === 'commercial' ? (
        <>
          {/* Interactive Route Preview Map */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center space-x-2">
                <Compass className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-mono uppercase tracking-wider text-slate-300 font-bold">
                  ROUTE PLANNING & DESTINATION RADAR
                </h3>
                {(activeJob || previewJob) && onOpenCharts && (
                  <button
                    type="button"
                    onClick={() => {
                      const t = activeJob || previewJob;
                      onOpenCharts(t.destination_icao, t.destination_name);
                    }}
                    className="ml-2 px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 transition flex items-center space-x-1 cursor-pointer"
                    title={`View charts for ${(activeJob || previewJob).destination_icao}`}
                  >
                    <FileText className="w-2.5 h-2.5 text-cyan-400" />
                    <span>CHARTS ({(activeJob || previewJob).destination_icao})</span>
                  </button>
                )}
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
              onOpenCharts={onOpenCharts}
              heightClass="h-[380px]"
            />

            {/* Destination Live Weather & Recommended Arrival Runway */}
            {(activeJob || previewJob) && (
              <WeatherBriefingCard
                icao={(activeJob || previewJob).destination_icao}
                airportName={(activeJob || previewJob).destination_name || (activeJob || previewJob).destination_airport?.name}
                type="arrival"
                onOpenCharts={onOpenCharts}
              />
            )}
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
            onOpenCharts={onOpenCharts}
            loading={loading}
          />
        </>
      ) : (
        /* Free Flight Dispatcher Setup Card (Open Roam only) */
        <FreeFlightDispatcher
          activeJob={activeJob}
          onStartFreeFlight={onStartFreeFlight}
          onCancelFreeFlight={onCancelFreeFlight}
          loading={loading}
        />
      )}
    </div>
  );
}

export default DispatchView;
