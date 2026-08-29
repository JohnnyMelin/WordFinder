# 04: Start screen: grid size & word count

**What to build:** A start screen that precedes the puzzle screen. The player picks a grid size (6x6 Easy, 10x10 Medium, 20x20 Hard) and a word count via a numeric selector. The word-count selector's max follows the grid size (6x6→6, 10x10→30, 20x20→50), and is dynamically capped further down to whatever the active word pool can actually supply, so an under-stocked pool never produces an error. Starting the game from this screen feeds the chosen grid size and word count into the engine from tickets 01-03, so the generated puzzle reflects what the player picked (still using the placeholder word list — theme selection is not part of this ticket).

**Blocked by:** 03 (needs the full engine and playable puzzle screen to hand configuration into)

**Status:** ready-for-agent

- [ ] Start screen lets the player choose grid size: 6x6, 10x10, or 20x20
- [ ] Start screen lets the player choose word count via a numeric selector, min 1
- [ ] Word-count max updates to match the chosen grid size (6/30/50)
- [ ] Word-count max is further capped to the available pool size when the pool has fewer qualifying words, with no error in that case
- [ ] Starting the puzzle from this screen produces a grid of the chosen size with the chosen number of words placed
- [ ] Returning to/reconfiguring the start screen and starting again produces a puzzle matching the new configuration
