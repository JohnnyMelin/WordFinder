# 12: Scoreboard persistence + arcade name entry

**What to build:** On winning a puzzle, check the computed score against its grid size's top-9 list using the ranking logic from ticket 11. If it qualifies, prompt the player arcade-style for a short name, then save the entry (name, score, word count used, date achieved) to `localStorage`, keyed to that puzzle's grid size. If it doesn't qualify, the player still sees their score (per ticket 11) with no rank shown, and nothing is written to storage. Each grid size (6x6, 10x10, 20x20) maintains its own independent top-9 list.

**Blocked by:** 11 (needs the computed score and the ranking/insertion logic)

**Status:** ready-for-agent

- [x] Finishing a puzzle with a top-9-qualifying score (for that puzzle's grid size) prompts the player for a short name before saving
- [x] The entry — name, score, word count used, date achieved — is saved to the `localStorage` list matching the puzzle's grid size
- [x] A non-qualifying score is not saved, and the player is not prompted for a name
- [x] The three grid sizes' lists are independent of each other, each capped at 9 entries, with the lowest-scoring entry evicted when a new one qualifies
- [x] Reloading the page preserves previously saved scoreboard entries
