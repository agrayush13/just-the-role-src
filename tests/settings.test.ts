import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORY_KEYS, DEFAULT_SETTINGS, normalizeSettings } from "../src/shared/settings";

test("fresh installs are disabled and recommended noise categories are selected", () => {
  const settings = normalizeSettings(undefined);
  assert.equal(settings.enabled, false);
  assert.equal(settings.categories.aiMatch, true);
  assert.equal(settings.categories.searchResultsPane, false);
});

test("unknown or malformed persisted values fall back safely", () => {
  const settings = normalizeSettings({
    enabled: "yes",
    categories: { aiMatch: false, applicantInsights: "no" },
  });
  assert.equal(settings.enabled, false);
  assert.equal(settings.categories.aiMatch, false);
  assert.equal(settings.categories.applicantInsights, true);
  assert.deepEqual(Object.keys(settings.categories), [...CATEGORY_KEYS]);
});

test("normalization returns a copy instead of mutating defaults", () => {
  const settings = normalizeSettings(undefined);
  settings.categories.aiMatch = false;
  assert.equal(DEFAULT_SETTINGS.categories.aiMatch, true);
});
