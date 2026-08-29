import {
  CATEGORY_KEYS,
  CATEGORY_LABELS,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  customizeModule,
  loadSettings,
  normalizeSettings,
  saveSettings,
  settingsForPreset,
  type CategoryKey,
  type KeywordType,
  type Preset,
  type Settings,
} from "../shared/settings";
import { bindSelectMenu } from "../shared/select-menu";
import { isSupportedLinkedInJobsUrl } from "../shared/urls";
import { REFRESH_MESSAGE_TYPE, SELECTOR_MAP_VERSION, STATUS_MESSAGE_TYPE } from "../content/registry";

interface ContentStatus {
  ready: boolean;
  pageStatus: "supported" | "unsupported" | "waiting";
  temporaryOriginal: boolean;
  selectorMapVersion: string;
  matchedCounts: Partial<Record<CategoryKey, number>>;
  keywordCounts: Record<KeywordType, number>;
  activePreset: Preset;
  enabled: boolean;
  diagnostics: {
    applyMs: number;
    keywordMs: number;
    detectedModuleIds: CategoryKey[];
    sectionCount: number;
  };
  urlKind: string;
}

let settings: Settings;
let contentStatus: ContentStatus | null = null;
let activationFailed = false;
let activationFailureReason = "";

const masterToggle = document.querySelector<HTMLInputElement>("#master-toggle")!;
const focusBarToggle = document.querySelector<HTMLInputElement>("#focus-bar-visible")!;
const presetRoot = document.querySelector<HTMLElement>("[data-custom-select='preset']")!;
const pageStatus = document.querySelector<HTMLElement>("#page-status")!;
const pageStatusText = pageStatus.querySelector<HTMLElement>(".sr-only")!;
const matchSummary = document.querySelector<HTMLElement>("#match-summary")!;
const hiddenCategories = document.querySelector<HTMLElement>("#hidden-categories")!;
const hiddenCategoryList = document.querySelector<HTMLUListElement>("#hidden-category-list")!;
const customCategories = document.querySelector<HTMLElement>("#custom-categories")!;
const customCategoryList = document.querySelector<HTMLElement>("#custom-category-list")!;
const feedback = document.querySelector<HTMLElement>("#feedback")!;
const masterState = document.querySelector<HTMLElement>("#master-state")!;
const widgetOffNote = document.querySelector<HTMLElement>("#widget-off-note")!;
const presetMenu = bindSelectMenu(presetRoot, {
  onChange: async (value) => {
    settings = settingsForPreset(settings, value as Preset);
    render();
    await persist();
    await refreshContentStatusAfterSettingsChange();
  },
});

const popupCategoryKeys = CATEGORY_KEYS.filter(
  (category) => category !== "topNavigation" && category !== "searchResultsPane",
);

function setupCustomCategoryControls(): void {
  customCategoryList.replaceChildren(...popupCategoryKeys.map((category) => {
    const label = document.createElement("label");
    label.className = "custom-category";
    const text = document.createElement("span");
    text.textContent = CATEGORY_LABELS[category];
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.category = category;
    input.setAttribute("aria-label", `Hide ${CATEGORY_LABELS[category]}`);
    input.addEventListener("change", async () => {
      settings = customizeModule(settings, category, input.checked);
      render();
      await persist();
      await refreshContentStatusAfterSettingsChange();
    });
    label.append(text, input);
    return label;
  }));
}

function setPageStatus(state: "supported" | "waiting" | "unsupported", label: string): void {
  pageStatus.dataset.state = state;
  pageStatus.setAttribute("aria-label", label);
  pageStatus.title = label;
  pageStatusText.textContent = label;
}

function render(): void {
  masterToggle.checked = settings.enabled;
  focusBarToggle.checked = settings.uiPreferences.focusBarVisible;
  masterState.textContent = settings.enabled ? "On" : "Off";
  masterToggle.setAttribute("aria-label", `${settings.enabled ? "Disable" : "Enable"} Focus Mode`);
  widgetOffNote.hidden = settings.enabled || !settings.uiPreferences.focusBarVisible;
  presetMenu.setValue(settings.activePreset);
  customCategories.hidden = settings.activePreset !== "custom";
  customCategoryList.querySelectorAll<HTMLInputElement>("input[data-category]").forEach((input) => {
    input.checked = settings.moduleRules[input.dataset.category as CategoryKey];
  });
  const counts = contentStatus?.keywordCounts;
  const total = counts ? counts.positive + counts.neutral + counts.dealbreaker : 0;
  const hiddenBlocks = Object.values(contentStatus?.matchedCounts ?? {}).reduce(
    (sum: number, count) => sum + (count ?? 0),
    0,
  );
  const hiddenCategoryKeys = Object.entries(contentStatus?.matchedCounts ?? {})
    .filter((entry): entry is [CategoryKey, number] => Boolean(entry[1]))
    .map(([category]) => category);
  const detectedBlocks = contentStatus?.diagnostics.detectedModuleIds.length ?? 0;
  hiddenCategoryList.replaceChildren(...hiddenCategoryKeys.map((category) => {
    const item = document.createElement("li");
    item.textContent = CATEGORY_LABELS[category];
    return item;
  }));
  hiddenCategories.hidden = settings.activePreset === "custom"
    || contentStatus?.pageStatus !== "supported"
    || hiddenCategoryKeys.length === 0;
  matchSummary.textContent = contentStatus?.pageStatus === "supported"
    ? hiddenBlocks
      ? `${total} keyword match${total === 1 ? "" : "es"}`
      : detectedBlocks
        ? `${detectedBlocks} optional block type${detectedBlocks === 1 ? "" : "s"} detected; none hidden by this view`
        : "No supported optional blocks detected on this page"
    : "Keyword and section tools follow your full settings.";
}

async function persist(): Promise<void> {
  try {
    const result = await saveSettings(settings);
    feedback.textContent = result.syncError ? "Saved locally; Chrome Sync is unavailable" : "Saved";
  } catch {
    feedback.textContent = "Could not save settings. Please try again.";
  }
  window.setTimeout(() => { feedback.textContent = ""; }, 1200);
}

async function requestTabStatus(tabId: number): Promise<ContentStatus | null> {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: STATUS_MESSAGE_TYPE });
  } catch {
    return null;
  }
}

async function refreshTabWidget(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: REFRESH_MESSAGE_TYPE });
    await new Promise((resolve) => window.setTimeout(resolve, 20));
  } catch {
    // The activation path below injects the current script when no listener exists.
  }
}

async function getActiveTabStatus(): Promise<ContentStatus | null> {
  if (typeof chrome === "undefined" || !chrome.tabs) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  let status = await requestTabStatus(tab.id);
  const hasCurrentScript = status?.selectorMapVersion === SELECTOR_MAP_VERSION;
  if (hasCurrentScript && status?.ready) {
    await refreshTabWidget(tab.id);
    return await requestTabStatus(tab.id) ?? status;
  }
  if (!isSupportedLinkedInJobsUrl(tab.url)) return status;

  if (!hasCurrentScript) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    } catch (error) {
      activationFailed = true;
      activationFailureReason = error instanceof Error ? error.message : String(error);
      return status;
    }
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    status = await requestTabStatus(tab.id);
    if (status?.selectorMapVersion === SELECTOR_MAP_VERSION && status.ready) {
      await refreshTabWidget(tab.id);
      return await requestTabStatus(tab.id) ?? status;
    }
  }
  activationFailed = true;
  activationFailureReason = status?.selectorMapVersion === SELECTOR_MAP_VERSION
    ? "the page script did not finish its initial scan"
    : "the updated page script did not respond";
  return status;
}

async function refreshContentStatusAfterSettingsChange(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.tabs) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isSupportedLinkedInJobsUrl(tab.url)) return;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 40));
    const status = await requestTabStatus(tab.id);
    if (status) contentStatus = status;
    if (status?.activePreset === settings.activePreset && status.enabled === settings.enabled) {
      render();
      return;
    }
  }
  render();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[SETTINGS_KEY]?.newValue) return;
    settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
    render();
  });
}

masterToggle.addEventListener("change", async () => {
  settings = { ...settings, enabled: masterToggle.checked };
  render();
  await persist();
  await refreshContentStatusAfterSettingsChange();
});

focusBarToggle.addEventListener("change", async () => {
  settings = {
    ...settings,
    uiPreferences: { ...settings.uiPreferences, focusBarVisible: focusBarToggle.checked },
  };
  render();
  await persist();
});

document.querySelector("#open-options")?.addEventListener("click", () => void chrome.runtime.openOptionsPage());

document.querySelector("#copy-diagnostics")?.addEventListener("click", async () => {
  const manifest = chrome.runtime.getManifest();
  const diagnostics = {
    product: "JUSTTHEROLE",
    extensionVersion: manifest.version,
    settingsSchemaVersion: settings.schemaVersion,
    enabled: settings.enabled,
    activePreset: settings.activePreset,
    focusBarVisible: settings.uiPreferences.focusBarVisible,
    pageStatus: contentStatus?.pageStatus ?? "unavailable",
    temporaryOriginal: contentStatus?.temporaryOriginal ?? false,
    selectorMapVersion: contentStatus?.selectorMapVersion ?? "unavailable",
    matchedModuleIds: Object.keys(contentStatus?.matchedCounts ?? {}),
    detectedModuleIds: contentStatus?.diagnostics.detectedModuleIds ?? [],
    keywordMatchCounts: contentStatus?.keywordCounts ?? {},
    sectionCount: contentStatus?.diagnostics.sectionCount ?? 0,
    timingsMs: {
      apply: contentStatus?.diagnostics.applyMs ?? null,
      keywords: contentStatus?.diagnostics.keywordMs ?? null,
    },
    routeType: contentStatus?.urlKind ?? "unavailable",
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
    feedback.textContent = "Safe diagnostics copied — no text, URL, or account data included";
  } catch {
    feedback.textContent = "Could not copy diagnostics. Check clipboard access and try again.";
  }
});

async function start(): Promise<void> {
  setupCustomCategoryControls();
  try {
    settings = await loadSettings();
  } catch {
    settings = structuredClone(DEFAULT_SETTINGS);
    feedback.textContent = "Settings storage is unavailable; showing safe defaults.";
  }
  contentStatus = await getActiveTabStatus();
  if (activationFailed) {
    feedback.textContent = `Could not activate on this tab: ${activationFailureReason || "unknown Chrome error"}.`;
  }
  if (contentStatus?.pageStatus === "supported") {
    setPageStatus("supported", "Supported job page");
  } else if (contentStatus?.pageStatus === "waiting") {
    setPageStatus("waiting", "Waiting for job details to finish loading");
  } else {
    setPageStatus("unsupported", "Open a signed-in LinkedIn job page to use Focus Mode");
  }
  render();
}

void start();
