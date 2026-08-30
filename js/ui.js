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
//
// Selection/found-word display (ticket 09): setupSelection renders
// through a swappable renderer (createHighlightRenderer or
// createLineRenderer below), chosen per the persisted display-mode
// preference in display-mode.js. The start screen's toggle for that
// preference lives in start-screen.js.
//
// Scoreboard modal (ticket 13): a "View Scoreboards" overlay reachable
// from both screens (openScoreboardModal below), browsing the same
// per-grid-size data recordScoreIfQualifying writes via
// scoreboard-storage.js. It's `#scoreboard-modal` in index.html — a plain
// overlay `<div>` toggled via `hidden`, deliberately a sibling of the
// `.screen` sections rather than one itself, so showScreen() never
// touches it and whichever screen was showing underneath is left exactly
// as it was once the modal is dismissed.

import { generatePuzzle, checkSelection } from './game-logic.js';
import { computeScore, rankEntries } from './scoring.js';
import { loadScores, saveScores } from './scoreboard-storage.js';
import { initStartScreen } from './start-screen.js';
import { THEME_NAMES, loadRandomWords, poolFor, wordCountMaxFor } from './word-pools.js';
import { getDisplayMode, DISPLAY_MODE_LINE } from './display-mode.js';

// Arcade-style name entry (ticket 12) is capped to this many characters,
// and falls back to this placeholder when the player cancels the prompt
// or leaves it blank.
const MAX_NAME_LENGTH = 12;
const ANONYMOUS_NAME = 'Anonymous';

// The three valid grid sizes, in the fixed order their scoreboard tabs
// are always shown (ticket 13) — matches scoreboard-storage.js's three
// independent storage keys and start-screen.js's GRID_SIZE_CHOICES.
const SCOREBOARD_GRID_SIZES = [6, 10, 20];

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
 * This is the renderer interface an alternate display implements instead
 * (see `createLineRenderer` below, ticket 09): `setPreview(cells)` shows
 * the live in-progress selection, `clearPreview()` removes it, and
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

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Line-mode display (ticket 09): implements the same renderer interface
 * as `createHighlightRenderer` (`setPreview`/`clearPreview`/`markFound`),
 * but instead of toggling classes on cells, draws lines onto an
 * absolutely-positioned SVG overlay appended into `container` (the grid
 * element; its CSS gives it `position: relative` so the overlay's
 * `inset: 0` lines up with `cellElementAt`'s cells' own `offsetLeft`/
 * `offsetTop` — both are measured from the same padding-edge origin,
 * which is how cell centers are located below).
 *
 * `setPreview(cells)` points a single live line from `cells`'s first
 * entry to its last (the drag-preview color/weight is styled in CSS via
 * `.preview-line`, at full opacity/saturation). `markFound(cells)` adds a
 * permanent line the same way, into the `.found-lines` group.
 *
 * Found-word lines need care to satisfy "crossing lines never look
 * darker than a single line": each `.found-line` stroke is drawn fully
 * *opaque* (not semi-transparent itself) — painting an opaque stroke over
 * an already-opaque same-colored pixel changes nothing, so overlapping
 * found-lines can never compound. The actual "semi-transparent light
 * gray" look is applied exactly *once*, as a single CSS `opacity` on the
 * whole `.found-lines` group, after its contents are flattened. Flattening
 * first (rather than each line separately carrying alpha) is what
 * `isolation: isolate` on `.found-lines` buys: it's the standard technique
 * for "many overlapping same-color shapes should look the same as one" —
 * per-stroke alpha alone doesn't achieve this, since alpha compositing
 * always accumulates coverage across separately-painted semi-transparent
 * layers regardless of blend mode; only a single opacity applied to the
 * pre-flattened whole avoids that. `mix-blend-mode: lighten` on the
 * strokes (scoped by that same isolation to blend only against each
 * other, not the real grid backdrop) additionally smooths over the
 * anti-aliased edge pixels where two lines' boundaries cross. Neither
 * line style draws endpoint markers; a cell's tiles get no class changes
 * at all in this mode.
 */
function createLineRenderer(cellElementAt, container) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('selection-lines');
  svg.setAttribute('aria-hidden', 'true');
  container.appendChild(svg);

  const foundLines = document.createElementNS(SVG_NS, 'g');
  foundLines.classList.add('found-lines');
  svg.appendChild(foundLines);

  const previewLine = document.createElementNS(SVG_NS, 'line');
  previewLine.classList.add('preview-line');
  previewLine.style.display = 'none';
  svg.appendChild(previewLine);

  function cellCenter({ row, col }) {
    const el = cellElementAt(row, col);
    if (!el) return null;
    return { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 };
  }

  /** Points `line` from `cells`'s first entry to its last. Returns false
   * (leaving `line` untouched) if either endpoint is out of bounds. */
  function pointLine(line, cells) {
    const start = cellCenter(cells[0]);
    const end = cellCenter(cells[cells.length - 1]);
    if (!start || !end) return false;

    line.setAttribute('x1', String(start.x));
    line.setAttribute('y1', String(start.y));
    line.setAttribute('x2', String(end.x));
    line.setAttribute('y2', String(end.y));
    return true;
  }

  function clearPreview() {
    previewLine.style.display = 'none';
  }

  function setPreview(cells) {
    if (cells.length === 0 || !pointLine(previewLine, cells)) {
      clearPreview();
      return;
    }
    previewLine.style.display = '';
  }

  function markFound(cells) {
    if (cells.length === 0) return;

    const line = document.createElementNS(SVG_NS, 'line');
    line.classList.add('found-line');
    if (pointLine(line, cells)) foundLines.appendChild(line);
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
 *
 * The renderer actually used for the preview/found-word display is
 * picked fresh on every call, based on the persisted display-mode
 * preference (ticket 09, display-mode.js) at the moment the puzzle
 * starts: Line mode (the default when nothing is stored yet) gets
 * `createLineRenderer`; Highlight mode gets `createHighlightRenderer`,
 * today's unchanged behavior.
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

  const renderer =
    getDisplayMode() === DISPLAY_MODE_LINE
      ? createLineRenderer(cellElementAt, container)
      : createHighlightRenderer(cellElementAt);

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
 * Computes this puzzle's score (ticket 11) from its dimensions
 * (`{ gridSize, wordCount }` — the same shape computeScore itself takes,
 * just missing elapsedSeconds) plus the just-frozen elapsed time
 * (getFinalElapsedSeconds(), populated by stopTimer() which must run
 * before this is called), and displays it on the win screen. Pure
 * calculation lives in scoring.js; this is just the DOM-facing call
 * site — no persistence or scoreboard happens here (ticket 12).
 */
function showScore(dimensions) {
  const score = computeScore({
    ...dimensions,
    elapsedSeconds: getFinalElapsedSeconds(),
  });

  const scoreLabel = document.getElementById('score-label');
  if (scoreLabel) scoreLabel.textContent = `Score: ${score}`;

  return score;
}

/**
 * Ticket 12's write path: checks the just-computed score against that
 * grid size's independent top-9 scoreboard (scoring.js's rankEntries),
 * and if it qualifies, prompts the player arcade-style for a short name
 * before persisting. A non-qualifying score is left exactly as ticket 11
 * left it — displayed via showScore, nothing prompted, nothing written.
 *
 * `dimensions` is the same `{ gridSize, wordCount }` object passed to
 * showScore, so the puzzle's identifying shape travels as one value
 * instead of two parallel positional args.
 *
 * The name is filled in on `newEntry` *after* rankEntries has already
 * decided whether/where it ranks — `entries` (from rankEntries) contains
 * that same `newEntry` object by reference when qualified, so mutating
 * its `name` here updates it in place within the list about to be
 * saved, without needing to re-run the ranking logic.
 */
function recordScoreIfQualifying({ gridSize, wordCount }, score) {
  const newEntry = { score, wordCount, date: new Date().toISOString() };
  const { entries, qualified } = rankEntries(loadScores(gridSize), newEntry);

  if (!qualified) return;

  const rawName = window.prompt('New high score! Enter your name:');
  const trimmedName = (rawName || '').trim().slice(0, MAX_NAME_LENGTH);
  newEntry.name = trimmedName || ANONYMOUS_NAME;

  saveScores(gridSize, entries);
}

// The grid size of whichever puzzle is currently on the puzzle screen (set
// at the top of startPuzzle below), so the win screen's "View Scoreboards"
// button can open the modal defaulted to the size just played instead of
// always falling back to the smallest board.
let currentPuzzleGridSize = SCOREBOARD_GRID_SIZES[0];

// The scoreboard modal's three DOM elements, resolved once in init() and
// reused by openScoreboardModal/closeScoreboardModal/selectScoreboardTab
// below instead of each of them re-querying the DOM on every open, close,
// or tab switch.
let scoreboardModalEl = null;
let scoreboardTabsEl = null;
let scoreboardListEl = null;

/**
 * Renders the modal's row of per-grid-size tab buttons, marking whichever
 * one matches `selectedGridSize` active. Re-rendered on every tab switch
 * (rather than just toggling a class on existing buttons) to keep this in
 * lockstep with renderScoreboardEntries below — both are driven from the
 * same `selectScoreboardTab` call.
 */
function renderScoreboardTabs(container, selectedGridSize) {
  container.replaceChildren();

  for (const gridSize of SCOREBOARD_GRID_SIZES) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'scoreboard-tab';
    tab.textContent = `${gridSize}x${gridSize}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(gridSize === selectedGridSize));
    tab.classList.toggle('active', gridSize === selectedGridSize);
    tab.addEventListener('click', () => selectScoreboardTab(gridSize));
    container.appendChild(tab);
  }
}

/**
 * Renders one grid size's saved entries (freshly loaded from
 * scoreboard-storage.js every call, so a score recorded moments ago on the
 * win screen always shows up) in the rank order they're already stored in
 * — rankEntries keeps the stored list sorted descending by score, so rank
 * is just the entry's index + 1. Falls back to a plain empty-state message
 * when there's nothing saved yet for this grid size.
 */
function renderScoreboardEntries(container, gridSize) {
  container.replaceChildren();

  const entries = loadScores(gridSize);
  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'scoreboard-empty';
    empty.textContent = 'No scores yet — be the first!';
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('ol');
  list.className = 'scoreboard-entries';

  entries.forEach((entry, index) => {
    const item = document.createElement('li');
    item.className = 'scoreboard-entry';

    const main = document.createElement('div');
    main.className = 'scoreboard-entry-main';

    const rank = document.createElement('span');
    rank.className = 'scoreboard-rank';
    rank.textContent = `#${index + 1}`;

    const name = document.createElement('span');
    name.className = 'scoreboard-name';
    name.textContent = entry.name || ANONYMOUS_NAME;

    const score = document.createElement('span');
    score.className = 'scoreboard-score';
    score.textContent = `${entry.score} pts`;

    main.append(rank, name, score);

    const meta = document.createElement('div');
    meta.className = 'scoreboard-entry-meta';
    const formattedDate = entry.date ? new Date(entry.date).toLocaleDateString() : '';
    meta.textContent = [`${entry.wordCount ?? '?'} words`, formattedDate].filter(Boolean).join(' • ');

    item.append(main, meta);
    list.appendChild(item);
  });

  container.appendChild(list);
}

/** Switches the modal to `gridSize`'s tab, re-rendering both the tab row
 * and the entries list. Used both when a tab is clicked and when the
 * modal is first opened. */
function selectScoreboardTab(gridSize) {
  renderScoreboardTabs(scoreboardTabsEl, gridSize);
  renderScoreboardEntries(scoreboardListEl, gridSize);
}

/**
 * Opens the "View Scoreboards" modal (ticket 13), reachable from both the
 * start screen and the win screen. `preferredGridSize` lets the win
 * screen default the modal to the size just played; the start screen
 * calls this with no argument, defaulting to the smallest board.
 * Re-renders the selected tab's entries fresh from loadScores() every
 * time the modal opens, so it always reflects the latest saved data —
 * important right after a score was just recorded on the win screen.
 *
 * The modal is a plain overlay `<div>` toggled via `hidden`, a sibling of
 * the `.screen` sections rather than one itself, so opening/closing it
 * never touches showScreen()'s single-screen-visible bookkeeping and
 * whichever screen was showing underneath is left exactly as it was.
 */
function openScoreboardModal(preferredGridSize) {
  if (!scoreboardModalEl) return;

  const gridSize = SCOREBOARD_GRID_SIZES.includes(preferredGridSize) ? preferredGridSize : SCOREBOARD_GRID_SIZES[0];
  selectScoreboardTab(gridSize);
  scoreboardModalEl.hidden = false;
}

function closeScoreboardModal() {
  if (scoreboardModalEl) scoreboardModalEl.hidden = true;
}

function startPuzzle({ gridSize, theme, wordCount }) {
  currentPuzzleGridSize = gridSize;

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
  const winViewScoreboardsButton = document.getElementById('win-view-scoreboards-button');
  if (winViewScoreboardsButton) winViewScoreboardsButton.hidden = true;
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
      if (winViewScoreboardsButton) winViewScoreboardsButton.hidden = false;
      const dimensions = { gridSize, wordCount: placements.length };
      const score = showScore(dimensions);
      recordScoreIfQualifying(dimensions, score);
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

  // Resolved once here and reused by openScoreboardModal/closeScoreboardModal/
  // selectScoreboardTab instead of each re-querying the DOM on every call.
  scoreboardModalEl = document.getElementById('scoreboard-modal');
  scoreboardTabsEl = document.getElementById('scoreboard-tabs');
  scoreboardListEl = document.getElementById('scoreboard-list');

  initStartScreen({
    form: document.getElementById('start-form'),
    gridSizeContainer: document.getElementById('grid-size-choices'),
    themeContainer: document.getElementById('theme-choices'),
    displayModeContainer: document.getElementById('display-mode-choices'),
    themes: THEME_NAMES,
    wordCountInput: document.getElementById('word-count'),
    getWordCountMax: wordCountMaxFor,
    onStart: startPuzzle,
  });

  const newPuzzleButton = document.getElementById('new-puzzle-button');
  if (newPuzzleButton) {
    newPuzzleButton.addEventListener('click', () => showScreen('start-screen'));
  }

  // Scoreboard modal (ticket 13): reachable from both the start screen
  // (before playing) and the win screen (right after finishing, defaulted
  // to the size just played). Dismissible via its close button or by
  // clicking the backdrop; either way it just re-hides the overlay, so
  // whichever screen was showing underneath is untouched.
  const viewScoreboardsButton = document.getElementById('view-scoreboards-button');
  if (viewScoreboardsButton) {
    viewScoreboardsButton.addEventListener('click', () => openScoreboardModal());
  }

  const winViewScoreboardsButton = document.getElementById('win-view-scoreboards-button');
  if (winViewScoreboardsButton) {
    winViewScoreboardsButton.addEventListener('click', () => openScoreboardModal(currentPuzzleGridSize));
  }

  if (scoreboardModalEl) {
    // Clicking the backdrop itself (not the modal card inside it) closes
    // the modal — event.target is only the overlay element when the click
    // didn't land on (or bubble up through) `.modal`.
    scoreboardModalEl.addEventListener('click', (event) => {
      if (event.target === scoreboardModalEl) closeScoreboardModal();
    });
  }

  const scoreboardModalClose = document.getElementById('scoreboard-modal-close');
  if (scoreboardModalClose) {
    scoreboardModalClose.addEventListener('click', closeScoreboardModal);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && scoreboardModalEl && !scoreboardModalEl.hidden) {
      closeScoreboardModal();
    }
  });

  showScreen('start-screen');
}

document.addEventListener('DOMContentLoaded', init);
