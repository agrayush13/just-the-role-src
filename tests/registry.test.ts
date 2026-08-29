import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORY_KEYS } from "../src/shared/settings";
import { MODULE_RULES, PROTECTED_SELECTORS, isSafeCandidate } from "../src/content/registry";

interface FakeElementOptions {
  matches?: readonly string[];
  descendants?: readonly string[];
  contains?: readonly object[];
}

function fakeElement(options: FakeElementOptions = {}): Element {
  return {
    matches: (selector: string) => options.matches?.includes(selector) ?? false,
    querySelector: (selector: string) =>
      options.descendants?.includes(selector) ? ({} as Element) : null,
    contains: (element: object) => options.contains?.includes(element) ?? false,
  } as unknown as Element;
}

test("the selector registry has one isolated rule for every setting category", () => {
  assert.deepEqual(
    MODULE_RULES.map((rule) => rule.category).sort(),
    [...CATEGORY_KEYS].sort(),
  );
  for (const rule of MODULE_RULES) assert.ok(rule.selectors.length > 0);
});

test("the job root can never be hidden", () => {
  const root = fakeElement();
  assert.equal(isSafeCandidate(root, root), false);
});

test("an ancestor of the job root can never be hidden", () => {
  const root = fakeElement();
  const candidate = fakeElement({ contains: [root] });
  assert.equal(isSafeCandidate(candidate, root), false);
});

test("a candidate matching or containing every protected anchor is rejected", () => {
  const root = fakeElement();
  for (const protectedSelector of PROTECTED_SELECTORS) {
    assert.equal(
      isSafeCandidate(fakeElement({ matches: [protectedSelector] }), root),
      false,
      `matching ${protectedSelector} should be rejected`,
    );
    assert.equal(
      isSafeCandidate(fakeElement({ descendants: [protectedSelector] }), root),
      false,
      `containing ${protectedSelector} should be rejected`,
    );
  }
});

test("an isolated non-core module is allowed", () => {
  assert.equal(isSafeCandidate(fakeElement(), fakeElement()), true);
});
