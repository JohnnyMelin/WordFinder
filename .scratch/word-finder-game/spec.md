# Deploy to GitHub Pages

**Status:** ready-for-agent

## Problem Statement

The game only runs locally today — playing it requires cloning the repo and running `npx serve .`. There's no URL a player can just open in a browser, and no way for the game to be "always accessible" without someone's machine serving it.

## Solution

Publish the game to GitHub Pages at the repo's default subdomain, with no custom domain. Since the repo mixes real site assets with dev-only files (specs, tickets, docs, scripts, test files sitting next to their source), the deploy doesn't serve the repo root as-is — a GitHub Actions workflow builds a filtered artifact containing only the files the game actually needs at runtime, then publishes that via `actions/upload-pages-artifact` + `actions/deploy-pages`.

The workflow is manually triggered rather than running on every push, and only allowed to run from `master`, so publishing a new version of the live site is always a deliberate action taken against the repo's known-good branch — never an accidental side effect of pushing a work-in-progress ticket branch. It also only publishes if `npm test` passes, so a broken merge can't take the live site down.

## User Stories

1. As a player, I want to open a stable URL in my browser and play the game, so that I don't need to clone the repo or run any local server to play.
2. As a player, I want that URL to work at any time, so that the game feels like a real, always-on website rather than something that only runs while a developer's machine is serving it.
3. As the maintainer, I want the published site to contain only the files the game needs at runtime, so that dev-only files (specs, tickets, docs, scripts, package manifests, test files) aren't served to the public just because they happen to live in the same repo.
4. As the maintainer, I want to trigger a new deploy manually rather than have every push to `master` auto-publish, so that I decide exactly when the live site changes.
5. As the maintainer, I want the deploy workflow to refuse to run unless it's triggered from `master`, so that I can never accidentally publish an in-progress ticket branch to the public site.
6. As the maintainer, I want the deploy to only proceed if `npm test` passes, so that a broken merge can't take the live site down.
7. As the maintainer, I want the live site's URL to be the free GitHub Pages subdomain, so that I don't have to buy or configure a custom domain to get an always-accessible site.

## Implementation Decisions

- **Platform**: GitHub Pages, using the modern Actions-based deployment (`actions/upload-pages-artifact` + `actions/deploy-pages`), not the legacy "serve a branch/folder" mode — the repo has no `gh-pages` branch and doesn't need one.
- **Trigger**: `workflow_dispatch` only (no `push` trigger). The workflow's first step checks `github.ref == 'refs/heads/master'` and fails immediately if the workflow was run from any other branch.
- **Test gate**: the workflow runs `npm test` (Node's built-in test runner, already configured as the `test` script) before the build/publish steps; a failing test run stops the workflow before anything is deployed.
- **Filtered artifact via explicit include-list**: before uploading the Pages artifact, a build step copies exactly these paths into a staging directory (nothing else):
  - `index.html`
  - `css/styles.css`
  - `js/*.js`, excluding every `js/*.test.js` file (`js/` currently holds runtime modules and their `*.test.js` files side by side, e.g. `game-logic.js` next to `game-logic.test.js`)
  - `js/data/themes.js`
  - `data/random-words.json`

  This is an include-list rather than an exclude-list on purpose: the repo already shows a pattern of dropping new `*.test.js` files directly next to their source, so an exclude-list of dev paths would need continual upkeep to avoid leaking new test files. An include-list only needs a one-line addition when a genuinely new runtime asset is added, which is rarer.
- **Domain**: the default GitHub Pages project subdomain (`https://<owner>.github.io/WordFinder/`). No custom domain.
- **One-time manual setup (not part of the workflow code)**: the repo currently has no Pages configuration at all. Before the workflow can succeed, `Settings → Pages → Source` must be set to `GitHub Actions` in the GitHub repo settings — this can't be done from a workflow file and is a prerequisite the maintainer does once by hand.
- **Out of scope**: no auto-deploy on push, no preview/staging deploys for in-progress branches, no custom domain, no CDN/analytics configuration beyond what GitHub Pages provides by default.
