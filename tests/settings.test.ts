import assert from "node:assert/strict";
import test from "node:test";
import {
  BALANCED_RULES,
  CATEGORY_KEYS,
  DEFAULT_SETTINGS,
  MINIMAL_RULES,
  customizeModule,
  migrateLegacySettings,
  normalizeSettings,
  settingsFromStorageChange,
  settingsForPreset,
  shouldReduceMotion,
} from "../src/shared/settings";

test("new installs are disabled with Balanced selected", () => {
  const settings = normalizeSettings(undefined);
  assert.equal(settings.enabled, false);
  assert.equal(settings.activePreset, "balanced");
  assert.deepEqual(settings.moduleRules, BALANCED_RULES);
  assert.deepEqual(settings.searchBeta, {
    compactDensity: false,
    collapseViewed: false,
    collapseApplied: false,
  });
});

test("legacy settings migrate to Custom without changing effective visibility", () => {
  const legacyCategories = Object.fromEntries(
    CATEGORY_KEYS.map((key, index) => [key, index % 2 === 0]),
  );
  const settings = migrateLegacySettings({ schemaVersion: 1, enabled: true, categories: legacyCategories });
  assert.equal(settings.enabled, true);
  assert.equal(settings.activePreset, "custom");
  assert.deepEqual(settings.moduleRules, legacyCategories);
});

test("preset resolution is deterministic and does not mutate defaults", () => {
  const settings = settingsForPreset(structuredClone(DEFAULT_SETTINGS), "minimal");
  assert.deepEqual(settings.moduleRules, MINIMAL_RULES);
  settings.moduleRules.aiMatch = false;
  assert.equal(MINIMAL_RULES.aiMatch, true);
});

test("a module change produces Custom and remembers its base preset", () => {
  const minimal = settingsForPreset(structuredClone(DEFAULT_SETTINGS), "minimal");
  const custom = customizeModule(minimal, "hiringTeam", false);
  assert.equal(custom.activePreset, "custom");
  assert.equal(custom.customBasePreset, "minimal");
  assert.equal(custom.moduleRules.hiringTeam, false);
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
