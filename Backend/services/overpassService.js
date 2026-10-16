/**
 * Ortenau Guesser - Overpass Service
 * Queries OpenStreetMap Overpass API for real roads, buildings, POIs, and landuse
 * around a coordinate in Ortenaukreis.
 */

const { haversineDistanceMeters, calculateBearing } = require('../utils/geoUtils');
const { USER_AGENT } = require('./streetviewService');

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

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

module.exports = {
  fetchOverpassSurroundings
};

