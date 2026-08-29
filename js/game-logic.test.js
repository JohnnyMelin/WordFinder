import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generatePuzzle } from './game-logic.js';
import { PLACEHOLDER_WORDS } from './data/placeholder-words.js';

const SAMPLE_WORDS = ['CAT', 'DOG', 'LION', 'TIGER', 'ZEBRA'];

test('places every requested word', () => {
  const { placements } = generatePuzzle(SAMPLE_WORDS, 10);

  assert.equal(placements.length, SAMPLE_WORDS.length);
  assert.deepEqual(
    placements.map((p) => p.word).sort(),
    [...SAMPLE_WORDS].sort()
  );
});

test('every placed word is readable left-to-right at its recorded position', () => {
  const { grid, placements } = generatePuzzle(SAMPLE_WORDS, 10);

  for (const placement of placements) {
    assert.equal(placement.direction, 'horizontal');
    assert.equal(placement.cells.length, placement.word.length);

    const row = placement.cells[0].row;
    for (const cell of placement.cells) {
      assert.equal(cell.row, row, `all cells of "${placement.word}" stay on one row`);
    }
    for (let i = 1; i < placement.cells.length; i++) {
      assert.equal(
        placement.cells[i].col,
        placement.cells[i - 1].col + 1,
        `"${placement.word}" cells are consecutive left-to-right columns`
      );
    }

    const readOut = placement.cells.map(({ row, col }) => grid[row][col]).join('');
    assert.equal(readOut, placement.word);
  }
});

test('placed words occupy disjoint cells (no overlap)', () => {
  const { placements } = generatePuzzle(SAMPLE_WORDS, 10);

  const seen = new Set();
  for (const { cells, word } of placements) {
    for (const { row, col } of cells) {
      const key = `${row},${col}`;
      assert.equal(seen.has(key), false, `cell ${key} used by more than one word (found again in "${word}")`);
      seen.add(key);
    }
  }
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
