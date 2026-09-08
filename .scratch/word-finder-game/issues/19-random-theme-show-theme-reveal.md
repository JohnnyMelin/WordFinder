# 19: Hide Random Theme's identity behind a Show Theme button

**What to build:** For puzzles generated via the "Random Theme" option (ticket 18), the puzzle header's "Theme: ___" label is suppressed rather than shown unconditionally. Instead, a "Show Theme" button appears above the word list ("Find these words" panel). Clicking it reveals the resolved theme's name by filling in the existing header label and then removing the button. Curated Themes and Random Words puzzles are unaffected — their theme label continues to display immediately, exactly as before. Winning the puzzle does not auto-reveal the theme; it stays hidden unless the player manually clicks "Show Theme", and the button remains available after a win.

**Blocked by:** 18 (requires the "Random Theme" option and its resolution mechanic to exist)

**Status:** ready-for-agent

- [x] Starting a puzzle via "Random Theme" leaves the header's theme label empty/hidden instead of showing the resolved theme name
- [x] A "Show Theme" button appears above the word list only for Random Theme puzzles
- [x] Clicking "Show Theme" fills in the header's theme label with the resolved theme's name and removes the button
- [x] Curated Themes and Random Words puzzles are unaffected: their theme label still displays immediately and unconditionally, with no "Show Theme" button
- [x] Winning a Random Theme puzzle without clicking "Show Theme" does not reveal the theme automatically; the button remains available post-win
