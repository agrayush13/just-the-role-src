# JustTheRole

A privacy-first Chrome extension that turns supported LinkedIn Jobs views into a personal focus layer.

The extension is deterministic and visual-only: no scraping, remote analytics, automation, summaries, scoring, job-data storage, or extension-initiated network requests.

## Features

- Balanced, Minimal, Native, and automatically created Custom presets
- Schema-v2 migration that preserves legacy category choices
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

## Chrome Web Store package

```sh
npm run chrome-extension
```

Upload the generated `release/just-the-role-chrome-extension-v<version>.zip` file directly to the Chrome Web Store. Do not zip the repository or upload the `dist/` folder itself: the release command runs the complete verification suite, validates that the archive contains exactly one `manifest.json` at its root, and excludes source, tests, source maps, dependencies, and other development files. `npm run package:store` remains available as an equivalent command.

## Safety model

- Fresh installs are disabled until the user enables Focus Mode.
- Selectors are centralized in `src/content/registry.ts`, versioned, and evaluated independently.
- Any candidate containing a title, description, Apply, Save, Share, or Report control is rejected.
- Disabling Focus Mode or selecting Show original removes every wrapper, marker, attribute, section control, and search-list mutation applied by the extension.
- The extension requests only `storage` and narrowly scoped LinkedIn jobs host access.
- Settings normalization allowlists configuration fields; job content, URLs, account data, and derived scores cannot enter the schema.

## Verification

`npm run verify` runs strict TypeScript checks, unit and sanitized DOM-fixture tests, and the production build. The fixture coverage includes migration, presets, storage-change handling, untrusted-label escaping, protected anchors, keyword validation/matching/restoration, a 25,000-character description pass, and conservative section recognition.

## Live DOM validation

LinkedIn can change its markup independently of this extension. Revalidate the conservative selector map against current signed-in job pages before each release.
