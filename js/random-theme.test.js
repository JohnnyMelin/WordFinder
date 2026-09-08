import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveRandomTheme } from './random-theme.js';

test('resolveRandomTheme: resolves to the only theme in a single-item list', () => {
  assert.equal(resolveRandomTheme(['Vehicles']), 'Vehicles');
});

test('resolveRandomTheme: an injected random source picks the corresponding index', () => {
  const themes = ['Vehicles', 'Animals', 'Sports'];

  assert.equal(resolveRandomTheme(themes, () => 0), 'Vehicles');
  assert.equal(resolveRandomTheme(themes, () => 0.34), 'Animals');
  assert.equal(resolveRandomTheme(themes, () => 0.99), 'Sports');
});

test('resolveRandomTheme: every theme in the list gets picked across enough runs', () => {
  const themes = ['Vehicles', 'Animals', 'Sports'];
  const seen = new Set();

  for (let run = 0; run < 200; run++) {
    seen.add(resolveRandomTheme(themes));
  }

  assert.deepEqual([...seen].sort(), [...themes].sort());
});

test('resolveRandomTheme: throws on an empty list', () => {
  assert.throws(() => resolveRandomTheme([]), TypeError);
});
