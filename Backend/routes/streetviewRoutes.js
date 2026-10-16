/**
 * Ortenau Guesser - Street View Routes
 * Proxies Google Street View tiles for frontend equirectangular stitching.
 */

const express = require('express');
const { fetchStreetViewTile } = require('../services/streetviewService');

const router = express.Router();

/**
 * GET /api/streetview/tile
 * Proxies Google Street View 512x512 panorama tiles with proper CORS & caching headers
 * so the frontend can stitch real 360° equirectangular panoramas seamlessly into Pannellum.
 */
router.get('/tile', async (req, res) => {
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

module.exports = router;

