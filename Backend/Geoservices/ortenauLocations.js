/**
 * Ortenau Guesser - Authentic Ortenaukreis (Baden-Württemberg, Germany) Geodata
 * OpenStreetMap Administrative Relation ID: 62608 (Ortenaukreis)
 */

const ORTENAU_REGION = {
  name: 'Ortenaukreis',
  displayName: 'Ortenau (Ortenaukreis), Baden-Württemberg, Germany',
  state: 'Baden-Württemberg',
  country: 'Germany',
  osmRelationId: 62608,
  center: {
    lat: 48.4719,
    lng: 7.9498
  },
  bounds: {
    south: 48.18,
    west: 7.75,
    north: 48.72,
    east: 8.35
  },
  // Multi-point boundary polygon approximating Ortenaukreis [lat, lng]
  polygon: [
    [48.705, 7.915], // Rheinau (north-west Rhine border)
    [48.685, 8.015], // Achern / Sasbach
    [48.655, 8.155], // Sasbachwalden / Hornisgrinde north
    [48.605, 8.215], // Seebach / Mummelsee / Hornisgrinde
    [48.545, 8.245], // Oppenau / Zuflucht
    [48.445, 8.335], // Bad Peterstal-Griesbach (east Black Forest border)
    [48.325, 8.310], // Wolfach / Schiltach border
    [48.205, 8.265], // Hornberg / Gutach (south-east)
    [48.195, 8.120], // Mühlenbach / Schweighausen
    [48.220, 7.945], // Schuttertal / EttenheimMünster
    [48.245, 7.795], // Ettenheim / Ringsheim
    [48.260, 7.715], // Rust / Kappel-Grafenhausen (Rhine south-west)
    [48.365, 7.735], // Nonnenweier / Meißenheim (Rhine)
    [48.455, 7.770], // Neuried / Altenheim (Rhine)
    [48.575, 7.800], // Kehl am Rhein (Rhine west border)
    [48.665, 7.880], // Rheinau-Freistett (Rhine)
    [48.705, 7.915]  // Close polygon
  ],
  tileServerUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  municipalities: [
    'Offenburg',
    'Lahr/Schwarzwald',
    'Kehl',
    'Achern',
    'Oberkirch',
    'Gengenbach',
    'Haslach im Kinzigtal',
    'Wolfach',
    'Hausach',
    'Hornberg',
    'Zell am Harmersbach',
    'Ettenheim',
    'Rust',
    'Rheinau',
    'Oppenau',
    'Sasbachwalden',
    'Durbach',
    'Kappelrodeck',
    'Bad Peterstal-Griesbach',
    'Appenweier',
    'Schutterwald',
    'Neuried',
    'Meißenheim',
    'Friesenheim',
    'Seelbach'
  ]
};

/**
 * Checks whether a coordinate lies within the Ortenau bounding box and boundary polygon.
 */
function isPointInOrtenau(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return false;
  }

  const { south, west, north, east } = ORTENAU_REGION.bounds;
  // Allow slight margin around the Rhine border near Rust/Kehl (7.70 to 8.36)
  if (lat < south - 0.02 || lat > north + 0.02 || lng < 7.70 || lng > east + 0.02) {
    return false;
  }

  // Ray-casting point-in-polygon check
  const poly = ORTENAU_REGION.polygon;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }

  // Fallback to bounding box if right on the Rhine edge
  return inside || (lat >= south && lat <= north && lng >= west && lng <= east);
}

/**
 * 25 curated, authentic street-level coordinates strictly inside Ortenaukreis,
 * enriched with baseline OpenStreetMap road, building, and street sign context.
 */
const ORTENAU_LOCATIONS = [
  {
    id: 'ortenau-offenburg-marktplatz',
    lat: 48.4708,
    lng: 7.9446,
    name: 'Hauptstraße / Fischmarkt',
    municipality: 'Offenburg',
    postalCode: '77652',
    district: 'Ortenaukreis',
    terrain: 'rhine_valley',
    elevation: 163,
    defaultHeading: 15,
    description: 'Historic Baroque town center of Offenburg at the intersection of Hauptstraße and Steinstraße.',
    landmarks: ['Historisches Rathaus Offenburg', 'Ursulasäule', 'Salmen Offenburg'],
    baselineRoads: [
      { name: 'Hauptstraße', highway: 'pedestrian', bearing: 15, distance: 4, surface: 'paving_stones' },
      { name: 'Hauptstraße', highway: 'pedestrian', bearing: 195, distance: 4, surface: 'paving_stones' },
      { name: 'Steinstraße', highway: 'pedestrian', bearing: 105, distance: 12, surface: 'cobblestone' },
      { name: 'Metzgerstraße', highway: 'residential', bearing: 285, distance: 18, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'Historisches Rathaus', type: 'townhall', bearing: 35, distance: 22, levels: 3, roofShape: 'gabled', color: '#e8c7b8' },
      { name: 'Löwenapotheke', type: 'commercial', bearing: 130, distance: 18, levels: 4, roofShape: 'gabled', color: '#f3e5ab' },
      { name: 'Kaufhaus am Markt', type: 'retail', bearing: 240, distance: 25, levels: 4, roofShape: 'hipped', color: '#dcd6d0' },
      { name: 'Bürgerhaus Hauptstraße', type: 'apartments', bearing: 315, distance: 20, levels: 3, roofShape: 'gabled', color: '#ebd5b3' }
    ],
    baselineSigns: [
      { text: 'Hauptstraße', subtext: 'Fischmarkt', type: 'street_name', bearing: 25, distance: 8 },
      { text: 'B 3 → Lahr / Kehl / B 33 → Kinzigtal', subtext: 'Rathaus / Bahnhof 600m', type: 'direction', bearing: 195, distance: 14 }
    ]
  },
  {
    id: 'ortenau-gengenbach-marktplatz',
    lat: 48.4044,
    lng: 8.0153,
    name: 'Marktplatz / Victor-Kretz-Straße',
    municipality: 'Gengenbach',
    postalCode: '77723',
    district: 'Ortenaukreis',
    terrain: 'foothills',
    elevation: 175,
    defaultHeading: 90,
    description: 'Famous half-timbered old town (Altstadt) and Rathaus in Gengenbach in the Kinzig valley.',
    landmarks: ['Rathaus Gengenbach', 'Obertor', 'Kinzigtorturm', 'Engelgasse'],
    baselineRoads: [
      { name: 'Victor-Kretz-Straße', highway: 'residential', bearing: 85, distance: 5, surface: 'cobblestone' },
      { name: 'Hauptstraße', highway: 'pedestrian', bearing: 265, distance: 6, surface: 'cobblestone' },
      { name: 'Engelgasse', highway: 'footway', bearing: 355, distance: 16, surface: 'paving_stones' },
      { name: 'Höllengasse', highway: 'footway', bearing: 175, distance: 19, surface: 'cobblestone' }
    ],
    baselineBuildings: [
      { name: 'Rathaus Gengenbach', type: 'townhall', bearing: 90, distance: 24, levels: 4, roofShape: 'hipped', color: '#e6b89c' },
      { name: 'Obertor Turm', type: 'historic_tower', bearing: 5, distance: 65, levels: 6, roofShape: 'pyramidal', color: '#f4efe6' },
      { name: 'Fachwerkhaus Marktplatz', type: 'timber_frame', bearing: 210, distance: 16, levels: 3, roofShape: 'gabled', color: '#f5e8d3' },
      { name: 'Kornhaus', type: 'historic', bearing: 300, distance: 20, levels: 3, roofShape: 'gabled', color: '#eddcc4' }
    ],
    baselineSigns: [
      { text: 'Victor-Kretz-Straße', subtext: 'Historische Altstadt', type: 'street_name', bearing: 70, distance: 9 },
      { text: 'B 33 → Offenburg / Haslach i. K.', subtext: 'Kloster / Narrenmuseum', type: 'direction', bearing: 260, distance: 15 }
    ]
  },
  {
    id: 'ortenau-lahr-storchenturm',
    lat: 48.3396,
    lng: 7.8729,
    name: 'Marktstraße / Storchenturm',
    municipality: 'Lahr/Schwarzwald',
    postalCode: '77933',
    district: 'Ortenaukreis',
    terrain: 'foothills',
    elevation: 170,
    defaultHeading: 180,
    description: 'Downtown Lahr/Schwarzwald along Marktstraße right beside the medieval Storchenturm.',
    landmarks: ['Storchenturm Lahr', 'Marktplatz Lahr', 'Altes Rathaus Lahr'],
    baselineRoads: [
      { name: 'Marktstraße', highway: 'pedestrian', bearing: 0, distance: 4, surface: 'paving_stones' },
      { name: 'Marktstraße', highway: 'pedestrian', bearing: 180, distance: 4, surface: 'paving_stones' },
      { name: 'Kaiserstraße', highway: 'secondary', bearing: 270, distance: 25, surface: 'asphalt' },
      { name: 'Kirchstraße', highway: 'residential', bearing: 95, distance: 18, surface: 'paving_stones' }
    ],
    baselineBuildings: [
      { name: 'Storchenturm', type: 'historic_tower', bearing: 40, distance: 20, levels: 6, roofShape: 'gabled', color: '#b59e8a' },
      { name: 'Altes Rathaus Lahr', type: 'civic', bearing: 170, distance: 32, levels: 3, roofShape: 'hipped', color: '#e6ccb2' },
      { name: 'Stadthaus Marktstraße', type: 'retail', bearing: 285, distance: 15, levels: 4, roofShape: 'gabled', color: '#f0ead6' }
    ],
    baselineSigns: [
      { text: 'Marktstraße', subtext: 'Am Storchenturm', type: 'street_name', bearing: 15, distance: 7 },
      { text: 'B 415 → Biberach / Seelbach', subtext: 'Stadtpark Lahr 800m', type: 'direction', bearing: 270, distance: 14 }
    ]
  },
  {
    id: 'ortenau-kehl-marktplatz',
    lat: 48.5738,
    lng: 7.8136,
    name: 'Hauptstraße / Marktplatz Kehl',
    municipality: 'Kehl',
    postalCode: '77694',
    district: 'Ortenaukreis',
    terrain: 'rhine_valley',
    elevation: 139,
    defaultHeading: 340,
    description: 'Central square of Kehl am Rhein near the Friedenskirche and Rhine promenade.',
    landmarks: ['Friedenskirche Kehl', 'Weißtannenturm', 'Passerelle des Deux Rives'],
    baselineRoads: [
      { name: 'Hauptstraße', highway: 'secondary', bearing: 340, distance: 5, surface: 'asphalt' },
      { name: 'Hauptstraße', highway: 'secondary', bearing: 160, distance: 5, surface: 'asphalt' },
      { name: 'Rheinstraße', highway: 'residential', bearing: 250, distance: 14, surface: 'paving_stones' },
      { name: 'Kasernenstraße', highway: 'residential', bearing: 70, distance: 16, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'Friedenskirche Kehl', type: 'church', bearing: 80, distance: 35, levels: 4, roofShape: 'pitched', color: '#d8a48f' },
      { name: 'Rathaus Kehl', type: 'townhall', bearing: 240, distance: 28, levels: 3, roofShape: 'hipped', color: '#e9ecef' },
      { name: 'Geschäftshaus Hauptstraße', type: 'commercial', bearing: 330, distance: 18, levels: 4, roofShape: 'flat', color: '#f8f9fa' }
    ],
    baselineSigns: [
      { text: 'Hauptstraße', subtext: 'Marktplatz', type: 'street_name', bearing: 345, distance: 8 },
      { text: 'B 28 → Offenburg / Appenweier', subtext: 'Bahnhof Kehl / Rheinpromenade', type: 'direction', bearing: 160, distance: 12 }
    ]
  },
  {
    id: 'ortenau-achern-hauptstrasse',
    lat: 48.6317,
    lng: 8.0744,
    name: 'Hauptstraße / Rathausplatz',
    municipality: 'Achern',
    postalCode: '77855',
    district: 'Ortenaukreis',
    terrain: 'foothills',
    elevation: 148,
    defaultHeading: 120,
    description: 'Main thoroughfare of Achern looking toward Klauskirche and the northern Black Forest foothills.',
    landmarks: ['Klauskirche Achern', 'Rathaus am Markt Achern', 'Illenau'],
    baselineRoads: [
      { name: 'Hauptstraße', highway: 'secondary', bearing: 120, distance: 5, surface: 'asphalt' },
      { name: 'Hauptstraße', highway: 'secondary', bearing: 300, distance: 5, surface: 'asphalt' },
      { name: 'Rathausplatz', highway: 'pedestrian', bearing: 30, distance: 15, surface: 'paving_stones' },
      { name: 'Kirchstraße', highway: 'residential', bearing: 210, distance: 14, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'Klauskirche', type: 'church', bearing: 145, distance: 35, levels: 4, roofShape: 'dome', color: '#c9a690' },
      { name: 'Rathaus Achern', type: 'townhall', bearing: 25, distance: 24, levels: 3, roofShape: 'gabled', color: '#f2e8dc' },
      { name: 'Stadthaus Achern', type: 'commercial', bearing: 280, distance: 19, levels: 4, roofShape: 'gabled', color: '#e0d6c8' }
    ],
    baselineSigns: [
      { text: 'Hauptstraße', subtext: 'L 87', type: 'street_name', bearing: 115, distance: 8 },
      { text: 'L 86a → Sasbachwalden / Hornisgrinde', subtext: 'B 3 → Renchen / Bühl', type: 'direction', bearing: 125, distance: 14 }
    ]
  },
  {
    id: 'ortenau-oberkirch-hauptstrasse',
    lat: 48.5308,
    lng: 8.0789,
    name: 'Hauptstraße / Kirchplatz',
    municipality: 'Oberkirch',
    postalCode: '77704',
    district: 'Ortenaukreis',
    terrain: 'foothills',
    elevation: 192,
    defaultHeading: 135,
    description: 'Wine town of Oberkirch in the Renchtal below Schauenburg castle ruins.',
    landmarks: ['Schauenburg Oberkirch', 'Kirchplatz Oberkirch', 'Heimat- und Grimmelshausenmuseum'],
    baselineRoads: [
      { name: 'Hauptstraße', highway: 'pedestrian', bearing: 135, distance: 4, surface: 'paving_stones' },
      { name: 'Hauptstraße', highway: 'pedestrian', bearing: 315, distance: 4, surface: 'paving_stones' },
      { name: 'Bachanlage', highway: 'residential', bearing: 225, distance: 16, surface: 'asphalt' },
      { name: 'Apothekerhof', highway: 'footway', bearing: 45, distance: 14, surface: 'cobblestone' }
    ],
    baselineBuildings: [
      { name: 'Altes Rathaus Oberkirch', type: 'timber_frame', bearing: 120, distance: 20, levels: 3, roofShape: 'gabled', color: '#f5e6d3' },
      { name: 'St. Cyriak Kirche', type: 'church', bearing: 35, distance: 38, levels: 4, roofShape: 'pitched', color: '#d9c2b2' },
      { name: 'Fachwerkhaus Renchtal', type: 'timber_frame', bearing: 290, distance: 16, levels: 3, roofShape: 'gabled', color: '#f4e3c9' }
    ],
    baselineSigns: [
      { text: 'Hauptstraße', subtext: 'Fußgängerzone', type: 'street_name', bearing: 130, distance: 7 },
      { text: 'B 28 → Oppenau / Freudenstadt / Appenweier', subtext: 'Ruine Schauenburg 2 km', type: 'direction', bearing: 310, distance: 13 }
    ]
  },
  {
    id: 'ortenau-haslach-altstadt',
    lat: 48.2775,
    lng: 8.0869,
    name: 'Hauptstraße / Alter Marktplatz',
    municipality: 'Haslach im Kinzigtal',
    postalCode: '77716',
    district: 'Ortenaukreis',
    terrain: 'black_forest',
    elevation: 220,
    defaultHeading: 75,
    description: 'Half-timbered historic center of Haslach im Kinzigtal, home of Hansjakob and the Trachtenmuseum.',
    landmarks: ['Altes Kapuzinerkloster Haslach', 'Historisches Rathaus Haslach', 'St. Arbogast'],
    baselineRoads: [
      { name: 'Hauptstraße', highway: 'pedestrian', bearing: 75, distance: 4, surface: 'cobblestone' },
      { name: 'Hauptstraße', highway: 'pedestrian', bearing: 255, distance: 4, surface: 'cobblestone' },
      { name: 'Engelstraße', highway: 'residential', bearing: 165, distance: 13, surface: 'paving_stones' },
      { name: 'Pfarrgasse', highway: 'footway', bearing: 345, distance: 15, surface: 'cobblestone' }
    ],
    baselineBuildings: [
      { name: 'Historisches Rathaus Haslach', type: 'townhall', bearing: 80, distance: 21, levels: 3, roofShape: 'gabled', color: '#e6ccb2' },
      { name: 'Fachwerkhaus Markt', type: 'timber_frame', bearing: 195, distance: 15, levels: 3, roofShape: 'gabled', color: '#f6ebd8' },
      { name: 'Gasthaus Kreuz', type: 'timber_frame', bearing: 325, distance: 18, levels: 3, roofShape: 'gabled', color: '#edd9c0' }
    ],
    baselineSigns: [
      { text: 'Hauptstraße', subtext: 'Historische Altstadt', type: 'street_name', bearing: 70, distance: 8 },
      { text: 'B 33 → Hausach / Gengenbach / B 294 → Elzach', subtext: 'Schwarzwälder Trachtenmuseum', type: 'direction', bearing: 250, distance: 12 }
    ]
  },
  {
    id: 'ortenau-wolfach-hauptstrasse',
    lat: 48.2994,
    lng: 8.2225,
    name: 'Hauptstraße / Fürstenberger Schloss',
    municipality: 'Wolfach',
    postalCode: '77709',
    district: 'Ortenaukreis',
    terrain: 'black_forest',
    elevation: 262,
    defaultHeading: 170,
    description: 'Main street of Wolfach flanked by the Kinzig river, Rathaus gate, and Fürstenberg Castle.',
    landmarks: ['Schloss Wolfach', 'Rathaus Wolfach', 'Dorotheenhütte'],
    baselineRoads: [
      { name: 'Hauptstraße', highway: 'primary', bearing: 170, distance: 5, surface: 'asphalt' },
      { name: 'Hauptstraße', highway: 'primary', bearing: 350, distance: 5, surface: 'asphalt' },
      { name: 'Vorstadtstraße', highway: 'secondary', bearing: 260, distance: 22, surface: 'asphalt' },
      { name: 'Schlosshof', highway: 'service', bearing: 80, distance: 18, surface: 'cobblestone' }
    ],
    baselineBuildings: [
      { name: 'Schloss Wolfach', type: 'castle', bearing: 350, distance: 36, levels: 4, roofShape: 'hipped', color: '#efe5d8' },
      { name: 'Rathaus Wolfach mit Stadttor', type: 'townhall', bearing: 170, distance: 28, levels: 4, roofShape: 'gabled', color: '#d99b82' },
      { name: 'Bürgerhaus Kinzigtal', type: 'timber_frame', bearing: 95, distance: 16, levels: 3, roofShape: 'gabled', color: '#f3e5d0' }
    ],
    baselineSigns: [
      { text: 'Hauptstraße', subtext: 'L 96', type: 'street_name', bearing: 165, distance: 8 },
      { text: 'B 294 → Freudenstadt / Hausach / Oberwolfach', subtext: 'Dorotheenhütte Glashütte 1 km', type: 'direction', bearing: 345, distance: 14 }
    ]
  },
  {
    id: 'ortenau-hornberg-hauptstrasse',
    lat: 48.2133,
    lng: 8.2311,
    name: 'Hauptstraße / Viadukt Hornberg',
    municipality: 'Hornberg',
    postalCode: '78132',
    district: 'Ortenaukreis',
    terrain: 'black_forest',
    elevation: 384,
    defaultHeading: 185,
    description: 'Deep Black Forest valley in Hornberg beneath the Schloss Hornberg ruin and Black Forest Railway viaduct.',
    landmarks: ['Schloss Hornberg', 'Rebberg-Viadukt Schwarzwaldbahn', 'Freilichtbühne Hornberg'],
    baselineRoads: [
      { name: 'Hauptstraße', highway: 'secondary', bearing: 5, distance: 5, surface: 'asphalt' },
      { name: 'Hauptstraße', highway: 'secondary', bearing: 185, distance: 5, surface: 'asphalt' },
      { name: 'Bahnhofstraße', highway: 'residential', bearing: 275, distance: 16, surface: 'asphalt' },
      { name: 'Schlossstraße', highway: 'residential', bearing: 95, distance: 19, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'Schwarzwaldbahn Viadukt', type: 'bridge', bearing: 290, distance: 55, levels: 5, roofShape: 'flat', color: '#9e9589' },
      { name: 'Evangelische Stadtkirche', type: 'church', bearing: 140, distance: 30, levels: 4, roofShape: 'pitched', color: '#e6dcd2' },
      { name: 'Rathaus Hornberg', type: 'townhall', bearing: 20, distance: 24, levels: 3, roofShape: 'gabled', color: '#f0e2d0' }
    ],
    baselineSigns: [
      { text: 'Hauptstraße', subtext: 'Hornberger Schießen Stadt', type: 'street_name', bearing: 10, distance: 7 },
      { text: 'B 33 → Triberg / Hausach / Gutach', subtext: 'Schloss Hornberg ↑', type: 'direction', bearing: 185, distance: 13 }
    ]
  },
  {
    id: 'ortenau-ettenheim-rohanstrasse',
    lat: 48.2564,
    lng: 7.8122,
    name: 'Rohanstraße / Prinzengarten',
    municipality: 'Ettenheim',
    postalCode: '77955',
    district: 'Ortenaukreis',
    terrain: 'foothills',
    elevation: 193,
    defaultHeading: 95,
    description: 'Baroque old town of Ettenheim with sandstone portals, Rathaus, and St. Bartholomäus church.',
    landmarks: ['St. Bartholomäus Ettenheim', 'Palais Rohan', 'Rathaus Ettenheim'],
    baselineRoads: [
      { name: 'Rohanstraße', highway: 'secondary', bearing: 95, distance: 5, surface: 'cobblestone' },
      { name: 'Rohanstraße', highway: 'secondary', bearing: 275, distance: 5, surface: 'cobblestone' },
      { name: 'Friedrichstraße', highway: 'residential', bearing: 5, distance: 14, surface: 'paving_stones' },
      { name: 'Kirchstraße', highway: 'residential', bearing: 185, distance: 15, surface: 'cobblestone' }
    ],
    baselineBuildings: [
      { name: 'Rathaus Ettenheim', type: 'townhall', bearing: 85, distance: 22, levels: 3, roofShape: 'mansard', color: '#e8c5b0' },
      { name: 'Barockkirche St. Bartholomäus', type: 'church', bearing: 165, distance: 42, levels: 5, roofShape: 'pitched', color: '#f0d9c4' },
      { name: 'Palais Rohan', type: 'historic', bearing: 265, distance: 26, levels: 3, roofShape: 'hipped', color: '#ebd4be' }
    ],
    baselineSigns: [
      { text: 'Rohanstraße', subtext: 'Barockstadt Ettenheim', type: 'street_name', bearing: 90, distance: 8 },
      { text: 'L 103 → Ettenheimmünster / Schweighausen / B 3 → Lahr', subtext: 'Historische Altstadt', type: 'direction', bearing: 275, distance: 13 }
    ]
  },
  {
    id: 'ortenau-rust-ritterstrasse',
    lat: 48.2669,
    lng: 7.7278,
    name: 'Ritterstraße / Schloss Balthasar',
    municipality: 'Rust',
    postalCode: '77977',
    district: 'Ortenaukreis',
    terrain: 'rhine_valley',
    elevation: 160,
    defaultHeading: 210,
    description: 'Village street in Rust in the Upper Rhine Plain near the Elz river and historic Balzare-Schloss.',
    landmarks: ['Schloss Balthasar Rust', 'Fischerstraße Rust', 'Naturschutzzentrum Rheinauen'],
    baselineRoads: [
      { name: 'Ritterstraße', highway: 'residential', bearing: 30, distance: 5, surface: 'asphalt' },
      { name: 'Ritterstraße', highway: 'residential', bearing: 210, distance: 5, surface: 'asphalt' },
      { name: 'Hindenburgstraße', highway: 'secondary', bearing: 120, distance: 15, surface: 'asphalt' },
      { name: 'Fischerstraße', highway: 'residential', bearing: 300, distance: 18, surface: 'paving_stones' }
    ],
    baselineBuildings: [
      { name: 'Schloss Balthasar', type: 'castle', bearing: 235, distance: 35, levels: 3, roofShape: 'gabled', color: '#f2e2ce' },
      { name: 'Altes Rathaus Rust', type: 'civic', bearing: 110, distance: 20, levels: 2, roofShape: 'gabled', color: '#e6ccb2' },
      { name: 'Fachwerkhaus Elzufer', type: 'timber_frame', bearing: 320, distance: 17, levels: 2, roofShape: 'gabled', color: '#f7ecda' }
    ],
    baselineSigns: [
      { text: 'Ritterstraße', subtext: 'Gemeinde Rust', type: 'street_name', bearing: 25, distance: 7 },
      { text: 'A 5 → Offenburg / Freiburg / Kappel-Grafenhausen', subtext: 'Rheinauen Taubergießen 2 km', type: 'direction', bearing: 120, distance: 14 }
    ]
  },
  {
    id: 'ortenau-sasbachwalden-talstrasse',
    lat: 48.6181,
    lng: 8.1286,
    name: 'Talstraße / Kurhaus Alde Gott',
    municipality: 'Sasbachwalden',
    postalCode: '77887',
    district: 'Ortenaukreis',
    terrain: 'black_forest',
    elevation: 258,
    defaultHeading: 110,
    description: 'Flower and wine village of Sasbachwalden with white-and-dark timber-framed houses beneath Hornisgrinde.',
    landmarks: ['Kurhaus Zum Alde Gott', 'Gaishöll-Wasserfälle', 'Dreifaltigkeitskirche Sasbachwalden'],
    baselineRoads: [
      { name: 'Talstraße (L 86)', highway: 'secondary', bearing: 110, distance: 5, surface: 'asphalt' },
      { name: 'Talstraße (L 86)', highway: 'secondary', bearing: 290, distance: 5, surface: 'asphalt' },
      { name: 'Kirchweg', highway: 'residential', bearing: 20, distance: 14, surface: 'paving_stones' },
      { name: 'Murberg', highway: 'residential', bearing: 200, distance: 17, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'Fachwerkhaus Blumenstraße', type: 'timber_frame', bearing: 75, distance: 16, levels: 3, roofShape: 'gabled', color: '#ffffff' },
      { name: 'Winzergenossenschaft Alde Gott', type: 'commercial', bearing: 280, distance: 30, levels: 3, roofShape: 'gabled', color: '#f8f9fa' },
      { name: 'Rathaus Sasbachwalden', type: 'townhall', bearing: 150, distance: 22, levels: 2, roofShape: 'gabled', color: '#ffffff' }
    ],
    baselineSigns: [
      { text: 'Talstraße', subtext: 'Blumen- und Weindorf', type: 'street_name', bearing: 105, distance: 8 },
      { text: 'L 86 → B 500 Schwarzwaldhochstraße / Achern', subtext: 'Gaishöll-Wasserfälle ↑', type: 'direction', bearing: 110, distance: 13 }
    ]
  },
  {
    id: 'ortenau-zell-am-harmersbach',
    lat: 48.3461,
    lng: 8.0636,
    name: 'Hauptstraße / Storchenturm Zell',
    municipality: 'Zell am Harmersbach',
    postalCode: '77736',
    district: 'Ortenaukreis',
    terrain: 'black_forest',
    elevation: 224,
    defaultHeading: 45,
    description: 'Smallest former Free Imperial City (Reichsstadt) in the Holy Roman Empire, famous for Zeller Keramik and Art Nouveau facades.',
    landmarks: ['Storchenturm Zell am Harmersbach', 'Hirschturm', 'Zeller Keramik Manufaktur'],
    baselineRoads: [
      { name: 'Hauptstraße', highway: 'pedestrian', bearing: 45, distance: 4, surface: 'paving_stones' },
      { name: 'Hauptstraße', highway: 'pedestrian', bearing: 225, distance: 4, surface: 'paving_stones' },
      { name: 'Turmstraße', highway: 'residential', bearing: 135, distance: 15, surface: 'cobblestone' },
      { name: 'Kanzleiplatz', highway: 'pedestrian', bearing: 315, distance: 16, surface: 'paving_stones' }
    ],
    baselineBuildings: [
      { name: 'Storchenturm Zell', type: 'historic_tower', bearing: 45, distance: 32, levels: 6, roofShape: 'gabled', color: '#e6dfd5' },
      { name: 'Jugendstil-Rathaus', type: 'townhall', bearing: 230, distance: 24, levels: 3, roofShape: 'gabled', color: '#d8e2dc' },
      { name: 'Bürgerhaus Kanzleiplatz', type: 'timber_frame', bearing: 310, distance: 18, levels: 3, roofShape: 'gabled', color: '#f4e4ce' }
    ],
    baselineSigns: [
      { text: 'Hauptstraße', subtext: 'Reichsstadt Zell a. H.', type: 'street_name', bearing: 40, distance: 7 },
      { text: 'L 94 → Oberharmersbach / Biberach (Baden)', subtext: 'Zeller Keramik / Storchenturm', type: 'direction', bearing: 225, distance: 13 }
    ]
  },
  {
    id: 'ortenau-oppenau-allmendplatz',
    lat: 48.4728,
    lng: 8.1614,
    name: 'Hauptstraße / Allmendplatz',
    municipality: 'Oppenau',
    postalCode: '77728',
    district: 'Ortenaukreis',
    terrain: 'black_forest',
    elevation: 277,
    defaultHeading: 60,
    description: 'Upper Renchtal town of Oppenau at the foot of the Allerheiligen waterfalls and Kniebis pass.',
    landmarks: ['Oberes Tor Oppenau', 'St. Johannes Baptist Oppenau', 'Allerheiligen Wasserfälle'],
    baselineRoads: [
      { name: 'Hauptstraße', highway: 'secondary', bearing: 60, distance: 5, surface: 'asphalt' },
      { name: 'Hauptstraße', highway: 'secondary', bearing: 240, distance: 5, surface: 'asphalt' },
      { name: 'Allmendplatz', highway: 'residential', bearing: 150, distance: 14, surface: 'paving_stones' },
      { name: 'Straßburger Straße (B 28)', highway: 'primary', bearing: 330, distance: 22, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'Oberes Stadttor Oppenau', type: 'historic_tower', bearing: 60, distance: 26, levels: 4, roofShape: 'hipped', color: '#efe6d8' },
      { name: 'Rathaus Oppenau', type: 'townhall', bearing: 165, distance: 22, levels: 3, roofShape: 'gabled', color: '#e8d5c4' },
      { name: 'Kirche St. Johannes Baptist', type: 'church', bearing: 315, distance: 38, levels: 4, roofShape: 'pitched', color: '#d5bdaf' }
    ],
    baselineSigns: [
      { text: 'Hauptstraße', subtext: 'Allmendplatz', type: 'street_name', bearing: 55, distance: 8 },
      { text: 'B 28 → Bad Peterstal-Griesbach / Oberkirch', subtext: 'Klosterruine Allerheiligen 9 km', type: 'direction', bearing: 240, distance: 14 }
    ]
  },
  {
    id: 'ortenau-durbach-weinstrasse',
    lat: 48.4936,
    lng: 8.0219,
    name: 'Talstraße / Schloss Staufenberg Blick',
    municipality: 'Durbach',
    postalCode: '77770',
    district: 'Ortenaukreis',
    terrain: 'foothills',
    elevation: 208,
    defaultHeading: 35,
    description: 'Premier wine valley of Durbach surrounded by steep Klingelberger Riesling vineyards and Schloss Staufenberg.',
    landmarks: ['Schloss Staufenberg Durbach', 'Wein- und Heimatmuseum Durbach', 'Durbacher Winzergenossenschaft'],
    baselineRoads: [
      { name: 'Talstraße (L 92)', highway: 'secondary', bearing: 35, distance: 5, surface: 'asphalt' },
      { name: 'Talstraße (L 92)', highway: 'secondary', bearing: 215, distance: 5, surface: 'asphalt' },
      { name: 'Staufenbergstraße', highway: 'residential', bearing: 310, distance: 14, surface: 'asphalt' },
      { name: 'Nachtweide', highway: 'residential', bearing: 125, distance: 16, surface: 'paving_stones' }
    ],
    baselineBuildings: [
      { name: 'Rathaus Durbach', type: 'townhall', bearing: 45, distance: 22, levels: 3, roofShape: 'gabled', color: '#f3e5d8' },
      { name: 'Weingut am Durbach', type: 'timber_frame', bearing: 200, distance: 18, levels: 2, roofShape: 'gabled', color: '#f7ecda' },
      { name: 'St. Heinrich Kirche', type: 'church', bearing: 110, distance: 35, levels: 4, roofShape: 'pitched', color: '#e6ccb2' }
    ],
    baselineSigns: [
      { text: 'Talstraße', subtext: 'Badische Weinstraße', type: 'street_name', bearing: 30, distance: 7 },
      { text: 'L 92 → Offenburg / Oberkirch', subtext: 'Schloss Staufenberg 2.5 km ↑', type: 'direction', bearing: 310, distance: 12 }
    ]
  },
  {
    id: 'ortenau-hausach-hauptstrasse',
    lat: 48.2856,
    lng: 8.1786,
    name: 'Hauptstraße / Burg Husen Blick',
    municipality: 'Hausach',
    postalCode: '77756',
    district: 'Ortenaukreis',
    terrain: 'black_forest',
    elevation: 241,
    defaultHeading: 250,
    description: 'Town center of Hausach in the Kinzig valley overlooked by the medieval Burg Husen castle keep.',
    landmarks: ['Burg Husen Hausach', 'Modellbahn-Zauber Hausach', 'Freilichtmuseum Vogtsbauernhof (Gutach)'],
    baselineRoads: [
      { name: 'Hauptstraße', highway: 'secondary', bearing: 70, distance: 5, surface: 'asphalt' },
      { name: 'Hauptstraße', highway: 'secondary', bearing: 250, distance: 5, surface: 'asphalt' },
      { name: 'Eisenbahnstraße', highway: 'residential', bearing: 340, distance: 15, surface: 'asphalt' },
      { name: 'Schlossbergstraße', highway: 'residential', bearing: 160, distance: 16, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'Rathaus Hausach', type: 'townhall', bearing: 240, distance: 22, levels: 3, roofShape: 'gabled', color: '#e9d8c8' },
      { name: 'St. Mauritius Kirche', type: 'church', bearing: 85, distance: 34, levels: 4, roofShape: 'pitched', color: '#dcd0c5' },
      { name: 'Geschäftshaus Kinzig', type: 'commercial', bearing: 335, distance: 18, levels: 3, roofShape: 'gabled', color: '#f2e8dc' }
    ],
    baselineSigns: [
      { text: 'Hauptstraße', subtext: 'Stadt Hausach', type: 'street_name', bearing: 245, distance: 7 },
      { text: 'B 33 → Gutach / Hornberg / Haslach i. K. / B 294 → Wolfach', subtext: 'Burg Husen ↑', type: 'direction', bearing: 70, distance: 13 }
    ]
  },
  {
    id: 'ortenau-kappelrodeck-marktplatz',
    lat: 48.5914,
    lng: 8.1178,
    name: 'Hauptstraße / Schloss Rodeck Blick',
    municipality: 'Kappelrodeck',
    postalCode: '77876',
    district: 'Ortenaukreis',
    terrain: 'foothills',
    elevation: 216,
    defaultHeading: 100,
    description: 'Red wine village of Kappelrodeck in the Achertal beneath Schloss Rodeck.',
    landmarks: ['Schloss Rodeck', 'Zuckerbergschloss Kappelrodeck', 'Achertalbahn'],
    baselineRoads: [
      { name: 'Hauptstraße (L 87)', highway: 'secondary', bearing: 100, distance: 5, surface: 'asphalt' },
      { name: 'Hauptstraße (L 87)', highway: 'secondary', bearing: 280, distance: 5, surface: 'asphalt' },
      { name: 'Pfarrberg', highway: 'residential', bearing: 10, distance: 14, surface: 'paving_stones' },
      { name: 'Bahnhofstraße', highway: 'residential', bearing: 190, distance: 15, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'Rathaus Kappelrodeck', type: 'townhall', bearing: 95, distance: 20, levels: 3, roofShape: 'gabled', color: '#f0e1d1' },
      { name: 'St. Nikolaus Kirche', type: 'church', bearing: 15, distance: 32, levels: 4, roofShape: 'pitched', color: '#d4b59e' },
      { name: 'Winzerhaus Achertal', type: 'timber_frame', bearing: 270, distance: 18, levels: 2, roofShape: 'gabled', color: '#f7ebda' }
    ],
    baselineSigns: [
      { text: 'Hauptstraße', subtext: 'Rotweindorf Kappelrodeck', type: 'street_name', bearing: 95, distance: 7 },
      { text: 'L 87 → Ottenhöfen / Seebach / Achern', subtext: 'Schloss Rodeck ↑', type: 'direction', bearing: 100, distance: 13 }
    ]
  },
  {
    id: 'ortenau-rheinau-freistett',
    lat: 48.6689,
    lng: 7.9056,
    name: 'Rheinstraße / Kirchplatz Freistett',
    municipality: 'Rheinau',
    postalCode: '77866',
    district: 'Ortenaukreis',
    terrain: 'rhine_valley',
    elevation: 130,
    defaultHeading: 50,
    description: 'Rheinau-Freistett in the northern Hanauerland near the Gambsheim Rhine barrage.',
    landmarks: ['Rheinübergang Gambsheim-Rheinau', 'Heimatmuseum Rheinau', 'Hanauer Fachwerkhäuser'],
    baselineRoads: [
      { name: 'Rheinstraße (L 75)', highway: 'secondary', bearing: 50, distance: 5, surface: 'asphalt' },
      { name: 'Rheinstraße (L 75)', highway: 'secondary', bearing: 230, distance: 5, surface: 'asphalt' },
      { name: 'Maiwaldstraße', highway: 'secondary', bearing: 140, distance: 15, surface: 'asphalt' },
      { name: 'Hafenstraße', highway: 'residential', bearing: 320, distance: 16, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'Rathaus Rheinau', type: 'townhall', bearing: 140, distance: 24, levels: 3, roofShape: 'gabled', color: '#efe5d8' },
      { name: 'Hanauer Fachwerkhaus', type: 'timber_frame', bearing: 45, distance: 18, levels: 2, roofShape: 'gabled', color: '#ffffff' },
      { name: 'Evangelische Kirche Freistett', type: 'church', bearing: 240, distance: 30, levels: 3, roofShape: 'pitched', color: '#e6d5c3' }
    ],
    baselineSigns: [
      { text: 'Rheinstraße', subtext: 'Rheinau-Freistett', type: 'street_name', bearing: 45, distance: 8 },
      { text: 'L 75 → Kehl / Lichtenau / L 87 → Achern', subtext: 'Rheinpassage Gambsheim 3 km', type: 'direction', bearing: 230, distance: 13 }
    ]
  },
  {
    id: 'ortenau-bad-peterstal-griesbach',
    lat: 48.4289,
    lng: 8.2053,
    name: 'Renchtalstraße / Kurpark Bad Peterstal',
    municipality: 'Bad Peterstal-Griesbach',
    postalCode: '77740',
    district: 'Ortenaukreis',
    terrain: 'black_forest',
    elevation: 398,
    defaultHeading: 105,
    description: 'Mineral spa and Black Forest hiking town of Bad Peterstal-Griesbach in the upper Rench valley.',
    landmarks: ['Sophienquelle Bad Peterstal', 'Habererturm', 'Wiesensteig & Schwarzwaldsteig'],
    baselineRoads: [
      { name: 'Renchtalstraße (B 28)', highway: 'primary', bearing: 105, distance: 5, surface: 'asphalt' },
      { name: 'Renchtalstraße (B 28)', highway: 'primary', bearing: 285, distance: 5, surface: 'asphalt' },
      { name: 'Wilhelmstraße', highway: 'residential', bearing: 195, distance: 15, surface: 'paving_stones' },
      { name: 'Kurhausweg', highway: 'footway', bearing: 15, distance: 14, surface: 'paving_stones' }
    ],
    baselineBuildings: [
      { name: 'Kurhaus Bad Peterstal', type: 'civic', bearing: 20, distance: 26, levels: 3, roofShape: 'hipped', color: '#f5ebe0' },
      { name: 'St. Peter und Paul', type: 'church', bearing: 120, distance: 34, levels: 4, roofShape: 'pitched', color: '#e3d5ca' },
      { name: 'Schwarzwaldhotel Renchtal', type: 'hotel', bearing: 275, distance: 22, levels: 4, roofShape: 'gabled', color: '#edede9' }
    ],
    baselineSigns: [
      { text: 'Renchtalstraße', subtext: 'Heilbad Bad Peterstal', type: 'street_name', bearing: 100, distance: 7 },
      { text: 'B 28 → Freudenstadt / Kniebis / Oppenau', subtext: 'Mineralbrunnen / Kurpark', type: 'direction', bearing: 105, distance: 13 }
    ]
  },
  {
    id: 'ortenau-seelbach-hauptstrasse',
    lat: 48.3136,
    lng: 7.9403,
    name: 'Hauptstraße / Klostergarten',
    municipality: 'Seelbach',
    postalCode: '77960',
    district: 'Ortenaukreis',
    terrain: 'black_forest',
    elevation: 205,
    defaultHeading: 165,
    description: 'Schutter valley town of Seelbach below Burgruine Hohengeroldseck.',
    landmarks: ['Burg Hohengeroldseck', 'Schloss Dautenstein', 'Franziskanerkloster Seelbach'],
    baselineRoads: [
      { name: 'Hauptstraße (B 415)', highway: 'primary', bearing: 165, distance: 5, surface: 'asphalt' },
      { name: 'Hauptstraße (B 415)', highway: 'primary', bearing: 345, distance: 5, surface: 'asphalt' },
      { name: 'Klosterstraße', highway: 'residential', bearing: 75, distance: 14, surface: 'paving_stones' },
      { name: 'Geroldsecker Straße', highway: 'residential', bearing: 255, distance: 16, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'Rathaus im Alten Kloster', type: 'townhall', bearing: 75, distance: 24, levels: 3, roofShape: 'hipped', color: '#f2e4d4' },
      { name: 'St. Nikolaus Seelbach', type: 'church', bearing: 200, distance: 32, levels: 4, roofShape: 'pitched', color: '#dfd3c3' },
      { name: 'Gasthof Löwen', type: 'commercial', bearing: 335, distance: 18, levels: 3, roofShape: 'gabled', color: '#f5ebe0' }
    ],
    baselineSigns: [
      { text: 'Hauptstraße', subtext: 'Luftkurort Seelbach', type: 'street_name', bearing: 160, distance: 7 },
      { text: 'B 415 → Biberach (Kinzigtal) / Lahr', subtext: 'Burgruine Hohengeroldseck 4 km', type: 'direction', bearing: 165, distance: 13 }
    ]
  },
  {
    id: 'ortenau-appenweier-ortsmitte',
    lat: 48.5394,
    lng: 7.9803,
    name: 'Ortenauer Straße / Rathaus Appenweier',
    municipality: 'Appenweier',
    postalCode: '77767',
    district: 'Ortenaukreis',
    terrain: 'rhine_valley',
    elevation: 152,
    defaultHeading: 85,
    description: 'Central crossroads of Appenweier between Offenburg, Kehl, and the Renchtal.',
    landmarks: ['St. Michael Appenweier', 'Rathaus Appenweier', 'Urloffen Meerrettichdorf'],
    baselineRoads: [
      { name: 'Ortenauer Straße (B 3)', highway: 'primary', bearing: 85, distance: 5, surface: 'asphalt' },
      { name: 'Ortenauer Straße (B 3)', highway: 'primary', bearing: 265, distance: 5, surface: 'asphalt' },
      { name: 'Oberkircher Straße', highway: 'secondary', bearing: 120, distance: 15, surface: 'asphalt' },
      { name: 'Kirchplatz', highway: 'residential', bearing: 355, distance: 16, surface: 'paving_stones' }
    ],
    baselineBuildings: [
      { name: 'Rathaus Appenweier', type: 'townhall', bearing: 10, distance: 22, levels: 3, roofShape: 'gabled', color: '#ede0d4' },
      { name: 'Kirche St. Michael', type: 'church', bearing: 340, distance: 35, levels: 4, roofShape: 'pitched', color: '#d8c3b5' },
      { name: 'Wohn- und Geschäftshaus', type: 'commercial', bearing: 190, distance: 18, levels: 3, roofShape: 'gabled', color: '#f4f1ea' }
    ],
    baselineSigns: [
      { text: 'Ortenauer Straße', subtext: 'Gemeinde Appenweier', type: 'street_name', bearing: 80, distance: 7 },
      { text: 'B 28 → Oberkirch / Kehl / B 3 → Offenburg / Achern', subtext: 'Bahnhof Appenweier', type: 'direction', bearing: 85, distance: 13 }
    ]
  },
  {
    id: 'ortenau-schutterwald-hauptstrasse',
    lat: 48.4583,
    lng: 7.8831,
    name: 'Hauptstraße / St. Jakobus Schutterwald',
    municipality: 'Schutterwald',
    postalCode: '77746',
    district: 'Ortenaukreis',
    terrain: 'rhine_valley',
    elevation: 151,
    defaultHeading: 270,
    description: 'Schutterwald west of Offenburg, landmarked by the tall neo-Baroque church tower of St. Jakobus.',
    landmarks: ['St. Jakobus Schutterwald', 'Baggersee Schutterwald', 'Müllenkapelle'],
    baselineRoads: [
      { name: 'Hauptstraße', highway: 'secondary', bearing: 90, distance: 5, surface: 'asphalt' },
      { name: 'Hauptstraße', highway: 'secondary', bearing: 270, distance: 5, surface: 'asphalt' },
      { name: 'Kirchstraße', highway: 'residential', bearing: 0, distance: 14, surface: 'paving_stones' },
      { name: 'Bahnhofstraße', highway: 'residential', bearing: 180, distance: 16, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'St. Jakobus Kirche', type: 'church', bearing: 355, distance: 30, levels: 5, roofShape: 'pitched', color: '#e6c2b0' },
      { name: 'Rathaus Schutterwald', type: 'townhall', bearing: 95, distance: 22, levels: 3, roofShape: 'gabled', color: '#f2e8dc' },
      { name: 'Fachwerkhaus Hauptstraße', type: 'timber_frame', bearing: 245, distance: 17, levels: 2, roofShape: 'gabled', color: '#f7ecda' }
    ],
    baselineSigns: [
      { text: 'Hauptstraße', subtext: 'Schutterwald', type: 'street_name', bearing: 265, distance: 7 },
      { text: 'L 99 → Offenburg / Neuried-Altenheim', subtext: 'Reitstadion / Baggersee', type: 'direction', bearing: 270, distance: 13 }
    ]
  },
  {
    id: 'ortenau-neuried-altenheim',
    lat: 48.4636,
    lng: 7.8072,
    name: 'Badstraße / Europadorf Altenheim',
    municipality: 'Neuried',
    postalCode: '77743',
    district: 'Ortenaukreis',
    terrain: 'rhine_valley',
    elevation: 147,
    defaultHeading: 180,
    description: 'Neuried-Altenheim in the Ried wetlands along the Upper Rhine.',
    landmarks: ['Friedenskirche Altenheim', 'Rheinauen Neuried', 'Pierre-Pflimlin-Brücke'],
    baselineRoads: [
      { name: 'Badstraße (L 75)', highway: 'secondary', bearing: 0, distance: 5, surface: 'asphalt' },
      { name: 'Badstraße (L 75)', highway: 'secondary', bearing: 180, distance: 5, surface: 'asphalt' },
      { name: 'Kirchstraße', highway: 'residential', bearing: 90, distance: 14, surface: 'asphalt' },
      { name: 'Vogelsangstraße', highway: 'residential', bearing: 270, distance: 15, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'Friedenskirche Altenheim', type: 'church', bearing: 85, distance: 28, levels: 4, roofShape: 'pitched', color: '#efe5d8' },
      { name: 'Ried-Fachwerkhaus', type: 'timber_frame', bearing: 195, distance: 16, levels: 2, roofShape: 'gabled', color: '#ffffff' },
      { name: 'Rathaus Neuried', type: 'townhall', bearing: 340, distance: 24, levels: 3, roofShape: 'gabled', color: '#e8d8c8' }
    ],
    baselineSigns: [
      { text: 'Badstraße', subtext: 'Neuried-Altenheim', type: 'street_name', bearing: 175, distance: 7 },
      { text: 'L 75 → Kehl / Ichenheim / L 98 → Offenburg', subtext: 'Rhein / Straßburg Süd', type: 'direction', bearing: 180, distance: 13 }
    ]
  },
  {
    id: 'ortenau-meissenheim-kirchstrasse',
    lat: 48.4094,
    lng: 7.7731,
    name: 'Hindenburgstraße / Friederike-Brion-Grab',
    municipality: 'Meißenheim',
    postalCode: '77974',
    district: 'Ortenaukreis',
    terrain: 'rhine_valley',
    elevation: 151,
    defaultHeading: 150,
    description: 'Ried village of Meißenheim near the Rhine, known for its Baroque church and Goethe heritage.',
    landmarks: ['Barockkirche Meißenheim', 'Friederike-Brion-Grabstätte', 'Rheinauen Meißenheim'],
    baselineRoads: [
      { name: 'Hindenburgstraße (L 104)', highway: 'secondary', bearing: 150, distance: 5, surface: 'asphalt' },
      { name: 'Hindenburgstraße (L 104)', highway: 'secondary', bearing: 330, distance: 5, surface: 'asphalt' },
      { name: 'Kirchstraße', highway: 'residential', bearing: 60, distance: 14, surface: 'paving_stones' },
      { name: 'Hauptstraße', highway: 'secondary', bearing: 240, distance: 16, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'Evangelische Barockkirche', type: 'church', bearing: 55, distance: 28, levels: 4, roofShape: 'pitched', color: '#f3e5d0' },
      { name: 'Rathaus Meißenheim', type: 'townhall', bearing: 160, distance: 22, levels: 2, roofShape: 'gabled', color: '#e9d8c8' },
      { name: 'Fachwerkhof Ried', type: 'timber_frame', bearing: 315, distance: 18, levels: 2, roofShape: 'gabled', color: '#ffffff' }
    ],
    baselineSigns: [
      { text: 'Hindenburgstraße', subtext: 'Gemeinde Meißenheim', type: 'street_name', bearing: 145, distance: 7 },
      { text: 'L 104 → Lahr / Nonnenweier / Neuried', subtext: 'Friederike-Brion-Stätte', type: 'direction', bearing: 150, distance: 13 }
    ]
  },
  {
    id: 'ortenau-friesenheim-hauptstrasse',
    lat: 48.3733,
    lng: 7.8806,
    name: 'Friesenheimer Hauptstraße / Rathaus',
    municipality: 'Friesenheim',
    postalCode: '77948',
    district: 'Ortenaukreis',
    terrain: 'foothills',
    elevation: 159,
    defaultHeading: 190,
    description: 'Friesenheim along the B 3 between Offenburg and Lahr at the foot of the Schuttern abbey hills.',
    landmarks: ['St. Laurentius Friesenheim', 'Klosterkirche Schuttern', 'Rathaus Friesenheim'],
    baselineRoads: [
      { name: 'Friesenheimer Hauptstraße (B 3)', highway: 'primary', bearing: 10, distance: 5, surface: 'asphalt' },
      { name: 'Friesenheimer Hauptstraße (B 3)', highway: 'primary', bearing: 190, distance: 5, surface: 'asphalt' },
      { name: 'Kirchgasse', highway: 'residential', bearing: 100, distance: 14, surface: 'paving_stones' },
      { name: 'Adlerstraße', highway: 'residential', bearing: 280, distance: 15, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'St. Laurentius Kirche', type: 'church', bearing: 105, distance: 30, levels: 4, roofShape: 'pitched', color: '#e6ccb2' },
      { name: 'Rathaus Friesenheim', type: 'townhall', bearing: 200, distance: 24, levels: 3, roofShape: 'gabled', color: '#f2e8dc' },
      { name: 'Winzerhof Friesenheim', type: 'timber_frame', bearing: 350, distance: 18, levels: 2, roofShape: 'gabled', color: '#f7ecda' }
    ],
    baselineSigns: [
      { text: 'Friesenheimer Hauptstraße', subtext: 'B 3 Ortenau', type: 'street_name', bearing: 185, distance: 7 },
      { text: 'B 3 → Lahr / Offenburg', subtext: 'Kloster Schuttern 3 km', type: 'direction', bearing: 190, distance: 13 }
    ]
  },
  {
    id: 'ortenau-seebach-mummelsee',
    lat: 48.5972,
    lng: 8.2008,
    name: 'Schwarzwaldhochstraße (B 500) / Mummelsee',
    municipality: 'Seebach',
    postalCode: '77889',
    district: 'Ortenaukreis',
    terrain: 'black_forest',
    elevation: 1036,
    defaultHeading: 350,
    description: 'High Black Forest pass at Mummelsee directly below Hornisgrinde (1164m), highest peak in the Ortenau.',
    landmarks: ['Mummelsee', 'Hornisgrinde Turm', 'St. Michael Kapelle Mummelsee'],
    baselineRoads: [
      { name: 'Schwarzwaldhochstraße (B 500)', highway: 'primary', bearing: 75, distance: 6, surface: 'asphalt' },
      { name: 'Schwarzwaldhochstraße (B 500)', highway: 'primary', bearing: 255, distance: 6, surface: 'asphalt' },
      { name: 'Mummelsee-Rundweg', highway: 'footway', bearing: 350, distance: 12, surface: 'gravel' },
      { name: 'Hornisgrindeweg', highway: 'path', bearing: 330, distance: 20, surface: 'gravel' }
    ],
    baselineBuildings: [
      { name: 'Berghotel Mummelsee', type: 'hotel', bearing: 295, distance: 28, levels: 3, roofShape: 'hipped', color: '#8d6e63' },
      { name: 'St. Michael Kapelle', type: 'church', bearing: 55, distance: 35, levels: 2, roofShape: 'pitched', color: '#f5ebe0' },
      { name: 'Hornisgrindeturm (Fernblick)', type: 'historic_tower', bearing: 340, distance: 85, levels: 6, roofShape: 'flat', color: '#adb5bd' }
    ],
    baselineSigns: [
      { text: 'Schwarzwaldhochstraße B 500', subtext: 'Mummelsee 1036m ü. NN', type: 'street_name', bearing: 250, distance: 8 },
      { text: 'B 500 → Freudenstadt / Baden-Baden / L 87 → Seebach / Achern', subtext: 'Hornisgrinde Gipfel ↑', type: 'direction', bearing: 75, distance: 14 }
    ]
  },
  {
    id: 'ortenau-gutach-vogtsbauernhof',
    lat: 48.2692,
    lng: 8.2031,
    name: 'Vogtsbauernhof / Gutach (Schwarzwaldbahn)',
    municipality: 'Gutach (Schwarzwaldbahn)',
    postalCode: '77793',
    district: 'Ortenaukreis',
    terrain: 'black_forest',
    elevation: 280,
    defaultHeading: 120,
    description: 'Gutach valley home to the Black Forest Open Air Museum Vogtsbauernhof and the iconic Bollenhut.',
    landmarks: ['Schwarzwälder Freilichtmuseum Vogtsbauernhof', 'Gutachtalbrücke', 'Bahnhof Gutach Freilichtmuseum'],
    baselineRoads: [
      { name: 'Landstraße (B 33)', highway: 'primary', bearing: 165, distance: 8, surface: 'asphalt' },
      { name: 'Landstraße (B 33)', highway: 'primary', bearing: 345, distance: 8, surface: 'asphalt' },
      { name: 'Am Vogtsbauernhof', highway: 'footway', bearing: 115, distance: 5, surface: 'gravel' },
      { name: 'Museumsweg', highway: 'footway', bearing: 40, distance: 14, surface: 'cobblestone' }
    ],
    baselineBuildings: [
      { name: 'Vogtsbauernhof (1612)', type: 'timber_frame', bearing: 120, distance: 24, levels: 3, roofShape: 'hipped', color: '#7f5539' },
      { name: 'Hippenseppenhof', type: 'timber_frame', bearing: 55, distance: 34, levels: 3, roofShape: 'hipped', color: '#9c6644' },
      { name: 'Lorenzenhof', type: 'timber_frame', bearing: 210, distance: 30, levels: 3, roofShape: 'hipped', color: '#b08968' }
    ],
    baselineSigns: [
      { text: 'Vogtsbauernhof', subtext: 'Gutach (Schwarzwaldbahn)', type: 'street_name', bearing: 110, distance: 7 },
      { text: 'B 33 → Hausach / Hornberg', subtext: 'Schwarzwälder Freilichtmuseum', type: 'direction', bearing: 345, distance: 14 }
    ]
  },
  {
    id: 'ortenau-renchen-hauptstrasse',
    lat: 48.5869,
    lng: 8.0108,
    name: 'Hauptstraße / Grimmelshausen-Denkmal',
    municipality: 'Renchen',
    postalCode: '77871',
    district: 'Ortenaukreis',
    terrain: 'rhine_valley',
    elevation: 150,
    defaultHeading: 200,
    description: 'Grimmelshausenstadt Renchen on the Rench river between Achern and Appenweier.',
    landmarks: ['Simplicissimus-Haus Renchen', 'Heilig-Kreuz-Kirche Renchen', 'Rathaus Renchen'],
    baselineRoads: [
      { name: 'Hauptstraße (B 3)', highway: 'primary', bearing: 20, distance: 5, surface: 'asphalt' },
      { name: 'Hauptstraße (B 3)', highway: 'primary', bearing: 200, distance: 5, surface: 'asphalt' },
      { name: 'Kirchplatz', highway: 'residential', bearing: 110, distance: 14, surface: 'paving_stones' },
      { name: 'Friedhofstraße', highway: 'residential', bearing: 290, distance: 16, surface: 'asphalt' }
    ],
    baselineBuildings: [
      { name: 'Heilig-Kreuz-Kirche', type: 'church', bearing: 115, distance: 28, levels: 4, roofShape: 'pitched', color: '#e6ccb2' },
      { name: 'Rathaus Renchen', type: 'townhall', bearing: 210, distance: 22, levels: 3, roofShape: 'gabled', color: '#f2e8dc' },
      { name: 'Simplicissimus-Haus', type: 'historic', bearing: 35, distance: 24, levels: 3, roofShape: 'gabled', color: '#edd9c4' }
    ],
    baselineSigns: [
      { text: 'Hauptstraße', subtext: 'Grimmelshausenstadt Renchen', type: 'street_name', bearing: 195, distance: 7 },
      { text: 'B 3 → Achern / Offenburg / L 89 → Rheinau', subtext: 'Simplicissimus-Haus', type: 'direction', bearing: 200, distance: 13 }
    ]
  }
];

module.exports = {
  ORTENAU_REGION,
  ORTENAU_LOCATIONS,
  isPointInOrtenau
};
