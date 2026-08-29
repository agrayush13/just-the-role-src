# Architecture

## System boundary

JUSTTHEROLE is a Manifest V3 Chrome extension with no server component. It consists of a LinkedIn Jobs content script, toolbar popup, options page, a minimal install-event service worker, shared deterministic logic, static styles, and a packaged privacy page.

```text
Chrome storage.local ───────┐
                            ├── shared settings boundary
Chrome storage.sync (opt-in)┘            │
                                         ├── popup
                                         ├── options page
                                         └── content script
                                                │
                                                ├── detect supported job view
                                                ├── restore prior mutations
                                                ├── apply safe layout rules
                                                ├── apply reading tools
                                                ├── apply search cleanup
                                                └── render Focus Bar
```

## Components

- `src/shared/settings.ts` owns defaults, schema normalization, migration, presets, category customization, and persistence.
- `src/shared/keywords.ts` validates rules and computes deterministic text ranges.
- `src/shared/sections.ts` contains the reviewed English heading dictionary.
- `src/shared/html.ts` escapes untrusted text before Shadow DOM HTML rendering.
- `src/content/registry.ts` is the versioned selector map and protected-anchor safety boundary.
- `src/content/keyword-dom.ts` adds and restores markers without replacing description HTML.
- `src/content/search-beta.ts` classifies explicit card labels.
- `src/content/index.ts` coordinates detection, transformations, restoration, navigation changes, DOM updates, and the Focus Bar.
- `src/popup/` provides compact quick controls, settings access, and a secondary privacy-safe diagnostics action.
- `src/options/` provides complete configuration editing.
- `src/background/` opens the existing settings page once after a fresh installation and performs no work on updates or browser startup.
- `scripts/build.mjs` bundles entry points and copies static assets.
- `scripts/package-store.mjs` produces and validates the store archive.

## Content-script lifecycle

At startup, the content script loads normalized settings. If storage cannot be read, it uses disabled defaults so the page remains unchanged. It then observes body child-list mutations and checks URL changes to accommodate LinkedIn's single-page navigation.

Each apply pass:

1. records scroll position and removes every extension-owned mutation from the previous pass;
2. detects a rendered job root, title, and description from the restored page;
3. resets transient diagnostics;
4. when Focus Mode is active and original view is not requested, applies layout rules, keyword markers, section controls, and search cleanup;
5. renders the Focus Bar whenever its independent visibility preference is enabled, including an Enable action when Focus Mode is off, or removes it when the preference is disabled;
6. restores scroll position and clears observer records created by the pass.

Relevant page mutations are debounced. Mutations inside extension UI or keyword markers are ignored to prevent feedback loops. Route changes clear session-only state such as Show original, Undo, collapsed sections, and revealed search cards.

## Safe DOM transformation model

The selector registry assigns each category a conservative selector list. Matches are deduplicated and independently checked before hiding. A candidate is rejected when it is or contains the job root, matches a protected selector, or contains a protected element.

Layout hiding is CSS-driven through `data-jtr-hidden`. Before changing `aria-hidden`, the extension records whether the attribute was absent or stores its exact previous value. Restoration removes extension attributes and reinstates the previous accessibility state.

Keyword processing walks visible text nodes below description content. It skips interactive, executable, hidden, and extension-owned regions. Matches are inserted from the end of each text node so ranges remain stable. Restoration replaces marks with text nodes and normalizes their parents.

Section and search transformations also use extension-owned data attributes. No employer-authored text or event handlers are rewritten.

## Focus Bar isolation

The Focus Bar is a single host inserted before the first recognized AI/profile-match module, with the description as its fallback anchor. Its open Shadow DOM contains scoped styles, extension theme tokens, the packaged 32px logo, native buttons, and the shared ARIA listbox dropdown behavior. The content script derives a light/dark mode from the nearest opaque page background and watches page theme attributes so the palette stays aligned with LinkedIn. Employer-provided section labels are escaped before template interpolation. The host and injected controls carry extension-owned markers so mutation handling and highlighting exclude them.

`uiPreferences.focusBarVisible` controls only host rendering. Page transformations continue when the host is hidden. When Focus Mode is disabled but this preference remains enabled, the host stays visible with a direct activation action while all LinkedIn content transformations remain restored. Storage changes update it immediately without requiring a page reload.

## Settings and messaging

Local storage is the durable baseline. Enabling Sync imports an existing opted-in cloud configuration when present; otherwise it writes the normalized local settings to `chrome.storage.sync`. Failures are returned to the UI while the local save remains intact. Disabling Sync removes the synced copy when possible.

Storage events update open job pages immediately. The background worker mirrors accepted Sync events into local storage so the fallback and open extension surfaces stay current. Sync events are ignored unless the current local configuration has Sync enabled. The popup requests an ephemeral status snapshot containing category IDs, aggregate counts, timings, versions, and route type—but no job text, keyword text, page URL, or account data.

## Security and privacy properties

- Manifest host access is restricted to LinkedIn Jobs URLs.
- There are no runtime remote dependencies, analytics endpoints, or extension network calls.
- Persisted settings are rebuilt from an allowlist; unknown fields are discarded.
- Untrusted labels are escaped before template interpolation.
- Core controls and content are protected at the selector boundary.
- The only web-accessible packaged asset is the 32px brand icon. Chrome requires web-accessible resource matches to use an origin-wide `/*` path, so the icon is available on LinkedIn origins while content-script execution and host access remain restricted to LinkedIn Jobs paths.
- The store archive excludes source maps, source, tests, dependencies, and hidden files.

## Testing strategy

Unit tests cover matching, schema, migration, selector safety, escaping, search labels, sections, and marker restoration. A sanitized fixture exercises the bundled content script against LinkedIn-like markup. The release command validates the built artifact.

The selector registry is the main external compatibility boundary. It requires manual signed-in validation before release because fixtures cannot observe future LinkedIn markup changes or account-specific experiments.
