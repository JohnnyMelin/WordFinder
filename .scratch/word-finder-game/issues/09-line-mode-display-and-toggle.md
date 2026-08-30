# 09: Line-mode display + start-screen toggle

**What to build:** A second selection-display mode ("Line"), an inline toggle on the start screen to choose between it and today's "Highlight" mode, and persistence of that choice across sessions.

In Line mode: dragging a selection shows a live line, in a bold fully-saturated color, growing from the start letter to the current letter, instead of a full-tile highlight. Confirming a found word replaces that line with a static line running only between the word's first and last letter, drawn in a transparent light gray, with no endpoint markers and no other tile highlighting. Where multiple found-word lines cross, the overlap must not visually darken beyond a single line's color — a letter's legibility stays the same no matter how many lines cross it.

In Highlight mode, behavior is unchanged from today (full-tile highlighting for both drag preview and found words).

**Blocked by:** 08 (needs the swappable renderer the selection-handling code renders through)

**Status:** ready-for-agent

- [x] A toggle on the start screen lets the player choose "Line" or "Highlight" mode before starting a puzzle, labeled so the classic full-tile mode reads as "Highlight"
- [x] In Line mode, dragging a selection shows a live, fully-saturated line from the start cell to the current cell instead of a full-tile highlight
- [x] In Line mode, confirming a found word shows a static, transparent light-gray line from the word's first to last letter, with no endpoint markers; letter tiles show no other highlight
- [x] In Line mode, many overlapping found-word lines remain visually a single consistent light gray where they cross — no compounding/darkening
- [x] In Highlight mode, drag preview and found-word display are unchanged from today's behavior
- [x] The chosen mode is persisted (e.g. via `localStorage`) and restored on the next visit
- [x] With no stored preference (first visit), the game defaults to Line mode
