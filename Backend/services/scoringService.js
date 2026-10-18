/**
 * Ortenau Guesser - Scoring Service
 * Calculates exact Haversine distance, bearings, and GeoGuessr-style exponential score
 * calibrated specifically for the Ortenaukreis regional scale (~60km span).
 */

const {
  haversineDistanceMeters,
  calculateBearing,
  bearingToCardinal,
  isPointInOrtenau
} = require('../utils/geoUtils');

/**
 * Calculate exact distance and GeoGuessr-style score (0 - 5000) calibrated for Ortenaukreis (~60km span)
 */
function calculateDistanceAndScore(actualLat, actualLng, guessLat, guessLng) {
  const distanceMeters = Math.round(haversineDistanceMeters(actualLat, actualLng, guessLat, guessLng));
  const distanceKm = Number((distanceMeters / 1000).toFixed(2));

  const distanceFormatted =
    distanceMeters < 1000
      ? `${distanceMeters} m`
      : `${(distanceMeters / 1000).toFixed(2)} km`;

  let score = 0;
  if (distanceMeters <= 50) {
    score = 5000;
  } else {
    score = Math.max(0, Math.min(5000, Math.round(5000 * Math.exp(-(distanceMeters / 1000) / 12))));
  }

  const bearingDegrees = calculateBearing(guessLat, guessLng, actualLat, actualLng);
  const compassDirection = bearingToCardinal(bearingDegrees);
  const guessInOrtenau = isPointInOrtenau(guessLat, guessLng);

  return {
    distanceMeters,
    distanceKm,
    distanceFormatted,
    score,
    maxScore: 5000,
    bearingDegrees,
    compassDirection,
    guessInOrtenau
  };
}

module.exports = {
  calculateDistanceAndScore
};

