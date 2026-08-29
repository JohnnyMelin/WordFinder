// ui.js
//
// UI layer: DOM rendering and interaction only. Imports the
// dependency-free engine (game-logic.js) and renders whatever it
// returns, then wires up Pointer Events so the player can select words
// by click-drag (mouse) or touch-drag (touch) — a single shared code
// path for both input types. No puzzle-generation or match-checking
// logic lives here; this module is verified by loading the page in a
// browser, not by unit tests (see spec.md's Testing Decisions).
//
// Two screens: a start screen (grid size + theme + word count,
// delegated to start-screen.js) and this puzzle screen. Starting a
// puzzle swaps from one to the other; "New Puzzle" swaps back so the
// player can reconfigure and start again without a page reload.
//
// Word source: the six curated theme lists in data/themes.js (ticket
// 05). This is the only module that knows the pool's shape (a
// theme-name -> word-list map); start-screen.js stays generic by taking
// the theme names and a getPoolSize(gridSize, theme) callback as
// options instead of importing theme data itself.

import { generatePuzzle, checkSelection } from './game-logic.js';
import { THEMES } from './data/themes.js';
import { initStartScreen } from './start-screen.js';

const THEME_NAMES = Object.keys(THEMES);

/**
 * Renders the letter grid and returns a 2D array of the cell elements,
 * indexed [row][col], so later code can look up a cell's DOM node by
 * coordinate without re-querying the DOM.
 */
function renderGrid(grid, container) {
  container.replaceChildren();
  container.style.setProperty('--grid-size', String(grid.length));

  const cellElements = [];
  for (let row = 0; row < grid.length; row++) {
    const rowElements = [];
    for (let col = 0; col < grid[row].length; col++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.textContent = grid[row][col];
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      container.appendChild(cell);
      rowElements.push(cell);
    }
    cellElements.push(rowElements);
  }
  return cellElements;
}

/**
 * Renders the word list and returns a Map of word -> its <li> element, so
 * later code can mark a specific word "found" without re-querying the DOM.
 */
function renderWordList(placements, container) {
  container.replaceChildren();

  const itemsByWord = new Map();
  for (const { word } of placements) {
    const item = document.createElement('li');
    item.className = 'word-list-item';
    item.textContent = word;
    container.appendChild(item);
    itemsByWord.set(word, item);
  }
  return itemsByWord;
}

/**
 * Snaps a drag from `start` to `end` (grid coordinates) onto the nearest
 * of the 8 straight-line directions (horizontal, vertical, or diagonal)
 * and returns every cell along that line from `start` to `end`,
 * inclusive, in drag order. This is how a messy real-world drag path
 * gets turned into the clean straight-line run `checkSelection` expects.
 */
function cellsAlongLine(start, end) {
  const deltaRow = end.row - start.row;
  const deltaCol = end.col - start.col;

  if (deltaRow === 0 && deltaCol === 0) {
    return [{ row: start.row, col: start.col }];
  }

  const angle = Math.atan2(deltaRow, deltaCol);
  const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  const stepRow = Math.round(Math.sin(snappedAngle));
  const stepCol = Math.round(Math.cos(snappedAngle));
  const distance = Math.max(Math.abs(deltaRow), Math.abs(deltaCol));

  const cells = [];
  for (let i = 0; i <= distance; i++) {
    cells.push({ row: start.row + stepRow * i, col: start.col + stepCol * i });
  }
  return cells;
}

/**
 * Wires up selection: pointerdown/pointermove/pointerup on the grid
 * container drive one shared code path for both mouse drag and touch
 * drag (Pointer Events unify the two). On release, the selected run of
 * cells is checked against the puzzle's placements; a match highlights
 * the cells and marks the word found, and finding every word shows the
 * win banner.
 *
 * `signal` is an AbortSignal that removes all of these listeners when
 * aborted. The grid container element is reused across puzzles (only
 * its children are replaced by `renderGrid`), so without this a second
 * call to `setupSelection` for a new puzzle would stack a second set of
 * listeners on top of the first, double-handling every pointer event.
 */
function setupSelection({ container, cellElements, placements, itemsByWord, winBanner, signal }) {
  const gridSize = cellElements.length;
  const foundWords = new Set();

  let isSelecting = false;
  let startCell = null;
  let previewCells = [];

  function cellElementAt(row, col) {
    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return null;
    return cellElements[row][col];
  }

  function clearPreview() {
    for (const cell of previewCells) {
      const el = cellElementAt(cell.row, cell.col);
      if (el) el.classList.remove('selecting');
    }
    previewCells = [];
  }

  function setPreview(cells) {
    clearPreview();
    for (const cell of cells) {
      const el = cellElementAt(cell.row, cell.col);
      if (el) el.classList.add('selecting');
    }
    previewCells = cells;
  }

  /** Hit-tests the pointer's current screen position against the grid,
   * ignoring pointer capture (which redirects `event.target` but not
   * where the pointer actually is). Returns the cell's grid coordinates,
   * or null if the pointer isn't currently over a grid cell. */
  function cellFromPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const cellEl = el.closest('.grid-cell');
    if (!cellEl || !container.contains(cellEl)) return null;
    return { row: Number(cellEl.dataset.row), col: Number(cellEl.dataset.col) };
  }

  function markWordFound(word, cells) {
    foundWords.add(word);

    for (const cell of cells) {
      const el = cellElementAt(cell.row, cell.col);
      if (el) el.classList.add('found');
    }

    const item = itemsByWord.get(word);
    if (item) item.classList.add('found');

    if (winBanner && foundWords.size === placements.length) {
      winBanner.hidden = false;
    }
  }

  function finishSelection() {
    const selectedCells = previewCells;
    clearPreview();
    isSelecting = false;
    startCell = null;

    const matchedWord = checkSelection(placements, selectedCells);
    if (matchedWord && !foundWords.has(matchedWord)) {
      markWordFound(matchedWord, selectedCells);
    }
  }

  function releaseCapture(pointerId) {
    try {
      container.releasePointerCapture(pointerId);
    } catch {
      // Capture may already have been released by the browser; safe to ignore.
    }
  }

  function handlePointerDown(event) {
    const cellEl = event.target.closest && event.target.closest('.grid-cell');
    if (!cellEl || !container.contains(cellEl)) return;

    isSelecting = true;
    startCell = { row: Number(cellEl.dataset.row), col: Number(cellEl.dataset.col) };
    setPreview([startCell]);

    container.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event) {
    if (!isSelecting) return;

    const current = cellFromPoint(event.clientX, event.clientY);
    if (!current) return;

    setPreview(cellsAlongLine(startCell, current));
  }

  function handlePointerUp(event) {
    if (!isSelecting) return;

    // Re-hit-test at the release point so the final selection reflects
    // exactly where the pointer came up, falling back to whatever the
    // last pointermove computed if the release lands off the grid.
    const finalCell = cellFromPoint(event.clientX, event.clientY);
    if (finalCell) {
      setPreview(cellsAlongLine(startCell, finalCell));
    }

    releaseCapture(event.pointerId);
    finishSelection();
  }

  function handlePointerCancel(event) {
    if (!isSelecting) return;

    releaseCapture(event.pointerId);
    clearPreview();
    isSelecting = false;
    startCell = null;
  }

  container.addEventListener('pointerdown', handlePointerDown, { signal });
  container.addEventListener('pointermove', handlePointerMove, { signal });
  container.addEventListener('pointerup', handlePointerUp, { signal });
  container.addEventListener('pointercancel', handlePointerCancel, { signal });
}

/**
 * Shuffles `pool`, filters to words that fit within `gridSize` (no
 * longer than the grid itself — a placement over grid size would throw
 * in generatePuzzle), and returns the first `wordCount` of them. The
 * shuffle means replaying with the same settings doesn't always surface
 * the exact same words.
 */
function pickWords(pool, gridSize, wordCount) {
  const eligible = pool.filter((word) => word.length <= gridSize);
  return shuffled(eligible).slice(0, wordCount);
}

function shuffled(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Size of `theme`'s word pool that actually qualifies for `gridSize`
 * (i.e. fits within it). This is the generic "pool size" input to
 * getWordCountMax — looking the pool up by theme name here rather than
 * hardcoding one list means switching themes on the start screen
 * recomputes the cap against the newly selected theme's own word
 * count, and a future differently-sized theme (ticket 06's Random/Any)
 * needs no change to this logic. */
function poolSizeFor(gridSize, theme) {
  const pool = THEMES[theme] ?? [];
  return pool.filter((word) => word.length <= gridSize).length;
}

/** Shows exactly one of the top-level `.screen` sections (by element id)
 * and hides the rest, so start <-> puzzle transitions never require a
 * page reload. */
function showScreen(id) {
  for (const screen of document.querySelectorAll('.screen')) {
    screen.hidden = screen.id !== id;
  }
}

// Listeners set up by setupSelection for the puzzle currently on screen,
// so startPuzzle can tear them down before wiring up a fresh puzzle (see
// setupSelection's doc comment on why this is necessary).
let selectionAbortController = null;

function startPuzzle({ gridSize, theme, wordCount }) {
  const pool = THEMES[theme] ?? [];
  const words = pickWords(pool, gridSize, wordCount);
  const { grid, placements } = generatePuzzle(words, gridSize);

  const themeLabel = document.getElementById('theme-label');
  if (themeLabel) themeLabel.textContent = theme;

  const gridContainer = document.getElementById('grid');
  const cellElements = renderGrid(grid, gridContainer);
  const itemsByWord = renderWordList(placements, document.getElementById('word-list'));
  const winBanner = document.getElementById('win-banner');
  winBanner.hidden = true;

  if (selectionAbortController) selectionAbortController.abort();
  selectionAbortController = new AbortController();

  setupSelection({
    container: gridContainer,
    cellElements,
    placements,
    itemsByWord,
    winBanner,
    signal: selectionAbortController.signal,
  });

  showScreen('puzzle-screen');
}

function init() {
  initStartScreen({
    form: document.getElementById('start-form'),
    gridSizeContainer: document.getElementById('grid-size-choices'),
    themeContainer: document.getElementById('theme-choices'),
    themes: THEME_NAMES,
    wordCountInput: document.getElementById('word-count'),
    getPoolSize: poolSizeFor,
    onStart: startPuzzle,
  });

  const newPuzzleButton = document.getElementById('new-puzzle-button');
  if (newPuzzleButton) {
    newPuzzleButton.addEventListener('click', () => showScreen('start-screen'));
  }

  showScreen('start-screen');
}

document.addEventListener('DOMContentLoaded', init);
