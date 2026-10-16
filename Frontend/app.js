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

    providerBadge: document.getElementById('streetview-provider-badge'),
    toggleClueBtn: document.getElementById('toggle-clue-btn'),
    clueDrawer: document.getElementById('clue-drawer'),
    closeClueBtn: document.getElementById('close-clue-btn'),
    clueContent: document.getElementById('clue-content'),

    panoViewerEl: document.getElementById('pano-viewer'),
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

    // Keyboard shortcut: Escape to close rules
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
   * and real 360° StreetView imagery metadata are consistently structured.
   */
  function normalizeLocationData(raw) {
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

  async function loadRound(retryAttempt = 0) {
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
    dom.loadingSubtitle.textContent = 'Searching for real 360° StreetView panorama in Ortenau...';

    try {
      const locationData = await fetchRandomOrtenauLocation();
      if (locationData.id) {
        state.usedLocationIds.push(locationData.id);
      }

      // Strictly exclude any location that does not have a real 360° panorama
      const img = locationData.imagery;
      if (!img || img.is360 !== true || (!img.panoId && !img.imageUrl)) {
        if (retryAttempt < 6) {
          return loadRound(retryAttempt + 1);
        }
        throw new Error('No real 360° StreetView panorama available for this location.');
      }

      state.currentLocation = locationData;
      populateFieldObservations(locationData);
      await renderReal360StreetView(locationData, retryAttempt);
      centerGuessMapOnOrtenau();
    } catch (err) {
      console.error('Error loading round:', err);
      dom.loadingTitle.textContent = 'Connection issue loading Ortenau 360° location';
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
        <span>Imagery Source:</span>
        <strong>${escapeHtml(loc.imagery?.provider || 'Google Street View 360°')}</strong>
      </div>
    `;
  }

  // =========================================================================
  // Real 360° Equirectangular StreetView Renderer (Pannellum 360° Spherical Viewer)
  // =========================================================================
  async function renderReal360StreetView(locationData, retryAttempt = 0) {
    stopCompassLoop();

    if (panoViewer) {
      try {
        panoViewer.destroy();
      } catch (_) {
        // Ignore cleanup errors
      }
      panoViewer = null;
    }

    const img = locationData.imagery || {};
    if (img.is360 !== true || (!img.panoId && !img.imageUrl)) {
      if (retryAttempt < 6) {
        return loadRound(retryAttempt + 1);
      }
      return;
    }

    if (dom.providerBadge) {
      dom.providerBadge.innerHTML = `<span>🌐 ${escapeHtml(img.provider || 'Google Street View 360°')}</span>`;
    }

    if (dom.streetviewStatusText) {
      dom.streetviewStatusText.textContent =
        'Real 360° StreetView • Drag anywhere to look around 360° • Scroll to zoom • Position is fixed';
    }

    let panoramaUrl = img.imageUrl || null;

    // If this is a Google Street View panorama, stitch the 512x512 tiles into a full equirectangular panorama
    if (img.panoId) {
      dom.loadingSubtitle.textContent = `Stitching real 360° StreetView panorama in ${escapeHtml(locationData.municipality)}...`;
      try {
        panoramaUrl = await stitchGoogleStreetViewPanorama(
          img.panoId,
          img.worldWidth,
          img.worldHeight,
          img.tileZoom || 2
        );
      } catch (stitchErr) {
        console.warn('Failed to stitch Google Street View tiles, retrying:', stitchErr);
        if (retryAttempt < 6) {
          return loadRound(retryAttempt + 1);
        }
      }
    }

    if (!panoramaUrl) {
      if (retryAttempt < 6) {
        return loadRound(retryAttempt + 1);
      }
      dom.loadingTitle.textContent = 'Unable to resolve 360° StreetView panorama';
      dom.loadingSubtitle.textContent = 'Please try again.';
      return;
    }

    panoViewer = window.pannellum.viewer('pano-viewer', {
      type: 'equirectangular',
      panorama: panoramaUrl,
      crossOrigin: 'anonymous',
      autoLoad: true,
      yaw: Number(locationData.heading) || 0,
      pitch: 0,
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

    panoViewer.on('error', () => {
      console.warn('360° panorama failed to load in viewer for location:', locationData.id);
      if (retryAttempt < 6) {
        loadRound(retryAttempt + 1);
      } else {
        dom.loadingTitle.textContent = 'Unable to load 360° StreetView image';
        dom.loadingSubtitle.textContent = 'Please check your internet connection and try again.';
      }
    });

    startCompassLoop();
  }

  /**
   * Stitches Google Street View 512x512 tiles from /api/streetview/tile
   * into a seamless 2:1 equirectangular 360° panorama.
   */
  async function stitchGoogleStreetViewPanorama(panoId, worldWidth, worldHeight, zoom = 2) {
    const canvas = document.createElement('canvas');
    canvas.width = worldWidth || 2048;
    canvas.height = worldHeight || 1024;
    const ctx = canvas.getContext('2d');

    const cols = Math.ceil(canvas.width / 512);
    const rows = Math.ceil(canvas.height / 512);

    const tilePromises = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const p = new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.drawImage(img, x * 512, y * 512);
            resolve();
          };
          img.onerror = () => {
            // Partial edge tile may not exist; gracefully proceed
            resolve();
          };
          img.src = `/api/streetview/tile?panoid=${encodeURIComponent(panoId)}&x=${x}&y=${y}&zoom=${zoom}`;
        });
        tilePromises.push(p);
      }
    }

    await Promise.all(tilePromises);
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  function resetPanoramaHeading() {
    if (!panoViewer || !state.currentLocation) return;
    panoViewer.setYaw(Number(state.currentLocation.heading) || 0, 450);
    panoViewer.setPitch(0, 450);
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
