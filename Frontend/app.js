/**
 * Ortenau Guesser — Frontend Application (Frontend/app.js)
 * Classic Vanilla JS + Leaflet (OpenStreetMap) + Pannellum (Fixed-Point 360° StreetView)
 * Explicitly fixed to the Ortenau region (Ortenaukreis, Baden-Württemberg, Germany).
 */

(function () {
  'use strict';

  // =========================================================================
  // Default Ortenaukreis Region Configuration (Fallback & Immediate Init)
  // =========================================================================
  const DEFAULT_ORTENAU_REGION = {
    name: 'Ortenaukreis',
    displayName: 'Ortenau (Ortenaukreis), Baden-Württemberg, Germany',
    center: { lat: 48.4719, lng: 7.9498 },
    bounds: {
      south: 48.18,
      west: 7.75,
      north: 48.72,
      east: 8.35
    },
    polygon: [
      [48.705, 7.915],
      [48.685, 8.015],
      [48.655, 8.155],
      [48.605, 8.215],
      [48.545, 8.245],
      [48.445, 8.335],
      [48.325, 8.310],
      [48.205, 8.265],
      [48.195, 8.120],
      [48.220, 7.945],
      [48.245, 7.795],
      [48.260, 7.715],
      [48.365, 7.735],
      [48.455, 7.770],
      [48.575, 7.800],
      [48.665, 7.880],
      [48.705, 7.915]
    ],
    tileServerUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  };

  // =========================================================================
  // Game State (Stateless Singleplayer without Persistence)
  // =========================================================================
  const state = {
    region: DEFAULT_ORTENAU_REGION,
    totalRounds: 5, // 5 for Standard Game, 0 for Endless Free Play
    currentRound: 1,
    totalScore: 0,
    roundHistory: [],
    usedLocationIds: [],
    currentLocation: null,
    currentGuess: null,
    isSubmitting: false,
    activeViewMode: '360', // '360' | 'streetembed'
    minimapPinnedExpanded: false,
    compassAnimFrame: null
  };

  // Map & Viewer Instances
  let menuPreviewMap = null;
  let guessMap = null;
  let guessMarker = null;
  let guessBoundaryLayer = null;
  let resultMap = null;
  let resultLayerGroup = null;
  let panoViewer = null;

  // =========================================================================
  // DOM Elements
  // =========================================================================
  const dom = {
    mainMenuScreen: document.getElementById('main-menu'),
    gameScreen: document.getElementById('game-screen'),
    apiStatusBadge: document.getElementById('api-status-badge'),

    modeStandardBtn: document.getElementById('mode-standard-btn'),
    modeFreeplayBtn: document.getElementById('mode-freeplay-btn'),
    startGameBtn: document.getElementById('start-game-btn'),
    howToPlayBtn: document.getElementById('how-to-play-btn'),

    backToMenuBtn: document.getElementById('back-to-menu-btn'),
    hudRound: document.getElementById('hud-round'),
    hudScore: document.getElementById('hud-score'),
    compassTape: document.getElementById('compass-tape'),
    compassReadout: document.getElementById('compass-readout'),
    resetViewBtn: document.getElementById('reset-view-btn'),

    viewMode360Btn: document.getElementById('view-mode-360'),
    viewModeEmbedBtn: document.getElementById('view-mode-streetembed'),
    toggleClueBtn: document.getElementById('toggle-clue-btn'),
    clueDrawer: document.getElementById('clue-drawer'),
    closeClueBtn: document.getElementById('close-clue-btn'),
    clueContent: document.getElementById('clue-content'),

    panoViewerEl: document.getElementById('pano-viewer'),
    externalStreetView: document.getElementById('external-street-view'),
    externalStreetContent: document.getElementById('external-street-content'),
    streetviewLoading: document.getElementById('streetview-loading'),
    loadingTitle: document.getElementById('loading-title'),
    loadingSubtitle: document.getElementById('loading-subtitle'),
    streetviewStatusText: document.getElementById('streetview-status-text'),

    minimapWrapper: document.getElementById('minimap-wrapper'),
    minimapCenterBtn: document.getElementById('minimap-center-btn'),
    minimapExpandBtn: document.getElementById('minimap-expand-btn'),
    guessCoordsLabel: document.getElementById('guess-coords-label'),
    submitGuessBtn: document.getElementById('submit-guess-btn'),

    resultModal: document.getElementById('result-modal'),
    resultRoundBadge: document.getElementById('result-round-badge'),
    resultLocationTitle: document.getElementById('result-location-title'),
    resultLocationSubtitle: document.getElementById('result-location-subtitle'),
    resultDistanceValue: document.getElementById('result-distance-value'),
    resultDistanceMeters: document.getElementById('result-distance-meters'),
    resultScoreValue: document.getElementById('result-score-value'),
    resultScoreBar: document.getElementById('result-score-bar'),
    legendDistanceInline: document.getElementById('legend-distance-inline'),
    resultOsmDetails: document.getElementById('result-osm-details'),
    nextRoundBtn: document.getElementById('next-round-btn'),

    summaryModal: document.getElementById('summary-modal'),
    summaryRankText: document.getElementById('summary-rank-text'),
    summaryTotalScore: document.getElementById('summary-total-score'),
    summaryAvgDistance: document.getElementById('summary-avg-distance'),
    summaryBestRound: document.getElementById('summary-best-round'),
    summaryRoundsTbody: document.getElementById('summary-rounds-tbody'),
    playAgainBtn: document.getElementById('play-again-btn'),
    summaryMenuBtn: document.getElementById('summary-menu-btn'),

    rulesModal: document.getElementById('rules-modal'),
    closeRulesBtn: document.getElementById('close-rules-btn'),
    rulesGotItBtn: document.getElementById('rules-got-it-btn')
  };

  // =========================================================================
  // Initialization & Event Listeners
  // =========================================================================
  async function initApp() {
    bindEvents();
    await fetchRegionConfig();
    initMenuPreviewMap();
  }

  function bindEvents() {
    // Mode selection on Main Menu
    dom.modeStandardBtn.addEventListener('click', () => {
      state.totalRounds = 5;
      dom.modeStandardBtn.classList.add('active');
      dom.modeFreeplayBtn.classList.remove('active');
    });

    dom.modeFreeplayBtn.addEventListener('click', () => {
      state.totalRounds = 0;
      dom.modeFreeplayBtn.classList.add('active');
      dom.modeStandardBtn.classList.remove('active');
    });

    // Start Game
    dom.startGameBtn.addEventListener('click', startNewGame);

    // Rules Modal
    dom.howToPlayBtn.addEventListener('click', () => dom.rulesModal.classList.remove('hidden'));
    dom.closeRulesBtn.addEventListener('click', () => dom.rulesModal.classList.add('hidden'));
    dom.rulesGotItBtn.addEventListener('click', () => dom.rulesModal.classList.add('hidden'));

    // In-Game Top HUD
    dom.backToMenuBtn.addEventListener('click', returnToMainMenu);
    dom.resetViewBtn.addEventListener('click', resetPanoramaHeading);

    // View Mode Switcher
    dom.viewMode360Btn.addEventListener('click', () => switchViewMode('360'));
    dom.viewModeEmbedBtn.addEventListener('click', () => switchViewMode('streetembed'));

    // Field Observations Drawer
    dom.toggleClueBtn.addEventListener('click', () => {
      dom.clueDrawer.classList.toggle('hidden');
    });
    dom.closeClueBtn.addEventListener('click', () => {
      dom.clueDrawer.classList.add('hidden');
    });

    // Mini-map Controls
    dom.minimapCenterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      centerGuessMapOnOrtenau();
    });

    dom.minimapExpandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.minimapPinnedExpanded = !state.minimapPinnedExpanded;
      dom.minimapWrapper.classList.toggle('expanded', state.minimapPinnedExpanded);
      refreshGuessMapSize();
    });

    dom.minimapWrapper.addEventListener('mouseenter', () => {
      refreshGuessMapSize();
    });
    dom.minimapWrapper.addEventListener('mouseleave', () => {
      refreshGuessMapSize();
    });
    dom.minimapWrapper.addEventListener('transitionend', () => {
      refreshGuessMapSize();
    });

    // Submit Guess Button
    dom.submitGuessBtn.addEventListener('click', submitCurrentGuess);

    // Result Modal Next Round Button
    dom.nextRoundBtn.addEventListener('click', handleNextRoundClick);

    // Summary Modal Actions
    dom.playAgainBtn.addEventListener('click', () => {
      dom.summaryModal.classList.add('hidden');
      startNewGame();
    });
    dom.summaryMenuBtn.addEventListener('click', () => {
      dom.summaryModal.classList.add('hidden');
      returnToMainMenu();
    });

    // Keyboard shortcut: Space / Enter on Result modal or Escape to close rules
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !dom.rulesModal.classList.contains('hidden')) {
        dom.rulesModal.classList.add('hidden');
      }
    });
  }

  // =========================================================================
  // API Communication: /api/region, /api/location/random, /api/guess
  // =========================================================================
  async function fetchRegionConfig() {
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
      dom.apiStatusBadge.textContent = 'OSM Live Connected';
      dom.apiStatusBadge.classList.add('status-online');
    } catch (err) {
      console.warn('Using built-in Ortenaukreis region definition:', err.message);
      dom.apiStatusBadge.textContent = 'OSM Ready (Local)';
    }
  }

  async function fetchRandomOrtenauLocation() {
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
   * are consistently structured regardless of backend response nesting.
   */
  function normalizeLocationData(raw) {
    const lat = Number(raw.lat ?? raw.coordinates?.lat ?? 48.4708);
    const lng = Number(raw.lng ?? raw.lon ?? raw.coordinates?.lng ?? 7.9446);
    const osm = raw.osmContext || {};

    const roads = osm.roads || raw.baselineRoads || raw.roads || [];
    const buildings = osm.buildings || raw.baselineBuildings || raw.buildings || [];
    const signs = osm.streetSigns || osm.signs || raw.baselineSigns || raw.signs || [];
    const landmarks = osm.landmarks || raw.landmarks || [];

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
      heading: Number(raw.heading ?? raw.defaultHeading ?? 0),
      description: raw.description || '',
      landmarks,
      roads,
      buildings,
      signs,
      streetView: raw.streetView || raw.panorama || {}
    };
  }

  // =========================================================================
  // Leaflet OpenStreetMap Initialization (Main Menu, Mini-Map, Result Map)
  // =========================================================================
  function initMenuPreviewMap() {
    if (menuPreviewMap || !window.L) return;

    const { center, polygon, tileServerUrl, tileAttribution } = state.region;
    menuPreviewMap = L.map('menu-preview-map', {
      center: [center.lat, center.lng],
      zoom: 9,
      zoomControl: false,
      attributionControl: true
    });

    L.tileLayer(tileServerUrl, {
      maxZoom: 18,
      attribution: tileAttribution
    }).addTo(menuPreviewMap);

    const polyLayer = L.polygon(polygon, {
      color: '#2dc653',
      weight: 2.5,
      fillColor: '#2dc653',
      fillOpacity: 0.14,
      dashArray: '6, 4'
    }).addTo(menuPreviewMap);

    menuPreviewMap.fitBounds(polyLayer.getBounds(), { padding: [12, 12] });
  }

  function initGuessMap() {
    if (!window.L) return;

    const { center, bounds, polygon, tileServerUrl, tileAttribution } = state.region;

    if (!guessMap) {
      // Constrain panning around Ortenaukreis with comfortable visual margin
      const maxBounds = L.latLngBounds(
        [bounds.south - 0.18, bounds.west - 0.25],
        [bounds.north + 0.18, bounds.east + 0.25]
      );

      guessMap = L.map('guess-map', {
        center: [center.lat, center.lng],
        zoom: 9,
        minZoom: 8,
        maxZoom: 18,
        maxBounds,
        maxBoundsViscosity: 0.85,
        zoomControl: true
      });

      L.tileLayer(tileServerUrl, {
        maxZoom: 19,
        attribution: tileAttribution
      }).addTo(guessMap);

      // Draw the Ortenaukreis boundary polygon on the guess mini-map
      guessBoundaryLayer = L.polygon(polygon, {
        color: '#e0b252',
        weight: 2,
        fillColor: '#2dc653',
        fillOpacity: 0.05,
        interactive: false
      }).addTo(guessMap);

      // Click handler to place guess marker inside Ortenau
      guessMap.on('click', (e) => {
        placeGuessPin(e.latlng.lat, e.latlng.lng);
      });
    }

    centerGuessMapOnOrtenau();
  }

  function centerGuessMapOnOrtenau() {
    if (!guessMap || !guessBoundaryLayer) return;
    guessMap.invalidateSize();
    guessMap.fitBounds(guessBoundaryLayer.getBounds(), { padding: [10, 10] });
  }

  function refreshGuessMapSize() {
    if (!guessMap) return;
    setTimeout(() => {
      guessMap.invalidateSize();
    }, 60);
    setTimeout(() => {
      guessMap.invalidateSize();
    }, 260);
  }

  function placeGuessPin(lat, lng) {
    if (state.isSubmitting) return;

    // Clamp coordinates to reasonable Ortenaukreis vicinity if clicked outside
    const b = state.region.bounds;
    const clampedLat = Math.max(b.south - 0.05, Math.min(b.north + 0.05, lat));
    const clampedLng = Math.max(b.west - 0.06, Math.min(b.east + 0.06, lng));

    state.currentGuess = { lat: clampedLat, lng: clampedLng };

    const pinIcon = L.divIcon({
      className: 'custom-pin-icon',
      html: '<div class="pin-marker-guess"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 22]
    });

    if (guessMarker) {
      guessMarker.setLatLng([clampedLat, clampedLng]);
    } else {
      guessMarker = L.marker([clampedLat, clampedLng], { icon: pinIcon }).addTo(guessMap);
    }

    dom.guessCoordsLabel.textContent = `Pin: ${clampedLat.toFixed(4)}° N, ${clampedLng.toFixed(4)}° E (Ortenau)`;
    dom.submitGuessBtn.disabled = false;
    dom.submitGuessBtn.innerHTML = '<span>Lock In Guess</span>';
  }

  // =========================================================================
  // Game Flow: Start Game, Load Round, Switch Screens
  // =========================================================================
  async function startNewGame() {
    state.currentRound = 1;
    state.totalScore = 0;
    state.roundHistory = [];
    state.usedLocationIds = [];

    dom.mainMenuScreen.classList.remove('active');
    dom.gameScreen.classList.add('active');
    dom.resultModal.classList.add('hidden');
    dom.summaryModal.classList.add('hidden');

    initGuessMap();
    await loadRound();
  }

  function returnToMainMenu() {
    stopCompassLoop();
    dom.resultModal.classList.add('hidden');
    dom.summaryModal.classList.add('hidden');
    dom.gameScreen.classList.remove('active');
    dom.mainMenuScreen.classList.add('active');
    if (menuPreviewMap) {
      setTimeout(() => menuPreviewMap.invalidateSize(), 100);
    }
  }

  function updateHudHeader() {
    if (state.totalRounds > 0) {
      dom.hudRound.textContent = `${state.currentRound} / ${state.totalRounds}`;
    } else {
      dom.hudRound.textContent = `Round ${state.currentRound} (Free)`;
    }
    dom.hudScore.textContent = state.totalScore.toLocaleString();
  }

  async function loadRound() {
    state.currentGuess = null;
    state.isSubmitting = false;

    if (guessMarker && guessMap) {
      guessMap.removeLayer(guessMarker);
      guessMarker = null;
    }

    dom.guessCoordsLabel.textContent = 'No pin placed yet — click in Ortenau';
    dom.submitGuessBtn.disabled = true;
    dom.submitGuessBtn.innerHTML = '<span>Place Pin on Map</span>';
    dom.clueDrawer.classList.add('hidden');

    updateHudHeader();

    // Show loading screen over streetview
    dom.streetviewLoading.classList.remove('hidden');
    dom.loadingTitle.textContent = `Dropping into Ortenaukreis (Round ${state.currentRound})...`;
    dom.loadingSubtitle.textContent = 'Querying OpenStreetMap Overpass context & rendering 360° fixed-point panorama';

    try {
      const locationData = await fetchRandomOrtenauLocation();
      state.currentLocation = locationData;
      if (locationData.id) {
        state.usedLocationIds.push(locationData.id);
      }

      populateFieldObservations(locationData);
      renderFixedPointStreetView(locationData);
      centerGuessMapOnOrtenau();
    } catch (err) {
      console.error('Error loading round:', err);
      dom.loadingTitle.textContent = 'Connection issue loading Ortenau location';
      dom.loadingSubtitle.textContent = err.message;
    }
  }

  // =========================================================================
  // Field Observations Drawer (OSM Context without coordinate spoilers)
  // =========================================================================
  function populateFieldObservations(loc) {
    const terrainLabels = {
      rhine_valley: 'Upper Rhine Plain (Oberrheinebene)',
      foothills: 'Ortenau Foothills / Vorbergzone',
      vineyards: 'Baden Wine Slope (Ortenauer Weinpfad)',
      black_forest: 'High Black Forest (Nordschwarzwald)',
      kinzig_valley: 'Kinzig Valley (Kinzigtal)',
      renchtal: 'Rench Valley (Renchtal)',
      achertal: 'Acher Valley (Achertal)'
    };

    const terrainText = terrainLabels[loc.terrain] || 'Ortenaukreis Landscape';
    const roadNames = loc.roads
      .map((r) => (typeof r === 'string' ? r : r.name))
      .filter(Boolean);
    const uniqueRoads = [...new Set(roadNames)].slice(0, 3);
    const surfaces = loc.roads
      .map((r) => r && r.surface)
      .filter(Boolean);
    const primarySurface = surfaces[0] ? surfaces[0].replace(/_/g, ' ') : 'paved';

    dom.clueContent.innerHTML = `
      <div class="clue-row">
        <span>Topography:</span>
        <strong>${escapeHtml(terrainText)}</strong>
      </div>
      <div class="clue-row">
        <span>Elevation (approx.):</span>
        <strong>~${Math.round(loc.elevation || 200)} m NHN</strong>
      </div>
      <div class="clue-row">
        <span>Road Surface:</span>
        <strong>${escapeHtml(primarySurface)} (${loc.roads.length} road segments)</strong>
      </div>
      <div class="clue-row">
        <span>Nearby Street Signs:</span>
        <strong>${uniqueRoads.length ? escapeHtml(uniqueRoads.join(' / ')) : 'Local Municipal Road'}</strong>
      </div>
      <div class="clue-row">
        <span>Movement Rule:</span>
        <strong>Fixed Point (360° Rotation Only)</strong>
      </div>
    `;
  }

  // =========================================================================
  // Fixed-Point 360° StreetView Renderer (Pannellum + OSM 3D Panorama Canvas)
  // =========================================================================
  function renderFixedPointStreetView(locationData) {
    // 1. Generate high-res 4096x2048 360° equirectangular panorama from OSM data
    const panoramaDataUrl = generateOsmEquirectangularPanorama(locationData);

    // 2. Initialize or update Pannellum 360° viewer
    if (panoViewer) {
      try {
        panoViewer.destroy();
      } catch (_) {
        // Ignore cleanup errors
      }
      panoViewer = null;
    }

    panoViewer = window.pannellum.viewer('pano-viewer', {
      type: 'equirectangular',
      panorama: panoramaDataUrl,
      autoLoad: true,
      yaw: Number(locationData.heading) || 0,
      pitch: 2,
      hfov: 95,
      minHfov: 45,
      maxHfov: 120,
      showZoomCtrl: true,
      showFullscreenCtrl: true,
      compass: false,
      mouseZoom: true,
      keyboardZoom: true,
      friction: 0.18
    });

    panoViewer.on('load', () => {
      dom.streetviewLoading.classList.add('hidden');
    });

    // Fallback timeout in case load event fires synchronously
    setTimeout(() => {
      dom.streetviewLoading.classList.add('hidden');
    }, 350);

    // 3. Prepare secondary External Street Cam / Photo view
    prepareExternalStreetView(locationData);

    // Ensure active view mode is applied
    switchViewMode(state.activeViewMode);

    // 4. Start live compass HUD synchronization
    startCompassLoop();
  }

  function prepareExternalStreetView(loc) {
    const sv = loc.streetView || {};
    const heading = Number(loc.heading) || 0;
    const googleEmbedUrl =
      sv.googleStreetViewEmbedUrl ||
      `https://maps.google.com/maps?q=&layer=c&cbll=${loc.lat},${loc.lng}&cbp=11,${heading},0,0,0&output=svembed`;

    if (sv.panoramaxImageUrl || sv.imageUrl) {
      const imgUrl = sv.panoramaxImageUrl || sv.imageUrl;
      dom.externalStreetContent.innerHTML = `
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#050e09;">
          <img src="${escapeHtml(imgUrl)}" alt="Ortenau Street Level View" style="max-width:100%;max-height:100%;object-fit:contain;" />
        </div>
      `;
    } else {
      dom.externalStreetContent.innerHTML = `
        <iframe
          src="${escapeHtml(googleEmbedUrl)}"
          title="Ortenau Fixed-Point Street Camera"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
      `;
    }
  }

  function switchViewMode(mode) {
    state.activeViewMode = mode;
    if (mode === '360') {
      dom.viewMode360Btn.classList.add('active');
      dom.viewMode360Btn.setAttribute('aria-selected', 'true');
      dom.viewModeEmbedBtn.classList.remove('active');
      dom.viewModeEmbedBtn.setAttribute('aria-selected', 'false');
      dom.externalStreetView.classList.add('hidden');
      dom.panoViewerEl.classList.remove('hidden');
      if (panoViewer && typeof panoViewer.resize === 'function') {
        panoViewer.resize();
      }
    } else {
      dom.viewModeEmbedBtn.classList.add('active');
      dom.viewModeEmbedBtn.setAttribute('aria-selected', 'true');
      dom.viewMode360Btn.classList.remove('active');
      dom.viewMode360Btn.setAttribute('aria-selected', 'false');
      dom.externalStreetView.classList.remove('hidden');
    }
  }

  function resetPanoramaHeading() {
    if (!panoViewer || !state.currentLocation) return;
    panoViewer.setYaw(Number(state.currentLocation.heading) || 0, 450);
    panoViewer.setPitch(2, 450);
    panoViewer.setHfov(95, 450);
  }

  function startCompassLoop() {
    stopCompassLoop();
    function updateCompass() {
      if (panoViewer && typeof panoViewer.getYaw === 'function') {
        const rawYaw = panoViewer.getYaw();
        const heading = ((rawYaw % 360) + 360) % 360;
        const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const dirLabel = dirs[Math.round(heading / 45) % 8];
        dom.compassReadout.textContent = `${Math.round(heading)}° ${dirLabel}`;

        // Translate compass tape smoothly
        const offsetPx = -((heading / 360) * 280);
        dom.compassTape.style.transform = `translateX(${offsetPx}px)`;
      }
      state.compassAnimFrame = requestAnimationFrame(updateCompass);
    }
    state.compassAnimFrame = requestAnimationFrame(updateCompass);
  }

  function stopCompassLoop() {
    if (state.compassAnimFrame) {
      cancelAnimationFrame(state.compassAnimFrame);
      state.compassAnimFrame = null;
    }
  }

  // =========================================================================
  // High-Resolution 360° Equirectangular Street-Level Panorama Generator
  // Builds a 4096x2048 spherical panorama from real OpenStreetMap Overpass
  // roads, buildings, street signs, elevation, and Black Forest / Rhine terrain
  // =========================================================================
  function generateOsmEquirectangularPanorama(loc) {
    const W = 4096;
    const H = 2048;
    const horizonY = H * 0.5;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Deterministic pseudo-random generator seeded by location coordinates
    let seed = Math.abs(Math.floor(loc.lat * 100000 + loc.lng * 100000)) || 484708;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const isBlackForest =
      loc.terrain === 'black_forest' || (loc.elevation && loc.elevation > 420);
    const isVineyard =
      loc.terrain === 'vineyards' || loc.terrain === 'foothills';

    // -----------------------------------------------------------------------
    // 1. Sky Dome Gradient (Zenith to Horizon)
    // -----------------------------------------------------------------------
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    if (isBlackForest) {
      skyGrad.addColorStop(0, '#163859');
      skyGrad.addColorStop(0.55, '#4b83b4');
      skyGrad.addColorStop(0.92, '#a7cde6');
      skyGrad.addColorStop(1, '#d9ebf5');
    } else {
      skyGrad.addColorStop(0, '#1d4e89');
      skyGrad.addColorStop(0.55, '#5fa8d3');
      skyGrad.addColorStop(0.92, '#cae9ff');
      skyGrad.addColorStop(1, '#f4f9fc');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, horizonY + 4);

    // Sun in the SSE sky (bearing ~155 deg, elevation +28 deg)
    const sunX = (155 / 360) * W;
    const sunY = horizonY - (28 / 90) * horizonY;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, 340);
    sunGlow.addColorStop(0, 'rgba(255, 252, 225, 0.98)');
    sunGlow.addColorStop(0.2, 'rgba(255, 238, 175, 0.45)');
    sunGlow.addColorStop(1, 'rgba(255, 238, 175, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 340, 0, Math.PI * 2);
    ctx.fill();

    // Soft Cumulus Clouds across 360°
    for (let i = 0; i < 28; i++) {
      const cx = rand() * W;
      const cy = horizonY * (0.38 + rand() * 0.45);
      const cw = 140 + rand() * 260;
      const ch = 26 + rand() * 44;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
      drawWrappedEllipse(ctx, W, cx, cy, cw, ch);
    }

    // -----------------------------------------------------------------------
    // 2. 360° Ortenau Topographic Mountain Ridges (Black Forest East, Vosges West)
    // -----------------------------------------------------------------------
    // Distant Mountain Layer (Hornisgrinde / Black Forest peak profile on East 40°..160°)
    ctx.fillStyle = isBlackForest ? '#264637' : '#4a6b5d';
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x <= W; x += 16) {
      const deg = (x / W) * 360;
      // East (90°) has tall Black Forest mountains; West (270°) has flatter Rhine plain + distant Vosges
      const eastPeak = Math.exp(-Math.pow((deg - 95) / 58, 2)) * (isBlackForest ? 210 : 135);
      const southEastPeak = Math.exp(-Math.pow((deg - 145) / 45, 2)) * 95;
      const westVosges = Math.exp(-Math.pow((deg - 275) / 55, 2)) * 45;
      const ridgeNoise =
        Math.sin(deg * (Math.PI / 180) * 7) * 14 +
        Math.cos(deg * (Math.PI / 180) * 17) * 7;
      const h = Math.max(12, eastPeak + southEastPeak + westVosges + ridgeNoise);
      ctx.lineTo(x, horizonY - h);
    }
    ctx.lineTo(W, horizonY);
    ctx.closePath();
    ctx.fill();

    // Mid-distance Forested / Vineyard Foothills
    ctx.fillStyle = isVineyard ? '#3a6638' : '#1f422c';
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 2);
    for (let x = 0; x <= W; x += 12) {
      const deg = (x / W) * 360;
      const foothill =
        Math.exp(-Math.pow((deg - 85) / 70, 2)) * 75 +
        Math.exp(-Math.pow((deg - 200) / 65, 2)) * 40 +
        Math.sin(deg * (Math.PI / 180) * 11) * 9 +
        18;
      ctx.lineTo(x, horizonY - foothill);
    }
    ctx.lineTo(W, horizonY + 2);
    ctx.closePath();
    ctx.fill();

    // Draw Vineyard Terraces on sunny south/east foothills if in wine region
    if (isVineyard) {
      ctx.strokeStyle = 'rgba(138, 179, 86, 0.48)';
      ctx.lineWidth = 3;
      for (let row = 1; row <= 5; row++) {
        ctx.beginPath();
        for (let deg = 35; deg <= 145; deg += 2) {
          const x = (deg / 360) * W;
          const baseH = Math.exp(-Math.pow((deg - 85) / 70, 2)) * 65;
          const y = horizonY - (baseH * (row / 6)) - 6;
          if (deg === 35) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // -----------------------------------------------------------------------
    // 3. Ground Plane & Surrounds (Horizon to Nadir)
    // -----------------------------------------------------------------------
    const primaryRoadSurface =
      (loc.roads[0] && loc.roads[0].surface) || (isBlackForest ? 'asphalt' : 'paving_stones');
    const isCobble =
      primaryRoadSurface.includes('cobble') || primaryRoadSurface.includes('paving');

    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, H);
    if (isCobble) {
      groundGrad.addColorStop(0, '#59554f');
      groundGrad.addColorStop(0.22, '#4a4640');
      groundGrad.addColorStop(1, '#36332e');
    } else {
      groundGrad.addColorStop(0, '#3d5238');
      groundGrad.addColorStop(0.12, '#3a423d');
      groundGrad.addColorStop(0.35, '#2f3337');
      groundGrad.addColorStop(1, '#232629');
    }
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizonY, W, H - horizonY);

    // Subtle cobblestone / ground texture rings near nadir
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 2;
    for (let p = 8; p < 85; p += 6) {
      const y = horizonY + (p / 90) * (H - horizonY);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // -----------------------------------------------------------------------
    // 4. Render OpenStreetMap Roads Radiating at Real Compass Bearings
    // -----------------------------------------------------------------------
    const roadsToRender = loc.roads.length > 0
      ? loc.roads
      : [
          { name: loc.name || 'Landstraße', highway: 'secondary', bearing: loc.heading || 0, surface: 'asphalt' },
          { name: loc.name || 'Landstraße', highway: 'secondary', bearing: ((loc.heading || 0) + 180) % 360, surface: 'asphalt' }
        ];

    roadsToRender.forEach((road) => {
      const bearing = Number(road.bearing ?? 0);
      const centerX = ((bearing % 360 + 360) % 360 / 360) * W;
      const isPedestrian =
        road.highway === 'pedestrian' || road.highway === 'footway' || road.surface === 'cobblestone';
      const roadHalfWidthBottom = isPedestrian ? 340 : 440;
      const roadHalfWidthHorizon = isPedestrian ? 18 : 26;

      drawWrappedRoadCorridor(
        ctx,
        W,
        H,
        horizonY,
        centerX,
        roadHalfWidthHorizon,
        roadHalfWidthBottom,
        isPedestrian ? '#6b635b' : '#2d3136',
        !isPedestrian
      );
    });

    // -----------------------------------------------------------------------
    // 5. Black Forest Pine Trees & Roadside Foliage
    // -----------------------------------------------------------------------
    const treeCount = isBlackForest ? 42 : 18;
    for (let i = 0; i < treeCount; i++) {
      const treeBearing = (i * (360 / treeCount) + rand() * 14) % 360;
      // Avoid placing trees directly in the middle of a road bearing
      const onRoad = roadsToRender.some((r) => angularDiff(treeBearing, Number(r.bearing || 0)) < 16);
      if (onRoad) continue;

      const treeX = (treeBearing / 360) * W;
      const treeScale = 0.7 + rand() * 0.85;
      drawPineTree(ctx, treeX, horizonY + 18, 95 * treeScale, 210 * treeScale);
    }

    // -----------------------------------------------------------------------
    // 6. Render Real OpenStreetMap Buildings (Fachwerk, Townhalls, Towers)
    // -----------------------------------------------------------------------
    const buildingsToRender = [...(loc.buildings || [])].sort(
      (a, b) => (Number(b.distance) || 30) - (Number(a.distance) || 30)
    );

    buildingsToRender.forEach((bldg) => {
      const bearing = ((Number(bldg.bearing ?? 60) % 360) + 360) % 360;
      const dist = Math.max(12, Number(bldg.distance) || 24);
      const levels = Math.max(1, Number(bldg.levels) || 3);
      const centerX = (bearing / 360) * W;

      // Perspective sizing from distance & building levels
      const bldgWidth = Math.min(480, Math.max(130, (5400 / dist)));
      const bldgHeight = Math.min(390, Math.max(95, (levels * 1650) / dist));
      const baseY = horizonY + Math.min(140, 1600 / dist);

      drawOrtenauBuilding(ctx, W, {
        centerX,
        baseY,
        width: bldgWidth,
        height: bldgHeight,
        levels,
        color: bldg.color || '#ebd8c0',
        roofShape: bldg.roofShape || 'gabled',
        type: bldg.type || 'residential',
        name: bldg.name || ''
      });
    });

    // -----------------------------------------------------------------------
    // 7. Render Authentic Street Name Signs & Bundesstraße Direction Signs
    // -----------------------------------------------------------------------
    const signsToRender = [...(loc.signs || [])];
    if (signsToRender.length === 0 && roadsToRender.length > 0) {
      signsToRender.push({
        text: roadsToRender[0].name || 'Ortenaustraße',
        subtext: loc.postalCode ? `${loc.postalCode} Ortenaukreis` : 'Ortenaukreis',
        type: 'street_name',
        bearing: ((Number(roadsToRender[0].bearing || 0) + 22) % 360)
      });
    }

    signsToRender.forEach((sign) => {
      const bearing = ((Number(sign.bearing ?? 35) % 360) + 360) % 360;
      const signX = (bearing / 360) * W;
      drawStreetSign(ctx, W, signX, horizonY, sign);
    });

    // -----------------------------------------------------------------------
    // 8. Subtle Compass Horizon Ticks (N / E / S / W) for Spatial Orientation
    // -----------------------------------------------------------------------
    const cardinals = [
      { deg: 0, label: 'N' },
      { deg: 90, label: 'E • Schwarzwald' },
      { deg: 180, label: 'S' },
      { deg: 270, label: 'W • Rheintal' }
    ];
    cardinals.forEach((c) => {
      const cx = (c.deg / 360) * W;
      ctx.fillStyle = 'rgba(10, 28, 18, 0.62)';
      ctx.strokeStyle = 'rgba(224, 178, 82, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cx - 58, horizonY - 195, 116, 26, 13);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e0b252';
      ctx.font = '700 13px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.label, cx, horizonY - 182);
    });

    return canvas.toDataURL('image/jpeg', 0.9);
  }

  // Helper: Draw ellipse that wraps cleanly across 0/W seam
  function drawWrappedEllipse(ctx, W, cx, cy, rx, ry) {
    [-W, 0, W].forEach((offset) => {
      const x = cx + offset;
      if (x + rx < 0 || x - rx > W) return;
      ctx.beginPath();
      ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Helper: Draw perspective road corridor with center dashes & sidewalks
  function drawWrappedRoadCorridor(ctx, W, H, horizonY, centerX, topHalfW, bottomHalfW, color, hasCenterLine) {
    [-W, 0, W].forEach((offset) => {
      const cx = centerX + offset;
      if (cx + bottomHalfW < 0 || cx - bottomHalfW > W) return;

      // Sidewalk / Shoulder
      ctx.fillStyle = '#7f827c';
      ctx.beginPath();
      ctx.moveTo(cx - topHalfW * 1.25, horizonY + 2);
      ctx.lineTo(cx + topHalfW * 1.25, horizonY + 2);
      ctx.lineTo(cx + bottomHalfW * 1.16, H);
      ctx.lineTo(cx - bottomHalfW * 1.16, H);
      ctx.closePath();
      ctx.fill();

      // Road Surface
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx - topHalfW, horizonY + 2);
      ctx.lineTo(cx + topHalfW, horizonY + 2);
      ctx.lineTo(cx + bottomHalfW, H);
      ctx.lineTo(cx - bottomHalfW, H);
      ctx.closePath();
      ctx.fill();

      // White Center Line Dashes
      if (hasCenterLine) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.lineWidth = 5;
        ctx.setLineDash([28, 22]);
        ctx.beginPath();
        ctx.moveTo(cx, horizonY + 12);
        ctx.lineTo(cx, H);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }

  // Helper: Draw Black Forest Conifer / Pine
  function drawPineTree(ctx, x, baseY, width, height) {
    // Trunk
    ctx.fillStyle = '#3d2817';
    ctx.fillRect(x - width * 0.08, baseY - height * 0.22, width * 0.16, height * 0.24);

    // Layered pine tiers
    const tiers = 4;
    for (let t = 0; t < tiers; t++) {
      const ratio = t / tiers;
      const tierTop = baseY - height + ratio * (height * 0.55);
      const tierBottom = tierTop + height * 0.36;
      const tierHalfW = width * (0.28 + (1 - ratio * 0.5) * 0.32);

      ctx.fillStyle = t % 2 === 0 ? '#143623' : '#1b432c';
      ctx.beginPath();
      ctx.moveTo(x, tierTop);
      ctx.lineTo(x - tierHalfW, tierBottom);
      ctx.lineTo(x + tierHalfW, tierBottom);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Helper: Draw Ortenau Building (Half-Timbered Fachwerk, Baroque Townhall, etc.)
  function drawOrtenauBuilding(ctx, W, b) {
    [-W, 0, W].forEach((offset) => {
      const cx = b.centerX + offset;
      const left = cx - b.width / 2;
      const top = b.baseY - b.height;
      if (left + b.width < 0 || left > W) return;

      // Wall Facade
      ctx.fillStyle = b.color;
      ctx.strokeStyle = 'rgba(30, 25, 20, 0.55)';
      ctx.lineWidth = 2;
      ctx.fillRect(left, top, b.width, b.height);
      ctx.strokeRect(left, top, b.width, b.height);

      // Half-Timbered (Fachwerk) beams for timber_frame / historic / winery buildings
      if (b.type === 'timber_frame' || b.type === 'historic' || b.type === 'winery') {
        ctx.strokeStyle = '#4a2c18';
        ctx.lineWidth = 3.5;
        for (let lv = 1; lv <= b.levels; lv++) {
          const yLv = top + (b.height / b.levels) * lv;
          ctx.beginPath();
          ctx.moveTo(left, yLv);
          ctx.lineTo(left + b.width, yLv);
          ctx.stroke();
        }
        // Vertical & diagonal Fachwerk struts
        const cols = 4;
        for (let c = 1; c < cols; c++) {
          const xCol = left + (b.width / cols) * c;
          ctx.beginPath();
          ctx.moveTo(xCol, top);
          ctx.lineTo(xCol, top + b.height);
          ctx.stroke();
        }
      }

      // Pitched Roof (Gabled / Hipped / Pyramidal)
      const roofH = b.type === 'historic_tower' ? b.height * 0.38 : b.height * 0.28;
      ctx.fillStyle = '#8c3b2b'; // Classic Baden terracotta roof tiles
      ctx.beginPath();
      ctx.moveTo(left - 8, top);
      ctx.lineTo(cx, top - roofH);
      ctx.lineTo(left + b.width + 8, top);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Windows Grid
      const winCols = Math.max(2, Math.min(5, Math.floor(b.width / 46)));
      const levelH = b.height / b.levels;
      for (let r = 0; r < b.levels; r++) {
        for (let c = 0; c < winCols; c++) {
          const wx = left + ((c + 0.5) / winCols) * b.width - 9;
          const wy = top + r * levelH + levelH * 0.25;
          ctx.fillStyle = '#293845';
          ctx.fillRect(wx, wy, 18, levelH * 0.48);
          ctx.strokeStyle = '#f8f9fa';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(wx, wy, 18, levelH * 0.48);
        }
      }

      // Facade Signboard (if named building/landmark)
      if (b.name) {
        ctx.fillStyle = 'rgba(20, 32, 24, 0.86)';
        const labelW = Math.min(b.width - 12, 210);
        ctx.fillRect(cx - labelW / 2, top + b.height - 34, labelW, 22);
        ctx.fillStyle = '#f3e5ab';
        ctx.font = '700 12px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.name.slice(0, 26), cx, top + b.height - 23);
      }
    });
  }

  // Helper: Draw German Street Name Sign or Yellow Bundesstraße Direction Sign
  function drawStreetSign(ctx, W, x, horizonY, sign) {
    [-W, 0, W].forEach((offset) => {
      const sx = x + offset;
      if (sx < -250 || sx > W + 250) return;

      const postTopY = horizonY - 22;
      const postBottomY = horizonY + 145;

      // Metal Signpost
      ctx.fillStyle = '#7d858c';
      ctx.fillRect(sx - 4, postTopY, 8, postBottomY - postTopY);

      const isDirection = sign.type === 'direction';
      const boxW = isDirection ? 270 : 195;
      const boxH = sign.subtext ? 54 : 38;
      const boxX = sx - boxW / 2;
      const boxY = postTopY - boxH + 6;

      // Sign Board Background (Yellow for German Bundesstraße direction, Blue/White for street name)
      ctx.fillStyle = isDirection ? '#f4c430' : '#1d3557';
      ctx.strokeStyle = isDirection ? '#111111' : '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();

      // Primary Text
      ctx.fillStyle = isDirection ? '#111111' : '#ffffff';
      ctx.font = '700 15px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        String(sign.text || 'Ortenau').slice(0, 32),
        sx,
        sign.subtext ? boxY + 19 : boxY + boxH / 2
      );

      // Subtext
      if (sign.subtext) {
        ctx.fillStyle = isDirection ? '#222222' : '#cbe5ff';
        ctx.font = '600 12px "Inter", sans-serif';
        ctx.fillText(String(sign.subtext).slice(0, 34), sx, boxY + 39);
      }
    });
  }

  function angularDiff(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  // =========================================================================
  // Submit Guess & Render Round Result Map with Real Distance
  // =========================================================================
  async function submitCurrentGuess() {
    if (!state.currentGuess || !state.currentLocation || state.isSubmitting) return;

    state.isSubmitting = true;
    dom.submitGuessBtn.disabled = true;
    dom.submitGuessBtn.innerHTML = '<span>Calculating Distance...</span>';

    const actual = state.currentLocation;
    const guess = state.currentGuess;

    let resultData = null;

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
      resultData = await response.json();
    } catch (err) {
      console.warn('Fallback to client-side Haversine distance calculation:', err.message);
      resultData = computeClientFallbackGuessResult(actual, guess);
    }

    displayRoundResult(actual, guess, resultData);
  }

  function computeClientFallbackGuessResult(actual, guess) {
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

  function displayRoundResult(actual, guess, res) {
    const distanceMeters = Number(
      res.distanceMeters ?? Math.round((res.distanceKm || 0) * 1000)
    );
    const distanceKm = Number(res.distanceKm ?? (distanceMeters / 1000).toFixed(2));
    const distanceFormatted =
      res.distanceFormatted ||
      (distanceMeters < 1000 ? `${distanceMeters} m` : `${distanceKm.toFixed(2)} km`);
    const roundScore = Number(res.score ?? 0);
    const maxScore = Number(res.maxScore ?? 5000);

    // Update cumulative game state
    state.totalScore += roundScore;
    state.roundHistory.push({
      round: state.currentRound,
      locationName: `${actual.municipality} — ${actual.name}`,
      distanceMeters,
      distanceFormatted,
      score: roundScore
    });

    updateHudHeader();

    // Populate Result Modal DOM
    dom.resultRoundBadge.textContent = `ROUND ${state.currentRound} RESULT`;
    dom.resultLocationTitle.textContent = `${actual.municipality} — ${actual.name}`;
    dom.resultLocationSubtitle.textContent =
      actual.description || `Coordinates: ${actual.lat.toFixed(4)}° N, ${actual.lng.toFixed(4)}° E (Ortenaukreis)`;

    dom.resultDistanceValue.textContent = distanceFormatted;
    dom.resultDistanceMeters.textContent = `${distanceMeters.toLocaleString()} m real distance`;
    dom.resultScoreValue.textContent = `+${roundScore.toLocaleString()}`;
    dom.legendDistanceInline.textContent = distanceFormatted;

    const pct = Math.min(100, Math.max(2, Math.round((roundScore / maxScore) * 100)));
    dom.resultScoreBar.style.width = `${pct}%`;

    // OSM metadata chips
    const landmarksList = (actual.landmarks || []).slice(0, 3).join(' • ');
    dom.resultOsmDetails.innerHTML = `
      <span class="osm-chip">📍 <strong>Municipality:</strong> ${escapeHtml(actual.municipality)}</span>
      <span class="osm-chip">⛰️ <strong>Elevation:</strong> ${Math.round(actual.elevation || 180)} m</span>
      ${landmarksList ? `<span class="osm-chip">🏛️ <strong>Landmarks:</strong> ${escapeHtml(landmarksList)}</span>` : ''}
    `;

    // Configure Next Round button text
    const isFinalRound = state.totalRounds > 0 && state.currentRound >= state.totalRounds;
    dom.nextRoundBtn.innerHTML = isFinalRound
      ? '<span>View Final Summary</span>'
      : '<span>Next Round</span>';

    dom.resultModal.classList.remove('hidden');

    // Render OpenStreetMap Result Map with Actual, Guess, and Connecting Line
    renderResultComparisonMap(actual, guess, distanceFormatted);
  }

  function renderResultComparisonMap(actual, guess, distanceFormatted) {
    if (!window.L) return;

    const { tileServerUrl, tileAttribution, polygon } = state.region;

    if (!resultMap) {
      resultMap = L.map('result-map', {
        center: [actual.lat, actual.lng],
        zoom: 10
      });

      L.tileLayer(tileServerUrl, {
        maxZoom: 19,
        attribution: tileAttribution
      }).addTo(resultMap);

      // Subtle Ortenaukreis polygon on the result map
      L.polygon(polygon, {
        color: '#2dc653',
        weight: 1.5,
        fillOpacity: 0.03,
        dashArray: '4, 4',
        interactive: false
      }).addTo(resultMap);

      resultLayerGroup = L.layerGroup().addTo(resultMap);
    }

    resultLayerGroup.clearLayers();

    const actualLatLng = [actual.lat, actual.lng];
    const guessLatLng = [guess.lat, guess.lng];

    const actualIcon = L.divIcon({
      className: 'custom-pin-icon',
      html: '<div class="pin-marker-actual"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const guessIcon = L.divIcon({
      className: 'custom-pin-icon',
      html: '<div class="pin-marker-guess"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 22]
    });

    // 1. Connecting Line between Actual Location and User's Guess
    const line = L.polyline([actualLatLng, guessLatLng], {
      color: '#e0b252',
      weight: 3.5,
      dashArray: '8, 8'
    }).addTo(resultLayerGroup);

    // Midpoint Distance Tooltip
    const midLat = (actual.lat + guess.lat) / 2;
    const midLng = (actual.lng + guess.lng) / 2;
    L.tooltip({
      permanent: true,
      direction: 'center',
      className: 'distance-map-tooltip'
    })
      .setLatLng([midLat, midLng])
      .setContent(`Real Distance: ${distanceFormatted}`)
      .addTo(resultLayerGroup);

    // 2. Actual Location Marker & Popup
    L.marker(actualLatLng, { icon: actualIcon })
      .bindPopup(`<strong>Actual Location:</strong><br/>${escapeHtml(actual.municipality)} — ${escapeHtml(actual.name)}`)
      .addTo(resultLayerGroup);

    // 3. User Guess Marker & Popup
    L.marker(guessLatLng, { icon: guessIcon })
      .bindPopup(`<strong>Your Guess</strong><br/>Distance: ${escapeHtml(distanceFormatted)}`)
      .addTo(resultLayerGroup);

    setTimeout(() => {
      resultMap.invalidateSize();
      resultMap.fitBounds(line.getBounds(), { padding: [45, 45], maxZoom: 15 });
    }, 80);
  }

  function handleNextRoundClick() {
    dom.resultModal.classList.add('hidden');

    if (state.totalRounds > 0 && state.currentRound >= state.totalRounds) {
      showFinalSummaryModal();
    } else {
      state.currentRound += 1;
      loadRound();
    }
  }

  // =========================================================================
  // Final Summary Modal (After 5 Rounds)
  // =========================================================================
  function showFinalSummaryModal() {
    const maxPossible = state.roundHistory.length * 5000;
    dom.summaryTotalScore.textContent = `${state.totalScore.toLocaleString()} / ${maxPossible.toLocaleString()}`;

    const totalMeters = state.roundHistory.reduce((acc, r) => acc + r.distanceMeters, 0);
    const avgMeters = state.roundHistory.length
      ? Math.round(totalMeters / state.roundHistory.length)
      : 0;
    dom.summaryAvgDistance.textContent =
      avgMeters < 1000 ? `${avgMeters} m` : `${(avgMeters / 1000).toFixed(2)} km`;

    const bestRound = state.roundHistory.reduce(
      (best, r) => (!best || r.distanceMeters < best.distanceMeters ? r : best),
      null
    );
    dom.summaryBestRound.textContent = bestRound ? bestRound.distanceFormatted : '—';

    // Rank message based on score
    if (state.totalScore >= 20000) {
      dom.summaryRankText.textContent = 'Ortenau Grandmaster! You know every valley from the Rhine to the Hornisgrinde.';
    } else if (state.totalScore >= 14000) {
      dom.summaryRankText.textContent = 'Schwarzwald Navigator! Strong knowledge of the Ortenaukreis.';
    } else {
      dom.summaryRankText.textContent = 'Good expedition through the Ortenau region — play again to beat your record!';
    }

    dom.summaryRoundsTbody.innerHTML = state.roundHistory
      .map(
        (r) => `
        <tr>
          <td><strong>#${r.round}</strong></td>
          <td>${escapeHtml(r.locationName)}</td>
          <td>${escapeHtml(r.distanceFormatted)} (${r.distanceMeters.toLocaleString()} m)</td>
          <td><strong>+${r.score.toLocaleString()} pts</strong></td>
        </tr>
      `
      )
      .join('');

    dom.summaryModal.classList.remove('hidden');
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Boot application when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
