// file-protocol-warning.js
//
// Pure decision logic for the file:// start-up warning: whether the page
// was opened directly (double-clicked) rather than served over http(s),
// and if so, what to tell the player. Browsers block `<script
// type="module">` from loading over file://, so opening index.html this
// way leaves the start screen's grid-size/theme fields empty and Start
// inert with no feedback (see .scratch/word-finder-game for the reported
// bug) — and that exact restriction is why this file can't be an ES
// module either: index.html needs to run this check from a plain classic
// <script> (the one kind of script that *does* survive file://), so this
// exposes its decision as a `globalThis` global instead of an `export`.
// The inline <script> in index.html is a thin caller: it reads
// window.location.protocol, calls this function, and applies the result
// to the DOM (untested, per this repo's convention that DOM application
// is verified by playing the game — see ui.js's header comment). This
// module is unit-tested via that same global.
//
// Node loads this file the same way the browser does: importing it for
// its side effect runs the assignment below, since `globalThis` is the
// same object Node's global scope and a browser's `window` both expose.

globalThis.fileProtocolWarning = function fileProtocolWarning(protocol) {
  if (protocol !== 'file:') return null;

  return (
    'This page won’t work when opened directly from a file. Serve this folder over ' +
    'http(s) instead — e.g. run "npx serve ." (or "python -m http.server") from the ' +
    'project folder and open the URL it prints.'
  );
};
