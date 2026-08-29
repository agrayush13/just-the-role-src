import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORY_KEYS } from "../src/shared/settings";
import {
  DESCRIPTION_SELECTORS,
  JOB_ROOT_SELECTORS,
  MODULE_RULES,
  PROTECTED_SELECTORS,
  TITLE_SELECTORS,
  isSafeCandidate,
} from "../src/content/registry";

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

test("the selector registry covers current regional public job pages", () => {
  assert.ok(JOB_ROOT_SELECTORS.includes(".core-rail"));
  assert.ok(TITLE_SELECTORS.includes(".top-card-layout__title"));
  assert.ok(DESCRIPTION_SELECTORS.includes(".description"));
  assert.ok(MODULE_RULES.find((rule) => rule.category === "aiMatch")?.selectors.includes(".job-assessment"));
  assert.ok(MODULE_RULES.find((rule) => rule.category === "recommendations")?.selectors.includes(".similar-jobs"));
  assert.ok(MODULE_RULES.find((rule) => rule.category === "recommendations")?.selectors.includes(".people-also-viewed"));
});

test("the selector registry covers LinkedIn semantic job details", () => {
  assert.ok(JOB_ROOT_SELECTORS.includes("[data-sdui-screen='com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails']"));
  assert.ok(TITLE_SELECTORS.includes("[data-sdui-screen='com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails'] a[href*='/jobs/view/']"));
  assert.ok(DESCRIPTION_SELECTORS.includes("[id^='JobDetails_AboutTheJob_']"));
  assert.ok(MODULE_RULES.find((rule) => rule.category === "aiMatch")?.selectors.includes("[id^='JobMatchRef_']"));
  assert.ok(MODULE_RULES.find((rule) => rule.category === "applicantInsights")?.selectors.includes("[id^='JobDetails_PremiumApplicantInsights_']"));
  assert.ok(MODULE_RULES.find((rule) => rule.category === "premiumUpsells")?.selectors.includes("[id^='JobDetails_PremiumCompanyInsights_']"));
  assert.ok(MODULE_RULES.find((rule) => rule.category === "peopleConnections")?.selectors.includes("[id^='JobDetailsPeopleWhoCanHelpSlot_']"));
  assert.ok(MODULE_RULES.find((rule) => rule.category === "companyOverview")?.selectors.includes("[id^='JobDetails_AboutTheCompany_']"));
});
