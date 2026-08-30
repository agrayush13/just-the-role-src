# JUSTTHEROLE

JUSTTHEROLE is a privacy-first Chrome extension that turns supported LinkedIn Jobs pages into a calmer, personal reading view. It hides recognized page blocks selected by the user, marks words and phrases the user defines, and adds navigation for reliably detected description sections.

The extension is deterministic and visual-only. It does not scrape jobs, summarize or score descriptions, automate LinkedIn actions, collect analytics, store job content, or make extension-initiated network requests.

## Install

[Install JUSTTHEROLE from the Chrome Web Store](https://chromewebstore.google.com/detail/justtherole-clean-job-des/ecojokoikohemnohhccokbbkilpekhff)

## What it does

Focus Mode is off on a fresh install. After the user enables it, JUSTTHEROLE applies one of these views:

Chrome opens the full settings page once after a fresh installation so the available controls are visible. Updates and extension reloads do not reopen it.

- **Balanced** hides supported match, upsell, recommendation, and promotional modules while retaining useful job context.
- **Minimal** keeps the job title, company and location context, original description, and core actions while hiding all supported optional modules.
- **Native** leaves LinkedIn page modules visible while retaining separately enabled reading tools.
- **Custom** is always selectable and recalls one saved set of category choices, independent of the previously selected preset.

On a supported job detail view, the branded in-page Focus Bar appears before the AI/profile-match module when present and lets the user switch views without reloading, edit the saved Custom category choices directly, temporarily show the original page, undo the latest view change, and restore the preset behind a Custom view. It follows the page's light or dark appearance using the extension palette and can be hidden independently from the popup or full settings. If Focus Mode is off while the Focus Bar preference remains on, the bar stays visible with an explicit Enable Focus Mode action. The title, company/location context, Apply, Save, Share, and Report remain protected. About the job can be hidden only through an explicit Custom choice and remains visible in every built-in preset.

Opening the toolbar popup can also activate the bundled content script and stylesheet on an already-open LinkedIn Jobs tab. This covers installation and extension-reload cases without requiring the user to refresh the job page.

Optional reading tools provide:

- Local **Desired**, **Notice**, and **Check** keyword markers using whole-word or exact-phrase matching.
- Match counts without interpretation, ranking, or scoring.
- Jump links and session-only collapse controls when at least two unambiguous English section headings are recognized.

## Privacy and safety

Only extension configuration is stored: the Focus Mode switch, selected view, module choices, keyword rules, reading-tool preferences, and UI preferences such as on-page widget visibility. Chrome Sync is optional and off by default. When enabled, the same configuration—including potentially sensitive keyword rules—may be synchronized through the user's Chrome account; the local copy remains available if Sync fails.

JUSTTHEROLE does not store page text, job URLs, titles, companies, profile or account details, resumes, applications, search terms, browsing history, or derived scores. The manifest requests Chrome storage, narrowly scoped LinkedIn Jobs access, and user-initiated active-tab scripting so the packaged code can activate on an already-open job tab. The content script does not run on non-Jobs paths.

LinkedIn can change its DOM independently. Selectors are centralized and versioned, every candidate is safety-checked independently, and unrecognized structures fail open by remaining visible. Disabling Focus Mode or choosing **Show original** restores all changes to LinkedIn content; the independently enabled Focus Bar may remain available as extension UI.

## Documentation

- [Product requirements](docs/PRD.md) — scope, behavior, non-goals, and acceptance criteria.
- [Product and interaction design](docs/PRODUCT_DESIGN.md) — user journeys, interface behavior, content language, and accessibility.
- [Architecture](docs/ARCHITECTURE.md) — components, runtime flow, DOM safety, storage, and build boundaries.
- [Settings schema](docs/SETTINGS_SCHEMA.md) — persisted data model, preset matrix, normalization, migration, and Sync behavior.
- [Privacy policy](PRIVACY.md) — local processing, storage, Sync, retention, and Limited Use disclosure.
- [Chrome Web Store submission answers](CHROME_WEB_STORE_SUBMISSION.md) — paste-ready privacy declarations and account checklist.

## Local development

Requirements: a current Node.js release, npm, and Chrome 120 or newer.

```sh
npm install
npm run verify
```

Then open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose the generated `dist/` directory.

After every local rebuild, click **Reload** on that exact extension card in `chrome://extensions`. Refreshing LinkedIn alone does not reload the unpacked extension package. Keep only one unpacked JUSTTHEROLE copy enabled and confirm it points to this repository's `dist/` directory; otherwise an older content script can render alongside the current build.

Useful commands:

- `npm run check` — strict TypeScript validation.
- `npm test` — unit and sanitized DOM tests.
- `npm run build` — create the unpacked extension in `dist/`.
- `npm run verify` — run checks, tests, and the production build.
- `npm run chrome-extension` — verify and create a Chrome Web Store archive.

## Chrome Web Store package

```sh
npm run chrome-extension
```

Upload `release/just-the-role-chrome-extension-v<version>.zip`. The packaging script verifies a single root `manifest.json`, checks required assets, and excludes source files, tests, source maps, dependencies, and hidden development files.

## Project structure

```text
src/content/   LinkedIn page detection, safe DOM transformations, and Focus Bar
src/popup/     Toolbar popup and privacy-safe diagnostics
src/options/   Full settings and keyword-rule editor
src/shared/    Settings, matching, escaping, and section-recognition logic
src/privacy/   Packaged privacy disclosure
tests/         Unit tests and sanitized LinkedIn-like fixture
scripts/       Build, fixture-server, and store-package tooling
docs/          Product and engineering documentation
```

## Release validation

`npm run verify` covers settings normalization and migration, presets, storage changes, untrusted-label escaping, selector safety, keyword validation/matching/restoration, a 25,000-character description pass, and conservative section recognition.

Before publishing, also load the unpacked build and validate the selector map against current signed-in LinkedIn job-detail and search views. Automated fixtures cannot guarantee compatibility with markup LinkedIn changes after release.
