// word-pools.js
//
// Pool-loading/resolution concern extracted out of ui.js: fetching the
// Random Words pool from data/random-words.json (ticket 06, relabeled
// from "Random/Any" in ticket 18) and resolving a theme name — curated,
// Random Words, or Random Theme alike — to its word array or qualifying
// word count. This is the only module that knows the pool's shape (a
// theme-name -> word-list map, curated themes imported directly, Random
// Words fetched, Random Theme resolved to whichever curated theme it
// last rolled); ui.js imports it for its puzzle-start word selection, and
// start-screen.js stays generic (it takes theme names and a
// getWordCountMax(gridSize, theme) callback — wordCountMaxFor below — as
// options instead of importing or fetching theme data itself, or even
// knowing which theme names are special; see that module's header
// comment).
//
// Random Theme's resolution (ticket 18): picking *which* curated theme it
// rolls is pure logic delegated to random-theme.js's resolveRandomTheme.
// This module owns the *state* — which curated theme it last resolved to
// — and *when* to re-roll it, via handleThemeSelection below, called by
// start-screen.js's onThemeChange hook both on an actual theme-radio
// change and on every start-screen re-entry (ticket 18's reroll timing:
// re-rolls on selection and on re-entering the start screen while still
// selected, but NOT on a grid-size change).
//
// Rendering, Pointer Events selection, and screen navigation are *not*
// this module's concern; those stay in ui.js.

import { THEMES } from './data/themes.js';
import { getWordCountMax, RANDOM_POOL_WORD_COUNT_MAX } from './game-logic.js';
import { resolveRandomTheme } from './random-theme.js';

export const RANDOM_WORDS_NAME = 'Random Words';
export const RANDOM_THEME_NAME = 'Random Theme';
const RANDOM_WORDS_URL = 'data/random-words.json';

export const CURATED_THEME_NAMES = Object.keys(THEMES);

// Display order (ticket 18): Random Words, then Random Theme, then the
// curated themes. The start screen's *default* checked option is decoupled
// from this order — see ui.js's use of CURATED_THEME_NAMES[0] as
// initStartScreen's explicit `defaultTheme`.
export const THEME_NAMES = [RANDOM_WORDS_NAME, RANDOM_THEME_NAME, ...CURATED_THEME_NAMES];

// Populated by loadRandomWords() before the start screen is interactive,
// so every synchronous lookup below (poolFor, poolSizeFor) can treat
// Random Words' pool exactly like a curated theme's — no async creeping
// into callers. Stays [] (an empty, always-valid pool) if the fetch
// fails, so a network hiccup degrades to "Random Words has 0 qualifying
// words" rather than crashing start-up.
let randomWordsPool = [];

// The curated theme "Random Theme" is currently resolved to (ticket 18).
// Starts pointed at the first curated theme so poolFor/poolSizeFor never
// see an unresolved value even before the player has ever selected
// "Random Theme"; handleThemeSelection reassigns it for real the moment
// "Random Theme" actually becomes (or stays) the selected option.
let resolvedRandomTheme = CURATED_THEME_NAMES[0];

/**
 * Fetches the pre-generated Random Words pool. Static JSON, fetched once
 * at start-up — no npm package, build step, or server-side code at
 * runtime (per spec.md's Random Words word data decision). Also updates
 * this module's internal pool so subsequent poolFor/poolSizeFor calls
 * see the fetched words.
 */
export async function loadRandomWords() {
  try {
    const response = await fetch(RANDOM_WORDS_URL);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const words = await response.json();
    randomWordsPool = Array.isArray(words) ? words : [];
  } catch (error) {
    console.error(`Failed to load ${RANDOM_WORDS_URL}:`, error);
    randomWordsPool = [];
  }
  return randomWordsPool;
}

/**
 * Re-resolves "Random Theme" to a freshly-picked curated theme when
 * `theme` is RANDOM_THEME_NAME; a no-op for every other theme name
 * (RANDOM_WORDS_NAME and every curated theme included). Intended to be
 * passed straight through as start-screen.js's `onThemeChange` hook —
 * that module calls it with whichever theme is currently selected both
 * when the theme radio changes and whenever the start screen is
 * (re-)entered, without itself knowing which theme name is special.
 */
export function handleThemeSelection(theme) {
  if (theme === RANDOM_THEME_NAME) {
    resolvedRandomTheme = resolveRandomTheme(CURATED_THEME_NAMES);
  }
}

/** The curated theme "Random Theme" is currently resolved to (ticket 18);
 * ui.js reads this for the puzzle header's theme label when the player
 * started via "Random Theme". */
export function resolvedThemeName() {
  return resolvedRandomTheme;
}

/** Looks up `theme`'s word pool: curated themes directly, Random Words'
 * fetched pool, or Random Theme's currently resolved curated theme. */
export function poolFor(theme) {
  if (theme === RANDOM_WORDS_NAME) return randomWordsPool;
  if (theme === RANDOM_THEME_NAME) return THEMES[resolvedRandomTheme] ?? [];
  return THEMES[theme] ?? [];
}

/** Size of `theme`'s word pool that actually qualifies for `gridSize`
 * (i.e. fits within it). This is the generic "pool size" input to
 * getWordCountMax — looking the pool up by theme name here rather than
 * hardcoding one list means switching themes on the start screen
 * recomputes the cap against the newly selected theme's own word
 * count. Random Words and Random Theme need no special case here since
 * poolFor already resolves either to the right word list. */
export function poolSizeFor(gridSize, theme) {
  return poolFor(theme).filter((word) => word.length <= gridSize).length;
}

/**
 * The word-count max the start screen should offer for `gridSize` +
 * `theme`, combining poolSizeFor with the right ceiling table:
 * RANDOM_POOL_WORD_COUNT_MAX for Random Words (its fully-random words
 * lack the letter correlation curated themes have, so it needs a lower
 * ceiling at some grid sizes — see that constant's comment in
 * game-logic.js), GRID_SIZE_WORD_COUNT_MAX for every curated theme *and*
 * for Random Theme (ticket 18: it reuses whichever curated theme it
 * resolved to's own ceiling unchanged — no separate ceiling table). This
 * is the only place that needs to know which theme is the uncorrelated
 * one — start-screen.js stays theme-agnostic and just calls this.
 */
export function wordCountMaxFor(gridSize, theme) {
  const maxMap = theme === RANDOM_WORDS_NAME ? RANDOM_POOL_WORD_COUNT_MAX : undefined;
  return getWordCountMax(gridSize, poolSizeFor(gridSize, theme), maxMap);
}
