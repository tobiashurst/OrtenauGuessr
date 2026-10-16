/**
 * Ortenau Guesser - Geographic Math Utilities
 * Haversine distance, true compass bearing calculations, and coordinate conversions.
 */

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

module.exports = {
  toRadians,
  toDegrees,
  haversineDistanceMeters,
  calculateBearing,
  bearingToCardinal
};

