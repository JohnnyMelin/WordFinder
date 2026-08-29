# 05: Curated themes

**What to build:** All six hand-authored curated word lists — Vehicles, Animals, Food, Countries, Sports, Colors — each ~100 words spanning 3-14 letters, stored as static data shipped with the app. A theme selector is added to the start screen alongside grid size and word count, replacing the placeholder list with the chosen curated theme's data. Word-count capping (from ticket 04) reacts correctly as the player switches themes.

**Blocked by:** 04 (extends the start screen's config controls and capping behavior)

**Status:** ready-for-agent

- [ ] Six curated word lists exist as static data: Vehicles, Animals, Food, Countries, Sports, Colors
- [ ] Each list has ~100 words, all within the 3-14 letter range
- [ ] Start screen has a theme selector offering all six curated themes
- [ ] Starting the puzzle uses the selected theme's word list as the source pool
- [ ] Switching themes on the start screen updates the word-count selector's cap to match the new theme's qualifying word count
- [ ] Puzzles generated from each theme play correctly end-to-end (placement, selection, win)
