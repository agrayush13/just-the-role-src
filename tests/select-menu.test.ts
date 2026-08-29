import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { bindSelectMenu } from "../src/shared/select-menu";

function asHtmlElement(value: unknown): HTMLElement {
  return value as HTMLElement;
}

test("custom select opens, selects an enabled option, and closes", () => {
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = `
    <div data-custom-select="preset">
      <input type="hidden" value="balanced" />
      <button class="select-trigger" aria-expanded="false"><span class="select-value">Balanced</span></button>
      <div class="select-options" role="listbox" hidden>
        <button role="option" data-value="balanced" aria-selected="true">Balanced</button>
        <button role="option" data-value="minimal" aria-selected="false">Minimal</button>
        <button role="option" data-value="custom" aria-selected="false" disabled>Custom</button>
      </div>
    </div>`;

  const root = asHtmlElement(document.querySelector("[data-custom-select]"));
  const trigger = asHtmlElement(root.querySelector(".select-trigger"));
  const menu = asHtmlElement(root.querySelector(".select-options"));
  const input = root.querySelector("input") as HTMLInputElement;
  const label = asHtmlElement(root.querySelector(".select-value"));
  const changes: string[] = [];
  const controller = bindSelectMenu(root, { onChange: (value) => { changes.push(value); } });

  trigger.click();
  assert.equal(menu.hidden, false);
  assert.equal(trigger.getAttribute("aria-expanded"), "true");

  asHtmlElement(root.querySelector("[data-value='minimal']")).click();
  assert.equal(input.value, "minimal");
  assert.equal(label.textContent, "Minimal");
  assert.deepEqual(changes, ["minimal"]);
  assert.equal(menu.hidden, true);
  assert.equal(trigger.getAttribute("aria-expanded"), "false");

  asHtmlElement(root.querySelector("[data-value='minimal']")).click();
  assert.deepEqual(changes, ["minimal"], "reselecting the active value must be a no-op");

  controller.setValue("custom");
  assert.equal(input.value, "balanced");
  controller.destroy();
});
