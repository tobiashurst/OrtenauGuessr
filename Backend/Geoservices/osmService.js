/**
 * Ortenau Guesser - OpenStreetMap Geoservices (Overpass API, Nominatim API, Panoramax / Wikimedia)
 * Strictly scoped to Ortenaukreis, Baden-Württemberg, Germany.
 */

const crypto = require('crypto');
const { ORTENAU_REGION, ORTENAU_LOCATIONS, isPointInOrtenau } = require('./ortenauLocations');

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const PANORAMAX_SEARCH_URL = 'https://api.panoramax.xyz/api/search';
const WIKIMEDIA_GEOSEARCH_URL = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'OrtenauGuesser/1.0 (Ortenaukreis OpenStreetMap Game; Baden-Wuerttemberg)';

// In-memory store for active singleplayer rounds (no persistent database required)
const activeRounds = new Map();
// Cache Overpass / Nominatim lookups by location ID so repeated rounds are snappy
const osmCache = new Map();

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
      way["natural"](around:${radiusMeters},${lat},${lng});
      way["landuse"](around:${radiusMeters},${lat},${lng});
    );
    out center tags qt 50;
  `.trim();

  try {
    const response = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(3500)
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
    const landuse = [];

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
        const levels = parseInt(tags['building:levels'], 10) || (tags.building === 'church' ? 4 : 3);
        buildings.push({
          osmId: el.id,
          name: tags.name || tags['addr:housename'] || null,
          type: tags.building === 'yes' ? (tags.amenity || tags.historic || 'residential') : tags.building,
          levels,
          roofShape: tags['roof:shape'] || 'gabled',
          color: tags['building:colour'] || null,
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
      } else if (tags.natural || tags.landuse) {
        landuse.push({
          type: tags.natural || tags.landuse,
          name: tags.name || null,
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
      signs: signs.slice(0, 6),
      landuse: landuse.slice(0, 6)
    };
  } catch (err) {
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
      signal: AbortSignal.timeout(3000)
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
      county: addr.county || 'Ortenaukreis',
      state: addr.state || 'Baden-Württemberg',
      postcode: addr.postcode || null
    };
  } catch (err) {
    return null;
  }
}

/**
 * Query open OSM-ecosystem street-level imagery (Panoramax API & Wikimedia Commons Geosearch)
 */
async function fetchStreetLevelImagery(lat, lng) {
  const delta = 0.006;
  const bbox = `${(lng - delta).toFixed(5)},${(lat - delta).toFixed(5)},${(lng + delta).toFixed(5)},${(lat + delta).toFixed(5)}`;
  const panoramaxUrl = `${PANORAMAX_SEARCH_URL}?bbox=${bbox}&limit=1`;

  try {
    const response = await fetch(panoramaxUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(2500)
    });
    if (response.ok) {
      const data = await response.json();
      const feature = data?.features?.[0];
      if (feature) {
        const thumbUrl =
          feature?.assets?.sd?.href ||
          feature?.assets?.thumb?.href ||
          feature?.assets?.hd?.href ||
          null;
        if (thumbUrl) {
          return {
            provider: 'Panoramax (OpenStreetMap Street-Level Imagery)',
            imageUrl: thumbUrl,
            captureTime: feature?.properties?.datetime || null,
            coordinates: feature?.geometry?.coordinates || [lng, lat]
          };
        }
      }
    }
  } catch (_) {
    // Fall through to Wikimedia Commons geosearch
  }

  try {
    const wikiUrl = `${WIKIMEDIA_GEOSEARCH_URL}?action=query&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=500&ggslimit=1&ggsnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=1280&format=json&origin=*`;
    const response = await fetch(wikiUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(2500)
    });
    if (response.ok) {
      const data = await response.json();
      const pages = data?.query?.pages;
      if (pages) {
        const firstPage = Object.values(pages)[0];
        const info = firstPage?.imageinfo?.[0];
        if (info?.thumburl || info?.url) {
          return {
            provider: 'Wikimedia Commons / OpenStreetMap Geosearch',
            imageUrl: info.thumburl || info.url,
            title: firstPage.title?.replace(/^File:/, '') || null
          };
        }
      }
    }
  } catch (_) {
    // Graceful fallback if offline or no nearby open photo
  }

  return {
    provider: 'OpenStreetMap 360° Procedural StreetView (Overpass Geometry)',
    imageUrl: null
  };
}

/**
 * Select a random street-level location strictly inside Ortenaukreis and enrich it
 * with live OpenStreetMap Overpass, Nominatim, and Panoramax data (with instant fallback).
 */
async function getRandomOrtenauLocation(excludeIds = []) {
  const validLocations = ORTENAU_LOCATIONS.filter(
    (loc) => isPointInOrtenau(loc.lat, loc.lng) && !excludeIds.includes(loc.id)
  );
  const pool = validLocations.length > 0
    ? validLocations
    : ORTENAU_LOCATIONS.filter((loc) => isPointInOrtenau(loc.lat, loc.lng));

  const chosen = pool[Math.floor(Math.random() * pool.length)];

  let cached = osmCache.get(chosen.id);
  if (!cached) {
    const [overpassRes, nominatimRes, imageryRes] = await Promise.allSettled([
      fetchOverpassSurroundings(chosen.lat, chosen.lng, 120),
      fetchReverseGeocode(chosen.lat, chosen.lng),
      fetchStreetLevelImagery(chosen.lat, chosen.lng)
    ]);

    const liveOverpass = overpassRes.status === 'fulfilled' ? overpassRes.value : null;
    const liveNominatim = nominatimRes.status === 'fulfilled' ? nominatimRes.value : null;
    const liveImagery = imageryRes.status === 'fulfilled' ? imageryRes.value : null;

    const mergedRoads =
      liveOverpass?.roads?.length >= 2 ? liveOverpass.roads : chosen.baselineRoads;
    const mergedBuildings =
      liveOverpass?.buildings?.length >= 2 ? liveOverpass.buildings : chosen.baselineBuildings;
    const mergedSigns =
      liveOverpass?.signs?.length >= 1
        ? [...chosen.baselineSigns, ...liveOverpass.signs].slice(0, 4)
        : chosen.baselineSigns;
    const mergedPois =
      liveOverpass?.pois?.length >= 1
        ? liveOverpass.pois
        : chosen.landmarks.map((name, idx) => ({
            name,
            category: 'landmark',
            bearing: (chosen.defaultHeading + idx * 95) % 360,
            distance: 25 + idx * 15
          }));

    cached = {
      osmContext: {
        source: liveOverpass ? liveOverpass.source : 'OpenStreetMap Baseline Geodata (Ortenaukreis)',
        osmRelationId: ORTENAU_REGION.osmRelationId,
        terrain: chosen.terrain,
        elevation: chosen.elevation,
        roads: mergedRoads,
        buildings: mergedBuildings,
        signs: mergedSigns,
        pois: mergedPois,
        landmarks: chosen.landmarks,
        reverseGeocode: liveNominatim || {
          source: 'OpenStreetMap Curated Address (Ortenaukreis)',
          road: chosen.baselineRoads?.[0]?.name || chosen.name,
          municipality: chosen.municipality,
          county: 'Ortenaukreis',
          state: 'Baden-Württemberg',
          postcode: chosen.postalCode
        }
      },
      imagery: liveImagery || {
        provider: 'OpenStreetMap 360° Procedural StreetView',
        imageUrl: null
      }
    };

    osmCache.set(chosen.id, cached);
  }

  const roundId = crypto.randomUUID();
  const roundPayload = {
    roundId,
    id: chosen.id,
    lat: chosen.lat,
    lng: chosen.lng,
    name: chosen.name,
    municipality: chosen.municipality,
    postalCode: chosen.postalCode,
    district: 'Ortenaukreis',
    region: 'Ortenaukreis',
    state: 'Baden-Württemberg',
    country: 'Germany',
    heading: chosen.defaultHeading,
    pitch: 0,
    terrain: chosen.terrain,
    elevation: chosen.elevation,
    description: chosen.description,
    landmarks: chosen.landmarks,
    osmContext: cached.osmContext,
    imagery: cached.imagery,
    streetView: {
      fixedPoint: true,
      allowMovement: false,
      allowLookAround: true,
      defaultHeading: chosen.defaultHeading,
      defaultPitch: 0,
      bounds: ORTENAU_REGION.bounds
    }
  };

  // Store round in memory (cap size at 500 to prevent memory leaks)
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

  // Calibrated for Ortenaukreis (diameter ~65 km):
  // <= 50m -> full 5000 pts; exponential decay with scale 12 km
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
  haversineDistanceMeters,
  calculateBearing,
  fetchOverpassSurroundings,
  fetchReverseGeocode,
  fetchStreetLevelImagery,
  getRandomOrtenauLocation,
  getRoundById,
  calculateDistanceAndScore
};
