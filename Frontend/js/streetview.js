/**
 * Ortenau Guesser - Street View & Panorama Manager (Frontend/js/streetview.js)
 * Manages the Pannellum 360° spherical viewer, Google Street View tile stitching,
 * and live HUD compass loop.
 */

import { dom } from './dom.js';
import { state } from './state.js';

let panoViewer = null;
let activeRenderToken = 0;
let activeUpgradeAbortController = null;
let activeBlobUrls = [];
let cachedMaxEquirectWidth = null;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function revokeActiveBlobUrls() {
  while (activeBlobUrls.length > 0) {
    const url = activeBlobUrls.pop();
    try {
      URL.revokeObjectURL(url);
    } catch (_) {
      // Ignore revoke errors
    }
  }
}

/**
 * Queries the device's WebGL MAX_TEXTURE_SIZE.
 * Because Pannellum splits equirectangular textures horizontally across 2 textures (width/2 x height),
 * MAX_TEXTURE_SIZE >= 4096 supports 8192x4096 (8K Zoom 4), and >= 2048 supports 4096x2048 (4K Zoom 3).
 */
export function getMaxSupportedEquirectangularWidth() {
  if (cachedMaxEquirectWidth !== null) {
    return cachedMaxEquirectWidth;
  }
  try {
    const probeCanvas = document.createElement('canvas');
    const gl =
      probeCanvas.getContext('webgl') || probeCanvas.getContext('experimental-webgl');
    if (!gl) {
      cachedMaxEquirectWidth = 4096;
      return cachedMaxEquirectWidth;
    }
    const maxTexSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096;
    const loseExt = gl.getExtension('WEBGL_lose_context');
    if (loseExt) loseExt.loseContext();
    cachedMaxEquirectWidth = Math.min(8192, maxTexSize * 2);
    return cachedMaxEquirectWidth;
  } catch (_) {
    cachedMaxEquirectWidth = 4096;
    return cachedMaxEquirectWidth;
  }
}

/**
 * Enables WebGL Anisotropic Filtering on Pannellum's active 2D textures so angled road markings
 * and street signs remain crisp across the sphere.
 */
function applyAnisotropicFiltering() {
  try {
    const container = dom.panoViewerEl || document.getElementById('pano-viewer');
    const glCanvas = container ? container.querySelector('canvas') : null;
    if (!glCanvas) return;
    const gl =
      glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
    if (!gl) return;

    const ext =
      gl.getExtension('EXT_texture_filter_anisotropic') ||
      gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
      gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    if (!ext) return;

    const maxAnisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 4;
    const targetAnisotropy = Math.min(16, maxAnisotropy);

    // Apply to both TEXTURE0 and TEXTURE1 (used when Pannellum splits 8K textures)
    [gl.TEXTURE0, gl.TEXTURE1].forEach((unit) => {
      gl.activeTexture(unit);
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, targetAnisotropy);
    });
    gl.activeTexture(gl.TEXTURE0);
  } catch (_) {
    // Ignore if WebGL extension is unavailable
  }
}

function updateProviderQualityBadge(providerName, qualityLabel, isEnhancing = false) {
  if (!dom.providerBadge) return;
  const safeProvider = escapeHtml(providerName || 'Google Street View 360°');
  const safeQuality = escapeHtml(qualityLabel);
  const pulseDot = isEnhancing
    ? ' <span style="opacity:0.8;font-weight:500;">• Enhancing...</span>'
    : '';
  dom.providerBadge.innerHTML = `<span>🌐 ${safeProvider} • <strong>${safeQuality}</strong>${pulseDot}</span>`;
}

/**
 * Destroy existing Pannellum viewer instance and cancel any in-flight background HD/8K upgrades
 */
export function destroyStreetView() {
  activeRenderToken += 1;
  if (activeUpgradeAbortController) {
    try {
      activeUpgradeAbortController.abort();
    } catch (_) {
      // Ignore abort errors
    }
    activeUpgradeAbortController = null;
  }
  stopCompassLoop();
  if (panoViewer) {
    try {
      panoViewer.destroy();
    } catch (_) {
      // Ignore cleanup errors
    }
    panoViewer = null;
  }
  revokeActiveBlobUrls();
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
 * Decode a base64 JPEG tile string and draw it at (x * 512, y * 512) on ctx.
 * Uses off-main-thread createImageBitmap when available for smooth frame rates during background upgrades.
 */
async function drawBase64TileToContext(ctx, base64Data, x, y) {
  const dataUrl = `data:image/jpeg;base64,${base64Data}`;
  if (typeof window.createImageBitmap === 'function') {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      ctx.drawImage(bitmap, x * 512, y * 512);
      bitmap.close();
      return;
    } catch (_) {
      // Fall back to HTMLImageElement below
    }
  }

  await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, x * 512, y * 512);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = dataUrl;
  });
}

/**
 * Stitches Google Street View 512x512 tiles into an HTMLCanvasElement at the requested zoom level.
 * Uses /api/streetview/tiles-batch first (bypassing browser 6-connection queuing) with fallback
 * to individual /api/streetview/tile requests.
 */
export async function stitchGoogleStreetViewCanvas(
  panoId,
  worldWidth,
  worldHeight,
  zoom = 2,
  signal = null
) {
  const canvas = document.createElement('canvas');
  const defaultWidth = 512 * (1 << zoom);
  const defaultHeight = 512 * Math.max(1, 1 << (zoom - 1));
  canvas.width = worldWidth || defaultWidth;
  canvas.height = worldHeight || defaultHeight;

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const cols = Math.ceil(canvas.width / 512);
  const rows = Math.ceil(canvas.height / 512);

  // Use server-side concurrent batch endpoint in row chunks of up to 4 rows (max 64 tiles per chunk)
  const chunkRows = 4;
  const rowBatchPromises = [];
  for (let startRow = 0; startRow < rows; startRow += chunkRows) {
    const endRow = Math.min(rows - 1, startRow + chunkRows - 1);
    const batchUrl = `/api/streetview/tiles-batch?panoid=${encodeURIComponent(
      panoId
    )}&zoom=${zoom}&cols=${cols}&rows=${rows}&startRow=${startRow}&endRow=${endRow}`;

    const p = (async () => {
      const response = await fetch(batchUrl, signal ? { signal } : undefined);
      if (!response.ok) {
        throw new Error(`Batch tile HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload?.tiles) || payload.tiles.length === 0) {
        throw new Error('Empty tile batch');
      }
      await Promise.all(
        payload.tiles.map((t) => {
          if (signal?.aborted) return Promise.resolve();
          return drawBase64TileToContext(ctx, t.data, t.x, t.y);
        })
      );
    })();
    rowBatchPromises.push(p);
  }

  try {
    await Promise.all(rowBatchPromises);
    if (signal?.aborted) {
      canvas.width = 0;
      canvas.height = 0;
      throw new DOMException('Aborted', 'AbortError');
    }
    return canvas;
  } catch (batchErr) {
    if (signal?.aborted || batchErr?.name === 'AbortError') {
      canvas.width = 0;
      canvas.height = 0;
      throw batchErr;
    }

    // Fallback: fetch individual tiles via /api/streetview/tile
    const tilePromises = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const p = new Promise((resolve) => {
          if (signal?.aborted) return resolve();
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            if (!signal?.aborted) {
              ctx.drawImage(img, x * 512, y * 512);
            }
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `/api/streetview/tile?panoid=${encodeURIComponent(
            panoId
          )}&x=${x}&y=${y}&zoom=${zoom}`;
        });
        tilePromises.push(p);
      }
    }
    await Promise.all(tilePromises);
    return canvas;
  }
}

/**
 * Converts a stitched panorama canvas into a high-quality Blob URL (0.98 JPEG quality)
 * with Data URL fallback.
 */
async function canvasToHighQualityUrl(canvas, quality = 0.98) {
  if (typeof canvas.toBlob === 'function') {
    const blobUrl = await new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            activeBlobUrls.push(url);
            resolve(url);
          } else {
            resolve(null);
          }
        },
        'image/jpeg',
        quality
      );
    });
    if (blobUrl) return blobUrl;
  }
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Stitches Google Street View 512x512 tiles from /api/streetview/tile
 * into a seamless 2:1 equirectangular 360° panorama URL.
 */
export async function stitchGoogleStreetViewPanorama(panoId, worldWidth, worldHeight, zoom = 2) {
  const canvas = await stitchGoogleStreetViewCanvas(panoId, worldWidth, worldHeight, zoom);
  const url = await canvasToHighQualityUrl(canvas, 0.98);
  canvas.width = 0;
  canvas.height = 0;
  return url;
}

/**
 * Hot-swaps a higher-resolution HTMLCanvasElement or HTMLImageElement directly into Pannellum's
 * WebGL renderer without recreating the viewer DOM, resetting camera yaw/pitch/hfov, or re-compressing to JPEG.
 */
function upgradePanoramaTextureInPlace(sourceCanvasOrImage) {
  if (!panoViewer || typeof panoViewer.getRenderer !== 'function') return false;
  try {
    const renderer = panoViewer.getRenderer();
    if (!renderer || typeof renderer.init !== 'function') return false;

    renderer.init(
      sourceCanvasOrImage,
      'equirectangular',
      false,
      Math.PI * 2,
      Math.PI,
      0,
      () => {
        applyAnisotropicFiltering();
        if (panoViewer && typeof panoViewer.setUpdate === 'function') {
          panoViewer.setUpdate(true);
        }
      },
      {}
    );
    return true;
  } catch (err) {
    console.warn('In-place WebGL texture upgrade failed:', err);
    return false;
  }
}

/**
 * Background progressive pipeline: upgrades an active Google Street View panorama
 * from initial SD (Zoom 2: 2048x1024) -> 4K HD (Zoom 3: 4096x2048) -> 8K Ultra HD (Zoom 4: 8192x4096).
 */
async function upgradeGooglePanoramaProgressively(img, renderToken, signal) {
  const providerName = img.provider || 'Google Street View 360°';
  const maxSupportedWidth = getMaxSupportedEquirectangularWidth();
  const maxZoom = Number(img.maxZoom) || 4;

  const z3Width = Number(img.hdWorldWidth || img.zoomLevels?.[3]?.width || 4096);
  const z3Height = Number(img.hdWorldHeight || img.zoomLevels?.[3]?.height || 2048);
  const z4Width = Number(img.ultraWorldWidth || img.zoomLevels?.[4]?.width || 8192);
  const z4Height = Number(img.ultraWorldHeight || img.zoomLevels?.[4]?.height || 4096);

  const canLoad4K = maxZoom >= 3 && maxSupportedWidth >= z3Width;
  const canLoad8K = maxZoom >= 4 && maxSupportedWidth >= z4Width;

  if (!canLoad4K) {
    updateProviderQualityBadge(providerName, '2K SD', false);
    return;
  }

  // Stage 2: Stitch and hot-swap 4K HD (Zoom 3 — 4096x2048, 32 tiles)
  try {
    updateProviderQualityBadge(providerName, '2K SD', true);
    const z3Canvas = await stitchGoogleStreetViewCanvas(
      img.panoId,
      z3Width,
      z3Height,
      3,
      signal
    );
    if (signal.aborted || renderToken !== activeRenderToken || !panoViewer) {
      z3Canvas.width = 0;
      z3Canvas.height = 0;
      return;
    }

    const upgraded4K = upgradePanoramaTextureInPlace(z3Canvas);
    z3Canvas.width = 0;
    z3Canvas.height = 0;

    if (upgraded4K) {
      updateProviderQualityBadge(providerName, '4K HD', canLoad8K);
    }
  } catch (err) {
    if (signal.aborted || err?.name === 'AbortError') return;
    console.warn('Background 4K panorama upgrade skipped:', err);
    return;
  }

  // Stage 3: Stitch and hot-swap 8K Ultra HD (Zoom 4 — 8192x4096, 128 tiles) if GPU supports it
  if (!canLoad8K || signal.aborted || renderToken !== activeRenderToken) {
    return;
  }

  try {
    const z4Canvas = await stitchGoogleStreetViewCanvas(
      img.panoId,
      z4Width,
      z4Height,
      4,
      signal
    );
    if (signal.aborted || renderToken !== activeRenderToken || !panoViewer) {
      z4Canvas.width = 0;
      z4Canvas.height = 0;
      return;
    }

    const upgraded8K = upgradePanoramaTextureInPlace(z4Canvas);
    z4Canvas.width = 0;
    z4Canvas.height = 0;

    if (upgraded8K) {
      updateProviderQualityBadge(providerName, '8K Ultra HD', false);
    } else {
      updateProviderQualityBadge(providerName, '4K HD', false);
    }
  } catch (err) {
    if (signal.aborted || err?.name === 'AbortError') return;
    updateProviderQualityBadge(providerName, '4K HD', false);
  }
}

/**
 * Initializes Pannellum with real 360° equirectangular imagery and progressive 4K/8K enhancement
 */
export async function renderReal360StreetView(locationData, onRetry, retryAttempt = 0) {
  destroyStreetView();

  const currentToken = activeRenderToken;
  const abortController = new AbortController();
  activeUpgradeAbortController = abortController;

  const img = locationData.imagery || {};
  if (img.is360 !== true || (!img.panoId && !img.imageUrl)) {
    if (retryAttempt < 6 && typeof onRetry === 'function') {
      return onRetry(retryAttempt + 1);
    }
    return;
  }

  const providerName = img.provider || 'Google Street View 360°';
  updateProviderQualityBadge(providerName, img.panoId ? '2K Preview' : 'HD 360°', Boolean(img.panoId));

  if (dom.streetviewStatusText) {
    dom.streetviewStatusText.textContent =
      'Real 360° StreetView • Drag anywhere to look around 360° • Scroll to zoom deeply • Position is fixed';
  }

  let panoramaUrl = img.imageUrl || null;

  // Stage 1: Fast initial Zoom 2 (2048x1024, 8 tiles) stitch so the round opens in ~300ms
  if (img.panoId) {
    dom.loadingSubtitle.textContent = `Stitching real 360° StreetView panorama in ${escapeHtml(locationData.municipality)}...`;
    try {
      const initialCanvas = await stitchGoogleStreetViewCanvas(
        img.panoId,
        img.worldWidth || 2048,
        img.worldHeight || 1024,
        img.tileZoom || 2,
        abortController.signal
      );
      if (currentToken !== activeRenderToken) {
        initialCanvas.width = 0;
        initialCanvas.height = 0;
        return;
      }
      panoramaUrl = await canvasToHighQualityUrl(initialCanvas, 0.98);
      initialCanvas.width = 0;
      initialCanvas.height = 0;
    } catch (stitchErr) {
      if (abortController.signal.aborted || currentToken !== activeRenderToken) return;
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
    minHfov: 25,
    maxHfov: 120,
    showZoomCtrl: true,
    showFullscreenCtrl: true,
    compass: false,
    mouseZoom: true,
    keyboardZoom: true,
    friction: 0.18
  });

  let initialLoadHandled = false;
  panoViewer.on('load', () => {
    if (currentToken !== activeRenderToken) return;
    dom.streetviewLoading.classList.add('hidden');
    applyAnisotropicFiltering();

    if (!initialLoadHandled) {
      initialLoadHandled = true;
      if (img.panoId) {
        upgradeGooglePanoramaProgressively(img, currentToken, abortController.signal);
      } else if (img.hdUrl && img.hdUrl !== img.imageUrl) {
        // Progressive HD upgrade for Panoramax fallback imagery
        const hdImg = new Image();
        hdImg.crossOrigin = 'anonymous';
        hdImg.onload = () => {
          if (currentToken === activeRenderToken && panoViewer) {
            upgradePanoramaTextureInPlace(hdImg);
            updateProviderQualityBadge(providerName, 'HD 360°', false);
          }
        };
        hdImg.src = img.hdUrl;
      }
    }
  });

  panoViewer.on('error', () => {
    if (currentToken !== activeRenderToken) return;
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


