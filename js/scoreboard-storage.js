// scoreboard-storage.js
//
// Thin localStorage-backed persistence for the scoreboard (ticket 12).
// This module is DOM/localStorage-dependent (not pure) — unlike
// scoring.js and game-logic.js it is NOT unit tested, per the same
// UI-adjacent-infrastructure convention the rest of ui.js follows (see
// spec.md's Testing Decisions). All reads/writes to localStorage funnel
// through the two functions below so a future backend swap (or a change
// in storage key scheme) only touches this file's internals — nothing
// else in the codebase should call localStorage directly for scores.
//
// Each grid size (6, 10, 20) gets its own independent list, stored under
// its own key. Entries are plain objects matching scoring.js's
// ScoreEntry shape: { name, score, wordCount, date }.

const STORAGE_KEY_PREFIX = 'wordFinder.scores.';

function storageKeyFor(gridSize) {
  return `${STORAGE_KEY_PREFIX}${gridSize}`;
}

/**
 * Loads the saved scoreboard entries for a given grid size, or an empty
 * array if none have been saved yet (or the stored value is missing,
 * unreadable, or malformed). Never throws.
 *
 * @param {number} gridSize
 * @returns {import('./scoring.js').ScoreEntry[]}
 */
export function loadScores(gridSize) {
  try {
    const raw = localStorage.getItem(storageKeyFor(gridSize));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // localStorage may be unavailable (private browsing, disabled
    // storage) or hold corrupted JSON — either way, fail soft to an
    // empty scoreboard rather than throwing during gameplay.
    return [];
  }
}

/**
 * Persists the full list of scoreboard entries for a given grid size,
 * overwriting whatever was previously saved. Callers are expected to
 * pass the already-ranked/capped list (see scoring.js's rankEntries) —
 * this function does no ranking or capping of its own.
 *
 * @param {number} gridSize
 * @param {import('./scoring.js').ScoreEntry[]} entries
 */
export function saveScores(gridSize, entries) {
  try {
    localStorage.setItem(storageKeyFor(gridSize), JSON.stringify(entries));
  } catch {
    // Quota exceeded, storage disabled, etc. — losing a scoreboard save
    // shouldn't crash the game, so fail silently.
  }
}
