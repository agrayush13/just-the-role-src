import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { highlightDescriptionText, restoreKeywordHighlights } from "../src/content/keyword-dom";
import type { KeywordRule } from "../src/shared/settings";

const rules: KeywordRule[] = [
  { id: "positive", text: "TypeScript", type: "positive", matchMode: "whole-word", enabled: true },
  { id: "check", text: "onsite only", type: "dealbreaker", matchMode: "phrase", enabled: true },
];

function asDomElement(value: unknown): Element {
  return value as Element;
}

test("description highlighting wraps text nodes without replacing container HTML", () => {
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = `<section id="description"><p>Build with <strong>TypeScript</strong>.</p><p>Onsite only.</p><a href="#">TypeScript link</a><button>TypeScript control</button></section>`;
  const description = asDomElement(document.querySelector("#description")!);
  const originalText = description.textContent;
  const originalStrong = description.querySelector("strong");

  const result = highlightDescriptionText(description, rules);

  assert.equal(result.counts.positive, 1);
  assert.equal(result.counts.dealbreaker, 1);
  assert.equal(description.querySelectorAll("mark[data-jtr-mark]").length, 2);
  assert.equal(description.querySelector("strong"), originalStrong);
  assert.equal(description.querySelector("a mark"), null);
  assert.equal(description.querySelector("button mark"), null);
  assert.equal(description.textContent, originalText);
});

test("restoration removes every marker without missing or duplicated text", () => {
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = `<section id="description"><p>TypeScript and TypeScript.</p></section>`;
  const description = asDomElement(document.querySelector("#description")!);
  const original = description.textContent;

  highlightDescriptionText(description, rules);
  restoreKeywordHighlights(description);
  assert.equal(description.querySelector("mark"), null);
  assert.equal(description.textContent, original);

  const rerun = highlightDescriptionText(description, rules);
  assert.equal(rerun.counts.positive, 2);
  assert.equal(description.querySelectorAll("mark").length, 2);
});

test("a 25,000-character fixture completes as a bounded text pass", () => {
  const window = new Window();
  const document = window.document;
  const text = "TypeScript architecture ownership benefits. ".repeat(625);
  document.body.innerHTML = `<section id="description"><p>${text}</p></section>`;
  const result = highlightDescriptionText(asDomElement(document.querySelector("#description")!), rules);
  assert.equal(result.counts.positive, 625);
  assert.ok(result.elapsedMs < 250, `fixture took ${result.elapsedMs} ms`);
});
