import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  settingsForPreset,
  type CategoryKey,
  type KeywordType,
  type Preset,
  type Settings,
} from "../shared/settings";
import { isSupportedLinkedInJobsUrl } from "../shared/urls";
import { SELECTOR_MAP_VERSION } from "../content/registry";

interface ContentStatus {
  pageStatus: "supported" | "unsupported" | "waiting";
  temporaryOriginal: boolean;
  selectorMapVersion: string;
  matchedCounts: Partial<Record<CategoryKey, number>>;
  keywordCounts: Record<KeywordType, number>;
  activePreset: Preset;
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
let activatedWithoutReload = false;
let activationFailed = false;

const masterToggle = document.querySelector<HTMLInputElement>("#master-toggle")!;
const presetSelect = document.querySelector<HTMLSelectElement>("#preset")!;
const pageStatus = document.querySelector<HTMLElement>("#page-status")!;
const matchSummary = document.querySelector<HTMLElement>("#match-summary")!;
const feedback = document.querySelector<HTMLElement>("#feedback")!;

function render(): void {
  masterToggle.checked = settings.enabled;
  presetSelect.value = settings.activePreset;
  const customOption = presetSelect.querySelector<HTMLOptionElement>("option[value='custom']");
  if (customOption) customOption.disabled = settings.activePreset !== "custom";
  const counts = contentStatus?.keywordCounts;
  const total = counts ? counts.positive + counts.neutral + counts.dealbreaker : 0;
  const hiddenBlocks = Object.values(contentStatus?.matchedCounts ?? {}).reduce(
    (sum: number, count) => sum + (count ?? 0),
    0,
  );
  const detectedBlocks = contentStatus?.diagnostics.detectedModuleIds.length ?? 0;
  matchSummary.textContent = contentStatus?.pageStatus === "supported"
    ? hiddenBlocks
      ? `${hiddenBlocks} optional block${hiddenBlocks === 1 ? "" : "s"} hidden · ${total} keyword match${total === 1 ? "" : "es"}`
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
    return await chrome.tabs.sendMessage(tabId, { type: "JTR_GET_STATUS" });
  } catch {
    return null;
  }
}

async function getActiveTabStatus(): Promise<ContentStatus | null> {
  if (typeof chrome === "undefined" || !chrome.tabs) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  let status = await requestTabStatus(tab.id);
  const needsCurrentScript = !status || status.selectorMapVersion !== SELECTOR_MAP_VERSION;
  if (!needsCurrentScript || !isSupportedLinkedInJobsUrl(tab.url)) return status;

  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    activatedWithoutReload = true;
  } catch {
    activationFailed = true;
    return status;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    status = await requestTabStatus(tab.id);
    if (status?.selectorMapVersion === SELECTOR_MAP_VERSION) return status;
    await new Promise((resolve) => window.setTimeout(resolve, 40));
  }
  activationFailed = true;
  return status;
}

masterToggle.addEventListener("change", async () => {
  settings = { ...settings, enabled: masterToggle.checked };
  await persist();
});

presetSelect.addEventListener("change", async () => {
  settings = settingsForPreset(settings, presetSelect.value as Preset);
  render();
  await persist();
});

document.querySelector("#open-options")?.addEventListener("click", () => void chrome.runtime.openOptionsPage());

document.querySelector("#copy-diagnostics")?.addEventListener("click", async () => {
  const manifest = chrome.runtime.getManifest();
  const diagnostics = {
    product: "JustTheRole",
    extensionVersion: manifest.version,
    settingsSchemaVersion: settings.schemaVersion,
    enabled: settings.enabled,
    activePreset: settings.activePreset,
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
  try {
    settings = await loadSettings();
  } catch {
    settings = structuredClone(DEFAULT_SETTINGS);
    feedback.textContent = "Settings storage is unavailable; showing safe defaults.";
  }
  contentStatus = await getActiveTabStatus();
  if (activationFailed) {
    feedback.textContent = "Could not activate on this tab. Check the extension error log and try again.";
  } else if (activatedWithoutReload) {
    feedback.textContent = "Activated on this tab without reloading";
  }
  pageStatus.textContent =
    contentStatus?.pageStatus === "supported"
      ? contentStatus.temporaryOriginal
        ? "Supported job page · original view shown for this session"
        : `Supported job page · ${contentStatus.activePreset} view`
      : contentStatus?.pageStatus === "waiting"
        ? "Waiting for the job details to finish loading"
        : "Open a signed-in LinkedIn job page to use Focus Mode";
  render();
}

void start();
