/**
 * Ortenau Guesser - Street View & Panorama Manager (Frontend/js/streetview.js)
 * Manages the Pannellum 360° spherical viewer, Google Street View tile stitching,
 * and live HUD compass loop.
 */

import { dom } from './dom.js';
import { state } from './state.js';

let panoViewer = null;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Destroy existing Pannellum viewer instance safely
 */
export function destroyStreetView() {
  stopCompassLoop();
  if (panoViewer) {
    try {
      panoViewer.destroy();
    } catch (_) {
      // Ignore cleanup errors
    }
    panoViewer = null;
  }
}

/**
 * Reset camera heading to look north / default panorama angle
 */
export function resetPanoramaHeading() {
  if (!panoViewer || !state.currentLocation) return;
  panoViewer.setYaw(Number(state.currentLocation.heading) || 0, 450);
  panoViewer.setPitch(0, 450);
  panoViewer.setHfov(95, 450);
}

/**
 * Live 60fps RAF loop syncing Pannellum yaw heading to top HUD compass tape
 */
export function startCompassLoop() {
  stopCompassLoop();
  function updateCompass() {
    if (panoViewer && typeof panoViewer.getYaw === 'function') {
      const rawYaw = panoViewer.getYaw();
      const heading = ((rawYaw % 360) + 360) % 360;
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const dirLabel = dirs[Math.round(heading / 45) % 8];
      if (dom.compassReadout) {
        dom.compassReadout.textContent = `${Math.round(heading)}° ${dirLabel}`;
      }

      if (dom.compassTape) {
        const offsetPx = -((heading / 360) * 280);
        dom.compassTape.style.transform = `translateX(${offsetPx}px)`;
      }
    }
    state.compassAnimFrame = requestAnimationFrame(updateCompass);
  }
  state.compassAnimFrame = requestAnimationFrame(updateCompass);
}

export function stopCompassLoop() {
  if (state.compassAnimFrame) {
    cancelAnimationFrame(state.compassAnimFrame);
    state.compassAnimFrame = null;
  }
}

/**
 * Stitches Google Street View 512x512 tiles from /api/streetview/tile
 * into a seamless 2:1 equirectangular 360° panorama canvas.
 */
export async function stitchGoogleStreetViewPanorama(panoId, worldWidth, worldHeight, zoom = 2) {
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

/**
 * Initializes Pannellum with real 360° equirectangular imagery
 */
export async function renderReal360StreetView(locationData, onRetry, retryAttempt = 0) {
  destroyStreetView();

  const img = locationData.imagery || {};
  if (img.is360 !== true || (!img.panoId && !img.imageUrl)) {
    if (retryAttempt < 6 && typeof onRetry === 'function') {
      return onRetry(retryAttempt + 1);
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

  // If this is a Google Street View panorama, stitch the 512x512 tiles
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
      if (retryAttempt < 6 && typeof onRetry === 'function') {
        return onRetry(retryAttempt + 1);
      }
    }
  }

  if (!panoramaUrl) {
    if (retryAttempt < 6 && typeof onRetry === 'function') {
      return onRetry(retryAttempt + 1);
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
    if (retryAttempt < 6 && typeof onRetry === 'function') {
      onRetry(retryAttempt + 1);
    } else {
      dom.loadingTitle.textContent = 'Unable to load 360° StreetView image';
      dom.loadingSubtitle.textContent = 'Please check your internet connection and try again.';
    }
  });

  startCompassLoop();
}

