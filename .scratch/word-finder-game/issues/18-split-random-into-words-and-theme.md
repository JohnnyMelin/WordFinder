# 18: Split Random into Random Words + Random Theme

**What to build:** The current "Random/Any" option (a single, generic ~15,600-word npm-backed pool, unrelated to any curated theme) becomes two distinct start-screen options:

- **Random Words** — the exact same generic word-list pool and behavior as today's "Random/Any", just relabeled.
- **Random Theme** — a new option that, on selection, resolves to one Curated Theme chosen uniformly at random (repeats of the same theme across consecutive rounds are allowed — no exclusion logic) and generates the puzzle exactly as if that theme had been picked directly, reusing its existing word pool and word-count ceiling logic unchanged (no new ceiling table needed).

The theme resolves (rolls) at the moment the "Random Theme" option is selected, and rerolls every time the start screen is (re-)entered while "Random Theme" is still the checked option — including returning via "New Puzzle" — so repeat plays don't silently reuse the same rolled theme. Changing grid size while "Random Theme" is selected does *not* reroll it; the already-resolved theme persists and only its word-count max is recomputed for the new grid size.

The start screen's theme list is reordered to: Random Words, then Random Theme, then the curated themes. The default checked option on page load stays a specific curated theme regardless of this new list order (i.e. default selection is decoupled from list position, not simply "first item").

This ticket does not include hiding which theme "Random Theme" resolved to — the puzzle header's theme label continues to display it exactly like any other theme, unconditionally (see ticket 19 for hiding it behind a reveal button).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] "Random/Any" is renamed to "Random Words" everywhere it's user-facing; its behavior (pool source, word-count ceiling) is unchanged
- [x] A new "Random Theme" option appears in the start screen's theme list
- [x] Selecting "Random Theme" resolves to one curated theme chosen uniformly at random from all currently available curated themes
- [x] The resolved theme's own word pool and word-count ceiling apply (no separate ceiling table for Random Theme)
- [x] The resolved theme persists across grid-size changes (no reroll), with the word-count max recomputed for the new grid size against the same resolved theme
- [x] Re-entering the start screen (e.g. via "New Puzzle") while "Random Theme" is still checked rerolls to a new resolved theme
- [x] Repeats (the same theme resolving on consecutive rolls) are allowed — no exclusion of the immediately-previous pick
- [x] Start screen's theme list order is: Random Words, Random Theme, then curated themes
- [x] The default checked option on page load is a specific curated theme, regardless of the new list order
- [x] Puzzles generated via "Random Theme" play correctly end-to-end (placement, selection, win), with the puzzle header showing the resolved theme's name unconditionally (same as any curated theme, for now)
