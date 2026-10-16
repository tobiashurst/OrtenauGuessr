/**
 * Ortenau Guesser - Leaflet Map Manager (Frontend/js/maps.js)
 * Manages the Menu Preview Map, Interactive Guess Minimap, and Result Comparison Map.
 */

import { dom } from './dom.js';
import { state } from './state.js';

let menuPreviewMap = null;
let guessMap = null;
let guessMarker = null;
let guessBoundaryLayer = null;
let resultMap = null;
let resultLayerGroup = null;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Initialize main menu region boundary preview map
 */
export function initMenuPreviewMap() {
  if (menuPreviewMap || !window.L) return;

  const { center, polygon, tileServerUrl, tileAttribution } = state.region;
  menuPreviewMap = window.L.map('menu-preview-map', {
    center: [center.lat, center.lng],
    zoom: 9,
    zoomControl: false,
    attributionControl: true
  });

  window.L.tileLayer(tileServerUrl, {
    maxZoom: 18,
    attribution: tileAttribution
  }).addTo(menuPreviewMap);

  const polyLayer = window.L.polygon(polygon, {
    color: '#2dc653',
    weight: 2.5,
    fillColor: '#2dc653',
    fillOpacity: 0.14,
    dashArray: '6, 4'
  }).addTo(menuPreviewMap);

  menuPreviewMap.fitBounds(polyLayer.getBounds(), { padding: [12, 12] });
}

export function invalidateMenuPreviewMap() {
  if (menuPreviewMap) {
    setTimeout(() => menuPreviewMap.invalidateSize(), 100);
  }
}

/**
 * Initialize interactive guess minimap constrained to Ortenaukreis
 */
export function initGuessMap() {
  if (!window.L) return;

  const { center, bounds, polygon, tileServerUrl, tileAttribution } = state.region;

  if (!guessMap) {
    // Constrain panning around Ortenaukreis with comfortable visual margin
    const maxBounds = window.L.latLngBounds(
      [bounds.south - 0.18, bounds.west - 0.25],
      [bounds.north + 0.18, bounds.east + 0.25]
    );

    guessMap = window.L.map('guess-map', {
      center: [center.lat, center.lng],
      zoom: 9,
      minZoom: 8,
      maxZoom: 18,
      maxBounds,
      maxBoundsViscosity: 0.85,
      zoomControl: true
    });

    window.L.tileLayer(tileServerUrl, {
      maxZoom: 19,
      attribution: tileAttribution
    }).addTo(guessMap);

    // Draw the Ortenaukreis boundary polygon on the guess mini-map
    guessBoundaryLayer = window.L.polygon(polygon, {
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

export function centerGuessMapOnOrtenau() {
  if (!guessMap || !guessBoundaryLayer) return;
  guessMap.invalidateSize();
  guessMap.fitBounds(guessBoundaryLayer.getBounds(), { padding: [10, 10] });
}

export function refreshGuessMapSize() {
  if (!guessMap) return;
  setTimeout(() => {
    guessMap.invalidateSize();
  }, 60);
  setTimeout(() => {
    guessMap.invalidateSize();
  }, 260);
}

export function clearGuessMarker() {
  if (guessMarker && guessMap) {
    guessMap.removeLayer(guessMarker);
    guessMarker = null;
  }
}

export function placeGuessPin(lat, lng) {
  if (state.isSubmitting) return;

  // Clamp coordinates to reasonable Ortenaukreis vicinity if clicked outside
  const b = state.region.bounds;
  const clampedLat = Math.max(b.south - 0.05, Math.min(b.north + 0.05, lat));
  const clampedLng = Math.max(b.west - 0.06, Math.min(b.east + 0.06, lng));

  state.currentGuess = { lat: clampedLat, lng: clampedLng };

  const pinIcon = window.L.divIcon({
    className: 'custom-pin-icon',
    html: '<div class="pin-marker-guess"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 22]
  });

  if (guessMarker) {
    guessMarker.setLatLng([clampedLat, clampedLng]);
  } else {
    guessMarker = window.L.marker([clampedLat, clampedLng], { icon: pinIcon }).addTo(guessMap);
  }

  dom.guessCoordsLabel.textContent = `Pin: ${clampedLat.toFixed(4)}° N, ${clampedLng.toFixed(4)}° E (Ortenau)`;
  dom.submitGuessBtn.disabled = false;
  dom.submitGuessBtn.innerHTML = '<span>Lock In Guess</span>';
}

/**
 * Render round result map with actual location, user guess, and connecting distance line
 */
export function renderResultComparisonMap(actual, guess, distanceFormatted) {
  if (!window.L) return;

  const { tileServerUrl, tileAttribution, polygon } = state.region;

  if (!resultMap) {
    resultMap = window.L.map('result-map', {
      center: [actual.lat, actual.lng],
      zoom: 10
    });

    window.L.tileLayer(tileServerUrl, {
      maxZoom: 19,
      attribution: tileAttribution
    }).addTo(resultMap);

    // Subtle Ortenaukreis polygon on the result map
    window.L.polygon(polygon, {
      color: '#2dc653',
      weight: 1.5,
      fillOpacity: 0.03,
      dashArray: '4, 4',
      interactive: false
    }).addTo(resultMap);

    resultLayerGroup = window.L.layerGroup().addTo(resultMap);
  }

  resultLayerGroup.clearLayers();

  const actualLatLng = [actual.lat, actual.lng];
  const guessLatLng = [guess.lat, guess.lng];

  const actualIcon = window.L.divIcon({
    className: 'custom-pin-icon',
    html: '<div class="pin-marker-actual"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  const guessIcon = window.L.divIcon({
    className: 'custom-pin-icon',
    html: '<div class="pin-marker-guess"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 22]
  });

  // 1. Connecting Line between Actual Location and User's Guess
  const line = window.L.polyline([actualLatLng, guessLatLng], {
    color: '#e0b252',
    weight: 3.5,
    dashArray: '8, 8'
  }).addTo(resultLayerGroup);

  // Midpoint Distance Tooltip
  const midLat = (actual.lat + guess.lat) / 2;
  const midLng = (actual.lng + guess.lng) / 2;
  window.L.tooltip({
    permanent: true,
    direction: 'center',
    className: 'distance-map-tooltip'
  })
    .setLatLng([midLat, midLng])
    .setContent(`Real Distance: ${distanceFormatted}`)
    .addTo(resultLayerGroup);

  // 2. Actual Location Marker & Popup
  window.L.marker(actualLatLng, { icon: actualIcon })
    .bindPopup(`<strong>Actual Location:</strong><br/>${escapeHtml(actual.municipality)} — ${escapeHtml(actual.name)}`)
    .addTo(resultLayerGroup);

  // 3. User Guess Marker & Popup
  window.L.marker(guessLatLng, { icon: guessIcon })
    .bindPopup(`<strong>Your Guess</strong><br/>Distance: ${escapeHtml(distanceFormatted)}`)
    .addTo(resultLayerGroup);

  setTimeout(() => {
    resultMap.invalidateSize();
    resultMap.fitBounds(line.getBounds(), { padding: [45, 45], maxZoom: 15 });
  }, 80);
}

