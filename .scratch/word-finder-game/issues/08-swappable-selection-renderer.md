# 08: Extract selection-rendering into a swappable renderer

**What to build:** Refactor the puzzle screen's selection/found-word display so the drag-preview and found-word marking go through a single, swappable renderer instead of being hard-coded to toggling `.selecting`/`.found` CSS classes inline. This is a pure prefactor: the game must look and behave exactly as it does today. It exists so a later ticket can add a second, alternate renderer (a line-based display) without touching the pointer-event/selection logic itself.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Dragging a selection still shows the existing full-tile highlight preview, cell by cell, exactly as today
- [ ] Confirming a found word still highlights its cells and strikes through its entry in the word list, exactly as today
- [ ] The win banner still appears once every word is found, exactly as today
- [ ] The preview/found-word rendering logic used by the selection-handling code is encapsulated behind one renderer object/interface, rather than inline class-toggling scattered through the selection handlers
- [ ] No new user-visible behavior is introduced by this ticket
