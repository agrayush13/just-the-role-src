import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

interface ExtensionManifest {
  permissions?: string[];
  host_permissions?: string[];
  content_scripts?: Array<{ matches?: string[] }>;
}

test("the extension runs on LinkedIn Jobs across regional hosts only", async () => {
  const manifest = JSON.parse(await readFile("manifest.json", "utf8")) as ExtensionManifest;
  const jobPattern = "https://*.linkedin.com/jobs/*";

  assert.deepEqual(manifest.host_permissions, [jobPattern]);
  assert.deepEqual(manifest.content_scripts?.flatMap((script) => script.matches ?? []), [jobPattern]);
  assert.deepEqual(manifest.permissions, ["storage", "activeTab", "scripting"]);
});
