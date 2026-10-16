/**
 * Ortenau Guesser - Round Management Service
 * Handles candidate generation, candidate jittering, panorama selection,
 * active round state storage, and duplicate avoidance.
 */

const crypto = require('crypto');
const {
  ORTENAU_REGION,
  isPointInOrtenau,
  generateRandomPointInOrtenau
} = require('../data/ortenauRegion');
const { ORTENAU_LOCATIONS } = require('../data/ortenauSeeds');
const { haversineDistanceMeters } = require('../utils/geoUtils');
const { fetchStreetLevelImagery } = require('./streetviewService');
const { fetchOverpassSurroundings } = require('./overpassService');
const { fetchReverseGeocode } = require('./nominatimService');

// In-memory store for active singleplayer rounds
const activeRounds = new Map();
// Track recently served panoIds so players get maximum variety and never repeat the same panorama
const recentPanoIds = [];

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

module.exports = {
  activeRounds,
  recentPanoIds,
  findNearestMunicipalityEntry,
  getRandomOrtenauLocation,
  getRoundById
};

