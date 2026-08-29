# JustTheRole product requirements

## Product summary

JustTheRole is a Chrome extension for people who want to evaluate LinkedIn job descriptions with less visual noise and without sending career data to another service. It provides a reversible focus layer over supported LinkedIn Jobs views. All decisions are based on reviewed selectors, explicit page labels, and rules created by the user.

## Problem

Job-detail pages mix the employer-written role description and primary actions with match products, upsells, recommendations, promotional content, and repeated context. People reviewing many roles need a faster way to focus on the description and their own criteria without losing access to the original page or trusting an opaque score.

## Goals

- Make supported job descriptions faster and calmer to read.
- Let users decide which supported optional modules remain visible.
- Surface user-defined criteria without interpreting the job or applicant.
- Keep every transformation immediate, deterministic, and reversible.
- Minimize permissions and keep private page data out of storage and network requests.
- Fail open when LinkedIn markup is unknown or a candidate could include essential content.

## Non-goals

JustTheRole does not scrape, export, or retain job or profile data; summarize descriptions; generate application advice; calculate fit scores; rank or recommend roles; automate LinkedIn actions; modify employer wording; provide analytics; or promise support for every LinkedIn layout, locale, or experiment.

## Users and primary jobs

The primary user is an individual reviewing job opportunities on desktop Chrome. They need to enable a focused view intentionally, choose a cleanup level, highlight personal criteria, navigate long descriptions, recover the original page immediately, and understand what the extension stores.

## Functional requirements

### Activation and page support

- **FR-01:** A fresh install must leave Focus Mode disabled.
- **FR-02:** The extension must operate only on the declared LinkedIn Jobs host scope.
- **FR-03:** A job view is supported only when a rendered job root, title, and description can all be found.
- **FR-04:** Unsupported or incomplete page structures must remain unchanged.
- **FR-05:** LinkedIn single-page navigation and relevant DOM updates must trigger a debounced re-evaluation without moving scroll position.

### Views and customization

- **FR-06:** Balanced, Minimal, and Native views must resolve to deterministic category rules.
- **FR-07:** Changing an individual category must create a Custom view and remember its source preset.
- **FR-08:** Custom must not be offered as a new blank preset; it exists only after customization or migration.
- **FR-09:** The Focus Bar must support view switching, temporary original-page display, one-step undo, source-preset restoration, and keyword-settings access.
- **FR-10:** The page-block picker must expose only detected, supported, non-essential categories and provide direct pointer selection plus a keyboard-operable modal list.
- **FR-11:** Customization may persist only the category toggle, never raw page text, a DOM path, or element identity.

### DOM safety and restoration

- **FR-12:** Selector rules must be centralized, versioned, and evaluated independently.
- **FR-13:** A candidate must not be hidden when it is the job root, contains the job root, matches a protected anchor, or contains a protected anchor.
- **FR-14:** Protected anchors must include title, description, Apply, Save, company/location context, Share, Report, navigation, and account controls.
- **FR-15:** Hiding must use extension-owned attributes and preserve an element's previous `aria-hidden` state.
- **FR-16:** Disabling Focus Mode or selecting Show original must remove all extension-owned layout, marker, section, picker, and search-list changes.

### Keyword tools

- **FR-17:** Users may create up to 50 rules of at most 60 normalized characters each.
- **FR-18:** Rules must have a unique case-insensitive phrase, a Desired/Notice/Check meaning, whole-word or exact-phrase matching, and an enabled state.
- **FR-19:** Matching must be local, Unicode-aware, case-insensitive, deterministic, and resolve overlaps consistently.
- **FR-20:** Markers must wrap visible description text nodes without rewriting container HTML and must skip links, controls, scripts, styles, hidden content, and extension UI.
- **FR-21:** Match counts may be shown, but no score or judgment may be derived.
- **FR-22:** Removing or reapplying markers must preserve original text and element structure.

### Description sections

- **FR-23:** Section tools must activate only when at least two unique headings match the reviewed English dictionary.
- **FR-24:** Ambiguous, duplicate, or unrecognized headings must fail open.
- **FR-25:** Jump controls must target the original heading; collapse state must be reversible and session-only.

### Search-list cleanup

- **FR-26:** Search-list cleanup must be separately configurable and disabled by default.
- **FR-27:** Compact density may reduce spacing but must not remove facts or actions.
- **FR-28:** Only cards with an explicit leading Viewed or Applied status label may be collapsed.
- **FR-29:** Cards containing a visible Sponsored or Promoted label must never be collapsed.
- **FR-30:** The Focus Bar must provide reversible counters for collapsed Viewed and Applied cards.

### Settings, Sync, and privacy

- **FR-31:** Persisted data must be normalized through an allowlisted schema before use or storage.
- **FR-32:** Legacy category choices must migrate without changing effective visibility.
- **FR-33:** Local storage is authoritative and must remain usable when Chrome Sync is unavailable.
- **FR-34:** Chrome Sync must be opt-in, disclose that keyword rules may be sensitive, and report local fallback.
- **FR-35:** The extension must not persist job content, URLs, account information, browsing activity, or derived scores.
- **FR-36:** Diagnostics must exclude page text, URL values, account data, and keyword text.
- **FR-37:** The extension must not initiate remote requests or include analytics.

### Accessibility and resilience

- **FR-38:** Interactive controls must be keyboard operable, visibly focused, and labeled for assistive technology.
- **FR-39:** Status and save feedback must use polite live regions; validation errors must be announced.
- **FR-40:** Motion must follow the user's reduced-motion preference.
- **FR-41:** Light and dark page contexts must retain legible controls and markers.
- **FR-42:** A storage read failure must leave the page unchanged and the content script responsive.

## Acceptance criteria

A release candidate is acceptable when:

- strict TypeScript checks, automated tests, and the production build pass;
- the sanitized fixture verifies hiding, highlighting, section controls, search cleanup, picker access, and complete restoration;
- the store package contains one root manifest and no development-only files;
- manual signed-in checks cover direct job pages and split search/detail views on current LinkedIn markup;
- Apply, Save, Share, Report, title, company/location context, and description remain usable in every view;
- disabling Focus Mode and Show original leave no extension DOM mutations;
- storage and diagnostics inspection confirms that no job or account data is retained.

## Success signals

This repository intentionally includes no telemetry. Success should be assessed through voluntary user feedback and privacy-preserving store metrics, emphasizing few reports of hidden essential content, reliable restoration, and continued compatibility.

## Known product boundary

Automated tests use a sanitized LinkedIn-like fixture. Because LinkedIn markup is external and changes over time, live signed-in selector validation remains a release requirement rather than a capability the repository can guarantee permanently.
