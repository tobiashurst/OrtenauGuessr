/**
 * Ortenau Guesser - Street View Imagery Service
 * Queries Google Street View SingleImageSearch RPC for real 360° panoramas
 * across Ortenaukreis, provides tile proxy fetching, and Panoramax 360° fallback.
 */

const { isPointInOrtenau } = require('../data/ortenauRegion');

const GOOGLE_SINGLE_IMAGE_SEARCH_URL =
  'https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/SingleImageSearch';
const GOOGLE_STREETVIEW_TILE_URL = 'https://streetviewpixels-pa.googleapis.com/v1/tile';
const PANORAMAX_SEARCH_URL = 'https://api.panoramax.xyz/api/search';
const USER_AGENT = 'OrtenauGuesser/1.0 (Ortenaukreis StreetView Game; Baden-Wuerttemberg)';

/**
 * Query Google Street View's SingleImageSearch RPC for a real 360° Street View panorama
 * near (lat, lng). Strictly validates that the returned panorama is inside the Ortenaukreis.
 */
async function fetchGoogleStreetViewPano(lat, lng, radiusMeters = 750) {
  const payload = [
    ['apiv3', null, null, null, 'US', null, null, null, null, null, [[0]]],
    [[null, null, lat, lng], radiusMeters],
    [null, ['de', 'DE'], null, null, null, null, null, null, [2], null, [[[2, 1, 2]]]],
    [[1, 2, 3, 4, 8, 6]]
  ];

  try {
    const response = await fetch(GOOGLE_SINGLE_IMAGE_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json+protobuf',
        'User-Agent': USER_AGENT
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3200)
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const status = data?.[0]?.[0];
    const panoId = data?.[1]?.[1]?.[1];
    if (status !== 0 || !panoId || typeof panoId !== 'string') {
      return null;
    }

    const rawCoords = data?.[1]?.[5]?.[0]?.[1]?.[0];
    const panoLat = Number(rawCoords?.[2] ?? lat);
    const panoLng = Number(rawCoords?.[3] ?? lng);
    const panoHeading = Number(data?.[1]?.[5]?.[0]?.[1]?.[2]?.[0] ?? 0);

    // Ensure the discovered panorama is strictly inside Ortenaukreis
    if (!isPointInOrtenau(panoLat, panoLng)) {
      return null;
    }

    // Extract resolution dimensions per zoom level if present
    const rawZoomSizes = data?.[1]?.[2]?.[3]?.[0];
    const rawTileSize = data?.[1]?.[2]?.[3]?.[1];
    const tileWidth = Number(rawTileSize?.[1] ?? 512);
    const tileHeight = Number(rawTileSize?.[0] ?? 512);

    const zoomSizes = Array.isArray(rawZoomSizes)
      ? rawZoomSizes.map((pair) => ({
          height: Number(pair?.[0]?.[0] ?? pair?.[0] ?? 1024),
          width: Number(pair?.[0]?.[1] ?? pair?.[1] ?? 2048)
        }))
      : null;

    const z2Size = zoomSizes?.[2] || { width: 2048, height: 1024 };
    const z3Size = zoomSizes?.[3] || { width: 4096, height: 2048 };
    const z4Size = zoomSizes?.[4] || { width: 8192, height: 4096 };
    const maxZoom = zoomSizes ? Math.min(4, zoomSizes.length - 1) : 4;

    return {
      provider: 'Google Street View 360°',
      panoId,
      is360: true,
      lat: panoLat,
      lng: panoLng,
      heading: Math.round(panoHeading),
      tileZoom: 2,
      maxZoom,
      tileSize: { width: tileWidth, height: tileHeight },
      worldWidth: z2Size.width,
      worldHeight: z2Size.height,
      hdWorldWidth: z3Size.width,
      hdWorldHeight: z3Size.height,
      ultraWorldWidth: z4Size.width,
      ultraWorldHeight: z4Size.height,
      zoomLevels: {
        2: z2Size,
        3: z3Size,
        4: z4Size
      },
      tileUrlTemplate: `/api/streetview/tile?panoid=${encodeURIComponent(panoId)}&zoom={z}&x={x}&y={y}`
    };
  } catch (_) {
    return null;
  }
}

// In-memory LRU cache for 512x512 Street View tiles to speed up retries & batch requests
const TILE_CACHE_MAX_ENTRIES = 600;
const tileCache = new Map();

function getCachedTile(key) {
  if (!tileCache.has(key)) return null;
  const val = tileCache.get(key);
  // Refresh LRU order
  tileCache.delete(key);
  tileCache.set(key, val);
  return val;
}

function setCachedTile(key, buffer) {
  if (tileCache.has(key)) {
    tileCache.delete(key);
  } else if (tileCache.size >= TILE_CACHE_MAX_ENTRIES) {
    const oldestKey = tileCache.keys().next().value;
    tileCache.delete(oldestKey);
  }
  tileCache.set(key, buffer);
}

/**
 * Fetch a single 512x512 JPEG tile for a Google Street View 360° panorama.
 */
async function fetchStreetViewTile(panoId, x, y, zoom = 2) {
  const safeZoom = Math.max(0, Math.min(5, Number(zoom) || 2));
  const cacheKey = `${panoId}:${safeZoom}:${x}:${y}`;
  const cached = getCachedTile(cacheKey);
  if (cached) {
    return cached;
  }

  const url = `${GOOGLE_STREETVIEW_TILE_URL}?cb_client=maps_sv.tactile&panoid=${encodeURIComponent(
    panoId
  )}&x=${encodeURIComponent(x)}&y=${encodeURIComponent(y)}&zoom=${encodeURIComponent(
    safeZoom
  )}&nbt=1&fover=2`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT
    },
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error(`StreetView tile HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  setCachedTile(cacheKey, buffer);
  return buffer;
}

/**
 * Fetch a grid or row range of Google Street View tiles concurrently on the backend.
 * Bypasses browser per-origin HTTP/1.1 connection limits when loading 4K (32 tiles) or 8K (128 tiles).
 */
async function fetchStreetViewTilesBatch(panoId, zoom = 3, cols = 8, rows = 4, startRow = 0, endRow = rows - 1) {
  const safeZoom = Math.max(0, Math.min(5, Number(zoom) || 3));
  const safeCols = Math.max(1, Math.min(32, Number(cols) || 8));
  const safeRows = Math.max(1, Math.min(16, Number(rows) || 4));
  const rStart = Math.max(0, Math.min(safeRows - 1, Number(startRow) || 0));
  const rEnd = Math.max(rStart, Math.min(safeRows - 1, Number(endRow) ?? safeRows - 1));

  const coords = [];
  for (let y = rStart; y <= rEnd; y++) {
    for (let x = 0; x < safeCols; x++) {
      coords.push({ x, y });
    }
  }

  const CONCURRENCY = 16;
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < coords.length) {
      const idx = cursor++;
      const { x, y } = coords[idx];
      try {
        const buf = await fetchStreetViewTile(panoId, x, y, safeZoom);
        results.push({
          x,
          y,
          data: buf.toString('base64')
        });
      } catch (_) {
        // Ignore missing edge tiles gracefully
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, coords.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Query real 360° street-level imagery:
 * 1. First queries Google Street View 360° (`fetchGoogleStreetViewPano`) for maximum coverage across all Ortenau streets.
 * 2. Falls back to Panoramax 360° equirectangular imagery (live or verified 360° asset) if Google Street View is unreachable.
 * Strictly returns `is360: true` panoramas only.
 */
async function fetchStreetLevelImagery(lat, lng, verifiedImagery = null, searchRadius = 700) {
  // 1. Primary: Real Google Street View 360° Panorama
  const gsvPano = await fetchGoogleStreetViewPano(lat, lng, searchRadius);
  if (gsvPano && gsvPano.panoId && gsvPano.is360 === true) {
    return gsvPano;
  }

  // 2. Secondary: Live Panoramax 360° Equirectangular Search
  const delta = 0.008;
  const bbox = `${(lng - delta).toFixed(5)},${(lat - delta).toFixed(5)},${(lng + delta).toFixed(5)},${(lat + delta).toFixed(5)}`;
  const panoramaxUrl = `${PANORAMAX_SEARCH_URL}?bbox=${bbox}&limit=15`;

  try {
    const response = await fetch(panoramaxUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(2500)
    });
    if (response.ok) {
      const data = await response.json();
      const features = Array.isArray(data?.features) ? data.features : [];
      const feature360 = features.find(
        (f) =>
          f?.properties?.['pers:interior_orientation']?.field_of_view === 360 ||
          f?.properties?.exif?.['Xmp.GPano.ProjectionType'] === 'equirectangular'
      );

      if (feature360) {
        const sdUrl =
          feature360?.assets?.sd?.href ||
          feature360?.assets?.hd?.href ||
          null;
        const hdUrl =
          feature360?.assets?.hd?.href ||
          feature360?.assets?.sd?.href ||
          sdUrl;

        if (sdUrl && /^https?:\/\//i.test(sdUrl)) {
          const [pLng, pLat] = Array.isArray(feature360?.geometry?.coordinates)
            ? feature360.geometry.coordinates
            : [lng, lat];
          return {
            provider: 'Panoramax 360° StreetView (OpenStreetMap)',
            imageUrl: sdUrl,
            hdUrl: hdUrl || sdUrl,
            is360: true,
            lat: Number(pLat ?? lat),
            lng: Number(pLng ?? lng),
            heading: Number(feature360?.properties?.['view:azimuth'] ?? verifiedImagery?.heading ?? 0)
          };
        }
      }
    }
  } catch (_) {
    // Fall through to verified 360° imagery if available
  }

  // 3. Offline / Verified 360° Fallback
  if (
    verifiedImagery?.is360 === true &&
    verifiedImagery?.imageUrl &&
    /^https?:\/\//i.test(verifiedImagery.imageUrl)
  ) {
    return {
      provider: verifiedImagery.provider || 'Panoramax 360° StreetView (OpenStreetMap)',
      imageUrl: verifiedImagery.imageUrl,
      hdUrl: verifiedImagery.hdUrl || verifiedImagery.imageUrl,
      is360: true,
      lat,
      lng,
      heading: Number(verifiedImagery.heading ?? 0)
    };
  }

  return null;
}

module.exports = {
  fetchGoogleStreetViewPano,
  fetchStreetViewTile,
  fetchStreetViewTilesBatch,
  fetchStreetLevelImagery,
  USER_AGENT
};


