# Chrome Web Store submission answers

These answers reflect the extension code in this repository. Keep the dashboard declarations, public privacy policy, and extension behavior consistent.

## Privacy practices

### Single purpose description

> JUSTTHEROLE provides a user-controlled focus and reading layer on LinkedIn Jobs pages by hiding selected recognized page blocks and locally highlighting user-defined criteria while preserving the title, company context, and application actions.

### Host permission justification

> The extension runs its bundled content script and stylesheet only on LinkedIn Jobs paths matching https://*.linkedin.com/jobs/*, including regional LinkedIn hosts, so it can locally identify supported page blocks, apply the user's visibility choices, highlight user-defined keywords, and add reversible focus controls. The content script does not run on non-Jobs paths. It does not submit applications, read cookies, or transmit page data.

### Storage permission justification

> The storage permission saves only the extension's configuration: whether Focus Mode is enabled, preset and category choices, keyword rules, reading-tool preferences, on-page widget visibility, and search-list preferences. Settings are local by default. Chrome Sync is used only when the user explicitly enables it. Job descriptions, URLs, account data, resumes, and application data are never stored.

### Active tab permission justification

> The activeTab permission is used only when the user opens the JUSTTHEROLE toolbar popup. It grants temporary access to the current tab so the extension can activate on an already-open LinkedIn Jobs page after installation or an extension update without requiring a page refresh. It is not used to inspect other tabs or browsing history.

### Scripting permission justification

> The scripting permission is used only with activeTab to inject JUSTTHEROLE's packaged content.js and content.css files into the current LinkedIn Jobs tab when the static content script is missing or stale. No remote code, downloaded logic, or arbitrary strings are executed.

### Remote code

Select **No, I am not using remote code**.

If the dashboard presents an explanation field, use:

> JUSTTHEROLE does not use remote code. All JavaScript, CSS, and dependencies are bundled inside the submitted extension package. It does not load external scripts, evaluate downloaded strings, or fetch remote configuration or logic, and it makes no extension-initiated network requests.

### Data-use disclosure

Disclose **Website content** because the extension processes the currently displayed job description locally to recognize sections and highlight user-defined keywords. State that this content is not collected, retained, transmitted, sold, or used for advertising.

Do not declare personally identifiable information, health information, financial information, authentication information, personal communications, location, or browsing history: the extension does not collect or retain those categories.

### Certification

After reviewing the declarations, select the checkbox certifying compliance with the Chrome Web Store Developer Program Policies and click **Save Draft**.

## Publisher account settings

1. Open the Developer Dashboard **Settings** page.
2. Enter an email address that you actively monitor.
3. Send the verification message.
4. Open the message and complete verification.
5. Return to the item and save the draft again.

These account steps cannot be completed in extension code.

## Public URLs

These URLs work only after the repository is public and the files have been committed and pushed:

- Homepage URL: `https://github.com/agrayush13/just-the-role-src`
- Support URL: `https://github.com/agrayush13/just-the-role-src/issues`
- Privacy policy URL: `https://github.com/agrayush13/just-the-role-src/blob/main/PRIVACY.md`
