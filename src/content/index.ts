import { emptyKeywordCounts } from "../shared/keywords";
import { recognizeSectionHeading, type SectionKind } from "../shared/sections";
import {
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
import {
  DESCRIPTION_SELECTORS,
  JOB_ROOT_SELECTORS,
  MODULE_RULES,
  SELECTOR_MAP_VERSION,
  TITLE_SELECTORS,
  isSafeCandidate,
} from "./registry";
import { highlightDescriptionText, KEYWORD_MARK_ATTR, restoreKeywordHighlights } from "./keyword-dom";
import { isSponsoredLabel, recognizedCardStatus } from "./search-beta";

const CONTROL_HOST_ID = "just-the-role-control";
const HIDDEN_ATTR = "data-jtr-hidden";
const CATEGORY_ATTR = "data-jtr-category";
const PREVIOUS_ARIA_ATTR = "data-jtr-previous-aria-hidden";
const MARK_ATTR = KEYWORD_MARK_ATTR;
const SECTION_BUTTON_ATTR = "data-jtr-section-button";
const SECTION_CONTENT_ATTR = "data-jtr-section-content";
const PICKER_ATTR = "data-jtr-picker-category";
const PICKER_LABEL_ATTR = "data-jtr-picker-label";
const SEARCH_HIDDEN_ATTR = "data-jtr-search-hidden";
const SEARCH_COMPACT_ATTR = "data-jtr-search-compact";
const APPLY_DEBOUNCE_MS = 120;

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
let temporaryOriginal = false;
let pageStatus: PageStatus = "waiting";
let lastUrl = location.href;
let applyTimer: number | undefined;
let matchedCounts: Partial<Record<CategoryKey, number>> = {};
let keywordCounts: Record<KeywordType, number> = emptyKeywordCounts();
let detectedSections: DetectedSection[] = [];
let collapsedSections = new Set<SectionKind>();
let pickerActive = false;
let undoSettings: Settings | null = null;
let showViewed = false;
let showApplied = false;
let searchCounts = { viewed: 0, applied: 0 };
let diagnostics: Diagnostics = { applyMs: 0, keywordMs: 0, detectedModuleIds: [], sectionCount: 0 };

function firstMatch(selectors: readonly string[], root: ParentNode = document): Element | null {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    if (element) return element;
  }
  return null;
}

function detectJobView(): JobView | null {
  if (!location.pathname.startsWith("/jobs")) return null;
  const root = firstMatch(JOB_ROOT_SELECTORS);
  if (!root) return null;
  const title = firstMatch(TITLE_SELECTORS, root) ?? firstMatch(TITLE_SELECTORS);
  const description = firstMatch(DESCRIPTION_SELECTORS, root);
  if (!title || !description) return null;
  const descriptionContent =
    description.matches(".jobs-box__html-content")
      ? description
      : description.querySelector(".jobs-box__html-content") ?? description;
  return { root, title, description, descriptionContent };
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

function collectCandidates(view: JobView): Map<CategoryKey, HTMLElement[]> {
  const candidates = new Map<CategoryKey, HTMLElement[]>();
  for (const rule of MODULE_RULES.filter((item) => item.selectable)) {
    const matches = new Set<HTMLElement>();
    for (const selector of rule.selectors) {
      document.querySelectorAll<HTMLElement>(selector).forEach((candidate) => {
        if (isSafeCandidate(candidate, view.root)) matches.add(candidate);
      });
    }
    if (matches.size) candidates.set(rule.category, [...matches]);
  }
  return candidates;
}

function cancelPicker(): void {
  pickerActive = false;
  document.querySelectorAll<HTMLElement>(`[${PICKER_ATTR}]`).forEach((element) => {
    element.removeAttribute(PICKER_ATTR);
    element.removeAttribute(PICKER_LABEL_ATTR);
  });
  document.removeEventListener("click", onPickerClick, true);
  document.removeEventListener("keydown", onPickerKeydown, true);
}

async function chooseCandidate(category: CategoryKey): Promise<void> {
  undoSettings = structuredClone(settings);
  settings = customizeModule(settings, category, !settings.moduleRules[category]);
  cancelPicker();
  await saveSettings(settings);
  scheduleApply(0);
}

function onPickerClick(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>(`[${PICKER_ATTR}]`) : null;
  if (!target) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void chooseCandidate(target.getAttribute(PICKER_ATTR) as CategoryKey);
}

function onPickerKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  event.preventDefault();
  cancelPicker();
  renderFocusBar(detectJobView());
  document.getElementById(CONTROL_HOST_ID)?.shadowRoot?.querySelector<HTMLButtonElement>("[data-action='customize']")?.focus();
}

function startPicker(view: JobView): void {
  cancelPicker();
  const candidates = collectCandidates(view);
  candidates.forEach((elements, category) => {
    elements.forEach((element) => {
      element.setAttribute(PICKER_ATTR, category);
      element.setAttribute(PICKER_LABEL_ATTR, CATEGORY_LABELS[category]);
    });
  });
  pickerActive = true;
  document.addEventListener("click", onPickerClick, true);
  document.addEventListener("keydown", onPickerKeydown, true);
  renderFocusBar(view, candidates);
}

function controlStyles(): string {
  return `
    :host { all: initial; color-scheme: light; }
    :host([data-jtr-theme="dark"]) { color-scheme: dark; }
    * { box-sizing: border-box; }
    .bar { margin: 12px 0; padding: 10px 12px; border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 12px; background: Canvas; color: CanvasText; font: 600 13px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .row, .nav, .counts, .search { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .brand { margin-right: auto; letter-spacing: -.01em; }
    button, select { min-height: 34px; padding: 5px 9px; border: 1px solid color-mix(in srgb, CanvasText 34%, transparent); border-radius: 8px; background: Canvas; color: CanvasText; font: inherit; cursor: pointer; }
    button:hover { background: color-mix(in srgb, CanvasText 8%, Canvas); }
    button:focus-visible, select:focus-visible { outline: 3px solid #70b5f9; outline-offset: 2px; }
    .primary { border-color: #0a66c2; color: #0a66c2; }
    .status { margin: 7px 0 0; color: GrayText; font-weight: 400; }
    .status:empty, [hidden] { display: none !important; }
    .nav, .counts, .search { margin-top: 8px; padding-top: 8px; border-top: 1px solid color-mix(in srgb, CanvasText 12%, transparent); }
    .label { color: GrayText; font-size: 12px; font-weight: 500; }
    .count { padding: 3px 7px; border-radius: 99px; background: color-mix(in srgb, CanvasText 8%, Canvas); font-size: 11px; }
    dialog { width: min(480px, calc(100vw - 32px)); max-height: 70vh; padding: 0; border: 1px solid color-mix(in srgb, CanvasText 22%, transparent); border-radius: 14px; background: Canvas; color: CanvasText; }
    dialog::backdrop { background: rgb(0 0 0 / .35); }
    .dialog-inner { padding: 18px; font: 500 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .dialog-inner h2 { margin: 0 0 6px; font-size: 18px; }
    .dialog-inner p { margin: 0 0 12px; color: GrayText; }
    .candidate-list { display: grid; gap: 7px; margin-bottom: 12px; }
    .candidate-list button { text-align: left; }
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

function renderFocusBar(view: JobView | null, candidates?: Map<CategoryKey, HTMLElement[]>): void {
  let host = document.getElementById(CONTROL_HOST_ID);
  if (!settings.enabled || !view) {
    host?.remove();
    return;
  }
  if (!host) {
    host = document.createElement("div");
    host.id = CONTROL_HOST_ID;
    host.setAttribute("data-jtr-ui", "true");
    host.attachShadow({ mode: "open" });
    view.description.before(host);
  }
  host.dataset.jtrTheme = pageTheme(view.description);
  const shadow = host.shadowRoot!;
  const countSummary = Object.entries(keywordCounts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `<span class="count">${type === "positive" ? "Desired" : type === "dealbreaker" ? "Check" : "Notice"}: ${count}</span>`)
    .join("");
  const nav = detectedSections
    .map((section) => `<button type="button" data-action="section" data-section="${section.kind}">${section.label}</button>`)
    .join("");
  const pickerList = [...(candidates ?? collectCandidates(view))]
    .map(([category, elements]) => `<button type="button" data-action="candidate" data-category="${category}">${settings.moduleRules[category] ? "Show" : "Hide"} ${CATEGORY_LABELS[category]} (${elements.length})</button>`)
    .join("");

  shadow.innerHTML = `
    <style>${controlStyles()}</style>
    <section class="bar" aria-label="JustTheRole Focus Bar">
      <div class="row">
        <span class="brand">JustTheRole</span>
        <label><span class="label">View </span>
          <select data-action="preset" aria-label="Focus preset">
            ${(["minimal", "balanced", "native", "custom"] as Preset[]).map((preset) => `<option value="${preset}" ${settings.activePreset === preset ? "selected" : ""}>${preset[0].toUpperCase()}${preset.slice(1)}</option>`).join("")}
          </select>
        </label>
        <button class="primary" type="button" data-action="customize">Customize page</button>
        <button type="button" data-action="keywords">Keywords</button>
        <button type="button" data-action="original">${temporaryOriginal ? "Resume focus" : "Show original"}</button>
        ${undoSettings ? '<button type="button" data-action="undo">Undo</button>' : ""}
        ${settings.activePreset === "custom" ? '<button type="button" data-action="restore-preset">Restore preset</button>' : ""}
      </div>
      ${nav ? `<nav class="nav" aria-label="Job description sections"><span class="label">Jump to</span>${nav}</nav>` : ""}
      ${countSummary ? `<div class="counts" aria-label="Keyword match counts"><span class="label">Matches</span>${countSummary}</div>` : ""}
      ${(settings.searchBeta.collapseViewed && searchCounts.viewed) || (settings.searchBeta.collapseApplied && searchCounts.applied) ? `<div class="search"><span class="label">Search list</span>${settings.searchBeta.collapseViewed && searchCounts.viewed ? `<button type="button" data-action="show-viewed">${showViewed ? "Hide" : "Show"} viewed (${searchCounts.viewed})</button>` : ""}${settings.searchBeta.collapseApplied && searchCounts.applied ? `<button type="button" data-action="show-applied">${showApplied ? "Hide" : "Show"} applied (${searchCounts.applied})</button>` : ""}</div>` : ""}
      <p class="status" aria-live="polite">${pickerActive ? "Choose an outlined block or use the accessible list. Press Escape to cancel." : temporaryOriginal ? "Original page shown for this job session." : ""}</p>
    </section>
    <dialog aria-labelledby="jtr-picker-title">
      <div class="dialog-inner">
        <h2 id="jtr-picker-title">Customize this page</h2>
        <p>Only supported, non-essential categories are available. No page text or DOM path is saved.</p>
        <div class="candidate-list">${pickerList || "<span>No supported blocks detected.</span>"}</div>
        <button type="button" data-action="cancel-picker">Cancel</button>
      </div>
    </dialog>
  `;

  shadow.querySelector<HTMLSelectElement>("[data-action='preset']")?.addEventListener("change", async (event) => {
    undoSettings = structuredClone(settings);
    settings = settingsForPreset(settings, (event.currentTarget as HTMLSelectElement).value as Preset);
    temporaryOriginal = false;
    await saveSettings(settings);
    scheduleApply(0);
  });
  shadow.querySelector("[data-action='customize']")?.addEventListener("click", () => startPicker(view));
  shadow.querySelector("[data-action='keywords']")?.addEventListener("click", () => void chrome.runtime.openOptionsPage());
  shadow.querySelector("[data-action='original']")?.addEventListener("click", () => {
    temporaryOriginal = !temporaryOriginal;
    scheduleApply(0);
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
      section?.heading.scrollIntoView({ block: "start", behavior: settings.uiPreferences.reducedMotion === "reduce" ? "auto" : "smooth" });
    });
  });
  shadow.querySelectorAll<HTMLButtonElement>("[data-action='candidate']").forEach((button) => {
    button.addEventListener("click", () => void chooseCandidate(button.dataset.category as CategoryKey));
  });
  shadow.querySelector("[data-action='cancel-picker']")?.addEventListener("click", () => {
    cancelPicker();
    renderFocusBar(view);
    host?.shadowRoot?.querySelector<HTMLButtonElement>("[data-action='customize']")?.focus();
  });
  shadow.querySelector("[data-action='show-viewed']")?.addEventListener("click", () => { showViewed = !showViewed; scheduleApply(0); });
  shadow.querySelector("[data-action='show-applied']")?.addEventListener("click", () => { showApplied = !showApplied; scheduleApply(0); });
  if (pickerActive) {
    const dialog = shadow.querySelector<HTMLDialogElement>("dialog")!;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-action='candidate'], [data-action='cancel-picker']")?.focus();
  }
}

function applyLayout(view: JobView): void {
  const detected = new Set<CategoryKey>();
  for (const rule of MODULE_RULES) {
    const matches = new Set<Element>();
    for (const selector of rule.selectors) document.querySelectorAll(selector).forEach((element) => matches.add(element));
    if (matches.size) detected.add(rule.category);
    if (!settings.moduleRules[rule.category]) continue;
    let safeCount = 0;
    for (const candidate of matches) {
      if (!(candidate instanceof HTMLElement) || !isSafeCandidate(candidate, view.root)) continue;
      hideElement(candidate, rule.category);
      safeCount += 1;
    }
    if (safeCount) matchedCounts[rule.category] = safeCount;
  }
  diagnostics.detectedModuleIds = [...detected];
}

function restoreAllMutations(): void {
  cancelPicker();
  restoreLayout();
  restoreKeywordMarks();
  restoreSections();
  restoreSearchBeta();
}

function applyFocusMode(): void {
  const started = performance.now();
  const scrollTop = document.scrollingElement?.scrollTop ?? 0;
  const view = detectJobView();
  pageStatus = view ? "supported" : location.pathname.startsWith("/jobs") ? "waiting" : "unsupported";
  restoreAllMutations();
  diagnostics = { applyMs: 0, keywordMs: 0, detectedModuleIds: [], sectionCount: 0 };

  if (view && settings.enabled && !temporaryOriginal) {
    applyLayout(view);
    applyKeywords(view);
    applySections(view);
    applySearchBeta();
  }
  renderFocusBar(view);
  diagnostics.applyMs = Math.round((performance.now() - started) * 10) / 10;
  if (document.scrollingElement && document.scrollingElement.scrollTop !== scrollTop) {
    document.scrollingElement.scrollTop = scrollTop;
  }
  observer.takeRecords();
}

function scheduleApply(delay = APPLY_DEBOUNCE_MS): void {
  if (applyTimer !== undefined) window.clearTimeout(applyTimer);
  applyTimer = window.setTimeout(() => {
    applyTimer = undefined;
    applyFocusMode();
  }, delay);
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

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!['local', 'sync'].includes(areaName) || !changes[SETTINGS_KEY]) return;
  settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
  temporaryOriginal = false;
  undoSettings = null;
  scheduleApply(0);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "JTR_GET_STATUS") return;
  sendResponse({
    pageStatus,
    temporaryOriginal,
    selectorMapVersion: SELECTOR_MAP_VERSION,
    matchedCounts,
    keywordCounts,
    activePreset: settings.activePreset,
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

async function start(): Promise<void> {
  settings = await loadSettings();
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("popstate", () => { clearRouteState(); scheduleApply(0); });
  window.addEventListener("hashchange", () => { clearRouteState(); scheduleApply(0); });
  window.setInterval(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    clearRouteState();
    scheduleApply(0);
  }, 400);
  applyFocusMode();
}

void start();
