# JUSTTHEROLE Privacy Policy

Last updated: August 30, 2026

JUSTTHEROLE provides a user-controlled focus and reading layer for supported LinkedIn Jobs pages. It changes how page content is displayed and highlights criteria that the user explicitly configures.

## Data processed on the device

JUSTTHEROLE processes the currently displayed job page locally in the browser to identify supported page sections, apply the user's visibility preferences, and highlight user-defined keywords. Job-page content is not collected, retained, or transmitted by JUSTTHEROLE.

## Configuration stored by Chrome

The extension stores only its configuration: the Focus Mode switch, selected preset, category visibility choices, reading-tool preferences, on-page widget preference, and keyword rules. This configuration is stored locally through Chrome's extension storage API.

Chrome Sync is off by default. If the user explicitly enables it, Chrome may synchronize the same configuration—including keyword rules—through the user's Chrome account. Disabling Sync removes the extension's synchronized configuration while retaining the local copy.

## Data not collected

JUSTTHEROLE does not collect or retain job descriptions, job URLs, job titles, company names, LinkedIn profile information, resumes, applications, messages, search terms, browsing history, account credentials, cookies, derived scores, or analytics.

JUSTTHEROLE does not sell user data, use data for advertising, transfer data to the developer or third parties, or allow humans to read user data. The extension makes no extension-initiated network requests and executes no remotely hosted code.

## Permissions

- **LinkedIn Jobs page access:** Used only to run the bundled content script and stylesheet on LinkedIn Jobs paths (`https://*.linkedin.com/jobs/*`), including regional LinkedIn hosts, where the extension applies the user's reversible display and reading preferences.
- **Storage:** Used only to save the extension configuration locally and, when explicitly enabled by the user, through Chrome Sync.
- **Active tab and scripting:** Used only after the user opens the extension popup, to activate the packaged content script and stylesheet on the current LinkedIn Jobs tab when they are not already running. This does not provide background access to other tabs and does not load remote code.

## Limited Use

JUSTTHEROLE's use of information complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. Information is used only to provide the extension's user-facing focus and reading features.

## Independence

JUSTTHEROLE is an independent product and is not affiliated with or endorsed by LinkedIn.

## Contact and deletion

Users can delete locally stored configuration by resetting the extension or uninstalling it. Users can remove synchronized configuration by disabling Chrome Sync in the extension before uninstalling. Support requests can be submitted at [GitHub Issues](https://github.com/agrayush13/just-the-role-src/issues).
