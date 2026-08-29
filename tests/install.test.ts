import assert from "node:assert/strict";
import test from "node:test";
import { isFreshInstallReason } from "../src/shared/install";

test("only a fresh install opens the extension settings page", () => {
  assert.equal(isFreshInstallReason("install"), true);
  assert.equal(isFreshInstallReason("update"), false);
  assert.equal(isFreshInstallReason("chrome_update"), false);
  assert.equal(isFreshInstallReason("shared_module_update"), false);
});
