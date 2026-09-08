# 14: Add curated themes: Nature batch

**What to build:** Six new hand-authored curated word lists — Space & Astronomy, Weather & Sky, Trees & Plants, Flowers, Insects & Bugs, Herbs & Spices — added to `THEMES` following the exact same authoring rules as the existing six themes (Vehicles, Animals, Food, Countries, Sports, Colors): ~100 real, recognizable, correctly-spelled words each, single alphabetic tokens (no spaces/hyphens), strictly 3-14 letters, stored uppercase. Because the start screen's theme selector and word-count capping already derive generically from `THEMES`, no code changes are needed beyond the data — each new theme becomes selectable and playable automatically.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] All six themes exist as static data in `THEMES`: Space & Astronomy, Weather & Sky, Trees & Plants, Flowers, Insects & Bugs, Herbs & Spices
- [x] Each list has ~100 words, all within the 3-14 letter range, single alphabetic tokens, uppercase
- [x] Each new theme appears as a selectable option in the start screen's theme list
- [x] Word-count capping reacts correctly when switching to/from each new theme
- [x] Puzzles generated from each new theme play correctly end-to-end (placement, selection, win)
