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
  matchSummary.textContent = total
    ? `${total} keyword match${total === 1 ? "" : "es"} · ${contentStatus?.diagnostics.sectionCount ?? 0} recognized sections`
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

async function getActiveTabStatus(): Promise<ContentStatus | null> {
  if (typeof chrome === "undefined" || !chrome.tabs) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: "JTR_GET_STATUS" });
  } catch {
    return null;
  }
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
