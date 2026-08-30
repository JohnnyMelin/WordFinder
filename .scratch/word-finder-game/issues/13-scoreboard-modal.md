# 13: Scoreboard modal (browsable UI)

**What to build:** A "View Scoreboards" modal that lets the player browse saved top-9 scores at any time, reachable both from the start screen (before playing) and from the win screen (right after finishing). The modal has one tab per grid size (6x6, 10x10, 20x20), each listing that board size's saved entries: rank, name, score, word count used, and date achieved.

**Blocked by:** 12 (needs real persisted scoreboard data to display)

**Status:** ready-for-agent

- [ ] A "View Scoreboards" control on the start screen opens the modal without starting a puzzle
- [ ] A "View Scoreboards" control on the win screen opens the same modal
- [ ] The modal has three tabs, one per grid size, switchable without leaving the modal
- [ ] Each tab lists its grid size's saved entries in rank order, showing rank, name, score, word count used, and date achieved
- [ ] A grid size with no saved scores yet shows a sensible empty state rather than an error or blank area
- [ ] The modal can be dismissed and returns the player to whichever screen (start or win) they opened it from
