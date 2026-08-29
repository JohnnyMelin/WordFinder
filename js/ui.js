// ui.js
//
// UI layer: DOM rendering only. Imports the dependency-free engine
// (game-logic.js) and renders whatever it returns — no puzzle-generation
// logic lives here. This module is verified by loading the page in a
// browser, not by unit tests (see spec.md's Testing Decisions).

import { generatePuzzle } from './game-logic.js';
import { PLACEHOLDER_WORDS, PLACEHOLDER_THEME } from './data/placeholder-words.js';

const GRID_SIZE = 10;

function renderGrid(grid, container) {
  container.replaceChildren();
  container.style.setProperty('--grid-size', String(grid.length));

  for (const row of grid) {
    for (const letter of row) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.textContent = letter;
      container.appendChild(cell);
    }
  }
}

function renderWordList(placements, container) {
  container.replaceChildren();

  for (const { word } of placements) {
    const item = document.createElement('li');
    item.className = 'word-list-item';
    item.textContent = word;
    container.appendChild(item);
  }
}

function init() {
  const { grid, placements } = generatePuzzle(PLACEHOLDER_WORDS, GRID_SIZE);

  const themeLabel = document.getElementById('theme-label');
  if (themeLabel) themeLabel.textContent = PLACEHOLDER_THEME;

  renderGrid(grid, document.getElementById('grid'));
  renderWordList(placements, document.getElementById('word-list'));
}

document.addEventListener('DOMContentLoaded', init);
