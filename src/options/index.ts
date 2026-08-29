import { validateKeywordRule } from "../shared/keywords";
import {
  CATEGORY_KEYS,
  CATEGORY_LABELS,
  DEFAULT_SETTINGS,
  customizeModule,
  loadSettings,
  saveSettings,
  settingsForPreset,
  type CategoryKey,
  type KeywordMatchMode,
  type KeywordRule,
  type KeywordType,
  type Preset,
  type Settings,
} from "../shared/settings";

let settings: Settings;
const feedback = document.querySelector<HTMLElement>("#feedback")!;
const keywordError = document.querySelector<HTMLElement>("#keyword-error")!;

const presetDescriptions: Record<Exclude<Preset, "custom">, string> = {
  balanced: "Hides match, upsell, recommendation, and promotion modules while keeping useful context.",
  minimal: "Keeps role facts, the original description, and core actions. Hides supported optional modules.",
  native: "Leaves LinkedIn's layout unchanged while separately enabled reading tools remain available.",
};

async function persist(message = "Saved"): Promise<void> {
  try {
    const result = await saveSettings(settings);
    feedback.textContent = result.syncError ? `Saved locally. Sync unavailable: ${result.syncError}` : message;
  } catch {
    feedback.textContent = "Could not save settings. Please try again.";
  }
  window.setTimeout(() => { feedback.textContent = ""; }, 2500);
}

function renderPresets(): void {
  const root = document.querySelector<HTMLElement>("#presets")!;
  root.replaceChildren();
  for (const preset of ["balanced", "minimal", "native"] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-card";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(settings.activePreset === preset));
    const strong = document.createElement("strong");
    strong.textContent = preset[0].toUpperCase() + preset.slice(1);
    const detail = document.createElement("span");
    detail.textContent = presetDescriptions[preset];
    button.append(strong, detail);
    button.addEventListener("click", async () => {
      settings = settingsForPreset(settings, preset);
      renderAll();
      await persist(`${strong.textContent} preset applied`);
    });
    root.append(button);
  }
  const custom = document.createElement("button");
  custom.type = "button";
  custom.className = "preset-card";
  custom.setAttribute("role", "radio");
  custom.setAttribute("aria-checked", String(settings.activePreset === "custom"));
  custom.disabled = settings.activePreset !== "custom";
  const customTitle = document.createElement("strong");
  customTitle.textContent = "Custom";
  const customDetail = document.createElement("span");
  customDetail.textContent = "Your saved category-level choices. Created automatically after a change.";
  custom.append(customTitle, customDetail);
  root.append(custom);
}

function renderModules(): void {
  const root = document.querySelector<HTMLElement>("#modules")!;
  root.replaceChildren();
  for (const key of CATEGORY_KEYS.filter((item) => !['topNavigation', 'searchResultsPane'].includes(item))) {
    const label = document.createElement("label");
    label.className = "setting";
    const text = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = CATEGORY_LABELS[key];
    const small = document.createElement("small");
    small.textContent = "Hide this supported category";
    text.append(strong, small);
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = settings.moduleRules[key];
    input.addEventListener("change", async () => {
      settings = customizeModule(settings, key as CategoryKey, input.checked);
      renderPresets();
      await persist();
    });
    label.append(text, input);
    root.append(label);
  }
}

function resetKeywordForm(): void {
  (document.querySelector<HTMLInputElement>("#keyword-id")!).value = "";
  (document.querySelector<HTMLInputElement>("#keyword-text")!).value = "";
  (document.querySelector<HTMLSelectElement>("#keyword-type")!).value = "positive";
  (document.querySelector<HTMLSelectElement>("#keyword-mode")!).value = "whole-word";
  document.querySelector<HTMLElement>("#cancel-edit")!.hidden = true;
  keywordError.textContent = "";
}

function editKeyword(rule: KeywordRule): void {
  (document.querySelector<HTMLInputElement>("#keyword-id")!).value = rule.id;
  (document.querySelector<HTMLInputElement>("#keyword-text")!).value = rule.text;
  (document.querySelector<HTMLSelectElement>("#keyword-type")!).value = rule.type;
  (document.querySelector<HTMLSelectElement>("#keyword-mode")!).value = rule.matchMode;
  document.querySelector<HTMLElement>("#cancel-edit")!.hidden = false;
  document.querySelector<HTMLInputElement>("#keyword-text")!.focus();
}

function renderKeywords(): void {
  const root = document.querySelector<HTMLElement>("#keyword-list")!;
  root.replaceChildren();
  if (!settings.keywordRules.length) {
    const empty = document.createElement("p");
    empty.className = "rule-meta";
    empty.textContent = "No keyword rules yet.";
    root.append(empty);
    return;
  }
  for (const rule of settings.keywordRules) {
    const row = document.createElement("article");
    row.className = "rule";
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = rule.enabled;
    enabled.setAttribute("aria-label", `Enable ${rule.text}`);
    enabled.addEventListener("change", async () => {
      settings = { ...settings, keywordRules: settings.keywordRules.map((item) => item.id === rule.id ? { ...item, enabled: enabled.checked } : item) };
      await persist();
    });
    const content = document.createElement("div");
    const text = document.createElement("strong");
    text.textContent = rule.text;
    const meta = document.createElement("div");
    meta.className = "rule-meta";
    meta.textContent = `${rule.type === "positive" ? "Desired" : rule.type === "dealbreaker" ? "Check" : "Notice"} · ${rule.matchMode === "whole-word" ? "whole word" : "exact phrase"}`;
    content.append(text, meta);
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editKeyword(rule));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Delete";
    remove.addEventListener("click", async () => {
      settings = { ...settings, keywordRules: settings.keywordRules.filter((item) => item.id !== rule.id) };
      renderKeywords();
      await persist("Rule deleted");
    });
    row.append(enabled, content, edit, remove);
    root.append(row);
  }
}

function setCheckbox(id: string, value: boolean): void {
  document.querySelector<HTMLInputElement>(`#${id}`)!.checked = value;
}

function renderAll(): void {
  setCheckbox("enabled", settings.enabled);
  setCheckbox("keywords-enabled", settings.readingTools.keywordsEnabled);
  setCheckbox("sections-enabled", settings.readingTools.sectionControlsEnabled);
  setCheckbox("focus-bar-visible", settings.uiPreferences.focusBarVisible);
  setCheckbox("sync-enabled", settings.syncEnabled);
  setCheckbox("compact-density", settings.searchBeta.compactDensity);
  setCheckbox("collapse-viewed", settings.searchBeta.collapseViewed);
  setCheckbox("collapse-applied", settings.searchBeta.collapseApplied);
  renderPresets();
  renderModules();
  renderKeywords();
}

function bindBoolean(id: string, update: (checked: boolean) => Settings): void {
  document.querySelector<HTMLInputElement>(`#${id}`)!.addEventListener("change", async (event) => {
    settings = update((event.currentTarget as HTMLInputElement).checked);
    await persist();
  });
}

document.querySelector<HTMLFormElement>("#keyword-form")!.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.querySelector<HTMLInputElement>("#keyword-id")!.value;
  const text = document.querySelector<HTMLInputElement>("#keyword-text")!.value;
  const validation = validateKeywordRule(text, settings.keywordRules, id || undefined);
  if (!validation.valid) { keywordError.textContent = validation.error; return; }
  const rule: KeywordRule = {
    id: id || crypto.randomUUID(),
    text: validation.normalizedText,
    type: document.querySelector<HTMLSelectElement>("#keyword-type")!.value as KeywordType,
    matchMode: document.querySelector<HTMLSelectElement>("#keyword-mode")!.value as KeywordMatchMode,
    enabled: id ? settings.keywordRules.find((item) => item.id === id)?.enabled ?? true : true,
  };
  settings = {
    ...settings,
    keywordRules: id
      ? settings.keywordRules.map((item) => item.id === id ? rule : item)
      : [...settings.keywordRules, rule],
  };
  resetKeywordForm();
  renderKeywords();
  await persist(id ? "Rule updated" : "Rule added");
});

document.querySelector("#cancel-edit")!.addEventListener("click", resetKeywordForm);
bindBoolean("enabled", (checked) => ({ ...settings, enabled: checked }));
bindBoolean("keywords-enabled", (checked) => ({ ...settings, readingTools: { ...settings.readingTools, keywordsEnabled: checked } }));
bindBoolean("sections-enabled", (checked) => ({ ...settings, readingTools: { ...settings.readingTools, sectionControlsEnabled: checked } }));
bindBoolean("focus-bar-visible", (checked) => ({ ...settings, uiPreferences: { ...settings.uiPreferences, focusBarVisible: checked } }));
bindBoolean("sync-enabled", (checked) => ({ ...settings, syncEnabled: checked }));
bindBoolean("compact-density", (checked) => ({ ...settings, searchBeta: { ...settings.searchBeta, compactDensity: checked } }));
bindBoolean("collapse-viewed", (checked) => ({ ...settings, searchBeta: { ...settings.searchBeta, collapseViewed: checked } }));
bindBoolean("collapse-applied", (checked) => ({ ...settings, searchBeta: { ...settings.searchBeta, collapseApplied: checked } }));

document.querySelector("#reset")!.addEventListener("click", async () => {
  settings = structuredClone(DEFAULT_SETTINGS);
  resetKeywordForm();
  renderAll();
  await persist("Defaults restored");
});

async function start(): Promise<void> {
  try {
    settings = await loadSettings();
  } catch {
    settings = structuredClone(DEFAULT_SETTINGS);
    feedback.textContent = "Settings storage is unavailable; showing safe defaults.";
  }
  renderAll();
}

void start();
