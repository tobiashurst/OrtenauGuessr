/**
 * Ortenau Guesser - Express Backend Server
 * Serves Frontend static files and exposes OpenStreetMap Geoservice endpoints for Ortenaukreis.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const {
  ORTENAU_REGION,
  ORTENAU_LOCATIONS,
  isPointInOrtenau,
  fetchStreetViewTile,
  fetchOverpassSurroundings,
  fetchReverseGeocode,
  getRandomOrtenauLocation,
  getRoundById,
  calculateDistanceAndScore
} = require('./Geoservices/osmService');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

// Serve static Frontend assets (index.html, style.css, app.js)
const frontendDir = path.join(__dirname, '../Frontend');
app.use(express.static(frontendDir));

/**
 * GET /api/streetview/tile
 * Proxies Google Street View 512x512 panorama tiles with proper CORS & caching headers
 * so the frontend can stitch real 360° equirectangular panoramas seamlessly into Pannellum.
 */
app.get('/api/streetview/tile', async (req, res) => {
  const panoId = req.query.panoid;
  const x = parseInt(req.query.x, 10);
  const y = parseInt(req.query.y, 10);
  const zoom = parseInt(req.query.zoom, 10) || 2;

  if (!panoId || Number.isNaN(x) || Number.isNaN(y)) {
    return res.status(400).json({ error: 'panoid, x, and y query parameters are required' });
  }

  try {
    const tileBuffer = await fetchStreetViewTile(panoId, x, y, zoom);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(tileBuffer);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch StreetView tile', message: err.message });
  }
});

/**
 * GET /api/health
 * Health check endpoint for Docker Compose and Frontend initialization
 */
app.get('/api/health', (req, res) => {
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
app.get('/api/region', (req, res) => {
  res.json({
    ...ORTENAU_REGION,
    locationsCount: ORTENAU_LOCATIONS.length
  });
});

/**
 * GET /api/location/random
 * Returns a random fixed street-level location strictly inside Ortenaukreis,
 * enriched with OpenStreetMap Overpass API roads/buildings/POIs/signs and Nominatim metadata.
 */
app.get('/api/location/random', async (req, res) => {
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
app.get('/api/location/surroundings', async (req, res) => {
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

/**
 * POST /api/guess
 * Evaluates a player's map guess against the actual Ortenau streetview location.
 * Supports multiple payload shapes:
 *   1) { roundId, guess: { lat, lng }, actual: { lat, lng } }
 *   2) { actualLat, actualLng, guessLat, guessLng, roundId }
 *   3) { roundId, lat, lng } (resolves actual location via roundId)
 */
app.post('/api/guess', (req, res) => {
  try {
    const body = req.body || {};
    const roundId = body.roundId || body.actual?.roundId || null;
    const storedRound = getRoundById(roundId);

    const guessLat = parseFloat(
      body.guess?.lat ?? body.guessLat ?? body.lat
    );
    const guessLng = parseFloat(
      body.guess?.lng ?? body.guess?.lon ?? body.guessLng ?? body.guessLon ?? body.lng ?? body.lon
    );

    const actualLat = parseFloat(
      body.actual?.lat ?? body.actualLat ?? storedRound?.lat
    );
    const actualLng = parseFloat(
      body.actual?.lng ?? body.actual?.lon ?? body.actualLng ?? body.actualLon ?? storedRound?.lng
    );

    if (
      Number.isNaN(guessLat) ||
      Number.isNaN(guessLng) ||
      Number.isNaN(actualLat) ||
      Number.isNaN(actualLng)
    ) {
      return res.status(400).json({
        error: 'Invalid coordinates. Provide guess and actual coordinates (or a valid roundId).'
      });
    }

    const result = calculateDistanceAndScore(actualLat, actualLng, guessLat, guessLng);

    // Match closest curated location metadata if roundId wasn't found
    const matchedLocation =
      storedRound ||
      ORTENAU_LOCATIONS.find(
        (loc) => Math.abs(loc.lat - actualLat) < 0.0005 && Math.abs(loc.lng - actualLng) < 0.0005
      ) ||
      null;

    res.json({
      roundId,
      ...result,
      actual: {
        lat: actualLat,
        lng: actualLng,
        id: matchedLocation?.id || body.actual?.id || null,
        name: matchedLocation?.name || body.actual?.name || 'Ortenaukreis Street Location',
        municipality: matchedLocation?.municipality || body.actual?.municipality || 'Ortenaukreis',
        district: 'Ortenaukreis',
        description: matchedLocation?.description || body.actual?.description || null,
        landmarks: matchedLocation?.landmarks || []
      },
      guess: {
        lat: guessLat,
        lng: guessLng,
        inOrtenau: result.guessInOrtenau
      }
    });
  } catch (err) {
    console.error('[OrtenauGuesser] Error in POST /api/guess:', err);
    res.status(500).json({
      error: 'Failed to evaluate guess',
      message: err.message
    });
  }
});

// Fallback to Frontend/index.html for SPA / root requests
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(frontendDir, 'index.html'), (err) => {
    if (err) {
      next();
    }
  });
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`[OrtenauGuesser] Backend & OpenStreetMap Geoservices listening on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
