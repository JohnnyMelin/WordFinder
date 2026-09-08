// start-screen.js
//
// Start-screen controller: lets the player pick a grid size, a theme, a
// word count, and a selection-display mode before playing, then hands
// that configuration off to a caller-supplied callback (ui.js generates
// and renders the puzzle from it). Pure DOM wiring only — the actual
// word-count-max math (including which per-theme ceiling table applies)
// lives entirely in the caller-supplied `getWordCountMax(gridSize,
// theme)` callback; this module just keeps the word-count input's `max`
// (and current value, if it now overshoots) in sync with whatever that
// callback returns whenever the grid size or theme changes. It doesn't
// know anything about theme *data* itself (no import of data/themes.js,
// no import of game-logic.js) — the caller supplies the list of theme
// names to render, an explicit `defaultTheme` to check initially, and the
// `getWordCountMax` callback to size against, so this stays generic
// across future pools/themes/ceilings without changes here. The optional
// `onThemeChange` hook (ticket 18) is the same kind of generic pass-
// through: this module calls it with whichever theme is currently
// selected, both on an actual theme-select change and via the returned
// `refresh()` (e.g. on start-screen re-entry), without knowing or caring
// what the caller does with it (e.g. re-rolling a "Random Theme" option).
//
// The display-mode toggle (ticket 09) is the one exception to "no data
// imports": display-mode.js is a tiny, self-contained localStorage
// wrapper (not puzzle content like themes/pools), so this module reads
// and writes through it directly rather than routing it through the
// caller — there's no future-extensibility reason to keep it generic the
// way the theme/pool wiring is.

import { getDisplayMode, setDisplayMode, DISPLAY_MODE_LINE, DISPLAY_MODE_HIGHLIGHT } from './display-mode.js';

// Grid size choices offered on the start screen. Kept as UI-facing data
// (value + label) separate from GRID_SIZE_WORD_COUNT_MAX in
// game-logic.js, which owns the actual per-size word-count ceiling.
const GRID_SIZE_CHOICES = [
  { value: 6, label: '6x6 (Easy)' },
  { value: 10, label: '10x10 (Medium)' },
  { value: 20, label: '20x20 (Hard)' },
];

// Display-mode choices (ticket 09). Labeled so the classic full-tile mode
// reads as "Highlight"; see display-mode.js for the persisted values.
const DISPLAY_MODE_CHOICES = [
  { value: DISPLAY_MODE_LINE, label: 'Line' },
  { value: DISPLAY_MODE_HIGHLIGHT, label: 'Highlight' },
];

const DEFAULT_GRID_SIZE = 10;
const DEFAULT_WORD_COUNT = 10;

/**
 * Renders one radio-button group (a label wrapping a radio input, per
 * item) into `container`, replacing whatever was there before. The
 * grid-size group and the display-mode group share this exact DOM shape
 * and only differ in the field name, the source items, and how a
 * value/label is pulled from each item — those differences are the
 * callbacks below.
 *
 * @param {HTMLElement} container - element the radio labels are appended to.
 * @param {Object} options
 * @param {string} options.name - the radio group's shared `name` attribute.
 * @param {string} options.className - class name(s) applied to each `<label>`.
 * @param {any[]} options.items - the choices to render, in order.
 * @param {(item: any) => string|number} options.toValue - the radio
 *   input's `value` for an item.
 * @param {(item: any) => string} options.toLabel - the visible label text
 *   for an item.
 * @param {(item: any) => boolean} options.isChecked - whether an item
 *   should start out checked.
 * @param {(event: Event) => void} options.onChange - listener attached to
 *   every radio's `change` event.
 */
function renderRadioGroup(container, { name, className, items, toValue, toLabel, isChecked, onChange }) {
  container.replaceChildren();

  for (const item of items) {
    const label = document.createElement('label');
    label.className = className;

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = name;
    radio.value = String(toValue(item));
    radio.checked = isChecked(item);
    radio.addEventListener('change', onChange);

    label.appendChild(radio);
    label.append(` ${toLabel(item)}`);
    container.appendChild(label);
  }
}

/**
 * Renders one `<option>` per item into `select` (a combo box), replacing
 * whatever was there before, and wires its `change` event. Used for the
 * theme field, which — with dozens of curated themes plus the Random
 * Words/Random Theme entries — got unwieldy as a radio group.
 *
 * @param {HTMLSelectElement} select - the combo box to populate.
 * @param {Object} options
 * @param {any[]} options.items - the choices to render, in order.
 * @param {(item: any) => string|number} options.toValue - the option's
 *   `value` for an item.
 * @param {(item: any) => string} options.toLabel - the visible option
 *   text for an item.
 * @param {string|number} options.selectedValue - the value selected
 *   initially.
 * @param {(event: Event) => void} options.onChange - listener attached to
 *   the select's `change` event.
 */
function renderSelect(select, { items, toValue, toLabel, selectedValue, onChange }) {
  select.replaceChildren();

  for (const item of items) {
    const option = document.createElement('option');
    option.value = String(toValue(item));
    option.textContent = toLabel(item);
    select.appendChild(option);
  }

  select.value = String(selectedValue);
  select.addEventListener('change', onChange);
}

/**
 * Renders the grid-size radio choices, the theme combo box, and wires up the
 * word-count input and the start form so that submitting it calls
 * `onStart` with the player's chosen `{ gridSize, theme, wordCount }`.
 *
 * @param {Object} options
 * @param {HTMLFormElement} options.form - the start screen's <form>;
 *   submitting it (Start button or Enter) triggers `onStart`.
 * @param {HTMLElement} options.gridSizeContainer - container the grid-
 *   size radio buttons are rendered into.
 * @param {HTMLSelectElement} options.themeSelect - the combo box theme
 *   options are rendered into.
 * @param {HTMLElement} options.displayModeContainer - container the
 *   Line/Highlight display-mode radio buttons are rendered into (ticket
 *   09); its initial checked value comes from display-mode.js's
 *   persisted preference (defaulting to Line), and a change is persisted
 *   back through it immediately.
 * @param {string[]} options.themes - theme names to offer, in display
 *   order.
 * @param {string} [options.defaultTheme] - the theme checked by default;
 *   defaults to `themes[0]` if omitted. Kept separate from `themes`'
 *   order since a caller's display order and its default selection don't
 *   always agree (e.g. ticket 18: Random Words/Random Theme lead the
 *   list, but a curated theme stays the default).
 * @param {HTMLInputElement} options.wordCountInput - the numeric word-
 *   count input; its `min`/`max`/`value` are managed here.
 * @param {(gridSize: number, theme: string) => number} options.getWordCountMax
 *   - returns the word-count input's max for a given grid size + theme
 *   pair (pool size already folded in), called fresh on every grid-size
 *   or theme change so this stays generic across future pools/themes/
 *   ceilings without changes here.
 * @param {(theme: string) => void} [options.onThemeChange] - called with
 *   the currently selected theme both when the theme select changes and
 *   whenever the returned `refresh()` is called (e.g. on start-screen
 *   re-entry). This module doesn't know or care what it does with that
 *   theme name (e.g. ticket 18's Random Theme re-roll) — it just forwards
 *   whichever theme is current, staying generic across future themes.
 * @param {(config: { gridSize: number, theme: string, wordCount: number }) => void} options.onStart
 *   called when the player starts a puzzle.
 * @returns {{ refresh: () => void }} `refresh` re-runs `onThemeChange`
 *   (with the currently selected theme) and re-syncs the word-count max —
 *   call it whenever the start screen is shown again without a full
 *   re-init (e.g. "New Puzzle"), so a re-rollable theme like Random Theme
 *   gets its chance to re-roll on every re-entry, not just the first.
 */
export function initStartScreen({
  form,
  gridSizeContainer,
  themeSelect,
  displayModeContainer,
  themes,
  defaultTheme,
  wordCountInput,
  getWordCountMax,
  onThemeChange,
  onStart,
}) {
  renderRadioGroup(gridSizeContainer, {
    name: 'grid-size',
    className: 'choice grid-size-choice',
    items: GRID_SIZE_CHOICES,
    toValue: (choice) => choice.value,
    toLabel: (choice) => choice.label,
    isChecked: (choice) => choice.value === DEFAULT_GRID_SIZE,
    onChange: syncWordCountMax,
  });

  const resolvedDefaultTheme = defaultTheme ?? themes[0];

  renderSelect(themeSelect, {
    items: themes,
    toValue: (theme) => theme,
    toLabel: (theme) => theme,
    selectedValue: resolvedDefaultTheme,
    onChange: handleThemeChange,
  });

  renderRadioGroup(displayModeContainer, {
    name: 'display-mode',
    className: 'choice display-mode-choice',
    items: DISPLAY_MODE_CHOICES,
    toValue: (choice) => choice.value,
    toLabel: (choice) => choice.label,
    isChecked: (choice) => choice.value === getDisplayMode(),
    onChange: (event) => setDisplayMode(event.target.value),
  });

  function selectedGridSize() {
    const checked = gridSizeContainer.querySelector('input[name="grid-size"]:checked');
    return checked ? Number(checked.value) : DEFAULT_GRID_SIZE;
  }

  function selectedTheme() {
    return themeSelect.value || resolvedDefaultTheme;
  }

  function handleThemeChange(event) {
    if (onThemeChange) onThemeChange(event.target.value);
    syncWordCountMax();
  }

  /**
   * Recomputes the word-count input's `max` for the currently selected
   * grid size + theme and the pool's current size, clamping the input's
   * value down if it now exceeds that max (e.g. after switching from
   * 10x10 to 6x6, after switching themes, or after the pool shrank).
   */
  function syncWordCountMax() {
    const max = getWordCountMax(selectedGridSize(), selectedTheme());
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

  return {
    refresh() {
      if (onThemeChange) onThemeChange(selectedTheme());
      syncWordCountMax();
    },
  };
}
