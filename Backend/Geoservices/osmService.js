/**
 * Ortenau Guesser - Geoservices Compatibility Wrapper (osmService.js)
 * Re-exports services and utilities from the modular services/, utils/, and data/ directories.
 * Kept for backwards compatibility with existing scripts and tests.
 */

const {
  ORTENAU_REGION,
  isPointInOrtenau,
  generateRandomPointInOrtenau
} = require('../data/ortenauRegion');
const { ORTENAU_LOCATIONS } = require('../data/ortenauSeeds');
const {
  haversineDistanceMeters,
  calculateBearing,
  bearingToCardinal,
  toRadians,
  toDegrees
} = require('../utils/geoUtils');
const {
  fetchGoogleStreetViewPano,
  fetchStreetViewTile,
  fetchStreetLevelImagery
} = require('../services/streetviewService');
const { fetchOverpassSurroundings } = require('../services/overpassService');
const { fetchReverseGeocode } = require('../services/nominatimService');
const {
  getRandomOrtenauLocation,
  getRoundById,
  activeRounds,
  recentPanoIds
} = require('../services/roundService');
const { calculateDistanceAndScore } = require('../services/scoringService');

module.exports = {
  ORTENAU_REGION,
  ORTENAU_LOCATIONS,
  isPointInOrtenau,
  generateRandomPointInOrtenau,
  haversineDistanceMeters,
  calculateBearing,
  bearingToCardinal,
  toRadians,
  toDegrees,
  fetchGoogleStreetViewPano,
  fetchStreetViewTile,
  fetchOverpassSurroundings,
  fetchReverseGeocode,
  fetchStreetLevelImagery,
  getRandomOrtenauLocation,
  getRoundById,
  calculateDistanceAndScore,
  activeRounds,
  recentPanoIds
};
