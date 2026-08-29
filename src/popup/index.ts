import {
  CATEGORY_KEYS,
  CATEGORY_LABELS,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type CategoryKey,
  type Settings,
} from "../shared/settings";

interface ContentStatus {
  pageStatus: "supported" | "unsupported" | "waiting";
  temporaryFullPage: boolean;
  selectorMapVersion: string;
  matchedCounts: Partial<Record<CategoryKey, number>>;
  urlKind: string;
}

let settings: Settings;
let contentStatus: ContentStatus | null = null;

const masterToggle = document.querySelector<HTMLInputElement>("#master-toggle")!;
const categories = document.querySelector<HTMLFieldSetElement>("#categories")!;
const pageStatus = document.querySelector<HTMLElement>("#page-status")!;
const feedback = document.querySelector<HTMLElement>("#feedback")!;

function render(): void {
  masterToggle.checked = settings.enabled;
  categories.querySelectorAll<HTMLInputElement>("input[data-category]").forEach((input) => {
    input.checked = settings.categories[input.dataset.category as CategoryKey];
  });
}

async function persist(): Promise<void> {
  await saveSettings(settings);
  feedback.textContent = "Saved";
  window.setTimeout(() => (feedback.textContent = ""), 1200);
}

function buildCategories(): void {
  const fragment = document.createDocumentFragment();
  for (const key of CATEGORY_KEYS) {
    const label = document.createElement("label");
    label.className = "category";
    const text = document.createElement("span");
    text.textContent = CATEGORY_LABELS[key];
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.category = key;
    input.addEventListener("change", async () => {
      settings = {
        ...settings,
        categories: { ...settings.categories, [key]: input.checked },
      };
      await persist();
    });
    label.append(text, input);
    fragment.append(label);
  }
  categories.append(fragment);
}

async function getActiveTabStatus(): Promise<ContentStatus | null> {
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

document.querySelector("#reset")?.addEventListener("click", async () => {
  settings = structuredClone(DEFAULT_SETTINGS);
  render();
  await persist();
  feedback.textContent = "Recommended defaults restored";
});

document.querySelector("#copy-diagnostics")?.addEventListener("click", async () => {
  const manifest = chrome.runtime.getManifest();
  const diagnostics = {
    product: "JustTheRole",
    extensionVersion: manifest.version,
    settingsSchemaVersion: settings.schemaVersion,
    enabled: settings.enabled,
    enabledCategories: CATEGORY_KEYS.filter((key) => settings.categories[key]),
    pageStatus: contentStatus?.pageStatus ?? "unavailable",
    temporaryFullPage: contentStatus?.temporaryFullPage ?? false,
    selectorMapVersion: contentStatus?.selectorMapVersion ?? "unavailable",
    matchedCounts: contentStatus?.matchedCounts ?? {},
    urlKind: contentStatus?.urlKind ?? "unavailable",
    userAgent: navigator.userAgent.replace(/\([^)]*\)/, "(redacted)"),
  };
  await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
  feedback.textContent = "Diagnostics copied — no page or account content included";
});

async function start(): Promise<void> {
  settings = await loadSettings();
  buildCategories();
  render();
  contentStatus = await getActiveTabStatus();
  pageStatus.textContent =
    contentStatus?.pageStatus === "supported"
      ? contentStatus.temporaryFullPage
        ? "Supported job page · showing full page for this session"
        : "Supported job page"
      : contentStatus?.pageStatus === "waiting"
        ? "Waiting for the job details to finish loading"
        : "Open a signed-in LinkedIn job page to use Focus Mode";
}

void start();
