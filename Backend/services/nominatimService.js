/**
 * Ortenau Guesser - Nominatim Reverse Geocoding Service
 * Queries OpenStreetMap Nominatim API for reverse geocoding metadata in Ortenaukreis.
 */

const { USER_AGENT } = require('./streetviewService');

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

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

module.exports = {
  fetchReverseGeocode
};

