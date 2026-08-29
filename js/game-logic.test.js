import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generatePuzzle, checkSelection, getWordCountMax } from './game-logic.js';
import { PLACEHOLDER_WORDS } from './data/placeholder-words.js';

const SAMPLE_WORDS = ['CAT', 'DOG', 'LION', 'TIGER', 'ZEBRA'];

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
  assert.equal(getWordCountMax(10, 16), 16);
  assert.equal(getWordCountMax(20, 16), 16);
});

test('getWordCountMax caps down to the grid size\'s max even when the pool is bigger', () => {
  assert.equal(getWordCountMax(6, 500), 6);
  assert.equal(getWordCountMax(10, 500), 30);
  assert.equal(getWordCountMax(20, 500), 50);
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
