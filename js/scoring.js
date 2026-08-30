// scoring.js
//
// Dependency-free scoring module (ticket 11). Like game-logic.js, this
// module has NO DOM access and NO localStorage access — it only deals
// with plain data (numbers, arrays, plain objects) so it can be unit
// tested directly with Node's built-in test runner. All display of the
// resulting score, and (in a later ticket) all persistence of scoreboard
// entries, belongs in ui.js.
//
// Two independent pieces of pure logic live here, per the spec's
// "Scoring" and "Scoreboard" sections:
//   - computeScore: turns a finished puzzle's stats into a number.
//   - rankEntries: pure top-9 sorted-insertion logic a later ticket
//     (12) will use to decide whether a score earns a scoreboard slot,
//     without this module knowing anything about where entries are
//     actually stored.

// Tuning constants for the score formula below. Both are freely
// adjustable during playtesting (per spec.md's Further Notes) — nothing
// else in the codebase depends on their exact values.
//
// K is chosen so a "typical" puzzle (10x10 grid, 10 words, finished in
// about a minute) lands on a round, legible score: gridSize^2 *
// wordCount * K / elapsedSeconds = 100 * 10 * 60 / 60 = 1000.
const K = 60;

// ELAPSED_SECONDS_FLOOR is the minimum elapsed time (in seconds) used in
// the score formula's denominator, so a freak near-instant finish (or a
// caller accidentally passing 0) can't divide by (near-)zero and produce
// an absurd or infinite score.
const ELAPSED_SECONDS_FLOOR = 1;

// A scoreboard is capped at this many entries per grid size (ticket 12).
const MAX_ENTRIES = 9;

/**
 * @typedef {Object} ScoreInput
 * @property {number} gridSize - the puzzle's grid width/height (grids are square).
 * @property {number} wordCount - how many words were hidden in the puzzle.
 * @property {number} elapsedSeconds - time taken to solve, in seconds.
 */

/**
 * Computes a numeric score for a finished puzzle: `gridSize^2 * wordCount
 * * K / max(elapsedSeconds, ELAPSED_SECONDS_FLOOR)`. Rewards a bigger
 * board or a longer word list with a higher score ceiling, and rewards a
 * faster finish with a higher score for a fixed board/word count.
 *
 * The elapsed-time floor means dropping below ELAPSED_SECONDS_FLOOR
 * seconds no longer increases the score — this is deliberate, since a
 * near-zero elapsed time (or a buggy caller passing 0) would otherwise
 * blow the formula up toward infinity.
 *
 * @param {ScoreInput} input
 * @returns {number} the computed score, rounded to the nearest whole number.
 */
export function computeScore({ gridSize, wordCount, elapsedSeconds }) {
  const flooredElapsed = Math.max(elapsedSeconds, ELAPSED_SECONDS_FLOOR);
  const rawScore = (gridSize * gridSize * wordCount * K) / flooredElapsed;
  return Math.round(rawScore);
}

/**
 * @typedef {Object} ScoreEntry
 * @property {string} [name] - the player's entered name (ticket 12 fills this in).
 * @property {number} score - the entry's score, as returned by computeScore.
 * @property {number} [wordCount] - how many words the puzzle had.
 * @property {string} [date] - when the entry was achieved (ticket 12 fills this in).
 */

/**
 * Pure top-9 ranking/insertion logic: given an existing sorted-by-score
 * scoreboard and a candidate new entry, decides whether the new entry
 * earns a place on the board and returns the updated board.
 *
 * `existingEntries` is never mutated. Only `score` is consulted for
 * ranking purposes — `name`/`wordCount`/`date` are carried through
 * untouched for whichever entry ends up in the result, but are not
 * required on the entries passed in (handy for tests that only care
 * about ranking).
 *
 * If `newEntry` doesn't qualify, `entries` is exactly `existingEntries`
 * (same contents, same order) — nothing is written or reordered.
 * If it does qualify, `entries` is every entry (existing + new) sorted
 * descending by `score` and capped to the top `MAX_ENTRIES` (9).
 *
 * A list with fewer than 9 existing entries always qualifies the new
 * entry, since there's a free slot regardless of score. At exactly 9
 * existing entries, the new entry must beat (strictly exceed) the
 * current lowest score to displace it; a tie keeps the existing entry
 * ranked ahead, consistent with natural sort order (no special
 * tie-breaking rules, per spec.md's Out of Scope).
 *
 * @param {ScoreEntry[]} existingEntries
 * @param {ScoreEntry} newEntry
 * @returns {{ entries: ScoreEntry[], qualified: boolean }}
 */
export function rankEntries(existingEntries, newEntry) {
  const combined = [...existingEntries, newEntry];
  const sorted = combined.slice().sort((a, b) => b.score - a.score);
  const capped = sorted.slice(0, MAX_ENTRIES);

  const qualified = capped.includes(newEntry);
  if (!qualified) {
    return { entries: existingEntries.slice(), qualified: false };
  }
  return { entries: capped, qualified: true };
}
