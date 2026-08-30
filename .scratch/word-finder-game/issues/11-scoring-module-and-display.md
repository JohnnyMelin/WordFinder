# 11: Scoring module + score display on win

**What to build:** A new, pure, dependency-free scoring module (no DOM, no `localStorage`) that computes a numeric score from grid size, word count, and elapsed time — rewarding a faster finish, and giving a bigger board or more words a higher score ceiling. On winning a puzzle, feed it the frozen elapsed time from the timer (ticket 10) along with the puzzle's grid size and word count, and display the resulting score to the player. This module also contains the pure top-9 ranking/insertion logic that a later ticket will use for the scoreboard, so both pieces of scoring logic land together and get unit tests now — but no persistence or scoreboard UI happens in this ticket.

**Blocked by:** 10 (needs a real, trustworthy elapsed time to score against)

**Status:** ready-for-agent

- [ ] A new dependency-free module computes a score from grid size, word count, and elapsed time, with no DOM or storage dependency
- [ ] The score increases as elapsed time decreases, for a fixed grid size and word count
- [ ] The score increases as grid size or word count increases, for a fixed elapsed time
- [ ] A safety floor on elapsed time prevents a near-zero elapsed time from producing a runaway or infinite score
- [ ] The same module exposes pure top-9 ranking/insertion logic: given an existing list of entries and a new entry, it returns the updated list (sorted descending by score, capped at 9) and whether the new entry qualified — with no knowledge of `localStorage` or the DOM
- [ ] Unit tests (in the style of `game-logic.test.js` / `file-protocol-warning.test.js`) cover the score formula's monotonic behavior, the elapsed-time floor, and the ranking logic's qualify/reject/sort/cap behavior at the 9-entry boundary
- [ ] On winning a puzzle, the score is computed from the frozen timer value and displayed to the player on the win screen
