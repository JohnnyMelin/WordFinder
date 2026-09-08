// random-theme.js
//
// Pure resolution logic for the "Random Theme" start-screen option
// (ticket 18): picks one curated theme name uniformly at random from a
// list of theme names. No DOM, no state, no knowledge of *when* to
// re-resolve (reroll-on-start-screen-reentry, persist-across-grid-size-
// change) — that timing lives in start-screen.js, verified by hand in a
// browser like the rest of that module.

/**
 * Picks one theme name from `themeNames`, uniformly at random.
 *
 * @param {string[]} themeNames - non-empty list of curated theme names to
 *   choose from.
 * @param {() => number} [random] - source of randomness; defaults to
 *   Math.random. Injectable so callers can pin the outcome in tests.
 * @returns {string} the chosen theme name.
 */
export function resolveRandomTheme(themeNames, random = Math.random) {
  if (!Array.isArray(themeNames) || themeNames.length === 0) {
    throw new TypeError('resolveRandomTheme: themeNames must be a non-empty array');
  }
  const index = Math.floor(random() * themeNames.length);
  return themeNames[index];
}
