/**
 * Ortenau Guesser - Guess Evaluation Routes
 * Evaluates player guesses against actual streetview locations in Ortenaukreis.
 */

const express = require('express');
const { getRoundById } = require('../services/roundService');
const { calculateDistanceAndScore } = require('../services/scoringService');
const { ORTENAU_LOCATIONS } = require('../data/ortenauSeeds');

const router = express.Router();

/**
 * POST /api/guess
 * Evaluates a player's map guess against the actual Ortenau streetview location.
 * Supports multiple payload shapes:
 *   1) { roundId, guess: { lat, lng }, actual: { lat, lng } }
 *   2) { actualLat, actualLng, guessLat, guessLng, roundId }
 *   3) { roundId, lat, lng } (resolves actual location via roundId)
 */
router.post('/', (req, res) => {
  try {
    const body = req.body || {};
    const roundId = body.roundId || body.actual?.roundId || null;
    const storedRound = getRoundById(roundId);

    const guessLat = parseFloat(
      body.guess?.lat ?? body.guessLat ?? body.lat
    );
    const guessLng = parseFloat(
      body.guess?.lng ?? body.guess?.lon ?? body.guessLng ?? body.guessLon ?? body.lng ?? body.lon
    );

    const actualLat = parseFloat(
      body.actual?.lat ?? body.actualLat ?? storedRound?.lat
    );
    const actualLng = parseFloat(
      body.actual?.lng ?? body.actual?.lon ?? body.actualLng ?? body.actualLon ?? storedRound?.lng
    );

    if (
      Number.isNaN(guessLat) ||
      Number.isNaN(guessLng) ||
      Number.isNaN(actualLat) ||
      Number.isNaN(actualLng)
    ) {
      return res.status(400).json({
        error: 'Invalid coordinates. Provide guess and actual coordinates (or a valid roundId).'
      });
    }

    const result = calculateDistanceAndScore(actualLat, actualLng, guessLat, guessLng);

    // Match closest curated location metadata if roundId wasn't found
    const matchedLocation =
      storedRound ||
      ORTENAU_LOCATIONS.find(
        (loc) => Math.abs(loc.lat - actualLat) < 0.0005 && Math.abs(loc.lng - actualLng) < 0.0005
      ) ||
      null;

    res.json({
      roundId,
      ...result,
      actual: {
        lat: actualLat,
        lng: actualLng,
        id: matchedLocation?.id || body.actual?.id || null,
        name: matchedLocation?.name || body.actual?.name || 'Ortenaukreis Street Location',
        municipality: matchedLocation?.municipality || body.actual?.municipality || 'Ortenaukreis',
        district: 'Ortenaukreis',
        description: matchedLocation?.description || body.actual?.description || null,
        landmarks: matchedLocation?.landmarks || []
      },
      guess: {
        lat: guessLat,
        lng: guessLng,
        inOrtenau: result.guessInOrtenau
      }
    });
  } catch (err) {
    console.error('[OrtenauGuesser] Error in POST /api/guess:', err);
    res.status(500).json({
      error: 'Failed to evaluate guess',
      message: err.message
    });
  }
});

module.exports = router;

