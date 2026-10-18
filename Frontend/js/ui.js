/**
 * Ortenau Guesser - UI Rendering Manager (Frontend/js/ui.js)
 * Manages HUD text, Field Observations drawer, Round Result modal, and Final Summary table.
 */

import { dom } from './dom.js';
import { state } from './state.js';
import { renderResultComparisonMap } from './maps.js';

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Update HUD round counter and running score
 */
export function updateHudHeader() {
  if (state.totalRounds > 0) {
    dom.hudRound.textContent = `${state.currentRound} / ${state.totalRounds}`;
  } else {
    dom.hudRound.textContent = `Round ${state.currentRound} (Free)`;
  }
  dom.hudScore.textContent = state.totalScore.toLocaleString();

  if (state.isTimedMode) {
    dom.hudTimerBox.classList.remove('hidden');
    dom.hudTimer.textContent = `${state.timeRemaining}s`;
  } else {
    dom.hudTimerBox.classList.add('hidden');
  }
}

/**
 * Populate Field Observations drawer from OSM context without coordinate spoilers
 */
export function populateFieldObservations(loc) {
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
  const roadNames = (loc.roads || [])
    .map((r) => (typeof r === 'string' ? r : r.name))
    .filter(Boolean);
  const uniqueRoads = [...new Set(roadNames)].slice(0, 3);
  const surfaces = (loc.roads || [])
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
      <strong>${escapeHtml(primarySurface)} (${(loc.roads || []).length} road segments)</strong>
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

/**
 * Display round result modal with distance, points, score bar, and result map
 */
export function displayRoundResult(actual, guess, res) {
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

/**
 * Display final summary modal after 5 rounds
 */
export function showFinalSummaryModal() {
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

