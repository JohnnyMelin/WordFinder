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
// 05), plus a seventh "Random/Any" theme (ticket 06) whose words come
// from data/random-words.json. Fetching and resolving that pool data
// lives in word-pools.js (loadRandomWords/poolFor/wordCountMaxFor),
// imported below; this module just calls into it to pick words for a
// puzzle.

import { generatePuzzle, checkSelection } from './game-logic.js';
import { computeScore } from './scoring.js';
import { initStartScreen } from './start-screen.js';
import { THEME_NAMES, loadRandomWords, poolFor, wordCountMaxFor } from './word-pools.js';

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
 * Today's full-tile highlight display: the drag preview and found-word
 * marking both just toggle a class on the affected cells. `cellElementAt`
 * resolves a {row, col} to its DOM cell (or null if out of bounds).
 *
 * This is the renderer interface a later ticket's alternate display (e.g.
 * a line-based one) implements instead: `setPreview(cells)` shows the
 * live in-progress selection, `clearPreview()` removes it, and
 * `markFound(cells)` marks a confirmed word's cells permanently. Callers
 * never toggle CSS classes directly — they go through whichever renderer
 * is in play.
 */
function createHighlightRenderer(cellElementAt) {
  let previewCells = [];

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

  function markFound(cells) {
    for (const cell of cells) {
      const el = cellElementAt(cell.row, cell.col);
      if (el) el.classList.add('found');
    }
  }

  return { setPreview, clearPreview, markFound };
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
function setupSelection({ container, cellElements, placements, itemsByWord, winBanner, onWin, signal }) {
  const gridSize = cellElements.length;
  const foundWords = new Set();

  let isSelecting = false;
  let startCell = null;
  let previewCells = [];

  function cellElementAt(row, col) {
    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return null;
    return cellElements[row][col];
  }

  const renderer = createHighlightRenderer(cellElementAt);

  function clearPreview() {
    renderer.clearPreview();
    previewCells = [];
  }

  function setPreview(cells) {
    renderer.setPreview(cells);
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

    renderer.markFound(cells);

    const item = itemsByWord.get(word);
    if (item) item.classList.add('found');

    if (winBanner && foundWords.size === placements.length) {
      winBanner.hidden = false;
      if (onWin) onWin();
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

// Timer state, kept in this same module scope for the same reason
// selectionAbortController is: startPuzzle can be called again for a new
// puzzle, and without explicitly clearing the previous interval it would
// keep ticking alongside a second one. `timerStartedAt` is the timestamp
// (from performance.now()) the currently-showing puzzle's timer started
// counting from; `finalElapsedSeconds` is the frozen reading (whole
// seconds) from the moment the puzzle was won, left in place until the
// next call to startTimer() — later tickets (e.g. ticket 11's scoring)
// read it via getFinalElapsedSeconds().
let timerIntervalId = null;
let timerStartedAt = null;
let finalElapsedSeconds = null;

function formatElapsed(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function currentElapsedSeconds() {
  if (timerStartedAt === null) return 0;
  return Math.floor((performance.now() - timerStartedAt) / 1000);
}

function renderTimer(seconds) {
  const timerLabel = document.getElementById('timer-label');
  if (timerLabel) timerLabel.textContent = formatElapsed(seconds);
}

/** Starts (or restarts) the live timer at zero. Clears any interval left
 * running from a previous puzzle first — the same stacking hazard
 * selectionAbortController solves for pointer listeners, but for
 * setInterval instead of event listeners. Called right after renderGrid
 * inside startPuzzle, so puzzle-generation time is never counted. */
function startTimer() {
  if (timerIntervalId !== null) clearInterval(timerIntervalId);

  timerStartedAt = performance.now();
  finalElapsedSeconds = null;
  renderTimer(0);
  timerIntervalId = setInterval(() => renderTimer(currentElapsedSeconds()), 250);
}

/** Stops the live timer the instant the puzzle is won and freezes the
 * final elapsed time (whole seconds) in finalElapsedSeconds, read by
 * getFinalElapsedSeconds() below. Passed to setupSelection as `onWin`. */
function stopTimer() {
  if (timerIntervalId !== null) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
  finalElapsedSeconds = currentElapsedSeconds();
  renderTimer(finalElapsedSeconds);
}

/**
 * The frozen elapsed time (whole seconds) from the most recently won
 * puzzle on screen, or null if the current puzzle hasn't been won yet.
 * This is the seam later tickets (e.g. ticket 11's scoring) read from —
 * import { getFinalElapsedSeconds } from './ui.js' and call it once the
 * win banner is showing.
 */
export function getFinalElapsedSeconds() {
  return finalElapsedSeconds;
}

/** Clears the win screen's score display, called at the start of every
 * puzzle (alongside hiding winBanner) so a previous puzzle's score never
 * flashes before this one has been won. */
function clearScoreLabel() {
  const scoreLabel = document.getElementById('score-label');
  if (scoreLabel) scoreLabel.textContent = '';
}

/**
 * Computes this puzzle's score (ticket 11) from its grid size and word
 * count, plus the just-frozen elapsed time (getFinalElapsedSeconds(),
 * populated by stopTimer() which must run before this is called), and
 * displays it on the win screen. Pure calculation lives in scoring.js;
 * this is just the DOM-facing call site — no persistence or scoreboard
 * happens here (ticket 12).
 */
function showScore(gridSize, wordCount) {
  const score = computeScore({
    gridSize,
    wordCount,
    elapsedSeconds: getFinalElapsedSeconds(),
  });

  const scoreLabel = document.getElementById('score-label');
  if (scoreLabel) scoreLabel.textContent = `Score: ${score}`;
}

function startPuzzle({ gridSize, theme, wordCount }) {
  const pool = poolFor(theme);
  const words = pickWords(pool, gridSize, wordCount);
  const { grid, placements } = generatePuzzle(words, gridSize);

  const themeLabel = document.getElementById('theme-label');
  if (themeLabel) themeLabel.textContent = theme;

  const gridContainer = document.getElementById('grid');
  const cellElements = renderGrid(grid, gridContainer);
  startTimer();
  const itemsByWord = renderWordList(placements, document.getElementById('word-list'));
  const winBanner = document.getElementById('win-banner');
  winBanner.hidden = true;
  clearScoreLabel();

  if (selectionAbortController) selectionAbortController.abort();
  selectionAbortController = new AbortController();

  setupSelection({
    container: gridContainer,
    cellElements,
    placements,
    itemsByWord,
    winBanner,
    onWin: () => {
      stopTimer();
      showScore(gridSize, placements.length);
    },
    signal: selectionAbortController.signal,
  });

  showScreen('puzzle-screen');
}

async function init() {
  // Awaited before initStartScreen so every theme (including Random/Any)
  // is fully ready before the player can interact with the theme
  // selector — no async creeps past this point into start-screen.js or
  // startPuzzle's synchronous pool lookups. loadRandomWords (word-pools.js)
  // populates its own internal pool, which poolFor/wordCountMaxFor then
  // read.
  await loadRandomWords();

  initStartScreen({
    form: document.getElementById('start-form'),
    gridSizeContainer: document.getElementById('grid-size-choices'),
    themeContainer: document.getElementById('theme-choices'),
    themes: THEME_NAMES,
    wordCountInput: document.getElementById('word-count'),
    getWordCountMax: wordCountMaxFor,
    onStart: startPuzzle,
  });

  const newPuzzleButton = document.getElementById('new-puzzle-button');
  if (newPuzzleButton) {
    newPuzzleButton.addEventListener('click', () => showScreen('start-screen'));
  }

  showScreen('start-screen');
}

document.addEventListener('DOMContentLoaded', init);
