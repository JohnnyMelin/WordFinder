# 06: Random/Any theme

**What to build:** A "Random/Any" theme option, completing the full theme set from the spec. Word data comes from a dev-only, one-off Node script (not part of the deployed app) that reads the `word-list` npm package (~15,600 words, MIT licensed), filters to 3-14 letters, and writes a static `data/random-words.json` checked into the repo. The deployed site fetches that static JSON exactly like a curated theme file — no npm package, build step, or server-side code at runtime or deploy time. "Random/Any" is added to the start screen's theme selector as a seventh option, with word-count capping applying the same as any curated theme.

**Blocked by:** 05 (extends the theme selector and reuses the same data-loading path curated themes established)

**Status:** ready-for-agent

- [ ] A one-off, dev-only Node script generates `data/random-words.json` from the `word-list` npm package, filtered to 3-14 letters
- [ ] The generation script is not invoked at deploy time or app runtime — it's a manual/dev step producing a checked-in static file
- [ ] "Random/Any" appears as a seventh option in the start screen's theme selector
- [ ] Selecting Random/Any and starting the puzzle draws words from `data/random-words.json`
- [ ] Word-count capping applies correctly for Random/Any same as curated themes
- [ ] Puzzles generated from Random/Any play correctly end-to-end (placement, selection, win)
- [ ] Deployed app still requires no build step and loads no npm packages at runtime
