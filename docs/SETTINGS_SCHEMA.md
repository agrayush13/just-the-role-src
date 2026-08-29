# Settings schema

## Storage keys

- Current local and Sync key: `settingsV2`
- Legacy local key read for migration: `settingsV1`
- Current schema version: `2`

The versioned key and number describe storage compatibility only. They are not product release labels.

## Canonical shape

```json
{
  "schemaVersion": 2,
  "enabled": false,
  "activePreset": "balanced",
  "customBasePreset": "balanced",
  "moduleRules": {
    "aiMatch": true,
    "applicantInsights": false,
    "premiumUpsells": true,
    "recommendations": true,
    "footerPromotions": true,
    "applicantCount": false,
    "hiringTeam": false,
    "peopleConnections": false,
    "companyOverview": false,
    "jobDescription": false,
    "topNavigation": false,
    "searchResultsPane": false
  },
  "customModuleRules": {
    "aiMatch": true,
    "applicantInsights": false,
    "premiumUpsells": true,
    "recommendations": true,
    "footerPromotions": true,
    "applicantCount": false,
    "hiringTeam": false,
    "peopleConnections": false,
    "companyOverview": false,
    "jobDescription": false,
    "topNavigation": false,
    "searchResultsPane": false
  },
  "keywordRules": [],
  "readingTools": {
    "keywordsEnabled": true,
    "sectionControlsEnabled": true
  },
  "searchBeta": {
    "compactDensity": false,
    "collapseViewed": false,
    "collapseApplied": false
  },
  "syncEnabled": false,
  "uiPreferences": {
    "reducedMotion": "system",
    "controlPlacement": "inline",
    "focusBarVisible": true
  }
}
```

## Fields

| Field | Values | Behavior |
| --- | --- | --- |
| `schemaVersion` | `2` | Selects the current normalization path. |
| `enabled` | boolean | Master Focus Mode switch; defaults to false. |
| `activePreset` | `minimal`, `balanced`, `native`, `custom` | Current view. Custom is directly selectable and is also produced by category editing or migration. |
| `customBasePreset` | `minimal`, `balanced`, `native` | Preset restored from a Custom view. |
| `moduleRules` | category-to-boolean map | `true` requests hiding; every candidate still passes the DOM safety check. |
| `customModuleRules` | category-to-boolean map | Saved Custom configuration, recalled independently of the previously active built-in preset. Missing legacy values default to Balanced unless the stored active view is already Custom, in which case its effective rules are preserved. |
| `keywordRules` | up to 50 `KeywordRule` objects | User-defined local matching configuration. |
| `readingTools` | booleans | Enables keyword markers and reliable-section controls independently. |
| `searchBeta` | booleans | Dormant compatibility fields retained for internal development. Shipping normalization forces every value to `false`; no user-facing control or runtime behavior is available. |
| `syncEnabled` | boolean | Opt-in configuration synchronization. |
| `uiPreferences.reducedMotion` | `system`, `reduce` | Uses system behavior or forces non-smooth in-page navigation. |
| `uiPreferences.controlPlacement` | `inline` | Reserved, allowlisted Focus Bar placement. |
| `uiPreferences.focusBarVisible` | boolean | Shows the on-page Focus Bar independently from Focus Mode; defaults to true. When Focus Mode is off, the bar exposes an activation action without transforming LinkedIn content. |

## Keyword rule

```json
{
  "id": "generated-uuid",
  "text": "TypeScript",
  "type": "positive",
  "matchMode": "whole-word",
  "enabled": true
}
```

- `id` is a non-empty stable identifier generated locally.
- `text` is trimmed, whitespace-normalized on entry, limited to 60 characters, and unique case-insensitively in the options UI.
- `type` is `positive`, `neutral`, or `dealbreaker`, displayed as Desired, Notice, or Check.
- `matchMode` is `whole-word` or `phrase`.
- `enabled` allows temporary suspension without deletion.

## Preset matrix

`true` means the category is requested to be hidden. Safety checks can still keep a matched element visible.

| Category | Balanced | Minimal | Native |
| --- | :---: | :---: | :---: |
| AI and profile match | true | true | false |
| Applicant insights | false | true | false |
| Premium and resume upsells | true | true | false |
| Related and recommended jobs | true | true | false |
| Footer and promotions | true | true | false |
| Applicant count | false | true | false |
| Hiring team and recruiter | false | true | false |
| People and connections | false | true | false |
| Company overview | false | true | false |
| About the job | false | false | false |
| Top navigation | false | false | false |
| Search results pane | false | false | false |

The last two categories remain in the schema for compatibility but are not offered as manual hiding controls.

## Normalization boundary

Every load and save passes through `normalizeSettings`. It:

- rejects non-object values in favor of defaults;
- allowlists every returned field and nested value;
- applies boolean and enum defaults;
- reconstructs the complete category map;
- forces dormant experimental search flags to `false`;
- caps keyword rules at 50 and text at 60 characters;
- discards empty rules and unknown top-level data.

Fields such as job URLs, descriptions, titles, account data, and scores cannot flow through the returned settings object even if malformed storage contains them.

## Migration

When the schema number differs, the legacy migrator copies only the master enabled flag and recognized category booleans. The result becomes a Custom view based on Balanced, and the migrated category map is also stored as its independent Custom configuration so effective visibility is preserved. Loading then writes the normalized current object to local storage.

## Local and Sync behavior

`chrome.storage.local` always receives the normalized object. If Sync is enabled, the same allowlisted object is written to `chrome.storage.sync`. A Sync quota or availability error does not roll back local storage and is surfaced to the user. When Sync is disabled, the synced key is removed when possible.

On a fresh browser profile with no local configuration, an existing opted-in synced object is adopted. Enabling Sync on an existing profile also imports an existing opted-in cloud copy instead of overwriting it. Otherwise, a locally enabled Sync setting may be overlaid by a present synced object. If no synced object exists or Sync cannot be read, local configuration remains authoritative. Remote Sync changes are mirrored into local storage, and open extension surfaces update from that local copy. Profiles that explicitly have Sync disabled ignore stale Sync changes.
