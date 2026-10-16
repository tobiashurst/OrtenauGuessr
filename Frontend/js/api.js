/**
 * Ortenau Guesser - API Communication (Frontend/js/api.js)
 * Interacts with backend /api/region, /api/location/random, and /api/guess.
 */

import { DEFAULT_ORTENAU_REGION, state } from './state.js';
import { dom } from './dom.js';

/**
 * Fetch Ortenau region config from Backend or fallback to local constants
 */
export async function fetchRegionConfig() {
  try {
    const response = await fetch('/api/region');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const regionObj = data.region || data;

    if (regionObj && regionObj.bounds && regionObj.center) {
      state.region = {
        ...DEFAULT_ORTENAU_REGION,
        ...regionObj,
        polygon: Array.isArray(regionObj.polygon) && regionObj.polygon.length > 3
          ? regionObj.polygon
          : DEFAULT_ORTENAU_REGION.polygon
      };
    }
    if (dom.apiStatusBadge) {
      dom.apiStatusBadge.textContent = 'OSM Live Connected';
      dom.apiStatusBadge.classList.add('status-online');
    }
  } catch (err) {
    console.warn('Using built-in Ortenaukreis region definition:', err.message);
    if (dom.apiStatusBadge) {
      dom.apiStatusBadge.textContent = 'OSM Ready (Local)';
    }
  }
}

/**
 * Fetch a random street-view location in Ortenaukreis, excluding recently visited IDs
 */
export async function fetchRandomOrtenauLocation() {
  const excludeParam = state.usedLocationIds.length > 0
    ? `?exclude=${encodeURIComponent(state.usedLocationIds.join(','))}`
    : '';

  const response = await fetch(`/api/location/random${excludeParam}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch random Ortenau location (${response.status})`);
  }
  const payload = await response.json();
  return normalizeLocationData(payload.location || payload);
}

/**
 * Normalizes location data from Backend/Geoservices so all OSM fields
 * and real 360° StreetView imagery metadata are consistently structured.
 */
export function normalizeLocationData(raw) {
  const lat = Number(raw.lat ?? raw.coordinates?.lat ?? 48.4708);
  const lng = Number(raw.lng ?? raw.lon ?? raw.coordinates?.lng ?? 7.9446);
  const osm = raw.osmContext || {};
  const sv = raw.streetView || raw.panorama || {};
  const img = raw.imagery || {};

  const roads = osm.roads || raw.baselineRoads || raw.roads || [];
  const buildings = osm.buildings || raw.baselineBuildings || raw.buildings || [];
  const signs = osm.streetSigns || osm.signs || raw.baselineSigns || raw.signs || [];
  const landmarks = osm.landmarks || raw.landmarks || [];

  const imageUrl = img.imageUrl || sv.imageUrl || sv.panoramaxImageUrl || null;
  const hdUrl = img.hdUrl || sv.hdUrl || imageUrl;
  const panoId = img.panoId || sv.panoId || null;
  const worldWidth = Number(img.worldWidth || sv.worldWidth || 2048);
  const worldHeight = Number(img.worldHeight || sv.worldHeight || 1024);
  const tileZoom = Number(img.tileZoom || sv.tileZoom || 2);
  const is360 = Boolean(img.is360 === true || sv.is360 === true);
  const provider = img.provider || sv.provider || (panoId ? 'Google Street View 360°' : 'Panoramax 360° StreetView');
  const heading = Number(img.heading ?? raw.heading ?? raw.defaultHeading ?? 0);

  return {
    id: raw.id || raw.roundId || `ortenau-${lat.toFixed(4)}-${lng.toFixed(4)}`,
    roundId: raw.roundId || raw.id || `round-${Date.now()}`,
    lat,
    lng,
    name: raw.name || osm.Suburb || 'Ortenau Street Drop',
    municipality: raw.municipality || osm.municipality || osm.city || osm.town || 'Ortenaukreis',
    postalCode: raw.postalCode || osm.postcode || '',
    terrain: raw.terrain || osm.terrain || 'foothills',
    elevation: Number(raw.elevation ?? osm.elevation ?? 210),
    heading,
    description: raw.description || '',
    landmarks,
    roads,
    buildings,
    signs,
    imagery: {
      imageUrl,
      hdUrl,
      panoId,
      worldWidth,
      worldHeight,
      tileZoom,
      is360,
      provider,
      heading
    },
    streetView: {
      ...sv,
      imageUrl,
      hdUrl,
      panoId,
      worldWidth,
      worldHeight,
      tileZoom,
      is360,
      provider
    }
  };
}

/**
 * Submit guess to backend or fallback to client-side distance computation
 */
export async function submitGuessApi(actual, guess) {
  try {
    const response = await fetch('/api/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roundId: actual.roundId,
        locationId: actual.id,
        actual: {
          lat: actual.lat,
          lng: actual.lng,
          roundId: actual.roundId,
          id: actual.id,
          name: actual.name,
          municipality: actual.municipality
        },
        guess: {
          lat: guess.lat,
          lng: guess.lng
        },
        actualLat: actual.lat,
        actualLng: actual.lng,
        guessLat: guess.lat,
        guessLng: guess.lng
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn('Fallback to client-side Haversine distance calculation:', err.message);
    return computeClientFallbackGuessResult(actual, guess);
  }
}

/**
 * Client-side Haversine & scoring fallback when backend is unreachable
 */
export function computeClientFallbackGuessResult(actual, guess) {
  const R = 6371000; // Earth radius in meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(guess.lat - actual.lat);
  const dLng = toRad(guess.lng - actual.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(actual.lat)) * Math.cos(toRad(guess.lat)) * Math.sin(dLng / 2) ** 2;
  const distanceMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  const distanceKm = Number((distanceMeters / 1000).toFixed(2));
  const distanceFormatted =
    distanceMeters < 1000 ? `${distanceMeters} m` : `${distanceKm.toFixed(2)} km`;

  // Ortenau regional scale scoring (5,000 max, decaying over ~35 km)
  const score =
    distanceMeters <= 35
      ? 5000
      : Math.max(0, Math.round(5000 * Math.exp(-distanceMeters / 14000)));

  return {
    distanceMeters,
    distanceKm,
    distanceFormatted,
    score,
    maxScore: 5000
  };
}

