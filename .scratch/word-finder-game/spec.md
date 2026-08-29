Status: ready-for-agent

# Word Finder Game

## Problem Statement

The user wants a classic word-search puzzle game they can play in a browser: pick a grid size, a theme, and how many words to hunt for, then find those words hidden in a letter grid by dragging across them. Nothing like this exists in the repo yet — it's a fresh build.

## Solution

A static, buildless web app (plain HTML/CSS/JS) with two screens:

1. **Start screen** — configure grid size/difficulty, theme, and word count.
2. **Puzzle screen** — a generated letter grid plus a word list; the player selects words by click-drag (mouse) or touch-drag, matched words highlight and get marked off, and the game announces a win once every word is found.

## User Stories

1. As a player, I want to choose a grid size (6x6 Easy, 10x10 Medium, 20x20 Hard), so that I can pick a difficulty that matches how much time/challenge I want.
2. As a player, I want to choose a theme (Vehicles, Animals, Food, Countries, Sports, Colors, or Random/Any), so that the puzzle's words match something I'm interested in.
3. As a player, I want to choose how many words are hidden in the grid, so that I can control puzzle length.
4. As a player, I want the word-count selector to respect a per-grid-size maximum (6x6→6, 10x10→30, 20x20→50), so that the puzzle stays legible and words fit without crowding.
5. As a player picking a theme with too few qualifying words, I want the word-count selector to silently cap itself to what's available, so that I never hit an error just from an unlucky theme/size combo.
6. As a player, I want every hidden word to be between 3 and 14 letters regardless of grid size, so that even in a 20x20 grid no single word spans edge-to-edge (which wouldn't be fun to spot).
7. As a player who picks a curated theme, I want the words drawn from a hand-authored, curated list for that theme, so that the words are actually thematic and recognizable (not random dictionary noise).
8. As a player who picks Random/Any, I want words pulled from a broad general word list (word-list npm package), filtered to 3-14 letters, so that I get variety without needing a themed list.
9. As a player, I want words placed horizontally, vertically, or diagonally, in either forward or reversed reading order (8 directions total), so that the puzzle has the classic word-search feel.
10. As a player, I want overlapping words to share coinciding letters where possible, so that the grid feels dense and hand-crafted rather than sparse.
11. As a player, I want every cell not used by a placed word filled with a random filler letter, so that the whole grid is full of letters, not blank space.
12. As a player, I want to select a word by pressing and dragging across its letters (mouse) or touching and dragging (touch device), so that I can play on desktop or mobile.
13. As a player, I want a correct selection to visually highlight in the grid and mark that word off the word list, so that I get immediate feedback and can track progress.
14. As a player, I want to be told when I've found all the words, so that I know the puzzle is complete.
15. As a player, I do not expect a timer, hint system, score, or save/resume progress in this version, so that the MVP stays focused and simple.
16. As a player, I do not expect to type in my own custom word list in this version, so that theme selection is the only way to pick puzzle content for now.

## Implementation Decisions

- **Test seam**: a single dependency-free JS module (e.g. `game-logic.js`) with no DOM access, exposing puzzle generation and selection-checking as pure functions. All rendering, Pointer Events wiring, and screen transitions live in a separate UI layer that calls into this module. This is the only seam the codebase needs — the UI layer is verified by playing the game in a browser, not by unit tests.
  - `generatePuzzle({ theme, gridSize, wordCount })` → `{ grid, placements }`, where `grid` is a 2D array of letters and `placements` records each placed word's cells/direction.
  - `checkSelection(placements, selectedCells)` → the matched word (or `null`), tolerant of a selection made in either direction along the word's line.
- **Selection input**: Pointer Events (not separate mouse/touch handlers), so click-drag and touch-drag share one code path.
- **Curated word data**: one hand-authored list per curated theme (Vehicles, Animals, Food, Countries, Sports, Colors), ~100 words each, 3-14 letters, stored as static data (e.g. `data/<theme>.json` or a JS module) shipped with the app.
- **Random/Any word data**: generated ahead of time, not at runtime. A one-off Node script (dev-only, not part of the deployed app, not run on every load) reads the `word-list` npm package (~15,600 words, MIT licensed), filters to 3-14 letters, and writes a static `data/random-words.json` checked into the repo. The deployed site fetches this static JSON like any other theme file — no npm package, no build step, no server-side code at runtime or deploy time.
- **Word count capping**: when a theme (curated or random) has fewer qualifying words (3-14 letters) than the grid size's max, the start screen's word-count selector's max is dynamically set to the smaller of the two — never allow a count the theme can't fulfill.
- **Placement algorithm**: attempt each word in a random one of 8 directions at a random position; allow placement over existing letters only where they match (supporting overlaps); on failed attempts, retry with a new direction/position up to a reasonable attempt limit, then fall back to placing without requiring overlap. Remaining empty cells get random filler letters (A-Z) after all words are placed.
- **No framework, no bundler**: plain HTML/CSS/JS files, ES modules loaded directly via `<script type="module">`, deployable as static files with no build tooling.

## Testing Decisions

- Good tests here exercise `game-logic.js`'s external behavior only — given inputs, assert on the returned grid/placements/match result — never assert on internal implementation details like which random position/direction a word landed at.
- Modules tested: `generatePuzzle` and `checkSelection` (or equivalent pure functions) in `game-logic.js`.
- Coverage to include: requested word count actually gets placed (respecting theme/size caps), every placed word is findable by reading its claimed direction out of the grid, no two placed words' overlapping cells conflict (same letter at the shared cell), all non-word cells are filled, and `checkSelection` correctly matches a drag made in either direction along a placed word's line and correctly rejects a non-matching drag.
- No prior art in this repo (fresh project) — the test runner/framework choice is left to the implementing agent, picking whatever is simplest to run against a plain-JS ES module with no DOM dependency (e.g. Node's built-in test runner) so the "no build step" deploy story isn't compromised by test-only tooling.
- UI layer (rendering, Pointer Events, screen flow) is verified manually by playing the game in a browser, not by automated tests.

## Out of Scope

- Timer, hints, scoring, save/resume progress (all deferred to v2 per plan.md).
- Custom typed-in word list (deferred to v2 per plan.md).
- Additional themes beyond the six curated ones + Random/Any.
- Any server-side component, build pipeline, or bundler for the deployed app.
- Automated/visual regression testing of the UI/rendering layer.

## Further Notes

- Source spec: `plan.md` at the repo root (unchanged by this spec; this file is the actionable synthesis of it).
- This is a fresh repo with no existing code, so there are no existing seams to prefer over the one proposed above.

## Comments
