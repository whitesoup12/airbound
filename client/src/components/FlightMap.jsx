import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Plane, MapPin, CheckCircle, Navigation, Layers } from 'lucide-react';

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

// Marker icon for visited airports
function createAirportIcon(type = 'visited') {
  let bg = 'bg-purple-950 border-purple-500 text-purple-400';
  let label = 'VISITED';
  if (type === 'origin') {
    bg = 'bg-emerald-950 border-emerald-500 text-emerald-400';
    label = 'ORIGIN';
  } else if (type === 'destination') {
    bg = 'bg-amber-950 border-amber-500 text-amber-400';
    label = 'DEST';
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

export function FlightMap({ telemetry, activeJob, visitedAirports = [], allAirports = [] }) {
  const [followAircraft, setFollowAircraft] = useState(true);

  const aircraftPos = [telemetry?.latitude || 33.9425, telemetry?.longitude || -118.4081];
  const aircraftHeading = telemetry?.heading || 0;
  const isAirborne = !telemetry?.simOnGround;

  // Compute flight route coordinates
  const origCoords = activeJob?.origin_airport?.location?.coordinates ||
    activeJob?.origin_location?.coordinates;
  const destCoords = activeJob?.destination_airport?.location?.coordinates ||
    activeJob?.destination_location?.coordinates;

  let routeLine = null;
  if (origCoords && destCoords) {
    routeLine = [
      [origCoords[1], origCoords[0]],
      [destCoords[1], destCoords[0]]
    ];
  }

  // Filter visited airports from all airports list
  const visitedAirportObjects = allAirports.filter((a) =>
    visitedAirports.includes(a.icao)
  );

  return (
    <div className="relative w-full h-[520px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl glass-panel">
      {/* Map Header Overlay Controls */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center space-x-2 bg-slate-950/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 text-xs font-mono">
        <button
          onClick={() => setFollowAircraft(!followAircraft)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
            followAircraft
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Navigation className={`w-3.5 h-3.5 ${followAircraft ? 'text-cyan-400 animate-spin' : ''}`} />
          <span>{followAircraft ? 'LOCKED ON AIRCRAFT' : 'FREE CAM'}</span>
        </button>

        <div className="hidden sm:flex items-center space-x-3 px-2 text-slate-400 text-[11px]">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>Origin</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Destination</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            <span>Visited ({visitedAirports.length})</span>
          </div>
        </div>
      </div>

      <MapContainer
        center={aircraftPos}
        zoom={7}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        {/* Dark Avionics Tile Layer */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={18}
        />

        <MapRecenter center={aircraftPos} followAircraft={followAircraft} />

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

        {/* Active Route Line */}
        {routeLine && (
          <>
            <Polyline
              positions={routeLine}
              pathOptions={{
                color: '#06b6d4',
                weight: 3,
                dashArray: '6, 8',
                opacity: 0.8
              }}
            />
            {/* Origin Marker */}
            <Marker
              position={[origCoords[1], origCoords[0]]}
              icon={createAirportIcon('origin')}
            >
              <Popup>
                <div className="p-1 font-mono text-xs text-slate-900">
                  <p className="font-bold text-emerald-700">ORIGIN: {activeJob?.origin_icao}</p>
                  <p>{activeJob?.origin_airport?.name}</p>
                </div>
              </Popup>
            </Marker>

            {/* Destination Marker */}
            <Marker
              position={[destCoords[1], destCoords[0]]}
              icon={createAirportIcon('destination')}
            >
              <Popup>
                <div className="p-1 font-mono text-xs text-slate-900">
                  <p className="font-bold text-amber-700">DESTINATION: {activeJob?.destination_icao}</p>
                  <p>{activeJob?.destination_airport?.name}</p>
                  <p>Runway: {activeJob?.destination_airport?.longest_runway_ft} ft</p>
                  <p>Payout: ${activeJob?.payout?.toLocaleString()}</p>
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
          if (airport.icao === activeJob?.origin_icao || airport.icao === activeJob?.destination_icao) {
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
  );
}

export default FlightMap;
