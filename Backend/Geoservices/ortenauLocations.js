/**
 * Ortenau Guesser - Geoservices Compatibility Wrapper (ortenauLocations.js)
 * Re-exports region data and seed locations from the modular data/ directory.
 * Kept for backwards compatibility with existing scripts and tests.
 */

const ORTENAU_REGION = require('../data/ortenauRegion.json');
const ORTENAU_LOCATIONS = require('../data/ortenauSeeds.json');
const {
  isPointInOrtenau,
  generateRandomPointInOrtenau
} = require('../utils/geoUtils');

module.exports = {
  ORTENAU_REGION,
  ORTENAU_LOCATIONS,
  isPointInOrtenau,
  generateRandomPointInOrtenau
};