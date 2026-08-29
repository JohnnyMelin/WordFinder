// game-logic.js
//
// Dependency-free puzzle engine. This module has NO DOM access — it only
// deals with plain data (arrays, strings, numbers) so it can be unit
// tested directly with Node's built-in test runner and reused by any
// future UI or platform. All rendering and DOM work belongs in ui.js.
//
// Ticket 03 scope: words are placed in a random one of the 8 classic
// word-search directions (horizontal/vertical/diagonal, each forward or
// reversed) at a random position, and are allowed to overlap an
// already-placed word wherever both words' letters agree at the shared
// cell.

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

const MAX_GRID_ATTEMPTS = 200;

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

  // Placing each word greedily (pick a spot, commit, move on) can paint
  // the grid into a corner where a later, shorter word has nowhere left
  // to go, even though a different arrangement would have fit everything.
  // Rather than backtrack mid-placement, retry the whole grid from
  // scratch with a fresh random layout — cheap, and reliable in practice
  // for grids with reasonable slack. Allowing overlaps, and preferring
  // the most-overlapping legal spot for each word (see findSpotForWord),
  // makes this even more reliable than in the horizontal-only ticket 01
  // version, since a word can now share cells with words already placed
  // instead of needing entirely empty ones.
  for (let attempt = 0; attempt < MAX_GRID_ATTEMPTS; attempt++) {
    const grid = createEmptyGrid(gridSize);
    const placements = [];
    let allPlaced = true;

    for (const word of orderedWords) {
      const spot = findSpotForWord(grid, word, gridSize);
      if (!spot) {
        allPlaced = false;
        break;
      }
      placements.push(placeWordAt(grid, word, spot.row, spot.col, spot.direction));
    }

    if (allPlaced) {
      return { grid, placements };
    }
  }

  throw new Error(
    `generatePuzzle: could not fit all ${words.length} words into a ${gridSize}x${gridSize} grid after ${MAX_GRID_ATTEMPTS} attempts`
  );
}

/**
 * Finds a direction + starting position to place `word` at, preferring
 * whichever legal spot overlaps the most already-placed letters.
 *
 * Scans every direction/position combination (via `overlapCountAt`) and
 * keeps only the spots tied for the highest overlap count seen, picking
 * uniformly at random among those ties — so an empty grid (where every
 * legal spot has 0 overlap) still gets a varied, randomly chosen
 * placement, exactly as before, but a partially-filled grid now packs
 * words onto existing letters wherever possible instead of only
 * stumbling onto overlaps by chance.
 *
 * This matters at the high end of the curated themes' word counts
 * (ticket 05): packing e.g. 30 words averaging ~7 letters into a 10x10
 * grid (100 cells) needs roughly 40-50% of those letters to land on
 * cells shared with other words — random-then-fallback placement (this
 * function's previous strategy) essentially never finds that much
 * overlap by chance, so `placeWords` exhausted all `MAX_GRID_ATTEMPTS`
 * restarts and threw. Always taking the best available overlap makes
 * that packing density achievable.
 */
function findSpotForWord(grid, word, gridSize) {
  let bestOverlap = -1;
  let candidates = [];

  for (const direction of DIRECTIONS) {
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const overlap = overlapCountAt(grid, word, row, col, direction, gridSize);
        if (overlap === null) continue;

        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          candidates = [{ row, col, direction }];
        } else if (overlap === bestOverlap) {
          candidates.push({ row, col, direction });
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  return candidates[randomInt(candidates.length)];
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

function placeWordAt(grid, word, row, col, direction) {
  const cells = [];
  for (let i = 0; i < word.length; i++) {
    const r = row + direction.dRow * i;
    const c = col + direction.dCol * i;
    grid[r][c] = word[i];
    cells.push({ row: r, col: c });
  }
  return { word, direction: direction.name, cells };
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

// Per spec: the maximum word count offered for each supported grid size,
// keeping a generated puzzle legible without overcrowding the grid.
export const GRID_SIZE_WORD_COUNT_MAX = {
  6: 6,
  10: 30,
  20: 50,
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
