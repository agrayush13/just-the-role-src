import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Window } from "happy-dom";
import {
  DESCRIPTION_CONTENT_SELECTORS,
  DESCRIPTION_SELECTORS,
  JOB_ROOT_SELECTORS,
  MODULE_RULES,
  TITLE_SELECTORS,
  isSafeCandidate,
} from "../src/content/registry";
import type { CategoryKey } from "../src/shared/settings";

function firstMatch(selectors: readonly string[], root: ParentNode): Element | null {
  for (const selector of selectors) {
    const match = root.querySelector(selector);
    if (match) return match;
  }
  return null;
}

test("the SDUI fixture exposes a complete, safely selectable job view", async () => {
  const window = new Window();
  const document = window.document as unknown as Document;
  document.write(await readFile("tests/fixtures/job-page-sdui.html", "utf8"));

  const root = firstMatch(JOB_ROOT_SELECTORS, document);
  assert.ok(root);
  assert.equal(firstMatch(TITLE_SELECTORS, root)?.textContent, "Senior Software Engineer");

  const description = firstMatch(DESCRIPTION_SELECTORS, root);
  assert.ok(description);
  assert.match(firstMatch(DESCRIPTION_CONTENT_SELECTORS, description)?.textContent ?? "", /TypeScript/);

  const expectedCategories: CategoryKey[] = [
    "aiMatch",
    "applicantInsights",
    "premiumUpsells",
    "peopleConnections",
    "companyOverview",
  ];
  for (const category of expectedCategories) {
    const rule = MODULE_RULES.find((candidate) => candidate.category === category);
    assert.ok(rule);
    const matches = rule.selectors.flatMap((selector) => [...document.querySelectorAll(selector)]);
    assert.ok(matches.length >= 2, `${category} should match both its semantic ID and SDUI component`);
    const outermost = matches.find((candidate) => matches.some((other) => other !== candidate && candidate.contains(other)));
    assert.ok(outermost, `${category} should expose an outer card container`);
    assert.equal(isSafeCandidate(outermost, root), true);
  }
});
