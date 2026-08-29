import { isFreshInstallReason } from "../shared/install";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  normalizeSettings,
  settingsFromStorageChange,
} from "../shared/settings";
import { OPEN_OPTIONS_MESSAGE_TYPE, SELECTOR_MAP_VERSION, STATUS_MESSAGE_TYPE } from "../content/registry";

const ACTIVATED_CONTENT_VERSION_KEY = "activatedContentVersion";
const LINKEDIN_JOBS_PATTERN = "https://*.linkedin.com/jobs/*";

async function hasCurrentContentScript(tabId: number): Promise<boolean> {
  try {
    const status = await chrome.tabs.sendMessage(tabId, { type: STATUS_MESSAGE_TYPE });
    return status?.selectorMapVersion === SELECTOR_MAP_VERSION;
  } catch {
    return false;
  }
}

async function activateCurrentContentScript(tabId: number): Promise<void> {
  if (await hasCurrentContentScript(tabId)) return;
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch {
    // Restricted or closing tabs fail safely and will activate on their next navigation.
  }
}

async function activateExistingJobTabs(force = false): Promise<void> {
  if (!force) {
    const stored = await chrome.storage.local.get(ACTIVATED_CONTENT_VERSION_KEY);
    if (stored[ACTIVATED_CONTENT_VERSION_KEY] === SELECTOR_MAP_VERSION) return;
  }
  const tabs = await chrome.tabs.query({ url: [LINKEDIN_JOBS_PATTERN] });
  await Promise.all(tabs.flatMap((tab) => tab.id ? [activateCurrentContentScript(tab.id)] : []));
  await chrome.storage.local.set({ [ACTIVATED_CONTENT_VERSION_KEY]: SELECTOR_MAP_VERSION });
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (isFreshInstallReason(reason)) void chrome.runtime.openOptionsPage();
  void activateExistingJobTabs(true);
});

chrome.runtime.onStartup.addListener(() => {
  void activateExistingJobTabs();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== OPEN_OPTIONS_MESSAGE_TYPE) return;
  void chrome.runtime.openOptionsPage().catch(() => {
    // Chrome can reject while the extension is itself being reloaded.
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes[SETTINGS_KEY]) return;
  void (async () => {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    const current = stored[SETTINGS_KEY]
      ? normalizeSettings(stored[SETTINGS_KEY])
      : structuredClone(DEFAULT_SETTINGS);
    const next = settingsFromStorageChange("sync", changes[SETTINGS_KEY].newValue, current);
    if (next) await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  })().catch(() => {
    // Sync reconciliation is best-effort; the synchronized copy remains available for the next load.
  });
});
