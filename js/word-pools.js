// word-pools.js
//
// Pool-loading/resolution concern extracted out of ui.js: fetching the
// Random/Any word pool from data/random-words.json (ticket 06) and
// resolving a theme name — curated or Random/Any alike — to its word
// array or qualifying word count. This is the only module that knows
// the pool's shape (a theme-name -> word-list map, curated themes
// imported directly, Random/Any fetched); ui.js imports it for its
// puzzle-start word selection, and start-screen.js stays generic (it
// takes theme names and a getWordCountMax(gridSize, theme) callback —
// wordCountMaxFor below — as options instead of importing or fetching
// theme data itself, or even knowing which theme is the uncorrelated one
// that needs a different ceiling table; see that module's header
// comment).
//
// Rendering, Pointer Events selection, and screen navigation are *not*
// this module's concern; those stay in ui.js.

import { THEMES } from './data/themes.js';
import { getWordCountMax, RANDOM_POOL_WORD_COUNT_MAX } from './game-logic.js';

export const RANDOM_THEME_NAME = 'Random/Any';
const RANDOM_WORDS_URL = 'data/random-words.json';

export const THEME_NAMES = [...Object.keys(THEMES), RANDOM_THEME_NAME];

// Populated by loadRandomWords() before the start screen is interactive,
// so every synchronous lookup below (poolFor, poolSizeFor) can treat
// Random/Any's pool exactly like a curated theme's — no async creeping
// into callers. Stays [] (an empty, always-valid pool) if the fetch
// fails, so a network hiccup degrades to "Random/Any has 0 qualifying
// words" rather than crashing start-up.
let randomWordsPool = [];

/**
 * Fetches the pre-generated Random/Any word pool. Static JSON, fetched
 * once at start-up — no npm package, build step, or server-side code at
 * runtime (per spec.md's Random/Any word data decision). Also updates
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

/** Looks up `theme`'s word pool, curated or Random/Any alike. */
export function poolFor(theme) {
  if (theme === RANDOM_THEME_NAME) return randomWordsPool;
  return THEMES[theme] ?? [];
}

/** Size of `theme`'s word pool that actually qualifies for `gridSize`
 * (i.e. fits within it). This is the generic "pool size" input to
 * getWordCountMax — looking the pool up by theme name here rather than
 * hardcoding one list means switching themes on the start screen
 * recomputes the cap against the newly selected theme's own word
 * count. Random/Any (ticket 06) needs no special case here since
 * poolFor already resolves it to the fetched word list. */
export function poolSizeFor(gridSize, theme) {
  return poolFor(theme).filter((word) => word.length <= gridSize).length;
}

/**
 * The word-count max the start screen should offer for `gridSize` +
 * `theme`, combining poolSizeFor with the right ceiling table:
 * RANDOM_POOL_WORD_COUNT_MAX for Random/Any (its fully-random words lack
 * the letter correlation curated themes have, so it needs a lower ceiling
 * at some grid sizes — see that constant's comment in game-logic.js),
 * GRID_SIZE_WORD_COUNT_MAX for every curated theme. This is the only
 * place that needs to know which theme is the uncorrelated one —
 * start-screen.js stays theme-agnostic and just calls this.
 */
export function wordCountMaxFor(gridSize, theme) {
  const maxMap = theme === RANDOM_THEME_NAME ? RANDOM_POOL_WORD_COUNT_MAX : undefined;
  return getWordCountMax(gridSize, poolSizeFor(gridSize, theme), maxMap);
}
