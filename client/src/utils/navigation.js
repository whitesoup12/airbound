/**
 * Aviation Navigation Utilities for Airbound MSFS Companion
 * Calculates great-circle distance, true bearing, track angle error,
 * closure rate (VMG), and Estimated Time En Route (ETE / ETA).
 */

const R_EARTH_NM = 3440.065; // Earth radius in nautical miles

/**
 * Calculates great-circle distance between two lat/lon points in Nautical Miles.
 */
export function calculateDistanceNm(lat1, lon1, lat2, lon2) {
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined ||
    lat1 === null ||
    lon1 === null ||
    lat2 === null ||
    lon2 === null
  ) {
    return 0;
  }

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R_EARTH_NM * c * 10) / 10;
}

/**
 * Calculates initial true bearing from point 1 to point 2 in degrees (0-359°).
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((bearing + 360) % 360);
}

/**
 * Calculates navigation estimates: Distance Remaining, Bearing, Closure Rate, ETE & ETA.
 */
export function calculateNavEstimates({
  telemetry = {},
  activeJob = null,
  phase = 'STANDBY',
  activeAircraft = null,
  allAirports = [],
  destDistOverride = null
}) {
  if (!activeJob) {
    return {
      hasActiveJob: false,
      remainingNm: 0,
      progressPct: 0,
      bearing: null,
      heading: Math.round(telemetry?.heading || 0),
      headingDiff: 0,
      turnAdvice: '',
      groundSpeed: Math.round(telemetry?.groundSpeed || 0),
      closureRate: 0,
      eteMinutes: 0,
      formattedEte: '--',
      formattedEta: '',
      isLiveRate: false,
      isDiverging: false,
      isCruiseEst: false
    };
  }

  const totalDist = activeJob.distance_nm || 1;
  const cruiseSpeed = activeAircraft?.cruise_speed_kts || 120;

  // Resolve destination coordinates from activeJob or airport lookup
  let destCoords =
    activeJob.destination_airport?.location?.coordinates ||
    activeJob.destination_location?.coordinates;

  if (!destCoords && allAirports && allAirports.length > 0 && activeJob.destination_icao) {
    const matched = allAirports.find(
      (a) => a.icao === activeJob.destination_icao.toUpperCase()
    );
    if (matched?.location?.coordinates) {
      destCoords = matched.location.coordinates;
    }
  }

  const currentLat = telemetry?.latitude;
  const currentLon = telemetry?.longitude;
  const heading = Math.round(telemetry?.heading || 0);
  const groundSpeed = Math.round(
    telemetry?.groundSpeed > 0 ? telemetry.groundSpeed : (telemetry?.airspeedTrue || 0)
  );

  let remainingNm = totalDist;
  let bearing = null;
  let headingDiff = 0;
  let turnAdvice = 'ON TRACK';

  if (destCoords && Number.isFinite(currentLat) && Number.isFinite(currentLon)) {
    const destLon = destCoords[0];
    const destLat = destCoords[1];

    remainingNm = calculateDistanceNm(currentLat, currentLon, destLat, destLon);
    bearing = calculateBearing(currentLat, currentLon, destLat, destLon);

    // Track angle error: difference between plane heading and destination bearing (-180 to +180)
    let diff = ((heading - bearing + 180) % 360) - 180;
    if (diff < -180) diff += 360;
    headingDiff = Math.abs(Math.round(diff));

    if (diff > 3) {
      turnAdvice = `Turn L ${Math.round(diff)}°`;
    } else if (diff < -3) {
      turnAdvice = `Turn R ${Math.round(Math.abs(diff))}°`;
    } else {
      turnAdvice = 'ON TRACK';
    }
  } else if (destDistOverride !== null && Number.isFinite(destDistOverride)) {
    remainingNm = Math.round(destDistOverride * 10) / 10;
  }

  // Handle phase specific distance overrides
  if (phase === 'IDLE') {
    remainingNm = totalDist;
  } else if (phase === 'COMPLETED') {
    remainingNm = 0;
  }

  // Progress percentage (0% to 100%)
  const progressPct =
    phase === 'COMPLETED'
      ? 100
      : phase === 'IDLE'
      ? 0
      : Math.min(100, Math.max(0, Math.round(((totalDist - remainingNm) / totalDist) * 100)));

  // Velocity Made Good (VMG) / Closure Rate towards destination
  // V_closure = GroundSpeed * cos(headingDiff)
  let closureRate = 0;
  let eteHours = null;
  let status = 'CRUISE_EST'; // 'CRUISE_EST' | 'LIVE' | 'DIVERGING' | 'ARRIVED'

  if (phase === 'COMPLETED') {
    status = 'ARRIVED';
    eteHours = 0;
  } else if (phase === 'IDLE' || telemetry?.simOnGround || groundSpeed < 30) {
    // On the ground or pre-flight: estimate using aircraft cruise speed
    status = 'CRUISE_EST';
    eteHours = remainingNm / Math.max(50, cruiseSpeed);
    closureRate = cruiseSpeed;
  } else {
    // Airborne: calculate live closure rate based on speed and heading alignment
    const headingDiffRad = (headingDiff * Math.PI) / 180;
    closureRate = Math.round(groundSpeed * Math.cos(headingDiffRad));

    if (headingDiff <= 80 && closureRate >= 15) {
      status = 'LIVE';
      eteHours = remainingNm / closureRate;
    } else {
      // Diverging or perpendicular (flying away from destination)
      status = 'DIVERGING';
      eteHours = null;
    }
  }

  // Format ETE & ETA
  let formattedEte = '--';
  let formattedEta = '';
  let eteMinutes = 0;

  if (status === 'ARRIVED') {
    formattedEte = 'Arrived';
    formattedEta = '00:00';
  } else if (status === 'DIVERGING') {
    formattedEte = 'Diverging';
    formattedEta = 'N/A';
  } else if (eteHours !== null && Number.isFinite(eteHours) && eteHours >= 0) {
    const totalSeconds = Math.round(eteHours * 3600);
    eteMinutes = Math.round(totalSeconds / 60);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      formattedEte = `${hours}h ${mins.toString().padStart(2, '0')}m`;
    } else if (mins > 0) {
      formattedEte = `${mins} min`;
    } else {
      formattedEte = '< 1 min';
    }

    // Projected arrival clock time
    const etaDate = new Date(Date.now() + totalSeconds * 1000);
    formattedEta = etaDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  return {
    hasActiveJob: true,
    remainingNm: Number(remainingNm.toFixed(1)),
    progressPct,
    bearing,
    heading,
    headingDiff,
    turnAdvice,
    groundSpeed,
    closureRate,
    eteMinutes,
    formattedEte,
    formattedEta,
    isLiveRate: status === 'LIVE',
    isDiverging: status === 'DIVERGING',
    isCruiseEst: status === 'CRUISE_EST',
    isArrived: status === 'ARRIVED'
  };
}

