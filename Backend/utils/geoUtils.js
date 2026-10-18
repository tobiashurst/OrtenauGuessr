/**
 * Ortenau Guesser - Geographic Math & Region Boundary Utilities
 * Haversine distance, true compass bearing calculations, coordinate conversions,
 * and Ortenaukreis polygon boundary checks.
 */

const ORTENAU_REGION = require('../data/ortenauRegion.json');

/**
 * Convert degrees to radians
 */
function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
function toDegrees(rad) {
  return (rad * 180) / Math.PI;
}

/**
 * Calculate Haversine distance in meters between two WGS84 coordinates
 */
function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth mean radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate true compass bearing (0° = North, 90° = East, 180° = South, 270° = West)
 */
function calculateBearing(lat1, lng1, lat2, lng2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lng2 - lng1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return Math.round((toDegrees(theta) + 360) % 360);
}

/**
 * Convert bearing degrees to 8-point compass direction
 */
function bearingToCardinal(bearing) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((bearing % 360) / 45)) % 8;
  return directions[index];
}

/**
 * Ray-casting point-in-polygon check + bounding box check to ensure any coordinate
 * is strictly within the Ortenaukreis region.
 */
function isPointInOrtenau(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return false;
  }
  const { north, south, east, west } = ORTENAU_REGION.bounds;
  if (lat < south || lat > north || lng < west || lng > east) {
    return false;
  }

  const poly = ORTENAU_REGION.polygon;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0];
    const xi = poly[i][1];
    const yj = poly[j][0];
    const xj = poly[j][1];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Generate a random geographic coordinate strictly inside the Ortenaukreis polygon.
 */
function generateRandomPointInOrtenau() {
  const { north, south, east, west } = ORTENAU_REGION.bounds;
  for (let i = 0; i < 100; i++) {
    const lat = Number((south + Math.random() * (north - south)).toFixed(6));
    const lng = Number((west + Math.random() * (east - west)).toFixed(6));
    if (isPointInOrtenau(lat, lng)) {
      return { lat, lng };
    }
  }
  return { lat: 48.4719, lng: 7.9446 };
}

module.exports = {
  toRadians,
  toDegrees,
  haversineDistanceMeters,
  calculateBearing,
  bearingToCardinal,
  isPointInOrtenau,
  generateRandomPointInOrtenau
};


