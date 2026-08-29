export const SETTINGS_KEY = "settingsV2" as const;
export const LEGACY_SETTINGS_KEY = "settingsV1" as const;
export const SETTINGS_SCHEMA_VERSION = 2 as const;

export const CATEGORY_KEYS = [
  "aiMatch",
  "applicantInsights",
  "premiumUpsells",
  "recommendations",
  "footerPromotions",
  "applicantCount",
  "hiringTeam",
  "peopleConnections",
  "companyOverview",
  "topNavigation",
  "searchResultsPane",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];
export type Preset = "minimal" | "balanced" | "native" | "custom";
export type KeywordType = "positive" | "neutral" | "dealbreaker";
export type KeywordMatchMode = "whole-word" | "phrase";

export interface KeywordRule {
  id: string;
  text: string;
  type: KeywordType;
  matchMode: KeywordMatchMode;
  enabled: boolean;
}

export interface Settings {
  schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
  enabled: boolean;
  activePreset: Preset;
  customBasePreset: Exclude<Preset, "custom">;
  moduleRules: Record<CategoryKey, boolean>;
  keywordRules: KeywordRule[];
  readingTools: { keywordsEnabled: boolean; sectionControlsEnabled: boolean };
  searchBeta: { compactDensity: boolean; collapseViewed: boolean; collapseApplied: boolean };
  syncEnabled: boolean;
  uiPreferences: { reducedMotion: "system" | "reduce"; controlPlacement: "inline" };
}

export interface SaveResult { syncError?: string }

export function shouldReduceMotion(
  preference: Settings["uiPreferences"]["reducedMotion"],
  systemPrefersReduced: boolean,
): boolean {
  return preference === "reduce" || (preference === "system" && systemPrefersReduced);
}

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  aiMatch: "AI and profile match",
  applicantInsights: "Applicant insights",
  premiumUpsells: "Premium and resume upsells",
  recommendations: "Related and recommended jobs",
  footerPromotions: "Footer and promotions",
  applicantCount: "Applicant count",
  hiringTeam: "Hiring team and recruiter",
  peopleConnections: "People and connections",
  companyOverview: "Company overview",
  topNavigation: "Top navigation",
  searchResultsPane: "Search results pane",
};

export const BALANCED_RULES: Record<CategoryKey, boolean> = {
  aiMatch: true,
  applicantInsights: false,
  premiumUpsells: true,
  recommendations: true,
  footerPromotions: true,
  applicantCount: false,
  hiringTeam: false,
  peopleConnections: false,
  companyOverview: false,
  topNavigation: false,
  searchResultsPane: false,
};

export const MINIMAL_RULES: Record<CategoryKey, boolean> = {
  aiMatch: true,
  applicantInsights: true,
  premiumUpsells: true,
  recommendations: true,
  footerPromotions: true,
  applicantCount: true,
  hiringTeam: true,
  peopleConnections: true,
  companyOverview: true,
  topNavigation: false,
  searchResultsPane: false,
};

export const NATIVE_RULES: Record<CategoryKey, boolean> = Object.fromEntries(
  CATEGORY_KEYS.map((key) => [key, false]),
) as Record<CategoryKey, boolean>;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  enabled: false,
  activePreset: "balanced",
  customBasePreset: "balanced",
  moduleRules: structuredClone(BALANCED_RULES),
  keywordRules: [],
  readingTools: { keywordsEnabled: true, sectionControlsEnabled: true },
  searchBeta: { compactDensity: false, collapseViewed: false, collapseApplied: false },
  syncEnabled: false,
  uiPreferences: { reducedMotion: "system", controlPlacement: "inline" },
};

interface LegacySettings {
  schemaVersion?: number;
  enabled?: unknown;
  categories?: Partial<Record<CategoryKey, unknown>>;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeModuleRules(
  value: unknown,
  fallback: Record<CategoryKey, boolean>,
): Record<CategoryKey, boolean> {
  const input = value && typeof value === "object"
    ? (value as Partial<Record<CategoryKey, unknown>>)
    : {};
  return Object.fromEntries(
    CATEGORY_KEYS.map((key) => [key, bool(input[key], fallback[key])]),
  ) as Record<CategoryKey, boolean>;
}

export function migrateLegacySettings(value: unknown): Settings {
  const legacy = value && typeof value === "object" ? (value as LegacySettings) : {};
  return {
    ...structuredClone(DEFAULT_SETTINGS),
    enabled: bool(legacy.enabled, false),
    activePreset: "custom",
    customBasePreset: "balanced",
    moduleRules: normalizeModuleRules(legacy.categories, BALANCED_RULES),
  };
}

export function normalizeSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return structuredClone(DEFAULT_SETTINGS);
  const input = value as Partial<Settings>;
  if (input.schemaVersion !== SETTINGS_SCHEMA_VERSION) return migrateLegacySettings(value);

  const validPreset: Preset[] = ["minimal", "balanced", "native", "custom"];
  const validBase: Settings["customBasePreset"][] = ["minimal", "balanced", "native"];
  const keywordRules: KeywordRule[] = [];
  const seenKeywordIds = new Set<string>();
  const seenKeywordTexts = new Set<string>();
  if (Array.isArray(input.keywordRules)) {
    for (const value of input.keywordRules) {
      if (!value || typeof value !== "object") continue;
      const rule = value as Partial<KeywordRule>;
      const text = typeof rule.text === "string"
        ? rule.text.trim().replace(/\s+/g, " ").slice(0, 60)
        : "";
      const normalizedText = text.toLocaleLowerCase();
      if (!text || seenKeywordTexts.has(normalizedText)) continue;
      let id = typeof rule.id === "string" && rule.id ? rule.id : crypto.randomUUID();
      while (seenKeywordIds.has(id)) id = crypto.randomUUID();
      keywordRules.push({
        id,
        text,
        type: (["positive", "neutral", "dealbreaker"] as const).includes(rule.type as KeywordType)
          ? rule.type as KeywordType
          : "neutral",
        matchMode: (["whole-word", "phrase"] as const).includes(rule.matchMode as KeywordMatchMode)
          ? rule.matchMode as KeywordMatchMode
          : "whole-word",
        enabled: bool(rule.enabled, true),
      });
      seenKeywordIds.add(id);
      seenKeywordTexts.add(normalizedText);
      if (keywordRules.length === 50) break;
    }
  }

  const activePreset = validPreset.includes(input.activePreset as Preset)
    ? (input.activePreset as Preset)
    : "balanced";
  const customBasePreset = validBase.includes(input.customBasePreset as Settings["customBasePreset"])
    ? (input.customBasePreset as Settings["customBasePreset"])
    : "balanced";

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    enabled: bool(input.enabled, false),
    activePreset,
    customBasePreset,
    moduleRules: normalizeModuleRules(input.moduleRules, BALANCED_RULES),
    keywordRules,
    readingTools: {
      keywordsEnabled: bool(input.readingTools?.keywordsEnabled, true),
      sectionControlsEnabled: bool(input.readingTools?.sectionControlsEnabled, true),
    },
    searchBeta: {
      compactDensity: bool(input.searchBeta?.compactDensity, false),
      collapseViewed: bool(input.searchBeta?.collapseViewed, false),
      collapseApplied: bool(input.searchBeta?.collapseApplied, false),
    },
    syncEnabled: bool(input.syncEnabled, false),
    uiPreferences: {
      reducedMotion: input.uiPreferences?.reducedMotion === "reduce" ? "reduce" : "system",
      controlPlacement: "inline",
    },
  };
}

export function settingsFromStorageChange(
  areaName: string,
  newValue: unknown,
  currentSettings: Settings,
): Settings | null {
  if (areaName === "local") {
    return newValue === undefined ? null : normalizeSettings(newValue);
  }
  if (areaName !== "sync" || !currentSettings.syncEnabled) return null;
  if (newValue === undefined) return { ...currentSettings, syncEnabled: false };
  return { ...normalizeSettings(newValue), syncEnabled: true };
}

export function settingsForPreset(settings: Settings, preset: Preset): Settings {
  if (preset === "custom") return { ...settings, activePreset: "custom" };
  const rules = preset === "minimal" ? MINIMAL_RULES : preset === "native" ? NATIVE_RULES : BALANCED_RULES;
  return {
    ...settings,
    activePreset: preset,
    customBasePreset: preset,
    moduleRules: structuredClone(rules),
  };
}

export function customizeModule(settings: Settings, category: CategoryKey, hidden: boolean): Settings {
  return {
    ...settings,
    activePreset: "custom",
    customBasePreset: settings.activePreset === "custom" ? settings.customBasePreset : settings.activePreset,
    moduleRules: { ...settings.moduleRules, [category]: hidden },
  };
}

export async function loadSettings(): Promise<Settings> {
  if (typeof chrome === "undefined" || !chrome.storage) return structuredClone(DEFAULT_SETTINGS);
  const local = await chrome.storage.local.get([SETTINGS_KEY, LEGACY_SETTINGS_KEY]);
  let normalized: Settings;
  if (local[SETTINGS_KEY]) normalized = normalizeSettings(local[SETTINGS_KEY]);
  else if (local[LEGACY_SETTINGS_KEY]) normalized = migrateLegacySettings(local[LEGACY_SETTINGS_KEY]);
  else normalized = structuredClone(DEFAULT_SETTINGS);

  if (normalized.syncEnabled) {
    try {
      const synced = await chrome.storage.sync.get(SETTINGS_KEY);
      if (synced[SETTINGS_KEY]) normalized = { ...normalizeSettings(synced[SETTINGS_KEY]), syncEnabled: true };
    } catch {
      // Local configuration remains authoritative when Sync is unavailable.
    }
  }
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalized });
  return normalized;
}

export async function saveSettings(settings: Settings): Promise<SaveResult> {
  const normalized = normalizeSettings(settings);
  if (typeof chrome === "undefined" || !chrome.storage) return {};
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalized });
  if (!normalized.syncEnabled) {
    try { await chrome.storage.sync.remove(SETTINGS_KEY); } catch { /* Sync may be unavailable. */ }
    return {};
  }
  try {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: normalized });
    return {};
  } catch (error) {
    return { syncError: error instanceof Error ? error.message : "Chrome Sync is unavailable" };
  }
}
