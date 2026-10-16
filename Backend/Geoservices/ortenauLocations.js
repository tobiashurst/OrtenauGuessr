/**
 * Ortenau Guesser - Geoservices Compatibility Wrapper (ortenauLocations.js)
 * Re-exports region data and seed locations from the modular data/ directory.
 * Kept for backwards compatibility with existing scripts and tests.
 */

const {
  ORTENAU_REGION,
  isPointInOrtenau,
  generateRandomPointInOrtenau
} = require('../data/ortenauRegion');
const { ORTENAU_LOCATIONS } = require('../data/ortenauSeeds');

module.exports = {
  ORTENAU_REGION,
  ORTENAU_LOCATIONS,
  isPointInOrtenau,
  generateRandomPointInOrtenau
};