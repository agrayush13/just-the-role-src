import assert from "node:assert/strict";
import test from "node:test";
import {
  BALANCED_RULES,
  CATEGORY_KEYS,
  DEFAULT_SETTINGS,
  MINIMAL_RULES,
  customizeModule,
  enableSettingsSync,
  loadSettings,
  migrateLegacySettings,
  normalizeSettings,
  saveSettings,
  settingsFromStorageChange,
  settingsForPreset,
  shouldReduceMotion,
} from "../src/shared/settings";

test("new installs are disabled with Balanced selected", () => {
  const settings = normalizeSettings(undefined);
  assert.equal(settings.enabled, false);
  assert.equal(settings.activePreset, "balanced");
  assert.deepEqual(settings.moduleRules, BALANCED_RULES);
  assert.deepEqual(settings.customModuleRules, BALANCED_RULES);
  assert.deepEqual(settings.searchBeta, {
    compactDensity: false,
    collapseViewed: false,
    collapseApplied: false,
  });
  assert.equal(settings.uiPreferences.focusBarVisible, true);
});

test("the on-page widget preference is normalized and can be hidden independently", () => {
  const settings = normalizeSettings({
    ...structuredClone(DEFAULT_SETTINGS),
    uiPreferences: { ...DEFAULT_SETTINGS.uiPreferences, focusBarVisible: false },
  });
  assert.equal(settings.enabled, false);
  assert.equal(settings.uiPreferences.focusBarVisible, false);
});

test("legacy settings migrate to Custom without changing effective visibility", () => {
  const legacyCategories = Object.fromEntries(
    CATEGORY_KEYS.map((key, index) => [key, index % 2 === 0]),
  );
  const settings = migrateLegacySettings({ schemaVersion: 1, enabled: true, categories: legacyCategories });
  assert.equal(settings.enabled, true);
  assert.equal(settings.activePreset, "custom");
  assert.deepEqual(settings.moduleRules, legacyCategories);
  assert.deepEqual(settings.customModuleRules, legacyCategories);
});

test("preset resolution is deterministic and does not mutate defaults", () => {
  const settings = settingsForPreset(structuredClone(DEFAULT_SETTINGS), "minimal");
  assert.deepEqual(settings.moduleRules, MINIMAL_RULES);
  settings.moduleRules.aiMatch = false;
  assert.equal(MINIMAL_RULES.aiMatch, true);
});

test("Custom has one stable saved configuration regardless of the preceding preset", () => {
  const minimal = settingsForPreset(structuredClone(DEFAULT_SETTINGS), "minimal");
  const custom = settingsForPreset(minimal, "custom");
  assert.equal(custom.activePreset, "custom");
  assert.equal(custom.customBasePreset, "balanced");
  assert.deepEqual(custom.moduleRules, BALANCED_RULES);

  const customized = customizeModule(custom, "applicantInsights", true);
  const native = settingsForPreset(customized, "native");
  const restored = settingsForPreset(native, "custom");
  assert.deepEqual(restored.moduleRules, customized.moduleRules);
  assert.deepEqual(restored.customModuleRules, customized.moduleRules);
});

test("About the job remains visible in every built-in preset", () => {
  assert.equal(BALANCED_RULES.jobDescription, false);
  assert.equal(MINIMAL_RULES.jobDescription, false);
  assert.equal(settingsForPreset(structuredClone(DEFAULT_SETTINGS), "native").moduleRules.jobDescription, false);
});

test("About the job can be hidden only through an explicit Custom choice", () => {
  const custom = customizeModule(structuredClone(DEFAULT_SETTINGS), "jobDescription", true);
  assert.equal(custom.activePreset, "custom");
  assert.equal(custom.moduleRules.jobDescription, true);
});

test("a module change produces Custom and remembers its base preset", () => {
  const minimal = settingsForPreset(structuredClone(DEFAULT_SETTINGS), "minimal");
  const custom = customizeModule(minimal, "hiringTeam", false);
  assert.equal(custom.activePreset, "custom");
  assert.equal(custom.customBasePreset, "minimal");
  assert.equal(custom.moduleRules.hiringTeam, false);
  assert.equal(custom.customModuleRules.hiringTeam, false);
});

test("schema normalization strips unknown data-boundary fields", () => {
  const settings = normalizeSettings({
    ...structuredClone(DEFAULT_SETTINGS),
    schemaVersion: 2,
    jobUrl: "https://example.test/private",
    description: "must never persist",
  });
  assert.equal("jobUrl" in settings, false);
  assert.equal("description" in settings, false);
});

test("schema normalization removes duplicate keyword text and identifiers", () => {
  const settings = normalizeSettings({
    ...structuredClone(DEFAULT_SETTINGS),
    keywordRules: [
      { id: "same", text: " TypeScript ", type: "positive", matchMode: "whole-word", enabled: true },
      { id: "other", text: "typescript", type: "neutral", matchMode: "phrase", enabled: true },
      { id: "same", text: "system   design", type: "neutral", matchMode: "phrase", enabled: true },
    ],
  });
  assert.equal(settings.keywordRules.length, 2);
  assert.equal(settings.keywordRules[1].text, "system design");
  assert.notEqual(settings.keywordRules[0].id, settings.keywordRules[1].id);
});

test("reduced motion respects both the system setting and explicit override", () => {
  assert.equal(shouldReduceMotion("system", true), true);
  assert.equal(shouldReduceMotion("system", false), false);
  assert.equal(shouldReduceMotion("reduce", false), true);
});

test("a local storage update is applied but a local deletion is ignored", () => {
  const current = structuredClone(DEFAULT_SETTINGS);
  const updated = settingsFromStorageChange("local", { ...current, enabled: true }, current);
  assert.equal(updated?.enabled, true);
  assert.equal(settingsFromStorageChange("local", undefined, current), null);
});

test("removing sync disables sync without resetting the current configuration", () => {
  const current = {
    ...structuredClone(DEFAULT_SETTINGS),
    enabled: true,
    activePreset: "minimal" as const,
    syncEnabled: true,
  };
  const updated = settingsFromStorageChange("sync", undefined, current);
  assert.equal(updated?.enabled, true);
  assert.equal(updated?.activePreset, "minimal");
  assert.equal(updated?.syncEnabled, false);
});

test("stale sync updates are ignored when sync is disabled", () => {
  const current = structuredClone(DEFAULT_SETTINGS);
  const synced = { ...current, enabled: true, syncEnabled: true };
  assert.equal(settingsFromStorageChange("sync", synced, current), null);
});

test("a fresh browser profile adopts an existing opted-in Sync configuration", async () => {
  const synced = {
    ...structuredClone(DEFAULT_SETTINGS),
    enabled: true,
    activePreset: "minimal" as const,
    syncEnabled: true,
  };
  let locallyStored: unknown;
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      local: {
        get: async () => ({}),
        set: async (value: unknown) => { locallyStored = value; },
      },
      sync: { get: async () => ({ settingsV2: synced }) },
    },
  } as unknown as typeof chrome;
  try {
    const loaded = await loadSettings();
    assert.equal(loaded.enabled, true);
    assert.equal(loaded.activePreset, "minimal");
    assert.equal(loaded.syncEnabled, true);
    assert.deepEqual(locallyStored, { settingsV2: loaded });
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("an explicitly opted-out local profile does not read stale Sync data", async () => {
  let syncReads = 0;
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      local: {
        get: async () => ({ settingsV2: structuredClone(DEFAULT_SETTINGS) }),
        set: async () => {},
      },
      sync: { get: async () => { syncReads += 1; return {}; } },
    },
  } as unknown as typeof chrome;
  try {
    const loaded = await loadSettings();
    assert.equal(loaded.syncEnabled, false);
    assert.equal(syncReads, 0);
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("a Sync write failure preserves the normalized local configuration", async () => {
  let locallyStored: unknown;
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      local: { set: async (value: unknown) => { locallyStored = value; } },
      sync: { set: async () => { throw new Error("quota exceeded"); } },
    },
  } as unknown as typeof chrome;
  const requested = { ...structuredClone(DEFAULT_SETTINGS), enabled: true, syncEnabled: true };
  try {
    const result = await saveSettings(requested);
    assert.deepEqual(locallyStored, { settingsV2: requested });
    assert.equal(result.syncError, "quota exceeded");
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("enabling Sync on an existing profile imports rather than overwrites cloud settings", async () => {
  const cloudSettings = {
    ...structuredClone(DEFAULT_SETTINGS),
    activePreset: "minimal" as const,
    syncEnabled: true,
  };
  let locallyStored: unknown;
  let syncWrites = 0;
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      local: { set: async (value: unknown) => { locallyStored = value; } },
      sync: {
        get: async () => ({ settingsV2: cloudSettings }),
        set: async () => { syncWrites += 1; },
      },
    },
  } as unknown as typeof chrome;
  try {
    const result = await enableSettingsSync(structuredClone(DEFAULT_SETTINGS));
    assert.equal(result.imported, true);
    assert.equal(result.settings.activePreset, "minimal");
    assert.deepEqual(locallyStored, { settingsV2: result.settings });
    assert.equal(syncWrites, 0);
  } finally {
    globalThis.chrome = previousChrome;
  }
});
