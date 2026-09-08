import { test } from 'node:test';
import assert from 'node:assert/strict';

import { THEMES } from './themes.js';

// Structural contract every curated theme's word list must satisfy
// (themes.js's header comment, tickets 05/14/15/16/17): ~100 real,
// correctly-spelled words, each a single alphabetic token strictly 3-14
// letters, stored uppercase, no duplicates within a theme. This module
// can't verify "real, recognizable, correctly-spelled" (that's a human
// authoring judgment), but everything mechanically checkable is
// enforced here — generically, over whatever themes exist, so it's the
// seam new theme batches (tickets 14-17) are authored against: adding a
// theme name to THEMES with no data (or malformed data) fails these
// tests, authoring it correctly turns them green.
const MIN_WORD_LENGTH = 3;
const MAX_WORD_LENGTH = 14;
const WORD_PATTERN = new RegExp(`^[A-Z]{${MIN_WORD_LENGTH},${MAX_WORD_LENGTH}}$`);

// "~100" per the spec — tolerant enough to allow natural hand-authoring
// variance (the original six themes range from exactly 100 to 103) without
// accepting a theme that's really a different size in disguise.
const MIN_THEME_SIZE = 90;
const MAX_THEME_SIZE = 115;

for (const [themeName, words] of Object.entries(THEMES)) {
  test(`${themeName}: has approximately 100 words`, () => {
    assert.ok(
      words.length >= MIN_THEME_SIZE && words.length <= MAX_THEME_SIZE,
      `expected ${themeName} to have ${MIN_THEME_SIZE}-${MAX_THEME_SIZE} words, got ${words.length}`
    );
  });

  test(`${themeName}: every word is a single alphabetic token, 3-14 letters, uppercase`, () => {
    const offenders = words.filter((word) => !WORD_PATTERN.test(word));
    assert.deepEqual(offenders, [], `${themeName} has malformed words: ${offenders.join(', ')}`);
  });

  test(`${themeName}: has no duplicate words`, () => {
    const seen = new Set();
    const duplicates = [];
    for (const word of words) {
      if (seen.has(word)) duplicates.push(word);
      seen.add(word);
    }
    assert.deepEqual(duplicates, [], `${themeName} has duplicate words: ${duplicates.join(', ')}`);
  });
}

test('every curated theme name is unique', () => {
  const names = Object.keys(THEMES);
  assert.equal(new Set(names).size, names.length);
});
