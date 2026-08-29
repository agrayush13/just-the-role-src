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
  settingsForPreset,
} from "../src/shared/settings";

test("new Phase 2 installs are disabled with Balanced selected", () => {
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

test("Phase 1 settings migrate to Custom without changing effective visibility", () => {
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
