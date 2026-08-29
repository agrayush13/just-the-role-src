import assert from "node:assert/strict";
import test from "node:test";
import { findKeywordMatches, validateKeywordRule } from "../src/shared/keywords";
import type { KeywordRule } from "../src/shared/settings";

const rule = (overrides: Partial<KeywordRule> = {}): KeywordRule => ({
  id: "rule-1",
  text: "TypeScript",
  type: "positive",
  matchMode: "whole-word",
  enabled: true,
  ...overrides,
});

test("whole-word matching is case-insensitive and rejects partial words", () => {
  const matches = findKeywordMatches("typescript TypeScriptX TYPESCRIPT", [rule()]);
  assert.deepEqual(matches.map((match) => match.text), ["typescript", "TYPESCRIPT"]);
});

test("phrase mode finds deterministic case-insensitive phrases", () => {
  const matches = findKeywordMatches("System design and SYSTEM   DESIGN", [
    rule({ text: "system design", matchMode: "phrase" }),
  ]);
  assert.equal(matches.length, 2);
});

test("longer rules win overlapping matches", () => {
  const matches = findKeywordMatches("React Native", [
    rule({ id: "short", text: "React" }),
    rule({ id: "long", text: "React Native" }),
  ]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].ruleId, "long");
});

test("validation rejects blanks, duplicates, and overlong rules", () => {
  assert.equal(validateKeywordRule("   ", []).valid, false);
  assert.equal(validateKeywordRule("typescript", [rule()]).valid, false);
  assert.equal(validateKeywordRule("x".repeat(61), []).valid, false);
});
