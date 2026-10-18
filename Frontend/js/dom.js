/**
 * Ortenau Guesser - DOM Elements Cache (Frontend/js/dom.js)
 * Centralized references to all interactive and display DOM elements.
 */

export const dom = {
  mainMenuScreen: document.getElementById('main-menu'),
  gameScreen: document.getElementById('game-screen'),
  apiStatusBadge: document.getElementById('api-status-badge'),

  modeStandardBtn: document.getElementById('mode-standard-btn'),
  modeTimedBtn: document.getElementById('mode-timed-btn'),
  modeFreeplayBtn: document.getElementById('mode-freeplay-btn'),
  timeLimitContainer: document.getElementById('time-limit-container'),
  timeLimitSlider: document.getElementById('time-limit-slider'),
  timeLimitDisplay: document.getElementById('time-limit-display'),
  startGameBtn: document.getElementById('start-game-btn'),
  howToPlayBtn: document.getElementById('how-to-play-btn'),

  backToMenuBtn: document.getElementById('back-to-menu-btn'),
  hudTimerBox: document.getElementById('hud-timer-box'),
  hudTimer: document.getElementById('hud-timer'),
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

