// start-screen.js
//
// Start-screen controller: lets the player pick a grid size, a theme, and
// a word count before playing, then hands that configuration off to a
// caller-supplied callback (ui.js generates and renders the puzzle from
// it). Pure DOM wiring only — the actual word-count-max math is the pure
// `getWordCountMax` helper in game-logic.js, which is unit tested
// without a DOM; this module just keeps the word-count input's `max`
// (and current value, if it now overshoots) in sync with whatever that
// helper returns whenever the grid size or theme changes. It doesn't
// know anything about theme *data* itself (no import of
// data/themes.js) — the caller supplies the list of theme names to
// render and a `getPoolSize(gridSize, theme)` callback to size against,
// the same way it already supplies `getPoolSize` for grid size alone.

import { getWordCountMax } from './game-logic.js';

// Grid size choices offered on the start screen. Kept as UI-facing data
// (value + label) separate from GRID_SIZE_WORD_COUNT_MAX in
// game-logic.js, which owns the actual per-size word-count ceiling.
const GRID_SIZE_CHOICES = [
  { value: 6, label: '6x6 (Easy)' },
  { value: 10, label: '10x10 (Medium)' },
  { value: 20, label: '20x20 (Hard)' },
];

const DEFAULT_GRID_SIZE = 10;
const DEFAULT_WORD_COUNT = 10;

/**
 * Renders the grid-size and theme radio choices and wires up the
 * word-count input and the start form so that submitting it calls
 * `onStart` with the player's chosen `{ gridSize, theme, wordCount }`.
 *
 * @param {Object} options
 * @param {HTMLFormElement} options.form - the start screen's <form>;
 *   submitting it (Start button or Enter) triggers `onStart`.
 * @param {HTMLElement} options.gridSizeContainer - container the grid-
 *   size radio buttons are rendered into.
 * @param {HTMLElement} options.themeContainer - container the theme
 *   radio buttons are rendered into.
 * @param {string[]} options.themes - theme names to offer, in display
 *   order; the first is selected by default.
 * @param {HTMLInputElement} options.wordCountInput - the numeric word-
 *   count input; its `min`/`max`/`value` are managed here.
 * @param {(gridSize: number, theme: string) => number} options.getPoolSize
 *   - returns the active word pool's qualifying word count for a given
 *   grid size + theme pair, called fresh on every grid-size or theme
 *   change so this stays generic across future pools/themes of
 *   differing sizes.
 * @param {(config: { gridSize: number, theme: string, wordCount: number }) => void} options.onStart
 *   called when the player starts a puzzle.
 */
export function initStartScreen({
  form,
  gridSizeContainer,
  themeContainer,
  themes,
  wordCountInput,
  getPoolSize,
  onStart,
}) {
  gridSizeContainer.replaceChildren();

  for (const choice of GRID_SIZE_CHOICES) {
    const label = document.createElement('label');
    label.className = 'grid-size-choice';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'grid-size';
    radio.value = String(choice.value);
    radio.checked = choice.value === DEFAULT_GRID_SIZE;
    radio.addEventListener('change', syncWordCountMax);

    label.appendChild(radio);
    label.append(` ${choice.label}`);
    gridSizeContainer.appendChild(label);
  }

  const defaultTheme = themes[0];

  themeContainer.replaceChildren();

  for (const theme of themes) {
    const label = document.createElement('label');
    label.className = 'theme-choice';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'theme';
    radio.value = theme;
    radio.checked = theme === defaultTheme;
    radio.addEventListener('change', syncWordCountMax);

    label.appendChild(radio);
    label.append(` ${theme}`);
    themeContainer.appendChild(label);
  }

  function selectedGridSize() {
    const checked = gridSizeContainer.querySelector('input[name="grid-size"]:checked');
    return checked ? Number(checked.value) : DEFAULT_GRID_SIZE;
  }

  function selectedTheme() {
    const checked = themeContainer.querySelector('input[name="theme"]:checked');
    return checked ? checked.value : defaultTheme;
  }

  /**
   * Recomputes the word-count input's `max` for the currently selected
   * grid size + theme and the pool's current size, clamping the input's
   * value down if it now exceeds that max (e.g. after switching from
   * 10x10 to 6x6, after switching themes, or after the pool shrank).
   */
  function syncWordCountMax() {
    const max = getWordCountMax(selectedGridSize(), getPoolSize(selectedGridSize(), selectedTheme()));
    wordCountInput.max = String(max);
    if (Number(wordCountInput.value) > max) {
      wordCountInput.value = String(max);
    }
  }

  wordCountInput.min = '1';
  wordCountInput.value = String(DEFAULT_WORD_COUNT);
  syncWordCountMax();

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    // Guard against a stale max (e.g. the pool changed underneath us
    // since the last grid-size/theme change) before reading the final
    // value.
    syncWordCountMax();

    onStart({
      gridSize: selectedGridSize(),
      theme: selectedTheme(),
      wordCount: Number(wordCountInput.value),
    });
  });
}
