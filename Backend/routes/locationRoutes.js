/**
 * Ortenau Guesser - Location Routes
 * Serves random 360° streetview locations and live OSM surroundings in Ortenaukreis.
 */

const express = require('express');
const ORTENAU_REGION = require('../data/ortenauRegion.json');
const { isPointInOrtenau } = require('../utils/geoUtils');
const { getRandomOrtenauLocation } = require('../services/roundService');
const { fetchOverpassSurroundings } = require('../services/overpassService');
const { fetchReverseGeocode } = require('../services/nominatimService');

const router = express.Router();

/**
 * GET /api/location/random
 * Returns a random fixed street-level location strictly inside Ortenaukreis,
 * enriched with OpenStreetMap Overpass API roads/buildings/POIs/signs and Nominatim metadata.
 */
router.get('/random', async (req, res) => {
  try {
    const excludeParam = typeof req.query.exclude === 'string' ? req.query.exclude : '';
    const excludeIds = excludeParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const locationData = await getRandomOrtenauLocation(excludeIds);
    res.json(locationData);
  } catch (err) {
    console.error('[OrtenauGuesser] Error in GET /api/location/random:', err);
    res.status(500).json({
      error: 'Failed to generate random Ortenau location',
      message: err.message
    });
  }
});

/**
 * GET /api/location/surroundings
 * Queries live OpenStreetMap Overpass + Nominatim data for any coordinate inside Ortenaukreis
 */
router.get('/surroundings', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'Valid numeric lat and lng query parameters are required.' });
  }

  if (!isPointInOrtenau(lat, lng)) {
    return res.status(400).json({
      error: 'Coordinates are outside the Ortenau (Ortenaukreis) boundary.',
      bounds: ORTENAU_REGION.bounds
    });
  }

  const [overpass, reverseGeocode] = await Promise.all([
    fetchOverpassSurroundings(lat, lng, 120),
    fetchReverseGeocode(lat, lng)
  ]);

  res.json({
    lat,
    lng,
    inOrtenau: true,
    overpass,
    reverseGeocode
  });
});

module.exports = router;

