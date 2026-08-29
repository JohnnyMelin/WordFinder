# 01: Walking skeleton: generate & render a single-direction puzzle

**What to build:** The project scaffold and the `game-logic.js` / UI module boundary that every later ticket builds on. Plain HTML/CSS/ES modules, no build step. `generatePuzzle` places the requested word count from a small hardcoded placeholder list (one theme, ~15-20 words) horizontally-forward only (no other directions, no overlap logic yet) into a fixed 10x10 grid, filling remaining cells with random letters. The puzzle screen renders the resulting grid and the word list. No selection interaction yet — this ticket proves the data flows from engine to screen.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `generatePuzzle` is a dependency-free function (no DOM access) living in its own module, taking a word list and grid size and returning a grid + placements
- [ ] Words are placed horizontally, left-to-right, at non-overlapping positions
- [ ] All non-word cells are filled with random filler letters, no blank cells
- [ ] Unit tests cover: requested word count gets placed, each placed word is readable left-to-right at its recorded position, all cells are filled
- [ ] The puzzle screen loads in a browser with no build step and renders the generated grid as a letter grid
- [ ] The word list is rendered alongside the grid
