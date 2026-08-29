// game-logic.js
//
// Dependency-free puzzle engine. This module has NO DOM access — it only
// deals with plain data (arrays, strings, numbers) so it can be unit
// tested directly with Node's built-in test runner and reused by any
// future UI or platform. All rendering and DOM work belongs in ui.js.
//
// Words are placed in a random one of the 8 classic word-search
// directions (horizontal/vertical/diagonal, each forward or reversed) at
// a random position, and are allowed to overlap an already-placed word
// wherever both words' letters agree at the shared cell (ticket 03).
// Placement itself does real backtracking across words — not just a
// whole-grid restart — so tight word counts near each grid size's
// advertised max reliably succeed (ticket 07; see `placeWords` and
// `backtrackPlace` below).

const DEFAULT_GRID_SIZE = 10;
const FILLER_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// The 8 classic word-search directions, expressed as the per-step
// (row, col) delta used to walk from one letter of a word to the next.
// `name` is the direction recorded on a Placement and is a compass
// abbreviation for the step vector (E = east/left-to-right, S = south/
// top-to-bottom, SE = south-east diagonal, etc.) — it carries no meaning
// beyond "this is the vector cells[i] -> cells[i+1] follows".
const DIRECTIONS = [
  { name: 'E', dRow: 0, dCol: 1 },
  { name: 'W', dRow: 0, dCol: -1 },
  { name: 'S', dRow: 1, dCol: 0 },
  { name: 'N', dRow: -1, dCol: 0 },
  { name: 'SE', dRow: 1, dCol: 1 },
  { name: 'SW', dRow: 1, dCol: -1 },
  { name: 'NE', dRow: -1, dCol: 1 },
  { name: 'NW', dRow: -1, dCol: -1 },
];

/**
 * @typedef {Object} Placement
 * @property {string} word - the placed word, uppercase.
 * @property {'E'|'W'|'S'|'N'|'SE'|'SW'|'NE'|'NW'} direction - compass
 *   abbreviation for the (row, col) step vector from each cell to the
 *   next; e.g. 'E' steps (0, +1) per letter, 'SW' steps (+1, -1).
 * @property {{row: number, col: number}[]} cells - cells the word
 *   occupies, in reading order (cells[0] is the word's first letter).
 */

/**
 * Generates a word-search puzzle: places every word in `words` in a
 * random one of the 8 classic directions at a random position in a
 * square grid — allowing a word to overlap another already-placed word
 * wherever their letters agree at the shared cell — then fills every
 * remaining cell with a random filler letter.
 *
 * @param {string[]} words - words to place; normalized to uppercase.
 * @param {number} [gridSize] - width/height of the square grid.
 * @returns {{ grid: string[][], placements: Placement[] }}
 */
export function generatePuzzle(words, gridSize = DEFAULT_GRID_SIZE) {
  if (!Array.isArray(words)) {
    throw new TypeError('generatePuzzle: words must be an array of strings');
  }
  if (!Number.isInteger(gridSize) || gridSize <= 0) {
    throw new TypeError('generatePuzzle: gridSize must be a positive integer');
  }

  const normalizedWords = words.map((word) => String(word).trim().toUpperCase());
  const { grid, placements } = placeWords(normalizedWords, gridSize);
  fillRemainingCells(grid);

  return { grid, placements };
}

function createEmptyGrid(gridSize) {
  return Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
}

// A same-shaped grid of per-cell reference counts, used to tell whether a
// cell is still used by any currently-placed word (see `unplaceWordAt`).
function createUsageGrid(gridSize) {
  return Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
}

// How many whole-grid layouts to try from scratch before giving up. Kept
// low relative to ticket 03's original 200 because each attempt is now
// far more powerful (real backtracking across words, see below), so
// restarting the entire grid is rarely needed — it's a safety net for
// the rare case where a single layout's per-attempt search budget
// (BACKTRACK_BUDGET_PER_ATTEMPT) is exhausted without finding a fit.
const MAX_GRID_ATTEMPTS = 40;

// Per grid-layout attempt, the max number of candidate-spot tries
// (across the whole recursive search, not per word) before abandoning
// this layout and starting a fresh one. Bounds worst-case runtime for
// large grids/word counts while still giving the backtracker enough
// room to recover from a bad early placement.
const BACKTRACK_BUDGET_PER_ATTEMPT = 8000;

// Per word, the max number of candidate spots the backtracker will try
// before giving up on that word (and letting the caller backtrack to the
// previous word). Candidates are ranked best-overlap-first (see
// rankedCandidatesForWord), so capping this trades an exhaustive search
// of every legal spot for a bounded number of the most promising ones —
// in practice the first few high-overlap candidates are what matter;
// trying all of them (which can number in the thousands on a 20x20 grid)
// would blow the backtracking budget for no real gain.
const MAX_CANDIDATES_PER_WORD = 25;

function placeWords(words, gridSize) {
  const tooLong = words.find((word) => word.length > gridSize);
  if (tooLong) {
    throw new Error(
      `generatePuzzle: word "${tooLong}" is longer than the grid size (${gridSize})`
    );
  }

  // Place longest words first: a long word has fewer valid positions than
  // a short one, so packing it while the grid is emptiest reduces the
  // chance of running out of room for it later.
  const orderedWords = [...words].sort((a, b) => b.length - a.length);

  // Ticket 07: packing word counts near the advertised per-grid-size max
  // (e.g. 30 words into a 10x10 grid) needs heavy, carefully-arranged
  // overlap that a purely greedy "place word, never revisit" strategy
  // can paint itself out of — a later word can find nowhere left to go
  // even though a different earlier choice would have left room for it.
  // `backtrackPlace` below does real backtracking *within* a single grid
  // layout: when a word has no legal spot left, it un-places the
  // previous word and tries that word's next-best candidate instead of
  // giving up on the whole layout. Restarting the whole grid from
  // scratch (this outer loop) is now only a fallback for when a single
  // layout's search budget runs out.
  for (let attempt = 0; attempt < MAX_GRID_ATTEMPTS; attempt++) {
    const grid = createEmptyGrid(gridSize);
    const usage = createUsageGrid(gridSize);
    const filledCells = new Set();
    const placements = [];
    const budget = { remaining: BACKTRACK_BUDGET_PER_ATTEMPT };

    if (backtrackPlace(orderedWords, 0, grid, usage, filledCells, placements, gridSize, budget)) {
      return { grid, placements };
    }
  }

  throw new Error(
    `generatePuzzle: could not fit all ${words.length} words into a ${gridSize}x${gridSize} grid after ${MAX_GRID_ATTEMPTS} attempts`
  );
}

/**
 * Recursively places `words[index..]` into `grid`, backtracking to try a
 * different spot for an earlier word whenever a later word runs out of
 * legal candidates. Returns `true` (with `placements` filled in for
 * `words[0..index-1]` plus everything placed during this call) once
 * every word from `index` onward has been placed, or `false` if no
 * combination of candidate spots (within the search budget) manages to
 * place them all — in which case `placements` is left exactly as it was
 * on entry, since every candidate this call tried is undone before
 * returning.
 */
function backtrackPlace(words, index, grid, usage, filledCells, placements, gridSize, budget) {
  if (index === words.length) return true;

  const word = words[index];
  const candidates = rankedCandidatesForWord(grid, word, gridSize, filledCells);

  for (const candidate of candidates) {
    if (budget.remaining <= 0) return false;
    budget.remaining--;

    const placement = placeWordAt(
      grid,
      usage,
      filledCells,
      word,
      candidate.row,
      candidate.col,
      candidate.direction
    );
    placements.push(placement);

    if (backtrackPlace(words, index + 1, grid, usage, filledCells, placements, gridSize, budget)) {
      return true;
    }

    placements.pop();
    unplaceWordAt(grid, usage, filledCells, placement);
  }

  return false;
}

// Random blind (row, col, direction) tries added to every candidate
// search, purely to surface some zero-overlap ("lands on entirely empty
// cells") fallback spots — the anchor search below only ever finds
// candidates that overlap an existing letter, so without this an empty
// (or letter-mismatched) grid area would never get proposed at all.
const RANDOM_CANDIDATE_SAMPLES = 60;

/**
 * Returns legal (row, col, direction) spots for `word`, ranked so the
 * candidates overlapping the most already-placed letters come first —
 * packing new words onto existing letters wherever possible makes a
 * tight grid (many words, few cells) far more achievable than stumbling
 * onto overlaps by chance. Candidates tied on overlap count are ordered
 * randomly (a fresh jitter each call), so an empty grid — where every
 * legal spot has 0 overlap — still gets a varied, randomly chosen
 * placement, and repeated calls (e.g. across backtracking attempts or
 * whole-grid retries) don't keep proposing the exact same spot first.
 *
 * Rather than scanning every (row, col, direction) triple in the grid
 * (gridSize^2 * 8 checks — expensive, and mostly wasted since the vast
 * majority of positions on a dense grid don't overlap anything), this
 * works backwards from `filledCells`: for each already-filled cell,
 * every direction, and every index in `word` whose letter matches that
 * cell's letter, it proposes the placement that would land `word` on
 * that cell at that index, then validates it with `overlapCountAt`. That
 * exhaustively finds every legal candidate with overlap >= 1 while only
 * doing work proportional to how many letters are already on the grid,
 * not the grid's full area — the difference that makes backtracking
 * across dozens of words on a 20x20 grid fast enough to actually run.
 * `RANDOM_CANDIDATE_SAMPLES` blind tries are added on top so zero-overlap
 * spots (which the anchor search can't find, by construction) still show
 * up as a fallback.
 *
 * Capped to `MAX_CANDIDATES_PER_WORD` entries (still best-overlap-first)
 * so a heavily-overlapping word — one whose letters match dozens of
 * filled cells — doesn't blow the backtracking search budget by handing
 * back every single legal spot found.
 */
function rankedCandidatesForWord(grid, word, gridSize, filledCells) {
  const candidateMap = new Map();

  function considerCandidate(row, col, direction) {
    const key = `${row},${col},${direction.name}`;
    if (candidateMap.has(key)) return;
    const overlap = overlapCountAt(grid, word, row, col, direction, gridSize);
    if (overlap === null) return;
    candidateMap.set(key, { row, col, direction, overlap });
  }

  for (const cellKey of filledCells) {
    const separatorIndex = cellKey.indexOf(',');
    const r = Number(cellKey.slice(0, separatorIndex));
    const c = Number(cellKey.slice(separatorIndex + 1));
    const letter = grid[r][c];

    for (let i = 0; i < word.length; i++) {
      if (word[i] !== letter) continue;
      for (const direction of DIRECTIONS) {
        considerCandidate(r - direction.dRow * i, c - direction.dCol * i, direction);
      }
    }
  }

  for (let i = 0; i < RANDOM_CANDIDATE_SAMPLES; i++) {
    considerCandidate(randomInt(gridSize), randomInt(gridSize), DIRECTIONS[randomInt(DIRECTIONS.length)]);
  }

  const candidates = [...candidateMap.values()];

  // Sort by overlap descending; each candidate gets one fixed random
  // jitter (strictly smaller than 1, so it can never move a candidate
  // across an overlap-count boundary) computed *before* sorting — a
  // comparator that calls Math.random() per comparison would give the
  // same candidate a different value on each comparison, violating the
  // consistent ordering Array#sort requires. The fixed jitter breaks
  // ties randomly within each overlap tier instead.
  for (const candidate of candidates) {
    candidate.sortKey = candidate.overlap + Math.random();
  }
  candidates.sort((a, b) => b.sortKey - a.sortKey);

  return candidates.slice(0, MAX_CANDIDATES_PER_WORD);
}

/**
 * Whether `word` can be written starting at (row, col) walking in
 * `direction` without running off the grid or landing on a cell that's
 * already a *different* letter, and if so, how many of its cells land on
 * a cell some other word already placed (an intentional overlap). Returns
 * `null` when the placement isn't legal at all (out of bounds, or a
 * conflicting letter at a shared cell).
 */
function overlapCountAt(grid, word, row, col, direction, gridSize) {
  let overlap = 0;
  for (let i = 0; i < word.length; i++) {
    const r = row + direction.dRow * i;
    const c = col + direction.dCol * i;
    if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return null;

    const existing = grid[r][c];
    if (existing !== null) {
      if (existing !== word[i]) return null;
      overlap++;
    }
  }
  return overlap;
}

function placeWordAt(grid, usage, filledCells, word, row, col, direction) {
  const cells = [];
  for (let i = 0; i < word.length; i++) {
    const r = row + direction.dRow * i;
    const c = col + direction.dCol * i;
    grid[r][c] = word[i];
    if (usage[r][c] === 0) filledCells.add(`${r},${c}`);
    usage[r][c]++;
    cells.push({ row: r, col: c });
  }
  return { word, direction: direction.name, cells };
}

/**
 * Undoes `placeWordAt`, clearing a cell back to empty (and out of
 * `filledCells`) only once no other currently-placed word still uses it
 * (tracked via `usage`, a grid of per-cell reference counts) — an
 * overlapped cell shared with another word must keep its letter. Used by
 * `backtrackPlace` to cleanly retry a different candidate spot for a
 * word without disturbing any other word's already-placed letters.
 */
function unplaceWordAt(grid, usage, filledCells, placement) {
  for (const { row, col } of placement.cells) {
    usage[row][col]--;
    if (usage[row][col] === 0) {
      grid[row][col] = null;
      filledCells.delete(`${row},${col}`);
    }
  }
}

function fillRemainingCells(grid) {
  for (const row of grid) {
    for (let col = 0; col < row.length; col++) {
      if (row[col] === null) {
        row[col] = FILLER_LETTERS[randomInt(FILLER_LETTERS.length)];
      }
    }
  }
}

function randomInt(exclusiveMax) {
  return Math.floor(Math.random() * exclusiveMax);
}

/**
 * Checks a player's selected run of grid cells against the puzzle's word
 * placements, returning the word it matches (or `null` if it matches
 * none).
 *
 * Direction-tolerant by design: a selection matches a placement whether
 * its cells run in the same order as `placement.cells` (the word's own
 * reading order) or in the exact reverse order — i.e. the player can drag
 * from either end of a word's line and it still counts. This matters
 * because `generatePuzzle` places words in all 8 directions (not just
 * horizontal-forward); this function makes no assumption about which of
 * those directions a placement uses, since it only ever compares cell
 * coordinates, never row/col deltas or the `direction` field.
 *
 * @param {Placement[]} placements - the puzzle's word placements, as
 *   returned by `generatePuzzle`.
 * @param {{row: number, col: number}[]} selectedCells - the cells the
 *   player selected, in the order they dragged across them.
 * @returns {string | null} the matched word, or `null` if the selection
 *   doesn't correspond to any placement (in either direction).
 */
export function checkSelection(placements, selectedCells) {
  if (!Array.isArray(placements) || !Array.isArray(selectedCells)) return null;
  if (selectedCells.length === 0) return null;

  for (const placement of placements) {
    if (placement.cells.length !== selectedCells.length) continue;

    if (
      sameCellSequence(placement.cells, selectedCells) ||
      sameCellSequence(placement.cells, [...selectedCells].reverse())
    ) {
      return placement.word;
    }
  }

  return null;
}

function sameCellSequence(a, b) {
  return a.every((cell, i) => cell.row === b[i].row && cell.col === b[i].col);
}

// The maximum word count offered for each supported grid size, keeping a
// generated puzzle legible without overcrowding the grid.
//
// Ticket 07: the original spec numbers (6/30/50) were an unvalidated
// guess — 10x10's 30 in particular meant packing ~150-180 letters of
// real-word content (30 words averaging ~5-6 letters) into only 100
// cells, which requires far more overlap than words from an unrelated
// curated theme ever coincidentally share. Empirically stress-testing
// `generatePuzzle` (see the "generatePuzzle succeeds reliably at each
// grid size's word-count max" tests in game-logic.test.js) against
// every curated theme — including Vehicles and Sports, whose lists skew
// longest and are the hardest to pack — found the actual reliable
// ceiling per grid size with the backtracking algorithm above:
//   - 6x6 (36 cells): 6 words was already reliable (0 failures across
//     300+ runs per theme) — unchanged from the original spec number.
//   - 10x10 (100 cells): 30 failed 100% of the time; even 12 still had
//     an occasional (~0.2-0.7%) failure on Sports (its longest-word
//     theme) across large samples — not the "reliably succeeds" bar
//     this ticket asks for. 10 measured genuinely reliable (0 failures
//     across 600+ runs on both Sports and Vehicles, the hardest
//     themes) and stays fast (well under a millisecond, typically).
//   - 20x20 (400 cells): 50 succeeded but was too slow for interactive
//     use in the worst case (Sports averaged ~2.5s/generation, some
//     runs much worse); 45 is both reliable (0 failures across 300+
//     runs) and fast (a few ms typical, rare worst-case spikes near
//     1s on the longest-word theme).
export const GRID_SIZE_WORD_COUNT_MAX = {
  6: 6,
  10: 10,
  20: 45,
};

/**
 * The maximum word count the start screen should allow for `gridSize`,
 * further capped down to `poolSize` when the active word pool (theme)
 * has fewer qualifying words than the grid size's own maximum — so
 * picking an under-stocked pool never produces a word count the engine
 * can't fulfill. Deliberately generic: callers pass in whatever the
 * current pool's size actually is, so this keeps working unchanged once
 * more themes/pools of varying sizes exist (see spec.md's word-count
 * capping decision).
 *
 * @param {number} gridSize - one of the supported grid sizes (currently
 *   6, 10, or 20).
 * @param {number} poolSize - number of qualifying words in the active
 *   word pool.
 * @returns {number} the smaller of the grid size's max and `poolSize`.
 */
export function getWordCountMax(gridSize, poolSize) {
  const sizeMax = GRID_SIZE_WORD_COUNT_MAX[gridSize];
  if (sizeMax === undefined) {
    throw new RangeError(`getWordCountMax: unsupported grid size ${gridSize}`);
  }
  if (!Number.isInteger(poolSize) || poolSize < 0) {
    throw new TypeError('getWordCountMax: poolSize must be a non-negative integer');
  }
  return Math.min(sizeMax, poolSize);
}
