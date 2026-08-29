import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadSettings,
  saveSettings,
  type CategoryKey,
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

const CONTROL_ID = "just-the-role-control";
const HIDDEN_ATTR = "data-jtr-hidden";
const CATEGORY_ATTR = "data-jtr-category";
const PREVIOUS_ARIA_ATTR = "data-jtr-previous-aria-hidden";
const APPLY_DEBOUNCE_MS = 120;

type PageStatus = "supported" | "unsupported" | "waiting";

let settings: Settings = structuredClone(DEFAULT_SETTINGS);
let temporaryFullPage = false;
let pageStatus: PageStatus = "waiting";
let lastUrl = location.href;
let applyTimer: number | undefined;
let matchedCounts: Partial<Record<CategoryKey, number>> = {};

function firstMatch(selectors: readonly string[], root: ParentNode = document): Element | null {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    if (element) return element;
  }
  return null;
}

function detectJobView(): { root: Element; title: Element; description: Element } | null {
  if (!location.pathname.startsWith("/jobs")) return null;
  const root = firstMatch(JOB_ROOT_SELECTORS);
  if (!root) return null;
  const title = firstMatch(TITLE_SELECTORS, root) ?? firstMatch(TITLE_SELECTORS);
  const description = firstMatch(DESCRIPTION_SELECTORS, root);
  if (!title || !description) return null;
  return { root, title, description };
}

function restoreElement(element: HTMLElement): void {
  const previousAria = element.getAttribute(PREVIOUS_ARIA_ATTR);
  if (previousAria === "__missing__") element.removeAttribute("aria-hidden");
  else if (previousAria !== null) element.setAttribute("aria-hidden", previousAria);
  element.removeAttribute(PREVIOUS_ARIA_ATTR);
  element.removeAttribute(HIDDEN_ATTR);
  element.removeAttribute(CATEGORY_ATTR);
}

function restoreAll(): void {
  document.querySelectorAll<HTMLElement>(`[${HIDDEN_ATTR}='true']`).forEach(restoreElement);
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

function setControlState(control: HTMLElement): void {
  const active = settings.enabled && !temporaryFullPage && pageStatus === "supported";
  const toggle = control.querySelector<HTMLButtonElement>("[data-jtr-action='toggle']");
  const escape = control.querySelector<HTMLButtonElement>("[data-jtr-action='full-page']");
  const status = control.querySelector<HTMLElement>("[data-jtr-status]");
  if (!toggle || !escape || !status) return;

  toggle.setAttribute("aria-pressed", String(active));
  toggle.dataset.active = String(active);
  toggle.querySelector<HTMLElement>("[data-jtr-toggle-label]")!.textContent = active
    ? "Focus Mode on"
    : "Focus Mode off";
  escape.hidden = !active;
  status.textContent = pageStatus === "supported" ? "" : "Waiting for a supported job view";
}

function createControl(): HTMLElement {
  const control = document.createElement("section");
  control.id = CONTROL_ID;
  control.className = "jtr-control";
  control.setAttribute("aria-label", "JustTheRole controls");
  control.innerHTML = `
    <div class="jtr-control__row">
      <span class="jtr-control__brand">JustTheRole</span>
      <button class="jtr-toggle" type="button" data-jtr-action="toggle" aria-pressed="false">
        <span class="jtr-toggle__icon" aria-hidden="true">◐</span>
        <span data-jtr-toggle-label>Focus Mode off</span>
      </button>
      <button class="jtr-link-button" type="button" data-jtr-action="full-page" hidden>Show full page</button>
    </div>
    <p class="jtr-control__status" data-jtr-status aria-live="polite"></p>
  `;

  control.querySelector("[data-jtr-action='toggle']")?.addEventListener("click", async () => {
    temporaryFullPage = false;
    settings = { ...settings, enabled: !settings.enabled };
    await saveSettings(settings);
    scheduleApply(0);
  });

  control.querySelector("[data-jtr-action='full-page']")?.addEventListener("click", () => {
    temporaryFullPage = true;
    restoreAll();
    setControlState(control);
  });

  return control;
}

function ensureControl(view: ReturnType<typeof detectJobView>): void {
  let control = document.getElementById(CONTROL_ID);
  if (!view) {
    if (control) setControlState(control);
    return;
  }
  if (!control) control = createControl();
  if (!control.isConnected) view.description.before(control);
  setControlState(control);
}

function applyFocusMode(): void {
  const view = detectJobView();
  pageStatus = view ? "supported" : location.pathname.startsWith("/jobs") ? "waiting" : "unsupported";
  restoreAll();
  ensureControl(view);

  if (!view || !settings.enabled || temporaryFullPage) return;

  for (const rule of MODULE_RULES) {
    if (!settings.categories[rule.category]) continue;
    const matches = new Set<Element>();
    for (const selector of rule.selectors) {
      document.querySelectorAll(selector).forEach((element) => matches.add(element));
    }
    let safeCount = 0;
    for (const candidate of matches) {
      if (!(candidate instanceof HTMLElement) || !isSafeCandidate(candidate, view.root)) continue;
      hideElement(candidate, rule.category);
      safeCount += 1;
    }
    if (safeCount) matchedCounts[rule.category] = safeCount;
  }
  setControlState(document.getElementById(CONTROL_ID)!);
}

function scheduleApply(delay = APPLY_DEBOUNCE_MS): void {
  if (applyTimer !== undefined) window.clearTimeout(applyTimer);
  applyTimer = window.setTimeout(() => {
    applyTimer = undefined;
    applyFocusMode();
  }, delay);
}

const observer = new MutationObserver((mutations) => {
  const relevant = mutations.some(
    (mutation) =>
      mutation.type === "childList" &&
      [...mutation.addedNodes, ...mutation.removedNodes].some(
        (node) => node instanceof HTMLElement && !node.closest(`#${CONTROL_ID}`),
      ),
  );
  if (relevant) scheduleApply();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[SETTINGS_KEY]) return;
  settings = changes[SETTINGS_KEY].newValue as Settings;
  temporaryFullPage = false;
  scheduleApply(0);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "JTR_GET_STATUS") {
    sendResponse({
      pageStatus,
      temporaryFullPage,
      selectorMapVersion: SELECTOR_MAP_VERSION,
      matchedCounts,
      urlKind: location.pathname.startsWith("/jobs/search") ? "split-or-search" : "direct-or-other",
    });
  }
});

async function start(): Promise<void> {
  settings = await loadSettings();
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("popstate", () => scheduleApply(0));
  window.addEventListener("hashchange", () => scheduleApply(0));
  window.setInterval(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    temporaryFullPage = false;
    scheduleApply(0);
  }, 400);
  applyFocusMode();
}

void start();
