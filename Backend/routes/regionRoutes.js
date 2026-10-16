/**
 * Ortenau Guesser - Region & Health Routes
 * Exposes region configuration, bounding polygon, and service health check.
 */

const express = require('express');
const { ORTENAU_REGION } = require('../data/ortenauRegion');
const { ORTENAU_LOCATIONS } = require('../data/ortenauSeeds');

const router = express.Router();

/**
 * GET /api/health
 * Health check endpoint for Docker Compose and Frontend initialization
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    region: ORTENAU_REGION.name,
    state: ORTENAU_REGION.state,
    country: ORTENAU_REGION.country,
    osmRelationId: ORTENAU_REGION.osmRelationId,
    locationsCount: ORTENAU_LOCATIONS.length,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/region
 * Returns the Ortenaukreis region definition, bounding box, boundary polygon, and OSM tile config
 */
router.get('/region', (req, res) => {
  res.json({
    ...ORTENAU_REGION,
    locationsCount: ORTENAU_LOCATIONS.length
  });
});

module.exports = router;

