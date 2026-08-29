import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { generatePuzzle, checkSelection, getWordCountMax, GRID_SIZE_WORD_COUNT_MAX } from './game-logic.js';
import { THEMES } from './data/themes.js';

// The pre-generated Random/Any word pool (see data/random-words.json's
// generating script, scripts/generate-random-words.js). Loaded straight
// off disk with fs/URL rather than imported as JSON, since this is a
// plain-JS test file with no JSON-module loader configured.
const RANDOM_WORDS = JSON.parse(
  readFileSync(new URL('../data/random-words.json', import.meta.url), 'utf8')
);

const SAMPLE_WORDS = ['CAT', 'DOG', 'LION', 'TIGER', 'ZEBRA'];

// A small, fixed word list for tests that just need "a bunch of real
// short-to-medium words", without depending on a bespoke fixture file.
// Used to be its own hardcoded list (js/data/placeholder-words.js, from
// ticket 01's walking skeleton); once ticket 05 replaced the UI's use of
// it with the curated theme data, it was only ever imported by this test
// file, so it was retired in favor of slicing the real Animals data below.
const PLACEHOLDER_WORDS = THEMES.Animals.slice(0, 16);

// Per-step (row, col) vector for each of the 8 direction names
// `generatePuzzle` can record on a placement (see game-logic.js's
// DIRECTIONS table). Kept independently here (not imported) so the tests
// verify the *contract* — "this direction name means this vector" — not
// just that the engine is internally consistent with itself.
const DIRECTION_VECTORS = {
  E: { dRow: 0, dCol: 1 },
  W: { dRow: 0, dCol: -1 },
  S: { dRow: 1, dCol: 0 },
  N: { dRow: -1, dCol: 0 },
  SE: { dRow: 1, dCol: 1 },
  SW: { dRow: 1, dCol: -1 },
  NE: { dRow: -1, dCol: 1 },
  NW: { dRow: -1, dCol: -1 },
};

test('places every requested word', () => {
  const { placements } = generatePuzzle(SAMPLE_WORDS, 10);

  assert.equal(placements.length, SAMPLE_WORDS.length);
  assert.deepEqual(
    placements.map((p) => p.word).sort(),
    [...SAMPLE_WORDS].sort()
  );
});

test('every placed word is readable along its claimed direction from its recorded position', () => {
  // Run several times since direction/position are randomized per word.
  for (let run = 0; run < 30; run++) {
    const { grid, placements } = generatePuzzle(SAMPLE_WORDS, 10);

    for (const placement of placements) {
      const vector = DIRECTION_VECTORS[placement.direction];
      assert.ok(vector, `"${placement.word}" has unknown direction "${placement.direction}"`);
      assert.equal(placement.cells.length, placement.word.length);

      // Every recorded cell must sit exactly `i` steps along the claimed
      // direction's vector from the first cell — i.e. `cells` really does
      // trace a straight line in that direction, not just some run of
      // matching letters.
      const first = placement.cells[0];
      for (let i = 0; i < placement.cells.length; i++) {
        assert.equal(placement.cells[i].row, first.row + vector.dRow * i);
        assert.equal(placement.cells[i].col, first.col + vector.dCol * i);
      }

      const readOut = placement.cells.map(({ row, col }) => grid[row][col]).join('');
      assert.equal(readOut, placement.word);
    }
  }
});

test('words are placed in all 8 directions across enough runs', () => {
  const seenDirections = new Set();

  for (let run = 0; run < 40; run++) {
    const { placements } = generatePuzzle(PLACEHOLDER_WORDS, 10);
    for (const { direction } of placements) {
      seenDirections.add(direction);
    }
  }

  assert.deepEqual(
    [...seenDirections].sort(),
    Object.keys(DIRECTION_VECTORS).sort(),
    'expected every one of the 8 directions to show up at least once across many runs'
  );
});

test('overlapping placements never conflict: a shared cell has the same letter for every word that uses it', () => {
  for (let run = 0; run < 30; run++) {
    const { placements } = generatePuzzle(PLACEHOLDER_WORDS, 10);
    const letterAtCell = new Map();

    for (const { word, cells } of placements) {
      for (let i = 0; i < cells.length; i++) {
        const key = `${cells[i].row},${cells[i].col}`;
        const letter = word[i];
        if (letterAtCell.has(key)) {
          assert.equal(
            letterAtCell.get(key),
            letter,
            `cell ${key} disagrees between overlapping words (got "${letter}" from "${word}")`
          );
        } else {
          letterAtCell.set(key, letter);
        }
      }
    }
  }
});

test('crossing words actually overlap and are each independently readable', () => {
  // A dense word list (10 short, letter-sharing words) in a small grid
  // makes overlap likely; run it several times and require at least one
  // run to show real overlap, so this test would fail if overlap support
  // silently regressed into "always find a fully empty spot" behavior.
  const DENSE_WORDS = ['ANT', 'BAT', 'CAT', 'RAT', 'HAT', 'MAT', 'SAT', 'PAT', 'FAT', 'OAT'];
  let sawOverlap = false;

  for (let run = 0; run < 15 && !sawOverlap; run++) {
    const { grid, placements } = generatePuzzle(DENSE_WORDS, 6);

    assert.equal(placements.length, DENSE_WORDS.length, 'all dense words still get placed');

    const usedCells = new Set();
    let totalCellUses = 0;
    for (const { cells } of placements) {
      totalCellUses += cells.length;
      for (const { row, col } of cells) {
        usedCells.add(`${row},${col}`);
      }
    }
    if (usedCells.size < totalCellUses) sawOverlap = true;

    // Regardless of whether this particular run overlapped, every word
    // must still read correctly along its own claimed direction.
    for (const placement of placements) {
      const vector = DIRECTION_VECTORS[placement.direction];
      const readOut = placement.cells.map(({ row, col }) => grid[row][col]).join('');
      assert.equal(readOut, placement.word);
      assert.ok(vector);
    }
  }

  assert.equal(sawOverlap, true, 'expected at least one run of a dense word list to produce an overlapping placement');
});

test('all cells are filled with a letter, no blanks', () => {
  const { grid } = generatePuzzle(SAMPLE_WORDS, 10);

  for (const row of grid) {
    for (const cell of row) {
      assert.equal(typeof cell, 'string');
      assert.match(cell, /^[A-Z]$/);
    }
  }
});

test('grid dimensions match the requested size', () => {
  const { grid } = generatePuzzle(SAMPLE_WORDS, 10);

  assert.equal(grid.length, 10);
  for (const row of grid) {
    assert.equal(row.length, 10);
  }
});

test('normalizes word casing to uppercase', () => {
  const { placements } = generatePuzzle(['cat', 'Dog'], 10);

  assert.deepEqual(
    placements.map((p) => p.word).sort(),
    ['CAT', 'DOG']
  );
});

test('the full placeholder word list places into a 10x10 grid without error', () => {
  const { grid, placements } = generatePuzzle(PLACEHOLDER_WORDS, 10);

  assert.equal(placements.length, PLACEHOLDER_WORDS.length);
  assert.equal(grid.length, 10);
});

test('throws when a word cannot possibly fit in the grid', () => {
  assert.throws(() => generatePuzzle(['LONGERWORDTHANGRID'], 10));
});

test('checkSelection matches a selection made in the word\'s own reading order', () => {
  const placements = [
    { word: 'CAT', direction: 'horizontal', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] },
    { word: 'DOG', direction: 'horizontal', cells: [{ row: 2, col: 4 }, { row: 2, col: 5 }, { row: 2, col: 6 }] },
  ];

  const match = checkSelection(placements, [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
  ]);

  assert.equal(match, 'CAT');
});

test('checkSelection matches a selection made in the reverse direction along the word\'s line', () => {
  const placements = [
    { word: 'CAT', direction: 'horizontal', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] },
  ];

  const match = checkSelection(placements, [
    { row: 0, col: 2 },
    { row: 0, col: 1 },
    { row: 0, col: 0 },
  ]);

  assert.equal(match, 'CAT');
});

test('checkSelection returns no match for a selection that does not correspond to any placed word', () => {
  const placements = [
    { word: 'CAT', direction: 'horizontal', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] },
  ];

  const match = checkSelection(placements, [
    { row: 5, col: 0 },
    { row: 5, col: 1 },
    { row: 5, col: 2 },
  ]);

  assert.equal(match, null);
});

test('checkSelection returns no match for a partial (subset) selection of a placed word', () => {
  const placements = [
    { word: 'TIGER', direction: 'horizontal', cells: [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }] },
  ];

  const match = checkSelection(placements, [
    { row: 1, col: 0 },
    { row: 1, col: 1 },
    { row: 1, col: 2 },
  ]);

  assert.equal(match, null);
});

test('checkSelection works end-to-end against a generated puzzle, in either direction', () => {
  const { placements } = generatePuzzle(SAMPLE_WORDS, 10);
  const target = placements[0];

  const forwardMatch = checkSelection(placements, target.cells);
  assert.equal(forwardMatch, target.word);

  const reverseMatch = checkSelection(placements, [...target.cells].reverse());
  assert.equal(reverseMatch, target.word);
});

test('getWordCountMax uses the grid size\'s own max when the pool is large enough', () => {
  assert.equal(getWordCountMax(6, 16), 6);
  assert.equal(getWordCountMax(10, 8), 8);
  assert.equal(getWordCountMax(20, 16), 16);
});

// Ticket 07: these grid-size maxes (6/10/45) were re-tuned down from the
// original spec numbers (6/30/50) — see GRID_SIZE_WORD_COUNT_MAX's doc
// comment in game-logic.js for why, and the "generatePuzzle succeeds
// reliably..." stress tests below for the empirical evidence.
test('getWordCountMax caps down to the grid size\'s max even when the pool is bigger', () => {
  assert.equal(getWordCountMax(6, 500), 6);
  assert.equal(getWordCountMax(10, 500), 10);
  assert.equal(getWordCountMax(20, 500), 45);
});

test('getWordCountMax never hardcodes a pool size: it tracks whatever poolSize is passed in', () => {
  assert.equal(getWordCountMax(10, 1), 1);
  assert.equal(getWordCountMax(10, 0), 0);
  assert.equal(getWordCountMax(20, 3), 3);
});

test('getWordCountMax throws for an unsupported grid size', () => {
  assert.throws(() => getWordCountMax(7, 10), RangeError);
});

test('getWordCountMax throws for an invalid pool size', () => {
  assert.throws(() => getWordCountMax(10, -1), TypeError);
  assert.throws(() => getWordCountMax(10, 1.5), TypeError);
});

// --- Ticket 07: reliability stress tests ---------------------------------
//
// The whole point of ticket 07 is that `generatePuzzle` must not just
// *usually* succeed at the word counts the start screen can actually
// offer (GRID_SIZE_WORD_COUNT_MAX, per grid size) — it must reliably
// succeed, every time, for every theme. A handful of runs isn't a strong
// enough signal for that (a placement algorithm with even a small
// failure rate can look perfect across ten runs and still fail for
// real players); these tests run each grid-size-at-its-own-max scenario
// many times and assert zero failures across the whole batch.
//
// `pickWords` below deliberately mirrors ui.js's `pickWords` (shuffle
// the theme pool, drop words longer than the grid, take the first N) —
// it's re-implemented here rather than imported because ui.js touches
// `document` at module load time (see spec.md's testing decision: the
// UI layer isn't unit-tested, only played manually), so this keeps the
// stress test exercising game-logic.js's public contract with exactly
// the kind of word selection the real app will actually feed it.
function pickWords(pool, gridSize, wordCount) {
  const eligible = pool.filter((word) => word.length <= gridSize);
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, wordCount);
}

// A representative sample of themes, not all six (per ticket 07's
// scope) — chosen to stress the algorithm, not just confirm the easy
// cases: Sports and Vehicles are data/themes.js's longest-word-skewed
// lists (many 8-14 letter words, e.g. "PADDLEBOARDING", "STATIONWAGON"),
// which is exactly the profile that made 30-into-10x10 fail 100% of the
// time before this ticket's fix, so they're the themes most likely to
// expose a regression. Animals is included as a more typical/shorter
// mixed-length profile for contrast.
const STRESS_THEMES = ['Sports', 'Vehicles', 'Animals'];

// Iterations per (grid size, theme) case. Lower for 20x20 than for 6x6
// and 10x10 — not because it's less important, but because each
// generatePuzzle call is inherently pricier on a 400-cell grid with up
// to 45 words, so fewer runs are needed to keep the whole suite's
// runtime reasonable while this remains a meaningful reliability signal
// (see this describe block's intro comment).
const STRESS_ITERATIONS_BY_GRID_SIZE = {
  6: 300,
  10: 300,
  20: 100,
};

for (const gridSize of Object.keys(GRID_SIZE_WORD_COUNT_MAX).map(Number)) {
  const wordCount = GRID_SIZE_WORD_COUNT_MAX[gridSize];
  const iterations = STRESS_ITERATIONS_BY_GRID_SIZE[gridSize];

  for (const theme of STRESS_THEMES) {
    test(`generatePuzzle succeeds reliably at ${gridSize}x${gridSize}'s word-count max (${wordCount}) with the ${theme} theme (${iterations} runs)`, () => {
      const pool = THEMES[theme];
      const poolSize = pool.filter((word) => word.length <= gridSize).length;
      const actualWordCount = getWordCountMax(gridSize, poolSize);
      assert.ok(
        actualWordCount > 0,
        `expected the ${theme} theme to have at least one word <= ${gridSize} letters`
      );

      let failures = 0;
      let firstError = null;

      for (let i = 0; i < iterations; i++) {
        const words = pickWords(pool, gridSize, actualWordCount);
        try {
          const { placements } = generatePuzzle(words, gridSize);
          assert.equal(
            placements.length,
            words.length,
            'every requested word must actually be placed, not silently dropped'
          );
        } catch (error) {
          failures++;
          if (!firstError) firstError = error;
        }
      }

      assert.equal(
        failures,
        0,
        `expected 0 failures placing ${actualWordCount} ${theme} words into a ${gridSize}x${gridSize} grid across ${iterations} runs, got ${failures}` +
          (firstError ? ` (first error: ${firstError.message})` : '')
      );
    });
  }
}

// --- Random/Any smoke test -------------------------------------------
//
// STRESS_THEMES above deliberately excludes Random/Any. spec.md's
// "Known limitation (deferred, not fixed)" note (under Further Notes)
// documents a rare but real multi-second worst-case latency in
// generatePuzzle specifically for Random/Any's fully-random word
// samples at high word counts — measured up to 26s at 20x20/45 words —
// because generic random words lack the letter-correlation curated
// theme words have. That's a known, deliberately deferred finding, not
// something to paper over by running Random/Any through the same
// hundreds-of-iterations stress test as the curated themes above: that
// would make this suite unacceptably slow and would still only be a
// partial characterization of a highly variable worst case.
//
// This test instead closes the narrower gap that Random/Any is never
// exercised by generatePuzzle *at all*: a small, fixed handful of runs
// (not hundreds) at 20x20's word-count max — the grid size/theme
// combination the known limitation is about — asserting only that
// generation eventually succeeds. This is NOT a timing assertion and
// NOT a reliability guarantee at scale; see spec.md's Known Limitation
// note for the latency caveat this deliberately does not attempt to fix
// or fully characterize.
const RANDOM_ANY_SMOKE_ITERATIONS = 5;

test(
  `generatePuzzle succeeds with a Random/Any word sample at 20x20's word-count max ` +
    `(${RANDOM_ANY_SMOKE_ITERATIONS} runs, deliberately small — see spec.md's Known Limitation note)`,
  () => {
    const gridSize = 20;
    const poolSize = RANDOM_WORDS.filter((word) => word.length <= gridSize).length;
    const wordCount = getWordCountMax(gridSize, poolSize);
    assert.ok(wordCount > 0, 'expected the Random/Any pool to have at least one word <= 20 letters');

    for (let i = 0; i < RANDOM_ANY_SMOKE_ITERATIONS; i++) {
      const words = pickWords(RANDOM_WORDS, gridSize, wordCount);
      const { placements } = generatePuzzle(words, gridSize);
      assert.equal(
        placements.length,
        words.length,
        'every requested word must actually be placed, not silently dropped'
      );
    }
  }
);
