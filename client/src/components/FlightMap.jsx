import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  Polyline,
  useMap,
  ZoomControl
} from 'react-leaflet';
import L from 'leaflet';
import {
  Plane,
  MapPin,
  CheckCircle,
  Navigation,
  Layers,
  ArrowRight,
  DollarSign,
  Maximize2,
  Locate
} from 'lucide-react';

const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY || '';
const CARTO_TILE_URL = CARTO_API_KEY
  ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`
  : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

// Controller to auto-center the map on the aircraft when "Follow Aircraft" is active
function MapRecenter({ center, followAircraft, onUserPan }) {
  const map = useMap();
  const isZoomingRef = useRef(false);
  const latestCenterRef = useRef(center);
  const pendingRecenterRef = useRef(false);

  useEffect(() => {
    latestCenterRef.current = center;
  }, [center]);

  // If user manually drags/pans the map while in locked mode, automatically release lock to Free Cam
  useEffect(() => {
    const onDragStart = () => {
      if (followAircraft && onUserPan) {
        onUserPan();
      }
    };
    map.on('dragstart', onDragStart);
    return () => {
      map.off('dragstart', onDragStart);
    };
  }, [map, followAircraft, onUserPan]);

  // Listen to Leaflet zoom events to avoid interrupting zoom animations and wheel zooming
  useEffect(() => {
    const onZoomStart = () => {
      isZoomingRef.current = true;
    };
    const onZoomEnd = () => {
      isZoomingRef.current = false;
      if (followAircraft && pendingRecenterRef.current && latestCenterRef.current) {
        pendingRecenterRef.current = false;
        map.panTo(latestCenterRef.current, { animate: true });
      }
    };

    map.on('zoomstart', onZoomStart);
    map.on('zoomend', onZoomEnd);

    return () => {
      map.off('zoomstart', onZoomStart);
      map.off('zoomend', onZoomEnd);
    };
  }, [map, followAircraft]);

  // Pan smoothly to aircraft updates without altering the map's current zoom level
  useEffect(() => {
    if (!followAircraft || !center || !center[0] || !center[1]) return;

    if (isZoomingRef.current) {
      pendingRecenterRef.current = true;
      return;
    }

    map.panTo(center, { animate: true });
  }, [center, followAircraft, map]);

  return null;
}

// Controller to execute explicit pan/zoom actions from toolbar
function MapActionsController({
  actionTrigger,
  origCoords,
  destCoords,
  aircraftPos,
  routeBounds,
  baseCoords,
  onActionHandled
}) {
  const map = useMap();
  const lastHandledTsRef = useRef(null);
  const dataRef = useRef({ origCoords, destCoords, aircraftPos, routeBounds, baseCoords });

  useEffect(() => {
    dataRef.current = { origCoords, destCoords, aircraftPos, routeBounds, baseCoords };
  }, [origCoords, destCoords, aircraftPos, routeBounds, baseCoords]);

  useEffect(() => {
    if (!actionTrigger || !actionTrigger.ts) return;
    if (lastHandledTsRef.current === actionTrigger.ts) return;
    lastHandledTsRef.current = actionTrigger.ts;

    const { origCoords, destCoords, aircraftPos, routeBounds, baseCoords } = dataRef.current;

    if (actionTrigger.type === 'fitRoute' && routeBounds && routeBounds.length >= 2) {
      map.fitBounds(routeBounds, { padding: [65, 65], maxZoom: 10, animate: true });
    } else if (actionTrigger.type === 'panOrigin' && origCoords) {
      map.setView([origCoords[1], origCoords[0]], Math.max(map.getZoom(), 11), { animate: true });
    } else if (actionTrigger.type === 'panDest' && destCoords) {
      map.setView([destCoords[1], destCoords[0]], Math.max(map.getZoom(), 11), { animate: true });
    } else if (actionTrigger.type === 'centerPlane' && aircraftPos) {
      map.panTo(aircraftPos, { animate: true });
    } else if (actionTrigger.type === 'panBase' && baseCoords) {
      map.panTo(baseCoords, { animate: true });
    }

    if (onActionHandled) {
      onActionHandled();
    }
  }, [actionTrigger, map, onActionHandled]);

  return null;
}

// Validates whether coordinates represent real in-flight/on-ground aircraft position
// rather than uninitialized main-menu telemetry (e.g. Null Island at 0, 0)
export function isValidSimCoordinates(lat, lon) {
  if (lat == null || lon == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  // Null Island check: MSFS sends coordinates near (0, 0) when in main menu
  if (Math.abs(lat) < 0.05 && Math.abs(lon) < 0.05) return false;
  // Valid Earth latitude and longitude boundaries
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  return true;
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

// Prominent High-Visibility Marker Icon for Mission Origin and Destination
function createMissionAirportIcon(type, icao, airportName = '') {
  const isOrig = type === 'origin';
  const isPreview = type === 'preview';

  const border = isOrig
    ? 'border-emerald-400 bg-slate-950/95 text-emerald-300 shadow-emerald-500/50 ring-1 ring-emerald-400/40'
    : isPreview
    ? 'border-cyan-400 bg-slate-950/95 text-cyan-300 shadow-cyan-500/50 ring-1 ring-cyan-400/40'
    : 'border-amber-400 bg-slate-950/95 text-amber-300 shadow-amber-500/50 ring-1 ring-amber-400/40';

  const badgeBg = isOrig
    ? 'bg-emerald-500 text-slate-950 font-black'
    : isPreview
    ? 'bg-cyan-400 text-slate-950 font-black'
    : 'bg-amber-500 text-slate-950 font-black';

  const dotBg = isOrig
    ? 'bg-emerald-400 ring-4 ring-emerald-500/40'
    : isPreview
    ? 'bg-cyan-400 ring-4 ring-cyan-500/40'
    : 'bg-amber-400 ring-4 ring-amber-500/40';

  const stemBg = isOrig ? 'bg-emerald-400' : isPreview ? 'bg-cyan-400' : 'bg-amber-400';
  const tag = isOrig ? 'DEP' : isPreview ? 'PREVIEW' : 'DEST';

  return L.divIcon({
    className: 'custom-mission-marker',
    html: `
      <div class="relative flex flex-col items-center group select-none cursor-pointer" style="transform: translate(-50%, -100%);">
        <!-- Floating Label Pill with ICAO and Tag -->
        <div class="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border-2 ${border} shadow-2xl backdrop-blur-md whitespace-nowrap font-mono text-xs font-bold transition-all duration-200 group-hover:scale-110">
          <span class="text-[9px] px-1.5 py-0.5 rounded ${badgeBg} uppercase tracking-wider">${tag}</span>
          <span class="text-white text-xs font-bold tracking-wider">${icao || 'APT'}</span>
          ${airportName ? `<span class="text-[10px] text-slate-300 hidden sm:inline max-w-[120px] truncate">• ${airportName}</span>` : ''}
        </div>
        <!-- Pin Stem -->
        <div class="w-0.5 h-3 ${stemBg}"></div>
        <!-- Center Target Reticle Dot on Runway -->
        <div class="w-3.5 h-3.5 rounded-full ${dotBg} shadow-lg shadow-black flex items-center justify-center">
          <div class="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
}

// Marker icon for visited airports
function createVisitedAirportIcon() {
  return L.divIcon({
    className: 'custom-visited-marker',
    html: `
      <div class="relative flex flex-col items-center" style="transform: translate(-50%, -50%);">
        <div class="w-6 h-6 rounded-md bg-purple-950/90 border border-purple-500/80 text-purple-300 flex items-center justify-center shadow-md text-[11px] font-mono font-bold hover:scale-110 transition-transform cursor-pointer">
          ✈
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
}

export function FlightMap({
  telemetry,
  activeJob,
  previewJob = null,
  visitedAirports = [],
  allAirports = [],
  currentAirport = null,
  onAcceptJob = null,
  activeAircraft = null,
  heightClass = 'h-[620px]'
}) {
  // Determine active route vs preview route
  const displayedJob = activeJob || previewJob;
  const isPreview = !activeJob && Boolean(previewJob);

  // Resolve base airport position [latitude, longitude]
  let baseCoords = null;
  if (currentAirport?.location?.coordinates && currentAirport.location.coordinates.length >= 2) {
    baseCoords = [currentAirport.location.coordinates[1], currentAirport.location.coordinates[0]];
  } else if (displayedJob?.origin_airport?.location?.coordinates) {
    baseCoords = [
      displayedJob.origin_airport.location.coordinates[1],
      displayedJob.origin_airport.location.coordinates[0]
    ];
  } else if (allAirports && allAirports.length > 0) {
    const baseIcao = (currentAirport?.icao || displayedJob?.origin_icao || 'KLAX').toUpperCase();
    const matched = allAirports.find((a) => a.icao === baseIcao);
    if (matched?.location?.coordinates) {
      baseCoords = [matched.location.coordinates[1], matched.location.coordinates[0]];
    }
  }
  if (!baseCoords) {
    baseCoords = [33.9425, -118.4081]; // Default KLAX
  }

  // Detect whether telemetry provides valid live aircraft coordinates or uninitialized sim state (Null Island ~0, 0)
  const hasValidSimLocation =
    isValidSimCoordinates(telemetry?.latitude, telemetry?.longitude) &&
    telemetry?.hasValidLocation !== false;

  // Default aircraft marker to current base airport when in MSFS main menu or location is invalid
  const aircraftPos = hasValidSimLocation
    ? [telemetry.latitude, telemetry.longitude]
    : baseCoords;

  const aircraftHeading = telemetry?.heading || 0;
  const isAirborne = hasValidSimLocation && !telemetry?.simOnGround;

  const [followAircraft, setFollowAircraft] = useState(!isPreview && hasValidSimLocation);
  const [actionTrigger, setActionTrigger] = useState(null);

  // Performance & Fuel Consumption estimates for displayedJob
  const cruiseSpeed = activeAircraft?.cruise_speed_kts || 120;
  const fuelBurnGph = activeAircraft?.fuel_burn_gph || 9.0;
  const fuelType = activeAircraft?.fuel_type || '100LL';
  const fuelPrice = fuelType === 'Jet-A' ? 5.60 : 6.40;

  const distance = displayedJob?.distance_nm || 0;
  const flightHours = distance / cruiseSpeed;
  const totalMinutes = Math.max(1, Math.round(flightHours * 60));
  const formattedEte =
    totalMinutes < 60
      ? `${totalMinutes}m`
      : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  const burnHours = Math.max(0.08, flightHours);
  const estGallons = Math.round(burnHours * fuelBurnGph * 10) / 10;
  const estFuelCost = Math.round(estGallons * fuelPrice);

  // 1. Resolve Origin coordinates & name
  let origCoords =
    displayedJob?.origin_airport?.location?.coordinates ||
    displayedJob?.origin_location?.coordinates;

  if (!origCoords && allAirports && allAirports.length > 0 && displayedJob?.origin_icao) {
    const match = allAirports.find(
      (a) => a.icao === displayedJob.origin_icao.toUpperCase()
    );
    if (match?.location?.coordinates) {
      origCoords = match.location.coordinates;
    }
  }

  if (!origCoords) {
    origCoords = currentAirport?.location?.coordinates || [
      baseCoords[1],
      baseCoords[0]
    ];
  }

  const origName =
    displayedJob?.origin_airport?.name ||
    allAirports.find((a) => a.icao === displayedJob?.origin_icao?.toUpperCase())?.name ||
    currentAirport?.name ||
    displayedJob?.origin_icao ||
    'Departure';

  // 2. Resolve Destination coordinates & name
  let destCoords =
    displayedJob?.destination_airport?.location?.coordinates ||
    displayedJob?.destination_location?.coordinates;

  if (!destCoords && allAirports && allAirports.length > 0 && displayedJob?.destination_icao) {
    const match = allAirports.find(
      (a) => a.icao === displayedJob.destination_icao.toUpperCase()
    );
    if (match?.location?.coordinates) {
      destCoords = match.location.coordinates;
    }
  }

  const destName =
    displayedJob?.destination_name ||
    displayedJob?.destination_airport?.name ||
    allAirports.find((a) => a.icao === displayedJob?.destination_icao?.toUpperCase())?.name ||
    displayedJob?.destination_icao ||
    'Destination';

  // Compute flight route line and bounding box
  let routeLine = null;
  let directToLine = null;
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

    // Only include aircraft position in route bounding box if telemetry is live/valid
    if (hasValidSimLocation) {
      routeBounds.push(aircraftPos);
    }

    // Magenta Direct-To vector from plane to destination: only when flying with valid location
    if (hasValidSimLocation && !isPreview && destCoords) {
      directToLine = [
        aircraftPos,
        [destCoords[1], destCoords[0]]
      ];
    }
  }

  // Auto-fit route whenever selected or previewed job changes
  const displayedJobId = displayedJob?._id;
  useEffect(() => {
    if (displayedJobId && routeBounds && routeBounds.length >= 2) {
      if (isPreview || !hasValidSimLocation) {
        setFollowAircraft(false);
        setActionTrigger({ type: 'fitRoute', ts: Date.now() });
      } else {
        setActionTrigger({ type: 'centerPlane', ts: Date.now() });
      }
    } else if (!displayedJobId && baseCoords) {
      setActionTrigger({ type: 'panBase', ts: Date.now() });
    }
  }, [displayedJobId]);

  const handleUserPan = useCallback(() => {
    setFollowAircraft(false);
  }, []);

  const handleActionHandled = useCallback(() => {
    setActionTrigger(null);
  }, []);

  // Filter visited airports from all airports list
  const visitedAirportObjects = allAirports.filter((a) =>
    visitedAirports.includes(a.icao)
  );

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl glass-panel bg-slate-950 flex flex-col">
      {/* Tactical Radar Toolbar */}
      <div className="px-4 py-2.5 bg-slate-950/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Left Navigation Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Follow Aircraft Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !followAircraft;
              setFollowAircraft(next);
              if (next) {
                setActionTrigger({ type: hasValidSimLocation ? 'centerPlane' : 'panBase', ts: Date.now() });
              }
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg font-bold transition shadow-sm ${
              followAircraft
                ? 'bg-cyan-500 text-slate-950 border border-cyan-400 shadow-cyan-500/30'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            <Navigation className={`w-3.5 h-3.5 ${followAircraft && hasValidSimLocation ? 'text-slate-950 animate-spin' : 'text-slate-400'}`} />
            <span>
              {hasValidSimLocation
                ? followAircraft
                  ? 'LOCKED ON AIRCRAFT'
                  : 'FREE CAM'
                : `BASE: ${currentAirport?.icao || 'PARKED'}`}
            </span>
          </button>

          {/* Fit Entire Route Button */}
          {routeBounds && (
            <button
              type="button"
              onClick={() => {
                setFollowAircraft(false);
                setActionTrigger({ type: 'fitRoute', ts: Date.now() });
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-800/60 hover:border-cyan-400 transition font-bold"
              title="Frame Origin, Destination, and Aircraft on screen"
            >
              <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>FIT ROUTE</span>
            </button>
          )}

          {/* Pan to Origin Button */}
          {origCoords && displayedJob?.origin_icao && (
            <button
              type="button"
              onClick={() => {
                setFollowAircraft(false);
                setActionTrigger({ type: 'panOrigin', ts: Date.now() });
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 hover:border-emerald-400 transition"
              title={`Center on Departure Airfield (${displayedJob.origin_icao})`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold">DEP: {displayedJob.origin_icao}</span>
            </button>
          )}

          {/* Pan to Destination Button */}
          {destCoords && displayedJob?.destination_icao && (
            <button
              type="button"
              onClick={() => {
                setFollowAircraft(false);
                setActionTrigger({ type: 'panDest', ts: Date.now() });
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-amber-950/80 text-amber-300 border border-amber-800/60 hover:border-amber-400 transition"
              title={`Center on Destination Airfield (${displayedJob.destination_icao})`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="font-bold">DEST: {displayedJob.destination_icao}</span>
            </button>
          )}
        </div>

        {/* Center / Right Route Summary Badge */}
        <div className="flex items-center space-x-3">
          {displayedJob ? (
            <div className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-cyan-950/60 border border-cyan-700/60 text-cyan-300 text-[11px] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span className="font-bold text-white">
                {isPreview ? 'PREVIEW:' : 'ACTIVE FLIGHT:'}
              </span>
              <span className="text-emerald-400 font-bold">{displayedJob.origin_icao}</span>
              <span className="text-slate-400">➔</span>
              <span className="text-amber-400 font-bold">{displayedJob.destination_icao}</span>
              <span className="text-slate-400">({displayedJob.distance_nm} NM)</span>
            </div>
          ) : null}

          {/* Waypoint Legend */}
          <div className="hidden lg:flex items-center space-x-3 text-[11px] text-slate-300">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              <span>Origin</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
              <span>Destination</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
              <span>Visited</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map Canvas */}
      <div className={`w-full ${heightClass || 'h-[620px]'}`}>
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
            url={CARTO_TILE_URL}
            subdomains="abcd"
            maxZoom={18}
          />

          {/* Real-Time Recenter & Manual Camera Actions */}
          <MapRecenter
            center={aircraftPos}
            followAircraft={followAircraft}
            onUserPan={handleUserPan}
          />
          <MapActionsController
            actionTrigger={actionTrigger}
            origCoords={origCoords}
            destCoords={destCoords}
            aircraftPos={aircraftPos}
            routeBounds={routeBounds}
            baseCoords={baseCoords}
            onActionHandled={handleActionHandled}
          />

          {/* Live Aircraft Marker */}
          <Marker
            position={aircraftPos}
            icon={createAircraftIcon(aircraftHeading, isAirborne)}
            zIndexOffset={1000}
          >
            <Popup className="avionics-popup">
              <div className="p-1 font-mono text-xs text-slate-900">
                <p className="font-bold text-cyan-700">
                  {hasValidSimLocation ? 'AIRCRAFT POSITION' : 'PARKED AT BASE'}
                </p>
                {!hasValidSimLocation ? (
                  <>
                    <p className="font-bold text-slate-800">{currentAirport?.name || 'Home Base Airfield'}</p>
                    <p className="text-slate-600 text-[10px] mt-0.5">MSFS Main Menu • Standing by</p>
                    <p className="text-slate-500 text-[10px]">ICAO: {currentAirport?.icao || 'KLAX'}</p>
                  </>
                ) : (
                  <>
                    <p>Alt: {Math.round(telemetry?.altitude || 0).toLocaleString()} FT</p>
                    <p>GS: {Math.round(telemetry?.groundSpeed || 0)} KTS</p>
                    <p>HDG: {Math.round(telemetry?.heading || 0).toString().padStart(3, '0')}°</p>
                    <p>Lat: {telemetry?.latitude?.toFixed(4)}</p>
                    <p>Lon: {telemetry?.longitude?.toFixed(4)}</p>
                  </>
                )}
              </div>
            </Popup>
          </Marker>

          {/* Planned Flight Plan Route Line (Origin -> Destination) */}
          {routeLine && (
            <Polyline
              positions={routeLine}
              pathOptions={{
                color: isPreview ? '#f59e0b' : '#06b6d4',
                weight: isPreview ? 3.5 : 3,
                dashArray: isPreview ? '8, 8' : '6, 8',
                opacity: isPreview ? 0.95 : 0.8
              }}
            />
          )}

          {/* Live Direct-To Vector Line (Aircraft -> Destination) */}
          {directToLine && !isPreview && (
            <Polyline
              positions={directToLine}
              pathOptions={{
                color: '#e879f9', // Magenta avionics direct vector
                weight: 2,
                dashArray: '4, 6',
                opacity: 0.85
              }}
            />
          )}

          {/* Origin Marker (High-Visibility DEP Badge) */}
          {origCoords && (
            <Marker
              position={[origCoords[1], origCoords[0]]}
              icon={createMissionAirportIcon('origin', displayedJob?.origin_icao, origName)}
              zIndexOffset={950}
            >
              <Popup>
                <div className="p-1 font-mono text-xs text-slate-900 min-w-[180px]">
                  <p className="font-bold text-emerald-700 text-sm border-b pb-1 mb-1">
                    DEPARTURE: {displayedJob?.origin_icao || 'ORIGIN'}
                  </p>
                  <p className="font-bold">{origName}</p>
                  {displayedJob?.origin_airport?.city && (
                    <p>{displayedJob.origin_airport.city}, {displayedJob.origin_airport.country}</p>
                  )}
                  {displayedJob?.origin_airport?.longest_runway_ft && (
                    <p>Longest Runway: {displayedJob.origin_airport.longest_runway_ft.toLocaleString()} ft</p>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Destination Marker (High-Visibility DEST Badge) */}
          {destCoords && (
            <Marker
              position={[destCoords[1], destCoords[0]]}
              icon={createMissionAirportIcon(
                isPreview ? 'preview' : 'destination',
                displayedJob?.destination_icao,
                destName
              )}
              zIndexOffset={950}
            >
              <Popup>
                <div className="p-1 font-mono text-xs text-slate-900 min-w-[200px]">
                  <div className="flex items-center justify-between border-b pb-1 mb-1">
                    <p className="font-bold text-amber-700 text-sm">
                      {isPreview ? 'ROUTE PREVIEW' : 'DESTINATION'}: {displayedJob?.destination_icao}
                    </p>
                  </div>
                  <p className="font-bold">{destName}</p>
                  <p>{displayedJob?.destination_city ? `${displayedJob.destination_city}, ` : ''}{displayedJob?.destination_country || displayedJob?.destination_airport?.country}</p>
                  <p className="text-slate-700">Distance: {displayedJob?.distance_nm} NM</p>
                  {displayedJob?.distance_nm && (
                    <div className="my-1.5 py-1 px-2 bg-slate-100 rounded border border-slate-200 text-[11px] space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Est Flight Time:</span>
                        <span className="font-bold text-slate-800">~{formattedEte}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Est Fuel Burn:</span>
                        <span className="font-bold text-slate-800">~{estGallons} gal (${estFuelCost?.toLocaleString()})</span>
                      </div>
                    </div>
                  )}
                  <p>Runway: {displayedJob?.destination_runway_ft?.toLocaleString() || displayedJob?.destination_airport?.longest_runway_ft?.toLocaleString()} ft</p>
                  <p className="font-bold text-emerald-700 mt-1 flex items-center justify-between">
                    <span>Reward: ${displayedJob?.payout?.toLocaleString()}</span>
                    {displayedJob?.seniority_bonus > 0 && (
                      <span className="text-[10px] text-purple-700 font-semibold">
                        (+${displayedJob.seniority_bonus.toLocaleString()} Seniority)
                      </span>
                    )}
                  </p>
                  <p className="text-purple-700 text-[11px] font-semibold">
                    XP Reward: +{displayedJob?.xp_reward || displayedJob?.distance_nm} XP
                  </p>
                  {isPreview && onAcceptJob && (
                    <button
                      onClick={() => onAcceptJob(displayedJob._id)}
                      className="mt-2 w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs transition shadow-md"
                    >
                      Accept Contract (${displayedJob.payout?.toLocaleString()})
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
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
                icon={createVisitedAirportIcon()}
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
