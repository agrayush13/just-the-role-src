import { emptyKeywordCounts } from "../shared/keywords";
import { escapeHtml } from "../shared/html";
import { bindSelectMenu, type SelectMenuController } from "../shared/select-menu";
import { recognizeSectionHeading, type SectionKind } from "../shared/sections";
import {
  CATEGORY_KEYS,
  CATEGORY_LABELS,
  DEFAULT_SETTINGS,
  EXPERIMENTAL_SEARCH_CLEANUP_AVAILABLE,
  SETTINGS_KEY,
  customizeModule,
  loadSettings,
  saveSettings,
  settingsFromStorageChange,
  settingsForPreset,
  shouldReduceMotion,
  type CategoryKey,
  type KeywordType,
  type Preset,
  type Settings,
} from "../shared/settings";
import {
  DESCRIPTION_CONTENT_SELECTORS,
  DESCRIPTION_SELECTORS,
  JOB_ROOT_SELECTORS,
  MODULE_RULES,
  OPEN_OPTIONS_MESSAGE_TYPE,
  REFRESH_MESSAGE_TYPE,
  SELECTOR_MAP_VERSION,
  STATUS_MESSAGE_TYPE,
  TITLE_SELECTORS,
  type ModuleRule,
} from "./registry";
import { highlightDescriptionText, KEYWORD_MARK_ATTR, restoreKeywordHighlights } from "./keyword-dom";
import { isSponsoredLabel, recognizedCardStatus } from "./search-beta";
import { isRendered } from "./visibility";
import { chooseFocusBarAnchor, resolveSafeModuleCandidates } from "./candidates";

const CONTROL_HOST_ID = "just-the-role-control-v2";
const INSTANCE_STOP_EVENT = "just-the-role:stop-content-instance";
const BRAND_ICON_URL = chrome.runtime.getURL("icons/icon-32.png");
const HIDDEN_ATTR = "data-jtr-hidden";
const CATEGORY_ATTR = "data-jtr-category";
const PREVIOUS_ARIA_ATTR = "data-jtr-previous-aria-hidden";
const MARK_ATTR = KEYWORD_MARK_ATTR;
const SECTION_BUTTON_ATTR = "data-jtr-section-button";
const SECTION_CONTENT_ATTR = "data-jtr-section-content";
const SEARCH_HIDDEN_ATTR = "data-jtr-search-hidden";
const SEARCH_COMPACT_ATTR = "data-jtr-search-compact";
const APPLY_DEBOUNCE_MS = 120;
const STABILIZATION_SCAN_DELAYS_MS = [150, 500, 1_200, 2_500, 5_000] as const;

document.dispatchEvent(new CustomEvent(INSTANCE_STOP_EVENT));

type PageStatus = "supported" | "unsupported" | "waiting";

interface JobView {
  root: Element;
  title: Element;
  description: Element;
  descriptionContent: Element;
}

interface DetectedSection {
  kind: SectionKind;
  label: string;
  heading: HTMLElement;
  content: HTMLElement[];
}

interface Diagnostics {
  applyMs: number;
  keywordMs: number;
  detectedModuleIds: CategoryKey[];
  sectionCount: number;
}

let settings: Settings = structuredClone(DEFAULT_SETTINGS);
let instanceActive = true;
let temporaryOriginal = false;
let pageStatus: PageStatus = "waiting";
let lastUrl = location.href;
let applyTimer: number | undefined;
let stabilizationTimers: number[] = [];
let matchedCounts: Partial<Record<CategoryKey, number>> = {};
let keywordCounts: Record<KeywordType, number> = emptyKeywordCounts();
let detectedSections: DetectedSection[] = [];
let collapsedSections = new Set<SectionKind>();
let undoSettings: Settings | null = null;
let focusPresetMenu: SelectMenuController | null = null;
let showViewed = false;
let showApplied = false;
let searchCounts = { viewed: 0, applied: 0 };
let diagnostics: Diagnostics = { applyMs: 0, keywordMs: 0, detectedModuleIds: [], sectionCount: 0 };
let appliedPreset: Preset = DEFAULT_SETTINGS.activePreset;
let appliedEnabled = DEFAULT_SETTINGS.enabled;
let initialApplyComplete = false;

const FOCUS_BAR_CATEGORY_KEYS = CATEGORY_KEYS.filter(
  (category) => category !== "topNavigation" && category !== "searchResultsPane",
);

function firstMatch(selectors: readonly string[], root: ParentNode = document): Element | null {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    if (element) return element;
  }
  return null;
}

function allMatches(selectors: readonly string[], root: ParentNode = document): Element[] {
  const matches = new Set<Element>();
  for (const selector of selectors) root.querySelectorAll(selector).forEach((element) => matches.add(element));
  return [...matches];
}

function detectJobView(): JobView | null {
  if (!location.pathname.startsWith("/jobs")) return null;
  const roots = allMatches(JOB_ROOT_SELECTORS).filter((root) => isRendered(root)).reverse();
  for (const root of roots) {
    const title = firstMatch(TITLE_SELECTORS, root);
    const description = firstMatch(DESCRIPTION_SELECTORS, root);
    if (!title || !description || !isRendered(title) || !isRendered(description)) continue;
    const descriptionContent = DESCRIPTION_CONTENT_SELECTORS.some((selector) => description.matches(selector))
      ? description
      : firstMatch(DESCRIPTION_CONTENT_SELECTORS, description) ?? description;
    return { root, title, description, descriptionContent };
  }
  return null;
}

function restoreHiddenElement(element: HTMLElement): void {
  const previousAria = element.getAttribute(PREVIOUS_ARIA_ATTR);
  if (previousAria === "__missing__") element.removeAttribute("aria-hidden");
  else if (previousAria !== null) element.setAttribute("aria-hidden", previousAria);
  element.removeAttribute(PREVIOUS_ARIA_ATTR);
  element.removeAttribute(HIDDEN_ATTR);
  element.removeAttribute(CATEGORY_ATTR);
}

function restoreLayout(): void {
  document.querySelectorAll<HTMLElement>(`[${HIDDEN_ATTR}='true']`).forEach(restoreHiddenElement);
  matchedCounts = {};
}

function hideElement(element: HTMLElement, category: CategoryKey): void {
  if (!element.hasAttribute(PREVIOUS_ARIA_ATTR)) {
    element.setAttribute(
      PREVIOUS_ARIA_ATTR,
      element.hasAttribute("aria-hidden") ? element.getAttribute("aria-hidden") ?? "" : "__missing__",
    );
  }
  element.setAttribute(CATEGORY_ATTR, category);
  element.setAttribute(HIDDEN_ATTR, "true");
  element.setAttribute("aria-hidden", "true");
}

function restoreKeywordMarks(): void {
  keywordCounts = restoreKeywordHighlights(document);
}

function applyKeywords(view: JobView): void {
  if (!settings.readingTools.keywordsEnabled || !settings.keywordRules.some((rule) => rule.enabled)) return;
  const result = highlightDescriptionText(view.descriptionContent, settings.keywordRules);
  keywordCounts = result.counts;
  diagnostics.keywordMs = result.elapsedMs;
}

function isHeadingCandidate(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const text = element.textContent?.trim() ?? "";
  if (!text || text.length > 80) return false;
  if (/^H[2-6]$/.test(element.tagName)) return true;
  if (!['P', 'DIV'].includes(element.tagName)) return false;
  const meaningfulChildren = [...element.children].filter(
    (child) => !child.matches(`[${SECTION_BUTTON_ATTR}]`),
  );
  return meaningfulChildren.length === 1 && meaningfulChildren[0].matches("strong, b");
}

function detectSections(view: JobView): DetectedSection[] {
  const children = [...view.descriptionContent.children];
  const headings = children
    .map((element, index) => ({ element, index, kind: isHeadingCandidate(element) ? recognizeSectionHeading(element.textContent ?? "") : null }))
    .filter((item): item is { element: HTMLElement; index: number; kind: SectionKind } => Boolean(item.kind));
  if (headings.length < 2) return [];
  if (new Set(headings.map((heading) => heading.kind)).size !== headings.length) return [];

  return headings.map((heading, index) => {
    const end = headings[index + 1]?.index ?? children.length;
    return {
      kind: heading.kind,
      label: heading.element.textContent?.trim() ?? heading.kind,
      heading: heading.element,
      content: children.slice(heading.index + 1, end).filter((element): element is HTMLElement => element instanceof HTMLElement),
    };
  });
}

function restoreSections(): void {
  document.querySelectorAll<HTMLElement>(`[${SECTION_BUTTON_ATTR}]`).forEach((button) => button.remove());
  document.querySelectorAll<HTMLElement>(`[${SECTION_CONTENT_ATTR}]`).forEach((element) => {
    element.removeAttribute(SECTION_CONTENT_ATTR);
    element.removeAttribute("data-jtr-section-collapsed");
  });
  detectedSections = [];
}

function applySections(view: JobView): void {
  if (!settings.readingTools.sectionControlsEnabled) return;
  detectedSections = detectSections(view);
  diagnostics.sectionCount = detectedSections.length;
  for (const section of detectedSections) {
    const collapsed = collapsedSections.has(section.kind);
    section.content.forEach((element) => {
      element.setAttribute(SECTION_CONTENT_ATTR, section.kind);
      if (collapsed) element.setAttribute("data-jtr-section-collapsed", "true");
    });
    const button = document.createElement("button");
    button.type = "button";
    button.className = "jtr-section-toggle";
    button.setAttribute(SECTION_BUTTON_ATTR, section.kind);
    button.setAttribute("data-jtr-ui", "true");
    button.setAttribute("aria-expanded", String(!collapsed));
    button.textContent = collapsed ? `Expand ${section.label}` : `Collapse ${section.label}`;
    button.addEventListener("click", () => {
      if (collapsedSections.has(section.kind)) collapsedSections.delete(section.kind);
      else collapsedSections.add(section.kind);
      scheduleApply(0);
    });
    section.heading.after(button);
  }
}

function isSponsoredCard(card: Element): boolean {
  const labels = card.querySelectorAll(
    ".job-card-container__footer-item, .job-card-list__footer-wrapper, [aria-label*='Promoted'], [aria-label*='Sponsored']",
  );
  if (isSponsoredLabel(card.textContent ?? "")) return true;
  return [...labels].some((label) => isSponsoredLabel(label.textContent ?? label.getAttribute("aria-label") ?? ""));
}

function cardStatus(card: Element): "viewed" | "applied" | null {
  const labels = card.querySelectorAll(
    ".job-card-container__footer-item, .job-card-list__footer-wrapper, .job-card-container__metadata-item",
  );
  return recognizedCardStatus([...labels].map((label) => label.textContent ?? ""));
}

function restoreSearchBeta(): void {
  document.querySelectorAll<HTMLElement>(`[${SEARCH_HIDDEN_ATTR}]`).forEach((element) => element.removeAttribute(SEARCH_HIDDEN_ATTR));
  document.querySelectorAll<HTMLElement>(`[${SEARCH_COMPACT_ATTR}]`).forEach((element) => element.removeAttribute(SEARCH_COMPACT_ATTR));
  searchCounts = { viewed: 0, applied: 0 };
}

function applySearchBeta(): void {
  if (!EXPERIMENTAL_SEARCH_CLEANUP_AVAILABLE) return;
  const searchList = firstMatch([
    ".jobs-search-results-list",
    "[data-view-name='jobs-search-results-list']",
  ]);
  if (!searchList) return;
  if (settings.searchBeta.compactDensity) searchList.setAttribute(SEARCH_COMPACT_ATTR, "true");
  const cards = searchList.querySelectorAll<HTMLElement>(
    ".jobs-search-results__list-item, li[data-occludable-job-id]",
  );
  for (const card of cards) {
    if (isSponsoredCard(card)) continue;
    const status = cardStatus(card);
    if (!status) continue;
    searchCounts[status] += 1;
    if (status === "viewed" && settings.searchBeta.collapseViewed && !showViewed) {
      card.setAttribute(SEARCH_HIDDEN_ATTR, "viewed");
    }
    if (status === "applied" && settings.searchBeta.collapseApplied && !showApplied) {
      card.setAttribute(SEARCH_HIDDEN_ATTR, "applied");
    }
  }
}

function candidatesForRule(rule: ModuleRule, view: JobView): HTMLElement[] {
  const matches = new Set<Element>();
  for (const selector of rule.selectors) {
    document.querySelectorAll(selector).forEach((candidate) => matches.add(candidate));
  }
  return resolveSafeModuleCandidates(matches, view.root, {
    allowJobDescription: rule.allowJobDescription,
  }).filter((candidate): candidate is HTMLElement => candidate instanceof HTMLElement);
}

function focusBarAnchor(view: JobView): Element {
  const aiMatchRule = MODULE_RULES.find((rule) => rule.category === "aiMatch");
  return chooseFocusBarAnchor(
    aiMatchRule ? candidatesForRule(aiMatchRule, view) : [],
    view.description,
  );
}

function controlStyles(): string {
  return `
    :host {
      all: initial;
      color-scheme: light;
      --jtr-bg: #f6f4ef;
      --jtr-surface: #ffffff;
      --jtr-text: #17201c;
      --jtr-muted: #5b6862;
      --jtr-border: #d9d8d2;
      --jtr-accent: #276749;
      --jtr-accent-hover: #1f563d;
      --jtr-accent-soft: #e3eee7;
      --jtr-focus: #8cc6ab;
    }
    :host([data-jtr-theme="dark"]) {
      color-scheme: dark;
      --jtr-bg: #17201c;
      --jtr-surface: #1f2b25;
      --jtr-text: #f2f4f2;
      --jtr-muted: #bbc5bf;
      --jtr-border: #3a4841;
      --jtr-accent: #8cc6ab;
      --jtr-accent-hover: #276749;
      --jtr-accent-soft: #25352e;
      --jtr-focus: #a8dfc4;
    }
    :host([data-jtr-menu-open="true"]) { position: relative; z-index: 2147483646; }
    * { box-sizing: border-box; }
    .bar { margin: 12px 0; padding: 12px; border: 1px solid var(--jtr-border); border-radius: 14px; background: var(--jtr-surface); color: var(--jtr-text); box-shadow: 0 8px 24px rgb(23 32 28 / .08); font: 600 13px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .bar-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .brand { display: inline-flex; align-items: center; gap: 8px; min-width: max-content; letter-spacing: -.01em; }
    .brand img { width: 24px; height: 24px; border-radius: 6px; }
    .preset { display: inline-flex; align-items: center; gap: 6px; }
    .custom-select { position: relative; min-width: 122px; color: var(--jtr-text); }
    .select-trigger { position: relative; width: 100%; min-height: 34px; padding: 5px 30px 5px 9px; text-align: left; }
    .select-trigger::after { content: ""; position: absolute; top: 50%; right: 10px; width: 8px; height: 8px; border-right: 1.75px solid currentColor; border-bottom: 1.75px solid currentColor; transform: translateY(-70%) rotate(45deg); }
    .select-trigger[aria-expanded="true"]::after { transform: translateY(-25%) rotate(225deg); }
    .select-options { position: absolute; z-index: 30; top: calc(100% + 4px); right: 0; left: 0; display: grid; gap: 2px; padding: 4px; border: 1px solid var(--jtr-border); border-radius: 10px; background: var(--jtr-bg); box-shadow: 0 12px 28px rgb(23 32 28 / .18); }
    .select-options button { position: relative; width: 100%; min-height: 34px; padding: 7px 28px 7px 9px; border: 0; background: transparent; color: inherit; text-align: left; }
    .select-options button:hover, .select-options button:focus-visible { background: var(--jtr-accent-soft); }
    .select-options button[aria-selected="true"] { color: var(--jtr-accent); }
    .select-options button[aria-selected="true"]::after { content: "✓"; position: absolute; top: 50%; right: 9px; transform: translateY(-50%); font-weight: 800; }
    .select-options button:disabled { color: var(--jtr-muted); cursor: not-allowed; opacity: .6; }
    .actions, .nav, .counts, .search { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .actions { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--jtr-border); }
    .custom-categories { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--jtr-border); }
    .custom-categories > .label { display: block; margin-bottom: 5px; font-weight: 700; }
    .custom-category-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 18px; }
    .custom-category { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 32px; color: var(--jtr-muted); font-size: 12px; font-weight: 500; cursor: pointer; }
    .custom-category input { flex: 0 0 auto; width: 17px; height: 17px; margin: 4px; accent-color: var(--jtr-accent); }
    .custom-category input:focus-visible { outline: 3px solid var(--jtr-focus); outline-offset: 2px; }
    .hidden-categories { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--jtr-border); }
    .hidden-categories > .label { display: block; font-weight: 700; }
    .hidden-categories ul { display: flex; flex-wrap: wrap; gap: 5px; margin: 6px 0 0; padding: 0; list-style: none; }
    .hidden-categories li { padding: 4px 7px; border-radius: 999px; background: var(--jtr-accent-soft); color: var(--jtr-accent); font-size: 11px; font-weight: 650; line-height: 1.25; }
    button { min-height: 34px; padding: 5px 9px; border: 1px solid var(--jtr-border); border-radius: 8px; background: var(--jtr-bg); color: var(--jtr-text); font: inherit; cursor: pointer; }
    button:hover { background: var(--jtr-accent-soft); }
    button:focus-visible { outline: 3px solid var(--jtr-focus); outline-offset: 2px; }
    .primary { border-color: var(--jtr-accent); background: var(--jtr-accent); color: #fff; }
    .primary:hover { border-color: var(--jtr-accent-hover); background: var(--jtr-accent-hover); color: #fff; }
    :host([data-jtr-theme="dark"]) .primary { color: #17201c; }
    :host([data-jtr-theme="dark"]) .primary:hover { color: #fff; }
    .status { margin: 9px 0 0; color: var(--jtr-muted); font-weight: 400; }
    .status:empty, [hidden] { display: none !important; }
    .nav, .counts, .search { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--jtr-border); }
    .label { color: var(--jtr-muted); font-size: 12px; font-weight: 500; }
    .count { padding: 3px 7px; border-radius: 99px; background: var(--jtr-accent-soft); font-size: 11px; }
    @media (max-width: 680px) { .custom-category-list { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; transition: none !important; } }
  `;
}

function pageTheme(element: Element): "light" | "dark" {
  let current: Element | null = element;
  while (current) {
    const color = getComputedStyle(current).backgroundColor;
    const channels = color.match(/[\d.]+/g)?.map(Number) ?? [];
    const alpha = channels.length > 3 ? channels[3] : 1;
    if (channels.length >= 3 && alpha > 0.05) {
      const [red, green, blue] = channels;
      const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      return luminance < 0.45 ? "dark" : "light";
    }
    current = current.parentElement;
  }
  return "light";
}

function renderFocusBar(view: JobView | null): void {
  if (!instanceActive) return;
  let host = document.getElementById(CONTROL_HOST_ID);
  focusPresetMenu?.destroy();
  focusPresetMenu = null;
  host?.removeAttribute("data-jtr-menu-open");
  if (!settings.uiPreferences.focusBarVisible || !view) {
    host?.remove();
    return;
  }
  if (!host) {
    host = document.createElement("div");
    host.id = CONTROL_HOST_ID;
    host.setAttribute("data-jtr-ui", "true");
    host.attachShadow({ mode: "open" });
  }
  host.dataset.jtrVersion = SELECTOR_MAP_VERSION;
  const anchor = focusBarAnchor(view);
  if (host.parentElement !== anchor.parentElement || host.nextElementSibling !== anchor) {
    anchor.before(host);
  }
  host.dataset.jtrTheme = pageTheme(anchor);
  const shadow = host.shadowRoot!;
  const countSummary = Object.entries(keywordCounts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `<span class="count">${type === "positive" ? "Desired" : type === "dealbreaker" ? "Check" : "Notice"}: ${count}</span>`)
    .join("");
  const nav = detectedSections
    .map((section) => `<button type="button" data-action="section" data-section="${section.kind}">${escapeHtml(section.label)}</button>`)
    .join("");
  const customCategoryControls = FOCUS_BAR_CATEGORY_KEYS
    .map((category) => `<label class="custom-category"><span>${escapeHtml(CATEGORY_LABELS[category])}</span><input type="checkbox" data-action="custom-category" data-category="${category}" aria-label="Hide ${escapeHtml(CATEGORY_LABELS[category])}" ${settings.moduleRules[category] ? "checked" : ""} /></label>`)
    .join("");
  const hiddenCategoryKeys = Object.entries(matchedCounts)
    .filter((entry): entry is [CategoryKey, number] => Boolean(entry[1]))
    .map(([category]) => category);
  const hiddenCategoryItems = hiddenCategoryKeys
    .map((category) => `<li>${escapeHtml(CATEGORY_LABELS[category])}</li>`)
    .join("");
  const hasHiddenCategories = hiddenCategoryKeys.length > 0;
  const showHiddenCategories = settings.enabled
    && !temporaryOriginal
    && settings.activePreset !== "custom"
    && hasHiddenCategories;
  const detectedBlockTypes = diagnostics.detectedModuleIds.length;
  const normalStatus = !settings.enabled
    ? "Focus Mode is off. The widget stays visible so you can enable it here."
    : settings.activePreset === "native" && detectedBlockTypes > 0
      ? `${detectedBlockTypes} optional block type${detectedBlockTypes === 1 ? "" : "s"} detected; none hidden by this view.`
    : hasHiddenCategories || detectedBlockTypes > 0
      ? ""
      : "No supported optional blocks were detected on this page.";

  shadow.innerHTML = `
    <style>${controlStyles()}</style>
    <section class="bar" aria-label="JUSTTHEROLE Focus Bar">
      <div class="bar-header">
        <span class="brand"><img src="${BRAND_ICON_URL}" alt="" width="24" height="24" />JUSTTHEROLE</span>
        <div class="preset">
          <span id="jtr-preset-label" class="label">View preset</span>
          <div class="custom-select" data-custom-select="focus-preset">
            <input type="hidden" value="${settings.activePreset}" />
            <button class="select-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="jtr-preset-label jtr-preset-value">
              <span id="jtr-preset-value" class="select-value">${settings.activePreset[0].toUpperCase()}${settings.activePreset.slice(1)}</span>
            </button>
            <div class="select-options" role="listbox" aria-labelledby="jtr-preset-label" hidden>
              ${(["balanced", "minimal", "native", "custom"] as Preset[]).map((preset) => `<button type="button" role="option" data-value="${preset}" aria-selected="${settings.activePreset === preset}" aria-disabled="false">${preset[0].toUpperCase()}${preset.slice(1)}</button>`).join("")}
            </div>
          </div>
        </div>
      </div>
      ${settings.activePreset === "custom" ? `<div class="custom-categories"><span class="label">Hide these page blocks</span><div class="custom-category-list">${customCategoryControls}</div></div>` : ""}
      ${showHiddenCategories ? `<div class="hidden-categories"><span class="label">Hidden on this page</span><ul>${hiddenCategoryItems}</ul></div>` : ""}
      <div class="actions">
        ${settings.enabled
          ? `<button type="button" data-action="keywords">Keywords</button>
             <button type="button" data-action="original">${temporaryOriginal ? "Resume focus" : "Show original"}</button>
             ${undoSettings ? '<button type="button" data-action="undo">Undo</button>' : ""}
             ${settings.activePreset === "custom" ? '<button type="button" data-action="restore-preset">Restore preset</button>' : ""}`
          : `<button class="primary" type="button" data-action="enable">Enable Focus Mode</button>
             <button type="button" data-action="keywords">Settings</button>`}
      </div>
      ${nav ? `<nav class="nav" aria-label="Job description sections"><span class="label">Jump to</span>${nav}</nav>` : ""}
      ${countSummary ? `<div class="counts" aria-label="Keyword match counts"><span class="label">Matches</span>${countSummary}</div>` : ""}
      ${EXPERIMENTAL_SEARCH_CLEANUP_AVAILABLE && ((settings.searchBeta.collapseViewed && searchCounts.viewed) || (settings.searchBeta.collapseApplied && searchCounts.applied)) ? `<div class="search"><span class="label">Search list</span>${settings.searchBeta.collapseViewed && searchCounts.viewed ? `<button type="button" data-action="show-viewed">${showViewed ? "Hide" : "Show"} viewed (${searchCounts.viewed})</button>` : ""}${settings.searchBeta.collapseApplied && searchCounts.applied ? `<button type="button" data-action="show-applied">${showApplied ? "Hide" : "Show"} applied (${searchCounts.applied})</button>` : ""}</div>` : ""}
      <p class="status" aria-live="polite">${temporaryOriginal ? "Original page shown for this job session." : normalStatus}</p>
    </section>
  `;

  focusPresetMenu = bindSelectMenu(shadow.querySelector<HTMLElement>("[data-custom-select='focus-preset']")!, {
    onOpenChange: (open) => {
      if (open) host?.setAttribute("data-jtr-menu-open", "true");
      else host?.removeAttribute("data-jtr-menu-open");
    },
    onChange: async (value) => {
      undoSettings = structuredClone(settings);
      settings = settingsForPreset(settings, value as Preset);
      temporaryOriginal = false;
      await saveSettings(settings);
      scheduleApply(0);
    },
  });
  shadow.querySelector("[data-action='enable']")?.addEventListener("click", async () => {
    settings = { ...settings, enabled: true };
    temporaryOriginal = false;
    await saveSettings(settings);
    scheduleApply(0);
  });
  shadow.querySelector("[data-action='keywords']")?.addEventListener("click", () => {
    void chrome.runtime.sendMessage({ type: OPEN_OPTIONS_MESSAGE_TYPE }).catch(() => {
      // A reloaded extension invalidates stale content contexts; the current
      // build replaces this widget through the versioned activation path.
    });
  });
  shadow.querySelector("[data-action='original']")?.addEventListener("click", () => {
    temporaryOriginal = !temporaryOriginal;
    scheduleApply(0);
  });
  shadow.querySelectorAll<HTMLInputElement>("[data-action='custom-category']").forEach((input) => {
    input.addEventListener("change", async () => {
      undoSettings = structuredClone(settings);
      settings = customizeModule(settings, input.dataset.category as CategoryKey, input.checked);
      await saveSettings(settings);
      scheduleApply(0);
    });
  });
  shadow.querySelector("[data-action='undo']")?.addEventListener("click", async () => {
    if (!undoSettings) return;
    settings = undoSettings;
    undoSettings = null;
    await saveSettings(settings);
    scheduleApply(0);
  });
  shadow.querySelector("[data-action='restore-preset']")?.addEventListener("click", async () => {
    undoSettings = structuredClone(settings);
    settings = settingsForPreset(settings, settings.customBasePreset);
    await saveSettings(settings);
    scheduleApply(0);
  });
  shadow.querySelectorAll<HTMLButtonElement>("[data-action='section']").forEach((button) => {
    button.addEventListener("click", () => {
      const section = detectedSections.find((item) => item.kind === button.dataset.section);
      const reduceMotion = shouldReduceMotion(
        settings.uiPreferences.reducedMotion,
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
      section?.heading.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    });
  });
  shadow.querySelector("[data-action='show-viewed']")?.addEventListener("click", () => { showViewed = !showViewed; scheduleApply(0); });
  shadow.querySelector("[data-action='show-applied']")?.addEventListener("click", () => { showApplied = !showApplied; scheduleApply(0); });
}

function applyLayout(view: JobView): void {
  const detected = new Set<CategoryKey>();
  for (const rule of MODULE_RULES) {
    const safeMatches = candidatesForRule(rule, view);
    if (safeMatches.length) detected.add(rule.category);
    if (!settings.moduleRules[rule.category]) continue;
    for (const candidate of safeMatches) {
      hideElement(candidate, rule.category);
    }
    if (safeMatches.length) matchedCounts[rule.category] = safeMatches.length;
  }
  diagnostics.detectedModuleIds = [...detected];
}

function restoreAllMutations(): void {
  restoreLayout();
  restoreKeywordMarks();
  restoreSections();
  restoreSearchBeta();
}

function applyFocusMode(): void {
  if (!instanceActive) return;
  const started = performance.now();
  const scrollTop = document.scrollingElement?.scrollTop ?? 0;
  restoreAllMutations();
  const view = detectJobView();
  pageStatus = view ? "supported" : location.pathname.startsWith("/jobs") ? "waiting" : "unsupported";
  diagnostics = { applyMs: 0, keywordMs: 0, detectedModuleIds: [], sectionCount: 0 };

  if (view && settings.enabled && !temporaryOriginal) {
    applyLayout(view);
    if (!settings.moduleRules.jobDescription) {
      applyKeywords(view);
      applySections(view);
    }
    applySearchBeta();
  }
  renderFocusBar(view);
  diagnostics.applyMs = Math.round((performance.now() - started) * 10) / 10;
  appliedPreset = settings.activePreset;
  appliedEnabled = settings.enabled;
  initialApplyComplete = true;
  if (document.scrollingElement && document.scrollingElement.scrollTop !== scrollTop) {
    document.scrollingElement.scrollTop = scrollTop;
  }
  observer.takeRecords();
}

function scheduleApply(delay = APPLY_DEBOUNCE_MS): void {
  if (!instanceActive) return;
  if (applyTimer !== undefined) window.clearTimeout(applyTimer);
  applyTimer = window.setTimeout(() => {
    applyTimer = undefined;
    applyFocusMode();
  }, delay);
}

function scheduleStabilizationScans(): void {
  stabilizationTimers.forEach((timer) => window.clearTimeout(timer));
  stabilizationTimers = STABILIZATION_SCAN_DELAYS_MS.map((delay) => window.setTimeout(() => {
    scheduleApply(0);
  }, delay));
}

const observer = new MutationObserver((mutations) => {
  const relevant = mutations.some((mutation) => {
    if (mutation.type !== "childList") return false;
    if (mutation.target instanceof Element && mutation.target.closest(`#${CONTROL_HOST_ID}, [${MARK_ATTR}], [data-jtr-ui]`)) return false;
    return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => {
      if (node instanceof HTMLElement) {
        return !node.closest(`#${CONTROL_HOST_ID}, [${MARK_ATTR}], [data-jtr-ui]`);
      }
      return node.nodeType === Node.TEXT_NODE;
    });
  });
  if (relevant) scheduleApply();
});

function refreshFocusBarTheme(): void {
  if (!instanceActive) return;
  const host = document.getElementById(CONTROL_HOST_ID);
  const view = host ? detectJobView() : null;
  if (host && view) host.dataset.jtrTheme = pageTheme(focusBarAnchor(view));
}

const themeObserver = new MutationObserver(refreshFocusBarTheme);

function stopContentInstance(): void {
  if (!instanceActive) return;
  instanceActive = false;
  if (applyTimer !== undefined) window.clearTimeout(applyTimer);
  stabilizationTimers.forEach((timer) => window.clearTimeout(timer));
  stabilizationTimers = [];
  observer.disconnect();
  themeObserver.disconnect();
  focusPresetMenu?.destroy();
  focusPresetMenu = null;
  restoreAllMutations();
  document.getElementById(CONTROL_HOST_ID)?.remove();
}

document.addEventListener(INSTANCE_STOP_EVENT, stopContentInstance, { once: true });

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!changes[SETTINGS_KEY]) return;
  const nextSettings = settingsFromStorageChange(areaName, changes[SETTINGS_KEY].newValue, settings);
  if (!nextSettings) return;
  settings = nextSettings;
  if (areaName === "sync") {
    void chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }
  temporaryOriginal = false;
  undoSettings = null;
  scheduleApply(0);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === REFRESH_MESSAGE_TYPE) {
    scheduleApply(0);
    sendResponse({ accepted: true });
    return;
  }
  if (message?.type !== STATUS_MESSAGE_TYPE) return;
  sendResponse({
    pageStatus,
    temporaryOriginal,
    ready: initialApplyComplete,
    selectorMapVersion: SELECTOR_MAP_VERSION,
    matchedCounts,
    keywordCounts,
    activePreset: appliedPreset,
    enabled: appliedEnabled,
    diagnostics,
    urlKind: location.pathname.startsWith("/jobs/search") ? "split-or-search" : "direct-or-other",
  });
});

function clearRouteState(): void {
  temporaryOriginal = false;
  collapsedSections = new Set();
  undoSettings = null;
  showViewed = false;
  showApplied = false;
}

function refreshRoute(): void {
  clearRouteState();
  scheduleApply(0);
  scheduleStabilizationScans();
}

async function start(): Promise<void> {
  try {
    settings = await loadSettings();
  } catch {
    // Keep the page unchanged if storage is unavailable, while preserving a
    // responsive status channel for the popup.
    settings = structuredClone(DEFAULT_SETTINGS);
  }
  observer.observe(document.body, { childList: true, subtree: true });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme", "data-color-scheme"],
  });
  themeObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme", "data-color-scheme"],
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", refreshFocusBarTheme);
  window.addEventListener("popstate", refreshRoute);
  window.addEventListener("hashchange", refreshRoute);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleApply(0);
  });
  window.setInterval(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    refreshRoute();
  }, 400);
  applyFocusMode();
  scheduleStabilizationScans();
}

void start();
