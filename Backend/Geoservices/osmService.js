/**
 * Ortenau Guesser - Geoservices (Google Street View 360° + OpenStreetMap Overpass/Nominatim + Panoramax 360°)
 * Strictly scoped to Ortenaukreis, Baden-Württemberg, Germany.
 * Provides maximum variety by discovering real 360° Street View panoramas across all towns,
 * villages, valleys, and roads of the Ortenaukreis.
 */

const crypto = require('crypto');
const {
  ORTENAU_REGION,
  ORTENAU_LOCATIONS,
  isPointInOrtenau,
  generateRandomPointInOrtenau
} = require('./ortenauLocations');

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const PANORAMAX_SEARCH_URL = 'https://api.panoramax.xyz/api/search';
const GOOGLE_SINGLE_IMAGE_SEARCH_URL =
  'https://maps.googleapis.com/$rpc/google.internal.maps.mapsjs.v1.MapsJsInternalService/SingleImageSearch';
const GOOGLE_STREETVIEW_TILE_URL = 'https://streetviewpixels-pa.googleapis.com/v1/tile';
const USER_AGENT = 'OrtenauGuesser/1.0 (Ortenaukreis StreetView Game; Baden-Wuerttemberg)';

// In-memory store for active singleplayer rounds
const activeRounds = new Map();
// Track recently served panoIds so players get maximum variety and never repeat the same panorama
const recentPanoIds = [];

/**
 * Convert degrees to radians
 */
function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
function toDegrees(rad) {
  return (rad * 180) / Math.PI;
}

/**
 * Calculate Haversine distance in meters between two WGS84 coordinates
 */
function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth mean radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate true compass bearing (0° = North, 90° = East, 180° = South, 270° = West)
 */
function calculateBearing(lat1, lng1, lat2, lng2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lng2 - lng1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return Math.round((toDegrees(theta) + 360) % 360);
}

/**
 * Convert bearing degrees to 8-point compass direction
 */
function bearingToCardinal(bearing) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((bearing % 360) / 45)) % 8;
  return directions[index];
}

/**
 * Find the closest municipality entry in ORTENAU_LOCATIONS to enrich random coordinates
 */
function findNearestMunicipalityEntry(lat, lng) {
  let best = ORTENAU_LOCATIONS[0];
  let bestDist = Infinity;
  for (const loc of ORTENAU_LOCATIONS) {
    const d = haversineDistanceMeters(lat, lng, loc.lat, loc.lng);
    if (d < bestDist) {
      bestDist = d;
      best = loc;
    }
  }
  return best;
}

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
    // data[1][2][3][0] is an array of [[height, width], ...] for zoom 0..5
    const rawZoomSizes = data?.[1]?.[2]?.[3]?.[0];
    const zoomSizes = Array.isArray(rawZoomSizes)
      ? rawZoomSizes.map((pair) => ({
          height: Number(pair?.[0]?.[0] ?? pair?.[0] ?? 1024),
          width: Number(pair?.[0]?.[1] ?? pair?.[1] ?? 2048)
        }))
      : null;

    const z2Size = zoomSizes?.[2] || { width: 2048, height: 1024 };
    const z3Size = zoomSizes?.[3] || { width: 4096, height: 2048 };

    return {
      provider: 'Google Street View 360°',
      panoId,
      is360: true,
      lat: panoLat,
      lng: panoLng,
      heading: Math.round(panoHeading),
      tileZoom: 2,
      worldWidth: z2Size.width,
      worldHeight: z2Size.height,
      hdWorldWidth: z3Size.width,
      hdWorldHeight: z3Size.height,
      tileUrlTemplate: `/api/streetview/tile?panoid=${encodeURIComponent(panoId)}&zoom={z}&x={x}&y={y}`
    };
  } catch (_) {
    return null;
  }
}

/**
 * Fetch a single 512x512 JPEG tile for a Google Street View 360° panorama.
 */
async function fetchStreetViewTile(panoId, x, y, zoom = 2) {
  const url = `${GOOGLE_STREETVIEW_TILE_URL}?cb_client=maps_sv.tactile&panoid=${encodeURIComponent(
    panoId
  )}&x=${encodeURIComponent(x)}&y=${encodeURIComponent(y)}&zoom=${encodeURIComponent(
    zoom
  )}&nbt=1&fover=2`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT
    },
    signal: AbortSignal.timeout(4000)
  });

  if (!response.ok) {
    throw new Error(`StreetView tile HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Query OpenStreetMap Overpass API for real roads, buildings, POIs, and landuse
 * around a coordinate in Ortenaukreis.
 */
async function fetchOverpassSurroundings(lat, lng, radiusMeters = 120) {
  const query = `
    [out:json][timeout:3];
    (
      way["highway"](around:${radiusMeters},${lat},${lng});
      way["building"](around:${radiusMeters},${lat},${lng});
      node["amenity"](around:${radiusMeters},${lat},${lng});
      node["tourism"](around:${radiusMeters},${lat},${lng});
      node["historic"](around:${radiusMeters},${lat},${lng});
    );
    out center tags qt 40;
  `.trim();

  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(2500)
    });

    if (!response.ok) {
      throw new Error(`Overpass HTTP ${response.status}`);
    }

    const data = await response.json();
    const elements = Array.isArray(data.elements) ? data.elements : [];

    const roads = [];
    const buildings = [];
    const pois = [];
    const signs = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (typeof elLat !== 'number' || typeof elLng !== 'number') continue;

      const distance = Math.round(haversineDistanceMeters(lat, lng, elLat, elLng));
      const bearing = calculateBearing(lat, lng, elLat, elLng);

      if (tags.highway) {
        const roadName = tags.name || tags.ref || null;
        roads.push({
          osmId: el.id,
          name: roadName || `${tags.highway} road`,
          ref: tags.ref || null,
          highway: tags.highway,
          surface: tags.surface || 'asphalt',
          bearing,
          distance
        });

        if (roadName && signs.length < 5) {
          signs.push({
            text: roadName,
            subtext: tags.ref || tags['addr:city'] || 'Ortenaukreis',
            type: tags.ref ? 'direction' : 'street_name',
            bearing,
            distance: Math.max(6, Math.min(25, distance))
          });
        }
      } else if (tags.building) {
        buildings.push({
          osmId: el.id,
          name: tags.name || tags['addr:housename'] || null,
          type: tags.building,
          bearing,
          distance: Math.max(10, distance)
        });
      } else if (tags.amenity || tags.tourism || tags.historic) {
        const label = tags.name || tags.historic || tags.tourism || tags.amenity;
        pois.push({
          osmId: el.id,
          name: label,
          category: tags.tourism || tags.historic || tags.amenity,
          bearing,
          distance
        });
      }
    }

    return {
      source: 'OpenStreetMap Overpass API (live)',
      fetchedAt: new Date().toISOString(),
      roads: roads.slice(0, 10),
      buildings: buildings.slice(0, 14),
      pois: pois.slice(0, 10),
      signs: signs.slice(0, 6)
    };
  } catch (_) {
    return null;
  }
}

/**
 * Query OpenStreetMap Nominatim API for reverse geocoding metadata in Ortenaukreis.
 */
async function fetchReverseGeocode(lat, lng) {
  const url = `${NOMINATIM_REVERSE_URL}?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'de,en'
      },
      signal: AbortSignal.timeout(2500)
    });

    if (!response.ok) {
      throw new Error(`Nominatim HTTP ${response.status}`);
    }

    const data = await response.json();
    const addr = data.address || {};
    return {
      source: 'OpenStreetMap Nominatim API (live)',
      osmId: data.osm_id || null,
      osmType: data.osm_type || null,
      displayName: data.display_name || null,
      road: addr.road || addr.pedestrian || addr.footway || null,
      municipality: addr.town || addr.city || addr.village || addr.municipality || null,
      suburb: addr.suburb || addr.hamlet || addr.neighbourhood || null,
      county: addr.county || 'Ortenaukreis',
      state: addr.state || 'Baden-Württemberg',
      postcode: addr.postcode || null
    };
  } catch (_) {
    return null;
  }
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

/**
 * Select a random street-level location strictly inside Ortenaukreis with a real 360° panorama.
 * Combines all 51 Ortenaukreis municipalities (with random street jitter) and dynamic random
 * points inside the Ortenaukreis polygon to provide maximum variety across thousands of streets.
 */
async function getRandomOrtenauLocation(excludeIds = []) {
  const excludedSet = new Set([...excludeIds, ...recentPanoIds]);

  // Build a diverse candidate queue mixing jittered municipality seeds + pure random Ortenau points
  const availableSeeds = ORTENAU_LOCATIONS.filter((loc) => !excludedSet.has(loc.id));
  const pool = availableSeeds.length > 0 ? availableSeeds : ORTENAU_LOCATIONS;
  const shuffledSeeds = [...pool].sort(() => Math.random() - 0.5);

  const probeQueue = [];

  // Interleave jittered municipality coordinates (explores different streets in every town)
  // and completely random coordinates inside the Ortenaukreis polygon
  for (let i = 0; i < Math.min(8, shuffledSeeds.length); i++) {
    const seed = shuffledSeeds[i];
    // Jitter by up to ±900m around the municipality center so every visit lands on a new street
    const jitterLat = seed.lat + (Math.random() - 0.5) * 0.014;
    const jitterLng = seed.lng + (Math.random() - 0.5) * 0.018;
    const targetLat = isPointInOrtenau(jitterLat, jitterLng) ? jitterLat : seed.lat;
    const targetLng = isPointInOrtenau(jitterLat, jitterLng) ? jitterLng : seed.lng;

    probeQueue.push({
      baseSeed: seed,
      lat: Number(targetLat.toFixed(6)),
      lng: Number(targetLng.toFixed(6)),
      searchRadius: 900
    });

    if (i % 2 === 1) {
      const randPt = generateRandomPointInOrtenau();
      const nearest = findNearestMunicipalityEntry(randPt.lat, randPt.lng);
      probeQueue.push({
        baseSeed: nearest,
        lat: randPt.lat,
        lng: randPt.lng,
        searchRadius: 1500
      });
    }
  }

  // Also append verified 360° fallback seeds at the end of the queue in case the environment is offline
  const verifiedSeeds = shuffledSeeds.filter(
    (s) => s.verifiedImagery?.is360 === true && s.verifiedImagery?.imageUrl
  );
  for (const vSeed of verifiedSeeds) {
    probeQueue.push({
      baseSeed: vSeed,
      lat: vSeed.lat,
      lng: vSeed.lng,
      searchRadius: 600,
      useVerifiedFallback: true
    });
  }

  let chosenBase = null;
  let resolvedImagery = null;

  for (const probe of probeQueue) {
    const imagery = await fetchStreetLevelImagery(
      probe.lat,
      probe.lng,
      probe.useVerifiedFallback ? probe.baseSeed.verifiedImagery : null,
      probe.searchRadius
    );

    if (
      imagery &&
      imagery.is360 === true &&
      (imagery.panoId || imagery.imageUrl)
    ) {
      // Skip if this exact Google Street View panoId was already used recently
      if (imagery.panoId && excludedSet.has(imagery.panoId)) {
        continue;
      }
      chosenBase = findNearestMunicipalityEntry(
        imagery.lat ?? probe.lat,
        imagery.lng ?? probe.lng
      );
      resolvedImagery = imagery;
      break;
    }
  }

  if (!chosenBase || !resolvedImagery || resolvedImagery.is360 !== true) {
    throw new Error('No Ortenau locations with real 360° street-view imagery are currently available.');
  }

  const finalLat = Number((resolvedImagery.lat ?? chosenBase.lat).toFixed(6));
  const finalLng = Number((resolvedImagery.lng ?? chosenBase.lng).toFixed(6));

  if (resolvedImagery.panoId) {
    recentPanoIds.push(resolvedImagery.panoId);
    if (recentPanoIds.length > 100) {
      recentPanoIds.shift();
    }
  }

  // Fetch live OSM reverse geocode & road context for the exact StreetView panorama coordinate
  const [overpassRes, nominatimRes] = await Promise.allSettled([
    fetchOverpassSurroundings(finalLat, finalLng, 100),
    fetchReverseGeocode(finalLat, finalLng)
  ]);

  const liveOverpass = overpassRes.status === 'fulfilled' ? overpassRes.value : null;
  const liveNominatim = nominatimRes.status === 'fulfilled' ? nominatimRes.value : null;

  const finalMunicipality =
    liveNominatim?.municipality || chosenBase.municipality || 'Ortenaukreis';
  const finalRoadName =
    liveNominatim?.road ||
    liveOverpass?.roads?.[0]?.name ||
    chosenBase.name ||
    `${finalMunicipality} Street View`;
  const finalLocationName =
    liveNominatim?.road && liveNominatim?.suburb
      ? `${liveNominatim.road} (${liveNominatim.suburb})`
      : liveNominatim?.road
        ? liveNominatim.road
        : chosenBase.name;

  const effectiveHeading = Number(
    resolvedImagery.heading ?? chosenBase.defaultHeading ?? 0
  );

  const roundId = crypto.randomUUID();
  const uniqueLocationId = resolvedImagery.panoId
    ? `${chosenBase.id}-${resolvedImagery.panoId.slice(0, 8)}`
    : chosenBase.id;

  const roundPayload = {
    roundId,
    id: uniqueLocationId,
    lat: finalLat,
    lng: finalLng,
    name: finalLocationName,
    municipality: finalMunicipality,
    postalCode: liveNominatim?.postcode || chosenBase.postalCode || '',
    district: 'Ortenaukreis',
    region: 'Ortenaukreis',
    state: 'Baden-Württemberg',
    country: 'Germany',
    heading: effectiveHeading,
    pitch: 0,
    terrain: chosenBase.terrain || 'foothills',
    elevation: chosenBase.elevation || 185,
    description:
      chosenBase.description ||
      `${finalMunicipality} (${finalRoadName}) in the Ortenaukreis, Baden-Württemberg.`,
    landmarks: chosenBase.landmarks || [],
    osmContext: {
      source: liveOverpass ? liveOverpass.source : 'OpenStreetMap Geodata (Ortenaukreis)',
      osmRelationId: ORTENAU_REGION.osmRelationId,
      terrain: chosenBase.terrain,
      elevation: chosenBase.elevation,
      roads: liveOverpass?.roads || [],
      buildings: liveOverpass?.buildings || [],
      signs: liveOverpass?.signs || [],
      pois: liveOverpass?.pois || [],
      landmarks: chosenBase.landmarks || [],
      reverseGeocode: liveNominatim || {
        source: 'OpenStreetMap Address (Ortenaukreis)',
        road: finalRoadName,
        municipality: finalMunicipality,
        county: 'Ortenaukreis',
        state: 'Baden-Württemberg',
        postcode: chosenBase.postalCode
      }
    },
    imagery: resolvedImagery,
    streetView: {
      fixedPoint: true,
      allowMovement: false,
      allowLookAround: true,
      defaultHeading: effectiveHeading,
      defaultPitch: 0,
      panoId: resolvedImagery.panoId || null,
      tileZoom: resolvedImagery.tileZoom || 2,
      worldWidth: resolvedImagery.worldWidth || 2048,
      worldHeight: resolvedImagery.worldHeight || 1024,
      imageUrl: resolvedImagery.imageUrl || null,
      hdUrl: resolvedImagery.hdUrl || resolvedImagery.imageUrl || null,
      is360: true,
      provider: resolvedImagery.provider,
      bounds: ORTENAU_REGION.bounds
    }
  };

  if (activeRounds.size >= 500) {
    const oldestKey = activeRounds.keys().next().value;
    activeRounds.delete(oldestKey);
  }
  activeRounds.set(roundId, roundPayload);

  return roundPayload;
}

/**
 * Retrieve a stored round by roundId
 */
function getRoundById(roundId) {
  if (!roundId) return null;
  return activeRounds.get(roundId) || null;
}

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
  ORTENAU_REGION,
  ORTENAU_LOCATIONS,
  isPointInOrtenau,
  generateRandomPointInOrtenau,
  haversineDistanceMeters,
  calculateBearing,
  fetchGoogleStreetViewPano,
  fetchStreetViewTile,
  fetchOverpassSurroundings,
  fetchReverseGeocode,
  fetchStreetLevelImagery,
  getRandomOrtenauLocation,
  getRoundById,
  calculateDistanceAndScore
};
