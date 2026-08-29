import assert from "node:assert/strict";
import test from "node:test";
import { isSponsoredLabel, recognizedCardStatus } from "../src/content/search-beta";

test("sponsored and promoted labels are hard-excluded case-insensitively", () => {
  assert.equal(isSponsoredLabel("Promoted"), true);
  assert.equal(isSponsoredLabel("This is a SPONSORED role"), true);
  assert.equal(isSponsoredLabel("Viewed"), false);
});

test("only explicit leading Viewed or Applied labels are recognized", () => {
  assert.equal(recognizedCardStatus(["Viewed 2 hours ago"]), "viewed");
  assert.equal(recognizedCardStatus(["Applied on Tuesday"]), "applied");
  assert.equal(recognizedCardStatus(["12 applicants", "Previously viewed by others"]), null);
});
