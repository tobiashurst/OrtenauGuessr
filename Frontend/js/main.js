/**
 * Ortenau Guesser - Main Application Orchestrator (Frontend/js/main.js)
 * Bootstraps game flow, screen transitions, and user interaction event bindings.
 */

import { dom } from './dom.js';
import { state, resetGameState } from './state.js';
import { fetchRegionConfig, fetchRandomOrtenauLocation, submitGuessApi } from './api.js';
import {
  initMenuPreviewMap,
  invalidateMenuPreviewMap,
  initGuessMap,
  centerGuessMapOnOrtenau,
  refreshGuessMapSize,
  clearGuessMarker
} from './maps.js';
import {
  renderReal360StreetView,
  resetPanoramaHeading,
  destroyStreetView,
  stopCompassLoop
} from './streetview.js';
import {
  updateHudHeader,
  updateTimerHud,
  populateFieldObservations,
  displayRoundResult,
  showFinalSummaryModal
} from './ui.js';

/**
 * Initialize application when DOM is ready
 */
async function initApp() {
  bindEvents();
  await fetchRegionConfig();
  initMenuPreviewMap();
}

/**
 * Wire all interactive event listeners
 */
function bindEvents() {
  // Mode selection on Main Menu
  dom.modeStandardBtn.addEventListener('click', () => {
    state.totalRounds = 5;
    state.isTimedMode = false;
    dom.modeStandardBtn.classList.add('active');
    dom.modeTimedBtn.classList.remove('active');
    dom.modeFreeplayBtn.classList.remove('active');
    dom.timeLimitContainer.classList.add('hidden');
  });

  dom.modeTimedBtn.addEventListener('click', () => {
    state.totalRounds = 5;
    state.isTimedMode = true;
    dom.modeTimedBtn.classList.add('active');
    dom.modeStandardBtn.classList.remove('active');
    dom.modeFreeplayBtn.classList.remove('active');
    dom.timeLimitContainer.classList.remove('hidden');
  });

  dom.modeFreeplayBtn.addEventListener('click', () => {
    state.totalRounds = 0;
    state.isTimedMode = false;
    dom.modeFreeplayBtn.classList.add('active');
    dom.modeStandardBtn.classList.remove('active');
    dom.modeTimedBtn.classList.remove('active');
    dom.timeLimitContainer.classList.add('hidden');
  });

  // Time Limit Slider
  dom.timeLimitSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    dom.timeLimitDisplay.textContent = val;
    state.timeLimit = parseInt(val, 10);
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

  dom.minimapWrapper.addEventListener('mouseenter', refreshGuessMapSize);
  dom.minimapWrapper.addEventListener('mouseleave', refreshGuessMapSize);
  dom.minimapWrapper.addEventListener('transitionend', refreshGuessMapSize);

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

/**
 * Start a new game session
 */
async function startNewGame() {
  resetGameState();

  dom.mainMenuScreen.classList.remove('active');
  dom.gameScreen.classList.add('active');
  dom.resultModal.classList.add('hidden');
  dom.summaryModal.classList.add('hidden');

  initGuessMap();
  await loadRound();
}

/**
 * Exit game session and return to main menu
 */
function returnToMainMenu() {
  destroyStreetView();
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
  }
  dom.hudTimerBox.classList.remove('timer-low');
  dom.resultModal.classList.add('hidden');
  dom.summaryModal.classList.add('hidden');
  dom.gameScreen.classList.remove('active');
  dom.mainMenuScreen.classList.add('active');
  invalidateMenuPreviewMap();
}

/**
 * Load the next round's 360° location
 */
async function loadRound(retryAttempt = 0) {
  state.currentGuess = null;
  state.isSubmitting = false;

  if (state.timerInterval) {
    clearInterval(state.timerInterval);
  }
  state.timeRemaining = state.timeLimit;
  dom.hudTimerBox.classList.remove('timer-low');

  clearGuessMarker();

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

    // Strictly exclude any location without real 360° panorama
    const img = locationData.imagery;
    if (!img || img.is360 !== true || (!img.panoId && !img.imageUrl)) {
      if (retryAttempt < 6) {
        return loadRound(retryAttempt + 1);
      }
      throw new Error('No real 360° StreetView panorama available for this location.');
    }

    state.currentLocation = locationData;
    populateFieldObservations(locationData);
    await renderReal360StreetView(locationData, loadRound, retryAttempt);
    centerGuessMapOnOrtenau();

    // Start timer if in timed mode
    if (state.isTimedMode) {
      startTimer();
    }
  } catch (err) {
    console.error('Error loading round:', err);
    dom.loadingTitle.textContent = 'Connection issue loading Ortenau 360° location';
    dom.loadingSubtitle.textContent = err.message;
  }
}

/**
 * Start the countdown timer for the round
 */
function startTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
  }

  state.timeRemaining = state.timeLimit;
  updateTimerHud();

  state.timerInterval = setInterval(() => {
    if (state.isSubmitting) {
      clearInterval(state.timerInterval);
      return;
    }

    state.timeRemaining -= 1;
    updateTimerHud();

    if (state.timeRemaining <= 0) {
      clearInterval(state.timerInterval);

      // If user hasn't placed a pin, set current guess to a default far location or null
      if (!state.currentGuess) {
        // We set to 0,0 to give them 0 points if they didn't guess in time
        state.currentGuess = { lat: 0, lng: 0 };
      }

      submitCurrentGuess();
    }
  }, 1000);
}

/**
 * Submit current guess and reveal actual location
 */
async function submitCurrentGuess() {
  if (!state.currentGuess || !state.currentLocation || state.isSubmitting) return;

  state.isSubmitting = true;

  if (state.timerInterval) {
    clearInterval(state.timerInterval);
  }

  dom.submitGuessBtn.disabled = true;
  dom.submitGuessBtn.innerHTML = '<span>Calculating Distance...</span>';

  const actual = state.currentLocation;
  const guess = state.currentGuess;

  const resultData = await submitGuessApi(actual, guess);
  displayRoundResult(actual, guess, resultData);
}

/**
 * Handle Next Round button click
 */
function handleNextRoundClick() {
  dom.resultModal.classList.add('hidden');

  if (state.totalRounds > 0 && state.currentRound >= state.totalRounds) {
    showFinalSummaryModal();
  } else {
    state.currentRound += 1;
    loadRound();
  }
}

// Auto-boot application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

export {
  initApp,
  startNewGame,
  returnToMainMenu,
  loadRound,
  submitCurrentGuess,
  handleNextRoundClick
};

