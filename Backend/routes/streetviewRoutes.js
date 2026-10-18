/**
 * Ortenau Guesser - Street View Routes
 * Proxies Google Street View tiles for frontend equirectangular stitching.
 */

const express = require('express');
const {
  fetchStreetViewTile,
  fetchStreetViewTilesBatch
} = require('../services/streetviewService');

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
  const parsedZoom = parseInt(req.query.zoom, 10);
  const zoom = Number.isNaN(parsedZoom) ? 2 : Math.max(0, Math.min(5, parsedZoom));

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
 * GET /api/streetview/tiles-batch
 * Concurrently fetches a batch of Street View 512x512 tiles on the server (for Zoom 2, 3, or 4)
 * so the browser avoids HTTP/1.1 6-connection-per-origin queuing when upgrading to 4K/8K.
 */
router.get('/tiles-batch', async (req, res) => {
  const panoId = req.query.panoid;
  const parsedZoom = parseInt(req.query.zoom, 10);
  const zoom = Number.isNaN(parsedZoom) ? 3 : Math.max(0, Math.min(5, parsedZoom));
  const cols = parseInt(req.query.cols, 10) || (1 << zoom);
  const rows = parseInt(req.query.rows, 10) || Math.max(1, 1 << (zoom - 1));
  const startRow = req.query.startRow !== undefined ? parseInt(req.query.startRow, 10) : 0;
  const endRow = req.query.endRow !== undefined ? parseInt(req.query.endRow, 10) : rows - 1;

  if (!panoId) {
    return res.status(400).json({ error: 'panoid query parameter is required' });
  }

  try {
    const tiles = await fetchStreetViewTilesBatch(panoId, zoom, cols, rows, startRow, endRow);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      panoid: panoId,
      zoom,
      cols,
      rows,
      startRow,
      endRow,
      tiles
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch StreetView tile batch', message: err.message });
  }
});

module.exports = router;


