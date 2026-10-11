// 1 Nautical Mile = 1852 Meters
export const NM_TO_METERS = 1852;
export const METERS_TO_NM = 1 / 1852;

/**
 * Calculates great circle distance between two points in Nautical Miles
 * @param {number} lat1 Latitude 1 in degrees
 * @param {number} lon1 Longitude 1 in degrees
 * @param {number} lat2 Latitude 2 in degrees
 * @param {number} lon2 Longitude 2 in degrees
 * @returns {number} Distance in Nautical Miles
 */
export function calculateDistanceNm(lat1, lon1, lat2, lon2) {
  const R_NM = 3440.065; // Earth radius in Nautical Miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R_NM * c * 10) / 10;
}

/**
 * Calculates initial bearing from point 1 to point 2 in degrees (0-360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

