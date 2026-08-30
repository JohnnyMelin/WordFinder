import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeScore, rankEntries } from './scoring.js';

test('computeScore: score increases as elapsed time decreases (fixed gridSize/wordCount)', () => {
  const slow = computeScore({ gridSize: 10, wordCount: 10, elapsedSeconds: 120 });
  const medium = computeScore({ gridSize: 10, wordCount: 10, elapsedSeconds: 60 });
  const fast = computeScore({ gridSize: 10, wordCount: 10, elapsedSeconds: 30 });

  assert.ok(fast > medium);
  assert.ok(medium > slow);
});

test('computeScore: score increases as gridSize increases (fixed wordCount/elapsedSeconds)', () => {
  const small = computeScore({ gridSize: 6, wordCount: 10, elapsedSeconds: 60 });
  const medium = computeScore({ gridSize: 10, wordCount: 10, elapsedSeconds: 60 });
  const large = computeScore({ gridSize: 20, wordCount: 10, elapsedSeconds: 60 });

  assert.ok(medium > small);
  assert.ok(large > medium);
});

test('computeScore: score increases as wordCount increases (fixed gridSize/elapsedSeconds)', () => {
  const few = computeScore({ gridSize: 10, wordCount: 5, elapsedSeconds: 60 });
  const many = computeScore({ gridSize: 10, wordCount: 20, elapsedSeconds: 60 });

  assert.ok(many > few);
});

test('computeScore: the elapsed-time floor prevents a runaway or infinite score', () => {
  const atFloor = computeScore({ gridSize: 10, wordCount: 10, elapsedSeconds: 1 });
  const zero = computeScore({ gridSize: 10, wordCount: 10, elapsedSeconds: 0 });
  const nearZero = computeScore({ gridSize: 10, wordCount: 10, elapsedSeconds: 0.001 });

  assert.ok(Number.isFinite(zero));
  assert.ok(Number.isFinite(nearZero));
  // Anything at or below the floor should score exactly the same as the
  // floor itself — dropping below it must not buy any extra score.
  assert.equal(zero, atFloor);
  assert.equal(nearZero, atFloor);
});

test('computeScore: realistic inputs produce a reasonable (non-astronomical) score', () => {
  const score = computeScore({ gridSize: 10, wordCount: 10, elapsedSeconds: 60 });

  assert.ok(score > 0);
  assert.ok(score < 100000);
});

function makeEntries(scores) {
  return scores.map((score, i) => ({ name: `p${i}`, score, wordCount: 10, date: '2026-01-01' }));
}

test('rankEntries: inserting into a list with fewer than 9 entries always qualifies', () => {
  const existing = makeEntries([500, 400, 300]);
  const newEntry = { name: 'new', score: 1, wordCount: 10, date: '2026-01-01' };

  const { entries, qualified } = rankEntries(existing, newEntry);

  assert.equal(qualified, true);
  assert.equal(entries.length, 4);
  assert.ok(entries.includes(newEntry));
});

test('rankEntries: a new entry beating the existing 9th place qualifies and displaces it', () => {
  const existing = makeEntries([900, 800, 700, 600, 500, 400, 300, 200, 100]);
  const newEntry = { name: 'new', score: 150, wordCount: 10, date: '2026-01-01' };

  const { entries, qualified } = rankEntries(existing, newEntry);

  assert.equal(qualified, true);
  assert.equal(entries.length, 9);
  assert.ok(entries.includes(newEntry));
  assert.ok(!entries.some((e) => e.score === 100));
});

test("rankEntries: a new entry that doesn't beat 9th place doesn't qualify and leaves the list unchanged", () => {
  const existing = makeEntries([900, 800, 700, 600, 500, 400, 300, 200, 100]);
  const newEntry = { name: 'new', score: 50, wordCount: 10, date: '2026-01-01' };

  const { entries, qualified } = rankEntries(existing, newEntry);

  assert.equal(qualified, false);
  assert.deepEqual(entries, existing);
  assert.ok(!entries.includes(newEntry));
});

test('rankEntries: the result stays sorted descending by score', () => {
  const existing = makeEntries([300, 100, 500, 200]);
  const newEntry = { name: 'new', score: 400, wordCount: 10, date: '2026-01-01' };

  const { entries } = rankEntries(existing, newEntry);

  const scores = entries.map((e) => e.score);
  const sortedDesc = [...scores].sort((a, b) => b - a);
  assert.deepEqual(scores, sortedDesc);
});

test('rankEntries: the result is capped at exactly 9 entries even when starting from 9', () => {
  const existing = makeEntries([900, 800, 700, 600, 500, 400, 300, 200, 100]);
  const newEntry = { name: 'new', score: 1000, wordCount: 10, date: '2026-01-01' };

  const { entries, qualified } = rankEntries(existing, newEntry);

  assert.equal(qualified, true);
  assert.equal(entries.length, 9);
  assert.equal(entries[0], newEntry);
});
