export const SETTINGS_KEY = "settingsV1" as const;
export const SETTINGS_SCHEMA_VERSION = 1 as const;

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

export interface Settings {
  schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
  enabled: boolean;
  categories: Record<CategoryKey, boolean>;
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  enabled: false,
  categories: {
    aiMatch: true,
    applicantInsights: true,
    premiumUpsells: true,
    recommendations: true,
    footerPromotions: true,
    applicantCount: false,
    hiringTeam: false,
    peopleConnections: false,
    companyOverview: false,
    topNavigation: false,
    searchResultsPane: false,
  },
};

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

export function normalizeSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return structuredClone(DEFAULT_SETTINGS);
  const input = value as Partial<Settings>;
  const inputCategories = input.categories ?? ({} as Partial<Record<CategoryKey, boolean>>);
  const categories = Object.fromEntries(
    CATEGORY_KEYS.map((key) => [
      key,
      typeof inputCategories[key] === "boolean"
        ? inputCategories[key]
        : DEFAULT_SETTINGS.categories[key],
    ]),
  ) as Record<CategoryKey, boolean>;

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    enabled: typeof input.enabled === "boolean" ? input.enabled : DEFAULT_SETTINGS.enabled,
    categories,
  };
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}
