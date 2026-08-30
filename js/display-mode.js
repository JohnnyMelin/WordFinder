// display-mode.js
//
// Persistence for the player's chosen selection-display mode ("Line" vs
// "Highlight", ticket 09). A tiny standalone module — not folded into
// start-screen.js or ui.js — so both sides read/write through the same
// localStorage key and default without duplicating storage access:
// start-screen.js uses it to render the toggle (checked state on load,
// persisted on change) and ui.js uses it in startPuzzle/setupSelection to
// pick which renderer to build a puzzle's selection display with.

const STORAGE_KEY = 'wordFinder.displayMode';

export const DISPLAY_MODE_LINE = 'line';
export const DISPLAY_MODE_HIGHLIGHT = 'highlight';

// New players (no stored preference yet) see Line mode, per spec.md's
// Implementation Decisions for ticket 09.
export const DEFAULT_DISPLAY_MODE = DISPLAY_MODE_LINE;

const VALID_MODES = new Set([DISPLAY_MODE_LINE, DISPLAY_MODE_HIGHLIGHT]);

/**
 * Reads the persisted display mode, falling back to the default (Line)
 * when nothing is stored yet, the stored value isn't recognized, or
 * localStorage itself is unavailable (e.g. the file:// start-up warning
 * case, or a browser with storage disabled) — never throws.
 */
export function getDisplayMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return VALID_MODES.has(stored) ? stored : DEFAULT_DISPLAY_MODE;
  } catch {
    return DEFAULT_DISPLAY_MODE;
  }
}

/**
 * Persists the player's chosen display mode so it's restored next visit.
 * Silently no-ops if localStorage is unavailable — the choice still works
 * for the current session via the caller's own DOM state, it just won't
 * be remembered next time.
 */
export function setDisplayMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore — e.g. localStorage disabled/unavailable. Nothing else to do.
  }
}
