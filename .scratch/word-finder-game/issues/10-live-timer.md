# 10: Live timer

**What to build:** A running, on-screen timer for the puzzle screen. It starts counting the moment the grid is rendered and visible to the player (not when the puzzle starts generating), updates live while the player plays, and stops the instant the last word is found. This ticket is display-only — no scoring is computed yet, this just establishes a trustworthy elapsed-time reading.

**Blocked by:** None (can start immediately; independent of tickets 08/09)

**Status:** ready-for-agent

- [ ] A visible, live-updating timer appears on the puzzle screen
- [ ] The timer starts at the moment the grid is rendered/shown, not when the player clicks "Start Game" on the start screen — puzzle-generation time is never counted
- [ ] The timer keeps counting up while the player plays
- [ ] The timer stops the instant the last word is found (the same moment the win banner appears), and the final elapsed time is available for later use
- [ ] Starting a new puzzle resets the timer back to zero
