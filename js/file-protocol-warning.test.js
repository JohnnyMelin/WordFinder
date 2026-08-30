import { test } from 'node:test';
import assert from 'node:assert/strict';

// Side-effect import: file-protocol-warning.js is a classic script (see
// its header comment for why), not an ES module, so it has no export —
// importing it runs the `globalThis.fileProtocolWarning = ...` assignment
// the same way loading it via a plain <script> tag would in the browser.
import './file-protocol-warning.js';

const { fileProtocolWarning } = globalThis;

test('warns when the page is opened as a file:// URL', () => {
  assert.equal(
    fileProtocolWarning('file:'),
    'This page won’t work when opened directly from a file. Serve this folder over ' +
      'http(s) instead — e.g. run "npx serve ." (or "python -m http.server") from the ' +
      'project folder and open the URL it prints.'
  );
});

test('stays silent when the page is served over http or https', () => {
  assert.equal(fileProtocolWarning('http:'), null);
  assert.equal(fileProtocolWarning('https:'), null);
});
