import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { isRendered } from "../src/content/visibility";

function setRectangleCount(element: Element, count: number): void {
  Object.defineProperty(element, "getClientRects", {
    configurable: true,
    value: () => ({ length: count }),
  });
}

test("a display-contents SDUI root is rendered when a visible child has a layout box", () => {
  const window = new Window();
  const document = window.document as unknown as Document;
  const root = document.createElement("div");
  const child = document.createElement("section");
  root.append(child);
  document.body.append(root);
  setRectangleCount(root, 0);
  setRectangleCount(child, 1);

  const readStyle = (element: Element) => ({
    display: element === root ? "contents" : "block",
    visibility: "visible",
  });

  assert.equal(isRendered(root, readStyle), true);
});

test("a zero-box element is not rendered unless it uses display contents", () => {
  const window = new Window();
  const document = window.document as unknown as Document;
  const element = document.createElement("div");
  document.body.append(element);
  setRectangleCount(element, 0);

  assert.equal(isRendered(element, () => ({ display: "block", visibility: "visible" })), false);
});

test("hidden and disconnected elements remain rejected", () => {
  const window = new Window();
  const document = window.document as unknown as Document;
  const hidden = document.createElement("div");
  hidden.setAttribute("aria-hidden", "true");
  document.body.append(hidden);
  setRectangleCount(hidden, 1);
  const disconnected = document.createElement("div");
  setRectangleCount(disconnected, 1);
  const visibleStyle = () => ({ display: "block", visibility: "visible" });

  assert.equal(isRendered(hidden, visibleStyle), false);
  assert.equal(isRendered(disconnected, visibleStyle), false);
});
