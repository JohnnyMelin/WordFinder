// generate-random-words.js
//
// One-off, dev-only generation script for the "Random/Any" theme's word
// pool (ticket 06). NOT part of the deployed app, NOT imported by
// ui.js/index.html, and NOT run at deploy time or app runtime — a
// developer runs this manually (`node scripts/generate-random-words.js`)
// whenever the word pool needs regenerating, and its output
// (`data/random-words.json`) is committed to the repo as a static build
// artifact, exactly like the hand-authored lists in js/data/themes.js are
// hand-authored build artifacts.
//
// Source: the `word-list` npm package (MIT licensed, sindresorhus/word-list),
// installed as a devDependency. It exports (default export) the filesystem
// path to a newline-delimited words.txt file — see its readme:
//
//   import wordListPath from 'word-list';
//   const wordArray = fs.readFileSync(wordListPath, 'utf8').split('\n');
//
// Filtering: strictly 3-14 letters (the same hard bound the spec places on
// every hidden word, curated or random, so no word can span edge-to-edge
// even on a 20x20 grid), alphabetic-only (A-Z after uppercasing — a basic
// sanity pass per the ticket; the installed package's words.txt already
// contains no punctuation/digits, but this guards against that changing
// upstream). Output is uppercased to match js/data/themes.js's casing
// convention.
//
// Note on word count vs. spec.md's "~15,600 words" estimate: the currently
// published `word-list` version (4.1.0, the version confirmed reachable
// via this repo's npm-workaround) ships a much larger source list
// (~274k raw entries, ~264k after the 3-14/alphabetic filter) than the
// spec's estimate, which appears to describe an older release of the
// package. Rather than shipping a multi-megabyte static JSON fetched at
// runtime, this script randomly samples the filtered list down to
// TARGET_COUNT (matching the spec's original ~15,600 estimate) so the
// Random/Any theme's asset stays a comparable order of magnitude to the
// package's originally-intended size, and to a lesser extent the curated
// themes (~100 words each) it's meant to sit alongside.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import wordListPath from 'word-list';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'random-words.json');

const MIN_LENGTH = 3;
const MAX_LENGTH = 14;
const ALPHA_ONLY = /^[A-Za-z]+$/;
const TARGET_COUNT = 15600;

function main() {
  const raw = fs.readFileSync(wordListPath, 'utf8');
  const rawWords = raw.split('\n').filter(Boolean);

  const filtered = rawWords
    .filter((word) => ALPHA_ONLY.test(word))
    .filter((word) => word.length >= MIN_LENGTH && word.length <= MAX_LENGTH)
    .map((word) => word.toUpperCase());

  // De-dupe defensively (the source list has none, but uppercasing could
  // theoretically collapse two distinct entries onto the same word).
  const deduped = Array.from(new Set(filtered));

  const words = sample(deduped, TARGET_COUNT).sort();

  verify(words);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(words));

  console.log(`Read ${rawWords.length} raw words from word-list.`);
  console.log(`Filtered to ${deduped.length} words (3-14 letters, alphabetic, deduped).`);
  console.log(`Sampled down to ${words.length} words, wrote to ${path.relative(process.cwd(), OUTPUT_PATH)}.`);
}

/** Fisher-Yates partial shuffle, returns the first `count` entries. */
function sample(list, count) {
  if (list.length <= count) return list.slice();
  const pool = list.slice();
  for (let i = pool.length - 1; i > pool.length - 1 - count; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(pool.length - count);
}

/**
 * Throwaway verification (per the ticket's testing note: this script isn't
 * part of the deployed/tested app surface, so a full test suite isn't
 * warranted, but the final output must be checked before committing).
 * Confirms every word in the final list is 3-14 letters and alphabetic-only.
 */
function verify(words) {
  if (!Array.isArray(words) || words.length === 0) {
    throw new Error('verify: word list is empty');
  }
  for (const word of words) {
    if (typeof word !== 'string' || !ALPHA_ONLY.test(word)) {
      throw new Error(`verify: "${word}" is not alphabetic-only`);
    }
    if (word.length < MIN_LENGTH || word.length > MAX_LENGTH) {
      throw new Error(`verify: "${word}" is ${word.length} letters (must be ${MIN_LENGTH}-${MAX_LENGTH})`);
    }
    if (word !== word.toUpperCase()) {
      throw new Error(`verify: "${word}" is not uppercase`);
    }
  }
  console.log(`Verified: all ${words.length} words are ${MIN_LENGTH}-${MAX_LENGTH} letters, alphabetic-only, uppercase.`);
}

main();
