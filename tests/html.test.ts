import assert from "node:assert/strict";
import test from "node:test";
import { escapeHtml } from "../src/shared/html";

test("employer-written labels are escaped before Focus Bar rendering", () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('x')"> & Role`),
    "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; Role",
  );
});
