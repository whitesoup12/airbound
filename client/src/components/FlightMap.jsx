import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { Plane, MapPin, CheckCircle, Navigation, Layers, ArrowRight, DollarSign } from 'lucide-react';

// Controller to auto-center the map on the aircraft when "Follow Aircraft" is active
function MapRecenter({ center, followAircraft }) {
  const map = useMap();
  useEffect(() => {
    if (followAircraft && center && center[0] && center[1]) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, followAircraft, map]);
  return null;
}

// Controller to fit route bounds on preview selection
function MapBoundsFitter({ bounds, shouldFit }) {
  const map = useMap();
  useEffect(() => {
    if (shouldFit && bounds && bounds.length === 2 && bounds[0] && bounds[1]) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 9, animate: true });
    }
  }, [bounds, shouldFit, map]);
  return null;
}

// Custom Leaflet DivIcon for the aircraft with dynamic heading rotation
function createAircraftIcon(heading = 0, isAirborne = false) {
  return L.divIcon({
    className: 'custom-aircraft-marker',
    html: `
      <div style="transform: rotate(${heading}deg); transition: transform 0.4s ease;" class="relative flex items-center justify-center w-10 h-10">
        <div class="absolute inset-0 rounded-full ${isAirborne ? 'bg-cyan-500/20 animate-ping' : ''}"></div>
        <div class="w-8 h-8 rounded-full bg-slate-950 border-2 border-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/50">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#06b6d4" class="w-5 h-5">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}

// Marker icon for visited, origin, or destination airports
function createAirportIcon(type = 'visited') {
  let bg = 'bg-purple-950 border-purple-500 text-purple-400';
  if (type === 'origin') {
    bg = 'bg-emerald-950 border-emerald-500 text-emerald-400';
  } else if (type === 'destination') {
    bg = 'bg-amber-950 border-amber-500 text-amber-400';
  } else if (type === 'preview') {
    bg = 'bg-cyan-950 border-cyan-400 text-cyan-300';
  }

  return L.divIcon({
    className: 'custom-airport-marker',
    html: `
      <div class="relative flex flex-col items-center">
        <div class="w-7 h-7 rounded-lg ${bg} border-2 flex items-center justify-center shadow-lg text-xs font-mono font-bold">
          ✈
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

export function FlightMap({
  telemetry,
  activeJob,
  previewJob = null,
  visitedAirports = [],
  allAirports = [],
  currentAirport = null,
  onAcceptJob = null
}) {
  const [followAircraft, setFollowAircraft] = useState(true);

  const aircraftPos = [telemetry?.latitude || 33.9425, telemetry?.longitude || -118.4081];
  const aircraftHeading = telemetry?.heading || 0;
  const isAirborne = !telemetry?.simOnGround;

  // Determine active route vs preview route
  const displayedJob = activeJob || previewJob;
  const isPreview = !activeJob && Boolean(previewJob);

  // Compute flight route coordinates
  const origCoords =
    displayedJob?.origin_airport?.location?.coordinates ||
    currentAirport?.location?.coordinates ||
    [telemetry?.longitude || -118.408, telemetry?.latitude || 33.942];

  const destCoords =
    displayedJob?.destination_airport?.location?.coordinates ||
    displayedJob?.destination_location?.coordinates;

  let routeLine = null;
  let routeBounds = null;
  if (origCoords && destCoords) {
    routeLine = [
      [origCoords[1], origCoords[0]],
      [destCoords[1], destCoords[0]]
    ];
    routeBounds = [
      [origCoords[1], origCoords[0]],
      [destCoords[1], destCoords[0]]
    ];
  }

  // Filter visited airports from all airports list
  const visitedAirportObjects = allAirports.filter((a) =>
    visitedAirports.includes(a.icao)
  );

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl glass-panel bg-slate-950 flex flex-col">
      {/* Dedicated Tactical Radar Toolbar */}
      <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => setFollowAircraft(!followAircraft)}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg font-bold transition shadow-sm ${
              followAircraft
                ? 'bg-cyan-500 text-slate-950 border border-cyan-400 shadow-cyan-500/30'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            <Navigation className={`w-3.5 h-3.5 ${followAircraft ? 'text-slate-950 animate-spin' : 'text-slate-400'}`} />
            <span>{followAircraft ? 'LOCKED ON AIRCRAFT' : 'FREE CAM'}</span>
          </button>

          {/* Route Preview Badge in Toolbar */}
          {isPreview && displayedJob && (
            <div className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-500/50 text-amber-300 text-[11px] shadow-sm animate-fadeIn">
              <span className="font-bold">PREVIEW:</span>
              <span>
                {displayedJob.origin_icao} ➔ {displayedJob.destination_icao} ({displayedJob.distance_nm} NM)
              </span>
              {onAcceptJob && (
                <button
                  onClick={() => onAcceptJob(displayedJob._id)}
                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition ml-1 flex items-center space-x-0.5"
                >
                  <span>Accept (${displayedJob.payout?.toLocaleString()})</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Waypoint Legend */}
        <div className="flex items-center space-x-4 text-[11px] text-slate-300">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            <span>Origin</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isPreview ? 'bg-cyan-400 shadow-cyan-400/50' : 'bg-amber-400 shadow-amber-400/50'} shadow-sm`} />
            <span>{isPreview ? 'Preview Dest' : 'Destination'}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
            <span>Visited ({visitedAirports.length})</span>
          </div>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="w-full h-[480px]">
        <MapContainer
          center={aircraftPos}
          zoom={7}
          zoomControl={false}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          <ZoomControl position="bottomright" />
          {/* Dark Avionics Tile Layer */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxZoom={18}
          />

          <MapRecenter center={aircraftPos} followAircraft={followAircraft} />
          {/* Fit route when preview job is chosen and user is not locked on aircraft */}
          <MapBoundsFitter bounds={routeBounds} shouldFit={!followAircraft && Boolean(routeBounds)} />

          {/* Live Aircraft Marker */}
          <Marker
            position={aircraftPos}
            icon={createAircraftIcon(aircraftHeading, isAirborne)}
            zIndexOffset={1000}
          >
            <Popup className="avionics-popup">
              <div className="p-1 font-mono text-xs text-slate-900">
                <p className="font-bold text-cyan-700">AIRCRAFT POSITION</p>
                <p>Alt: {Math.round(telemetry?.altitude || 0)} FT</p>
                <p>GS: {Math.round(telemetry?.groundSpeed || 0)} KTS</p>
                <p>HDG: {Math.round(telemetry?.heading || 0)}°</p>
                <p>Lat: {telemetry?.latitude?.toFixed(4)}</p>
                <p>Lon: {telemetry?.longitude?.toFixed(4)}</p>
              </div>
            </Popup>
          </Marker>

          {/* Route Line (Active or Preview) */}
          {routeLine && (
            <>
              <Polyline
                positions={routeLine}
                pathOptions={{
                  color: isPreview ? '#f59e0b' : '#06b6d4',
                  weight: isPreview ? 3.5 : 3,
                  dashArray: isPreview ? '8, 8' : '6, 8',
                  opacity: isPreview ? 0.95 : 0.8
                }}
              />
              {/* Origin Marker */}
              <Marker
                position={[origCoords[1], origCoords[0]]}
                icon={createAirportIcon('origin')}
              >
                <Popup>
                  <div className="p-1 font-mono text-xs text-slate-900">
                    <p className="font-bold text-emerald-700">ORIGIN: {displayedJob?.origin_icao}</p>
                    <p>{displayedJob?.origin_airport?.name || currentAirport?.name || displayedJob?.origin_icao}</p>
                  </div>
                </Popup>
              </Marker>

              {/* Destination Marker */}
              <Marker
                position={[destCoords[1], destCoords[0]]}
                icon={createAirportIcon(isPreview ? 'preview' : 'destination')}
              >
                <Popup>
                  <div className="p-1 font-mono text-xs text-slate-900 min-w-[180px]">
                    <div className="flex items-center justify-between border-b pb-1 mb-1">
                      <p className="font-bold text-amber-700">
                        {isPreview ? 'ROUTE PREVIEW' : 'DESTINATION'}: {displayedJob?.destination_icao}
                      </p>
                    </div>
                    <p className="font-bold">{displayedJob?.destination_name || displayedJob?.destination_airport?.name}</p>
                    <p>{displayedJob?.destination_city ? `${displayedJob.destination_city}, ` : ''}{displayedJob?.destination_country || displayedJob?.destination_airport?.country}</p>
                    <p>Distance: {displayedJob?.distance_nm} NM</p>
                    <p>Runway: {displayedJob?.destination_runway_ft?.toLocaleString() || displayedJob?.destination_airport?.longest_runway_ft?.toLocaleString()} ft</p>
                    <p>Payload: {displayedJob?.cargo_lbs?.toLocaleString()} lbs cargo • {displayedJob?.pax_count} pax</p>
                    <p className="font-bold text-emerald-700 mt-1">Payout: ${displayedJob?.payout?.toLocaleString()}</p>
                    {isPreview && onAcceptJob && (
                      <button
                        onClick={() => onAcceptJob(displayedJob._id)}
                        className="mt-2 w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs transition"
                      >
                        Accept Contract
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            </>
          )}

          {/* Visited Airports Markers */}
          {visitedAirportObjects.map((airport) => {
            if (!airport.location?.coordinates) return null;
            const [lon, lat] = airport.location.coordinates;
            // Skip if already drawn as origin or destination
            if (
              airport.icao === displayedJob?.origin_icao ||
              airport.icao === displayedJob?.destination_icao
            ) {
              return null;
            }

            return (
              <Marker
                key={airport.icao}
                position={[lat, lon]}
                icon={createAirportIcon('visited')}
              >
                <Popup>
                  <div className="p-1 font-mono text-xs text-slate-900">
                    <p className="font-bold text-purple-700">VISITED AIRPORT</p>
                    <p className="font-bold">{airport.icao} — {airport.name}</p>
                    <p>{airport.city}, {airport.country}</p>
                    <p>Longest Runway: {airport.longest_runway_ft?.toLocaleString()} ft</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

export default FlightMap;
