import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedLinkedInJobsUrl } from "../src/shared/urls";

test("LinkedIn job URLs are eligible for no-refresh activation", () => {
  assert.equal(isSupportedLinkedInJobsUrl("https://www.linkedin.com/jobs/view/123"), true);
  assert.equal(isSupportedLinkedInJobsUrl("https://in.linkedin.com/jobs/view/123"), true);
  assert.equal(isSupportedLinkedInJobsUrl("https://linkedin.com/jobs/search-results/"), true);
});

test("no-refresh activation rejects unrelated and deceptive URLs", () => {
  assert.equal(isSupportedLinkedInJobsUrl("https://www.linkedin.com/feed/"), false);
  assert.equal(isSupportedLinkedInJobsUrl("https://notlinkedin.com/jobs/view/123"), false);
  assert.equal(isSupportedLinkedInJobsUrl("http://www.linkedin.com/jobs/view/123"), false);
  assert.equal(isSupportedLinkedInJobsUrl("chrome://extensions/"), false);
  assert.equal(isSupportedLinkedInJobsUrl(undefined), false);
});
