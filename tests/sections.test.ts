import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHeading, recognizeSectionHeading } from "../src/shared/sections";

test("reviewed English headings are recognized after conservative normalization", () => {
  assert.equal(recognizeSectionHeading(" Requirements: "), "requirements");
  assert.equal(recognizeSectionHeading("WHAT YOU'LL DO"), "responsibilities");
  assert.equal(recognizeSectionHeading("What we offer"), "benefits");
});

test("unreviewed and ambiguous headings fail open", () => {
  assert.equal(recognizeSectionHeading("Our amazing opportunity"), null);
  assert.equal(recognizeSectionHeading("Responsibilities and requirements"), null);
});

test("normalization does not rewrite internal wording", () => {
  assert.equal(normalizeHeading(" About   the role: "), "about the role");
});
