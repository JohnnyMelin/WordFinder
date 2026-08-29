# 03: Full 8-direction placement with overlaps

**What to build:** Extends `generatePuzzle` from ticket 01 to place words in any of the 8 directions (horizontal, vertical, diagonal; forward and reversed) at random positions, retrying on conflicting placements and allowing overlaps where letters coincide so the grid gets the dense, classic word-search feel. Since `checkSelection` from ticket 02 is already direction-tolerant, this ticket is mostly an engine change, but it's verified end-to-end by actually playing a real word search (diagonals, reversed words, crossing words) through the existing selection UI from ticket 02.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `generatePuzzle` places words in a random one of the 8 directions per word
- [ ] Overlapping placements only share a cell where both words' letters agree; conflicting placements are retried (new direction/position) up to a reasonable attempt limit
- [ ] Unit tests cover: words placed in each of the 8 directions are readable along their claimed direction, and overlapping cells never contain a letter conflict
- [ ] Playing the puzzle end-to-end (from ticket 02's selection UI) correctly finds words placed vertically, diagonally, and in reverse
- [ ] Crossing/overlapping words are both independently findable
