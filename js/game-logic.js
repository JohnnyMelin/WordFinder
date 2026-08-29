// game-logic.js
//
// Dependency-free puzzle engine. This module has NO DOM access — it only
// deals with plain data (arrays, strings, numbers) so it can be unit
// tested directly with Node's built-in test runner and reused by any
// future UI or platform. All rendering and DOM work belongs in ui.js.
//
// Ticket 01 scope: words are placed horizontally, left-to-right only, at
// non-overlapping positions. Vertical/diagonal directions and overlap
// support are added in later tickets.

const DEFAULT_GRID_SIZE = 10;
const FILLER_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * @typedef {Object} Placement
 * @property {string} word - the placed word, uppercase.
 * @property {'horizontal'} direction - reading direction of the word.
 * @property {{row: number, col: number}[]} cells - cells the word
 *   occupies, in reading order (cells[0] is the word's first letter).
 */

/**
 * Generates a word-search puzzle: places every word in `words`
 * horizontally, left-to-right, at a non-overlapping position in a square
 * grid, then fills every remaining cell with a random filler letter.
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
  const { grid, placements } = placeWordsHorizontally(normalizedWords, gridSize);
  fillRemainingCells(grid);

  return { grid, placements };
}

function createEmptyGrid(gridSize) {
  return Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
}

const MAX_GRID_ATTEMPTS = 50;

function placeWordsHorizontally(words, gridSize) {
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
  // for grids with reasonable slack.
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
      placements.push(placeWordAt(grid, word, spot.row, spot.col));
    }

    if (allPlaced) {
      return { grid, placements };
    }
  }

  throw new Error(
    `generatePuzzle: could not fit all ${words.length} words into a ${gridSize}x${gridSize} grid after ${MAX_GRID_ATTEMPTS} attempts`
  );
}

function findSpotForWord(grid, word, gridSize) {
  const maxCol = gridSize - word.length;
  if (maxCol < 0) return null;

  // Try random positions first, for a varied-looking layout.
  const maxAttempts = 200;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const row = randomInt(gridSize);
    const col = randomInt(maxCol + 1);
    if (canPlaceAt(grid, word, row, col)) return { row, col };
  }

  // Deterministic fallback: scan every position in order. This guarantees
  // the word gets placed whenever a valid spot exists anywhere in the
  // grid, even if the random attempts above got unlucky.
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col <= maxCol; col++) {
      if (canPlaceAt(grid, word, row, col)) return { row, col };
    }
  }

  return null;
}

function canPlaceAt(grid, word, row, col) {
  for (let i = 0; i < word.length; i++) {
    if (grid[row][col + i] !== null) return false;
  }
  return true;
}

function placeWordAt(grid, word, row, col) {
  const cells = [];
  for (let i = 0; i < word.length; i++) {
    grid[row][col + i] = word[i];
    cells.push({ row, col: col + i });
  }
  return { word, direction: 'horizontal', cells };
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
 * because a future ticket (03) starts placing words in all 8 directions
 * (not just horizontal-forward); this function makes no assumption about
 * which of those directions a placement uses, since it only ever compares
 * cell coordinates, never row/col deltas or the `direction` field.
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
