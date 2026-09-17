import React, { useState, useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
  ZoomControl
} from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin,
  Layers,
  Maximize2,
  Navigation,
  Globe,
  Compass,
  Plane
} from 'lucide-react';

// Controller to auto-fit bounds on visited airports
function MapBoundsFitter({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10, animate: true });
    }
  }, [points, map]);
  return null;
}

// Custom DivIcon for Home Base
function createHomeBaseIcon(icao) {
  return L.divIcon({
    className: 'custom-home-base-marker',
    html: `
      <div class="relative flex flex-col items-center">
        <div class="w-8 h-8 rounded-xl bg-cyan-950 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 font-mono font-bold text-xs shadow-lg shadow-cyan-500/40">
          ★
        </div>
        <div class="mt-0.5 px-1.5 py-0.2 rounded bg-slate-950/90 border border-cyan-500/80 text-[10px] font-mono font-bold text-cyan-300 whitespace-nowrap shadow-md">
          ${icao}
        </div>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 21]
  });
}

export function VisitedAirportsMap({
  visitedAirports = [],
  visitedAirportDocs = [],
  allAirports = [],
  flightLog = [],
  homeBaseIcao = 'KXNA'
}) {
  const [showRoutes, setShowRoutes] = useState(false);
  const [activeAirport, setActiveAirport] = useState(null);

  // Merge visited airport coordinates lookup
  const airportMap = useMemo(() => {
    const map = new Map();

    // From allAirports
    for (const a of allAirports) {
      if (a.icao && a.location?.coordinates) {
        map.set(a.icao.toUpperCase(), {
          icao: a.icao.toUpperCase(),
          name: a.name || a.icao,
          city: a.city || '',
          country: a.country || '',
          longest_runway_ft: a.longest_runway_ft || 0,
          lat: a.location.coordinates[1],
          lon: a.location.coordinates[0]
        });
      }
    }

    // From visitedAirportDocs (higher priority)
    for (const a of visitedAirportDocs) {
      if (a.icao && a.location?.coordinates) {
        map.set(a.icao.toUpperCase(), {
          icao: a.icao.toUpperCase(),
          name: a.name || a.icao,
          city: a.city || '',
          country: a.country || '',
          longest_runway_ft: a.longest_runway_ft || 0,
          lat: a.location.coordinates[1],
          lon: a.location.coordinates[0]
        });
      }
    }

    return map;
  }, [allAirports, visitedAirportDocs]);

  // Compute flight frequencies per airport
  const flightCounts = useMemo(() => {
    const counts = new Map();
    for (const f of flightLog) {
      if (f.origin_icao) {
        const orig = f.origin_icao.toUpperCase();
        counts.set(orig, (counts.get(orig) || 0) + 1);
      }
      if (f.destination_icao && f.destination_icao !== f.origin_icao) {
        const dest = f.destination_icao.toUpperCase();
        counts.set(dest, (counts.get(dest) || 0) + 1);
      }
    }
    return counts;
  }, [flightLog]);

  // Plottable airport list
  const plottableAirports = useMemo(() => {
    const list = [];
    for (const icao of visitedAirports) {
      const code = icao.toUpperCase();
      const info = airportMap.get(code);
      if (info) {
        list.push({
          ...info,
          isHomeBase: code === homeBaseIcao.toUpperCase(),
          flightCount: flightCounts.get(code) || 1
        });
      }
    }
    return list;
  }, [visitedAirports, airportMap, homeBaseIcao, flightCounts]);

  // Plottable unique flight routes
  const routeLines = useMemo(() => {
    const uniquePairs = new Set();
    const lines = [];

    for (const f of flightLog) {
      if (!f.origin_icao || !f.destination_icao || f.origin_icao === f.destination_icao) continue;
      const orig = f.origin_icao.toUpperCase();
      const dest = f.destination_icao.toUpperCase();
      const pairKey = [orig, dest].sort().join('-');

      if (uniquePairs.has(pairKey)) continue;
      uniquePairs.add(pairKey);

      const p1 = airportMap.get(orig);
      const p2 = airportMap.get(dest);

      if (p1 && p2) {
        lines.push({
          id: pairKey,
          from: orig,
          to: dest,
          positions: [
            [p1.lat, p1.lon],
            [p2.lat, p2.lon]
          ]
        });
      }
    }

    return lines;
  }, [flightLog, airportMap]);

  // Default fallback center
  const initialCenter = useMemo(() => {
    const home = airportMap.get(homeBaseIcao.toUpperCase());
    if (home) return [home.lat, home.lon];
    if (plottableAirports.length > 0) return [plottableAirports[0].lat, plottableAirports[0].lon];
    return [36.2818, -94.3068]; // KXNA
  }, [airportMap, homeBaseIcao, plottableAirports]);

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl flex flex-col">
      {/* Map Header Toolbar */}
      <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-white tracking-wide">VISITED AIRPORTS & ROUTE NETWORK</h4>
            <p className="text-[11px] text-slate-400">
              {plottableAirports.length} Airfields Plotted • {routeLines.length} Unique Route Lines
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Toggle Route Network */}
          <button
            type="button"
            onClick={() => setShowRoutes(!showRoutes)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border transition ${
              showRoutes
                ? 'bg-purple-950 text-purple-300 border-purple-700 font-bold'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showRoutes ? 'Routes Visible' : 'Routes Hidden'}</span>
          </button>

          {/* Home Base Indicator */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/70 border border-cyan-800 text-cyan-300 text-[11px]">
            <span>Base:</span>
            <strong>{homeBaseIcao}</strong>
          </div>
        </div>
      </div>

      {/* Leaflet Canvas Container */}
      <div className="w-full h-[420px] relative">
        <MapContainer
          center={initialCenter}
          zoom={5}
          zoomControl={false}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          <ZoomControl position="bottomright" />

          {/* Dark Aviation Tile Layer */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxZoom={18}
          />

          {/* Auto-fit map bounds across all visited airfields */}
          <MapBoundsFitter points={plottableAirports} />

          {/* Route Network Lines */}
          {showRoutes &&
            routeLines.map((route) => (
              <Polyline
                key={route.id}
                positions={route.positions}
                pathOptions={{
                  color: '#a855f7',
                  weight: 1.5,
                  opacity: 0.38,
                  dashArray: '4, 6'
                }}
              />
            ))}

          {/* Visited Airport Markers */}
          {plottableAirports.map((airport) => {
            if (airport.isHomeBase) {
              return (
                <Marker
                  key={airport.icao}
                  position={[airport.lat, airport.lon]}
                  icon={createHomeBaseIcon(airport.icao)}
                >
                  <Popup>
                    <div className="p-1 font-mono text-xs text-slate-900">
                      <p className="font-bold text-cyan-700 text-sm flex items-center space-x-1">
                        <span>★ HOME BASE: {airport.icao}</span>
                      </p>
                      <p className="font-semibold">{airport.name}</p>
                      <p className="text-slate-600">
                        {airport.city ? `${airport.city}, ` : ''}{airport.country}
                      </p>
                      {airport.longest_runway_ft > 0 && (
                        <p className="mt-1 text-slate-700">
                          Runway: <strong>{airport.longest_runway_ft.toLocaleString()} ft</strong>
                        </p>
                      )}
                      <p className="text-purple-700 font-bold mt-1">
                        Flights Logged: {airport.flightCount}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              );
            }

            return (
              <CircleMarker
                key={airport.icao}
                center={[airport.lat, airport.lon]}
                radius={airport.flightCount > 5 ? 6 : 4.5}
                pathOptions={{
                  color: '#c084fc',
                  fillColor: '#9333ea',
                  fillOpacity: 0.75,
                  weight: 1.5
                }}
              >
                <Popup>
                  <div className="p-1 font-mono text-xs text-slate-900">
                    <p className="font-bold text-purple-700 text-sm">{airport.icao}</p>
                    <p className="font-semibold">{airport.name}</p>
                    <p className="text-slate-600">
                      {airport.city ? `${airport.city}, ` : ''}{airport.country}
                    </p>
                    {airport.longest_runway_ft > 0 && (
                      <p className="mt-1 text-slate-700">
                        Longest Runway: <strong>{airport.longest_runway_ft.toLocaleString()} ft</strong>
                      </p>
                    )}
                    <p className="text-purple-700 font-bold mt-1">
                      Flights Logged: {airport.flightCount}
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

export default VisitedAirportsMap;

