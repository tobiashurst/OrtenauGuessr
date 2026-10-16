/**
 * Ortenau Guesser - Application State & Region Configuration (Frontend/js/state.js)
 */

export const DEFAULT_ORTENAU_REGION = {
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

export const state = {
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

export function resetGameState() {
  state.currentRound = 1;
  state.totalScore = 0;
  state.roundHistory = [];
  state.usedLocationIds = [];
  state.currentLocation = null;
  state.currentGuess = null;
  state.isSubmitting = false;
}

