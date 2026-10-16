/**
 * Ortenau Guesser - Region Boundaries & Geometry (Ortenaukreis, Baden-Württemberg)
 * OSM Relation ID: 62611
 */

const ORTENAU_REGION = {
  name: 'Ortenau (Ortenaukreis)',
  shortName: 'Ortenaukreis',
  state: 'Baden-Württemberg',
  country: 'Germany',
  osmRelationId: 62611,
  center: {
    lat: 48.4550,
    lng: 7.9850
  },
  defaultZoom: 10,
  minZoom: 9,
  maxZoom: 18,
  // Bounding box of Ortenaukreis (Rhine in the West, Black Forest crest in the East, Achern/Rheinau North, Rust/Ettenheim/Schuttertal South)
  bounds: {
    north: 48.72,
    south: 48.18,
    east: 8.35,
    west: 7.70
  },
  // Approximate polygon of Ortenaukreis [lat, lng] clockwise for boundary rendering & point-in-polygon checks
  polygon: [
    [48.695, 7.925], // Rheinau (North Rhine)
    [48.685, 8.020], // Achern North
    [48.650, 8.135], // Sasbachwalden / Hornisgrinde North-West
    [48.605, 8.205], // Seebach / Hornisgrinde / Mummelsee
    [48.520, 8.245], // Oppenau / Lierbach
    [48.445, 8.320], // Bad Peterstal-Griesbach (East)
    [48.325, 8.285], // Wolfach / Kirnbach
    [48.205, 8.245], // Hornberg (South-East)
    [48.195, 8.110], // Mühlenbach / Hofstetten
    [48.210, 7.965], // Schuttertal / Dörlinbach
    [48.220, 7.820], // Ettenheim / Ringsheim
    [48.235, 7.715], // Rust / Taubergießen (South-West Rhine)
    [48.295, 7.710], // Kappel-Grafenhausen (Rhine crossing Rhinau)
    [48.360, 7.730], // Schwanau / Meißenheim (Rhine)
    [48.465, 7.775], // Neuried / Altenheim (Rhine)
    [48.575, 7.800], // Kehl (Rhine border to Strasbourg)
    [48.655, 7.865], // Rheinau-Freistett
    [48.695, 7.925]
  ],
  tileServer: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
};

/**
 * Ray-casting point-in-polygon check + bounding box check to ensure any coordinate
 * is strictly within the Ortenaukreis region.
 */
function isPointInOrtenau(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return false;
  }
  const { north, south, east, west } = ORTENAU_REGION.bounds;
  if (lat < south || lat > north || lng < west || lng > east) {
    return false;
  }

  const poly = ORTENAU_REGION.polygon;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0];
    const xi = poly[i][1];
    const yj = poly[j][0];
    const xj = poly[j][1];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Generate a random geographic coordinate strictly inside the Ortenaukreis polygon.
 */
function generateRandomPointInOrtenau() {
  const { north, south, east, west } = ORTENAU_REGION.bounds;
  for (let i = 0; i < 100; i++) {
    const lat = Number((south + Math.random() * (north - south)).toFixed(6));
    const lng = Number((west + Math.random() * (east - west)).toFixed(6));
    if (isPointInOrtenau(lat, lng)) {
      return { lat, lng };
    }
  }
  return { lat: 48.4719, lng: 7.9446 };
}

module.exports = {
  ORTENAU_REGION,
  isPointInOrtenau,
  generateRandomPointInOrtenau
};

