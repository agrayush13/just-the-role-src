# JustTheRole

A privacy-first Chrome extension that turns supported LinkedIn Jobs views into a personal focus layer.

Phase 2 remains deterministic and visual-only: no scraping, remote analytics, automation, summaries, scoring, job-data storage, or extension-initiated network requests.

## Phase 2 features

- Balanced, Minimal, Native, and automatically created Custom presets
- Schema-v2 migration that preserves every Phase 1 category choice
- A Shadow DOM Focus Bar with Show original, Undo, and restore-preset actions
- A supported-block picker with pointer outlines and a keyboard-accessible modal list
- Local positive, neutral, and dealbreaker keyword rules with clean DOM restoration
- Conservative English section navigation and session-only collapse controls
- Optional Chrome Sync with disclosure, quota-error fallback, and local retention
- A separately gated, default-off search-list beta that hard-excludes sponsored/promoted cards

## Local setup

```sh
npm install
npm run verify
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the generated `dist/` directory.

## Safety model

- Fresh installs are disabled until the user enables Focus Mode.
- Selectors are centralized in `src/content/registry.ts`, versioned, and evaluated independently.
- Any candidate containing a title, description, Apply, Save, Share, or Report control is rejected.
- Disabling Focus Mode or selecting Show original removes every wrapper, marker, attribute, section control, and search-list mutation applied by the extension.
- The extension requests only `storage` and narrowly scoped LinkedIn jobs host access.
- Settings normalization allowlists configuration fields; job content, URLs, account data, and derived scores cannot enter the schema.

## Verification

`npm run verify` runs strict TypeScript checks, unit and sanitized DOM-fixture tests, and the production build. The fixture coverage includes migration, presets, protected anchors, keyword validation/matching/restoration, a 25,000-character description pass, and conservative section recognition.

## DOM validation still required

The PRDs require signed-in DOM inspection and live QA before the selector map is release-ready. Phase 2 also remains gated on Phase 1 usage/safety evidence and an explicit platform-risk decision. The current map is intentionally conservative and is the implementation baseline for those audits.
