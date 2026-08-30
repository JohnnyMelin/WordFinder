# Selection display modes & scoring system

**Status:** ready-for-agent

## Problem Statement

When a puzzle has many overlapping words, the existing found-word display — highlighting every cell of the word — makes the grid hard to read. Once several found words cross paths, their highlighted cells blur together, making it hard for the player to visually isolate the letters that still belong to unfound words. There is also currently no way to measure or compare performance: no timer, no score, and no record of past results, so a finished puzzle has no sense of accomplishment beyond the win banner.

## Solution

Add a second, lower-noise way to mark a found word: instead of highlighting every cell, draw a line connecting only the word's first and last letter. The player can switch between this new "Line" mode and the existing "Highlight" mode via a toggle on the start screen, with their choice remembered between visits.

Alongside this, add a scoring system that rewards solving a puzzle quickly, scaled by how large the board is and how many words had to be found, plus a persistent, arcade-style top-9 scoreboard per board size that the player can check before or after playing.

## User Stories

**Selection display**

1. As a player solving a puzzle with many overlapping words, I want found words marked with a thin line instead of a full highlight, so that I can still visually distinguish the letters that belong to words I haven't found yet.
2. As a player, I want the found-word line to run only between the first and last letter of the word, so that it doesn't obscure the letters in between.
3. As a player, I want found-word lines to be a semi-transparent light gray, so that I can still read the letters underneath the line.
4. As a player who has found many overlapping words, I want multiple crossing found-word lines to look the same as a single line where they overlap, so that dense overlaps don't turn into a dark, illegible tangle.
5. As a player, I want the found-word line to be plain, with no dot or marker at its endpoints, so that the display stays minimal.
6. As a player, I want letter tiles to look exactly like unfound tiles once a word is found (in Line mode), so that the line is the only thing indicating a word was found.
7. As a player currently dragging out a selection, I want to see a live line grow from my starting letter to my current position, so that I get the same kind of feedback as the old tile-by-tile preview but consistent with the new found-word style.
8. As a player, I want the in-progress drag line to appear in a bold, fully-saturated color, so that I can immediately tell it apart from the lighter, transparent lines of already-found words.
9. As a player who prefers the original look, I want a "Highlight" mode that restores full-tile highlighting for both the in-progress drag and found words, so that I can keep playing the way I'm used to.
10. As a player, I want to switch between "Line" and "Highlight" display modes from the start screen, so that I don't have to hunt through a separate settings area to change it.
11. As a returning player, I want my chosen display mode to be remembered the next time I open the game, so that I don't have to reselect it every session.
12. As a new player, I want the game to default to "Line" mode, so that I see the improved display without having to discover the setting myself.

**Timer**

13. As a player, I want to see a running timer once the puzzle grid appears, so that I know how much time I've spent so far.
14. As a player, I want the timer to start only once the grid has actually rendered, so that puzzle-generation time (which I can't act on, particularly on large boards) doesn't count against me.
15. As a player, I want the timer to stop the moment I find the last word, so that my final time reflects only the time I spent actively solving.

**Scoring**

16. As a player, I want my score to be higher the faster I finish a puzzle, so that speed is rewarded.
17. As a player, I want a larger board or a longer word list to raise the amount of score available, so that harder puzzles feel worth more than easy ones even if they take longer to finish.
18. As a player, I want to see my score as soon as I finish the puzzle, so that I get immediate feedback on how I did.

**Scoreboard**

19. As a player, I want a separate top-9 scoreboard for each board size (6x6, 10x10, 20x20), so that I'm only compared against other results from a puzzle of the same difficulty tier.
20. As a player who just finished a puzzle with a top-9 score, I want to be prompted arcade-style to enter a short name, so that my result is recognizable on the scoreboard.
21. As a player, I want to see my score even if it doesn't make the top 9, so that finishing a puzzle always gives me some feedback, not just when I set a record.
22. As a player whose score doesn't make the top 9, I want to see that I didn't place without seeing a specific rank number, so that I get an honest result without a discouraging "you were #47" callout.
23. As a player, I want each scoreboard entry to show the name, score, word count used, and date it was achieved, so that I have context for how a given score was earned.
24. As a player, I want to browse all three scoreboards from the start screen before I've even played, so that I can see what I'm aiming to beat.
25. As a player who just finished a puzzle, I want to browse the scoreboards from the win screen, so that I can immediately see how my result compares.
26. As a player switching between scoreboards, I want to move between the 6x6, 10x10, and 20x20 boards using tabs inside one modal, so that comparing across difficulties doesn't require navigating away from what I'm doing.
27. As a player, I want my scoreboard results saved across sessions on this device, so that they aren't lost when I close the browser.

## Implementation Decisions

- New pure, dependency-free module (`scoring.js`, alongside `game-logic.js` in `js/`) exposes:
  - A `computeScore` function taking grid size, word count, and elapsed time, returning a numeric score using `score = gridSize² × wordCount × K / elapsedSeconds`, where `K` is an internal tuning constant chosen during implementation. Elapsed time is floored to a small minimum before dividing, so a freak near-instant finish can't produce an absurd or infinite score.
  - Pure top-9 ranking/insertion logic that, given an existing list of scoreboard entries and a new entry, returns the updated list (sorted descending by score, truncated to 9 entries) and whether the new entry qualified. This function has no knowledge of `localStorage` or the DOM — it's a plain array transformation.
- Selection/found-word rendering gets two code paths in `ui.js`, switched on the display-mode setting:
  - **Highlight mode**: unchanged — the existing `.selecting`/`.found` CSS-class approach on individual grid cells stays exactly as it is today.
  - **Line mode**: a new rendering path draws lines instead. The in-progress drag renders a live line from the start cell's center to the current cell's center in the app's existing accent color, at full saturation, replacing the `.selecting` class entirely while this mode is active. A confirmed found word renders as a static line between the first and last cell of its placement (`placements[i].cells[0]` and the last entry), in a transparent light gray, with no endpoint markers. Overlapping found-word lines must not visually compound into a darker tangle — this is achieved with a blend mode (e.g. a lines layer using a "lighten"-style blend) so that identical semi-transparent strokes crossing each other render the same as a single stroke.
- The display-mode toggle lives inline on the start screen (alongside the existing grid-size and word-count controls), labeled with a "Highlight" option for the classic mode. The chosen mode is persisted in `localStorage` and defaults to Line mode when no stored preference exists.
- Timer: elapsed time is measured starting the moment the grid is rendered and shown on the puzzle screen (i.e., right after `renderGrid` runs in `startPuzzle`), displayed live, and stops the moment the win condition is reached (the same point `markWordFound` currently detects all words found). The frozen elapsed time and the current grid size/word count feed into `computeScore` to produce the game's score, shown on the win screen.
- Scoreboard persistence uses `localStorage`, keyed per grid size (three independent lists, one per board size), each holding up to 9 entries `{ name, score, wordCount, date }`. Reads and writes go through a small set of named helper functions rather than scattered inline calls, so a future swap to a backend-backed store only requires changing those functions' internals.
- On a win, the game checks (via the pure ranking logic in `scoring.js`) whether the score qualifies for its grid size's top 9. If it does, the player is prompted for a short name (arcade high-score style) before the entry is written to `localStorage`. If it doesn't qualify, the player still sees their score on the win screen, with no rank shown, and nothing is written to storage.
- A "View Scoreboards" modal is reachable both from the start screen and the win screen, with tabs for the three grid sizes; each tab lists that board size's top-9 entries (rank, name, score, word count, date). No in-game "record to beat" indicator is shown during play.

## Testing Decisions

A good test here exercises externally observable behavior (inputs/outputs of a pure function), not internal implementation details — consistent with how this codebase already tests `game-logic.js` and `file-protocol-warning.js`.

- `scoring.test.js` (new, `node:test` + `node:assert`, no DOM) covers:
  - `computeScore`: score increases as elapsed time decreases (fixed grid size/word count); score increases as grid size or word count increases (fixed elapsed time); the elapsed-time floor prevents runaway or infinite scores on a near-zero elapsed time.
  - The ranking/insertion logic: a new entry that beats an existing 9th-place entry qualifies and displaces it; a new entry that doesn't beat the current 9th place doesn't qualify and leaves the stored list unchanged; the returned list stays sorted descending and capped at 9 entries; inserting into a list with fewer than 9 entries always qualifies.
  - Prior art: `js/game-logic.test.js` and `js/file-protocol-warning.test.js` — both test small, pure, DOM-free modules this way, run via `npm test` (`node --test`).
- Everything else introduced by this spec — the line/blend-mode rendering, the live drag-preview line, the Highlight/Line toggle, the timer display, the name-entry prompt, the scoreboard modal, and the actual `localStorage` reads/writes — is DOM- and browser-environment-dependent UI code. Per the existing documented convention in `ui.js` ("this module is verified by loading the page in a browser, not by unit tests"), this layer is verified manually: loading the page, playing through puzzles at each board size, toggling display modes, forcing many overlapping words to check the line/blend-mode behavior, and checking scoreboard behavior at the top, middle, and 9th/10th-place boundary.

## Out of Scope

- A backend or server-side scoreboard — only local, per-device `localStorage` persistence ships now, structured so a backend can be swapped in later.
- Cross-device or cross-browser score syncing.
- A "clear scores" / reset control for the scoreboard.
- A live "record to beat" indicator shown during gameplay.
- Segmenting the scoreboard by word count (only grid size) — a single board size's leaderboard mixes different word counts, with the score formula accounting for the difference.
- Endpoint markers/dots on found-word or drag-preview lines.
- Per-word line coloring (all found-word lines share one uniform style).
- Hints, mistakes/wrong-guess penalties, or other mechanics already excluded from MVP per `plan.md`.
- Score tie-breaking rules beyond natural descending sort order.
- Name input validation/moderation beyond a basic length limit.

## Further Notes

- This spec was produced through an interactive `/grill-me` session; the key rationale behind less-obvious decisions:
  - Line mode's uniform color (rather than per-word coloring) was a deliberate simplification — the goal is decluttering so unfound words stay legible, not making individual found words individually distinguishable from each other.
  - The blend-mode approach for non-additive overlaps was chosen as an implementation detail to satisfy an explicit requirement ("a letter's visibility must stay the same no matter how many lines cross it"), not something requiring further design input.
  - Per-board-size (rather than unified) scoreboards were chosen because comparing a 6x6 result against a 20x20 result isn't meaningful even with a normalizing formula.
  - The exact value of `K` in the scoring formula is an internal tuning constant with no functional impact on the design and can be adjusted freely during implementation/playtesting.
- Relevant existing files: `js/ui.js` (grid/word-list rendering, selection handling, win detection), `js/game-logic.js` (puzzle engine, placements), `js/start-screen.js` (start-screen controls), `css/styles.css` (existing `.selecting`/`.found` styles to be joined by the new Line-mode styles).
