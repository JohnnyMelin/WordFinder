# Word Finder Game

## Platform & Stack
- Web app: plain HTML/CSS/JS, no framework, no build step — deploys as static files
- Selection input via Pointer Events, so click-drag works with both mouse and touch

## Start Screen
Player configures a puzzle before it's generated:
- **Grid size / difficulty**: 6x6 (Easy), 10x10 (Medium), 20x20 (Hard)
- **Theme**: Vehicles, Animals, Food, Countries, Sports, Colors, or Random/Any
- **Word count**: numeric selector, min 1, max per grid size:
  - 6x6 → max 6
  - 10x10 → max 30
  - 20x20 → max 50
  - If the chosen theme doesn't have enough qualifying words to hit the max, the selector is dynamically capped to what's available (never errors)

## Word Data
- **Curated themes** (Vehicles, Animals, Food, Countries, Sports, Colors): hand-authored word lists, ~100 words each, spanning 3-14 letters
- **Random/Any**: pulled from the `word-list` npm package (~15,600 words, MIT license, profanity mostly pre-filtered), filtered to 3-14 letters
- Word length range is 3-14 letters across all grid sizes, even 20x20 — a word spanning the full grid edge-to-edge isn't fun to spot

## Puzzle Generation
- The chosen number of words (from the chosen theme) are placed in the grid
- Directions: horizontal, vertical, diagonal — both forward and reversed (8 directions total)
- Words may overlap/cross where letters coincide (denser, classic word-search feel)
- Remaining cells filled with random filler letters

## Gameplay
- Player selects a word by click-drag (mouse) or touch-drag across letters
- Correctly selected words are highlighted in the grid and marked off the word list
- **Win condition**: all words in the list have been found

## MVP Scope (v1)
- No timer, no hints, no scoring, no save/resume progress
- No custom typed-in word list (see Future)

## Future / v2 Ideas
- Scoring system
- Custom typed word list (player supplies their own words directly, bypassing themes)
- Hints, timer
- Additional themes
