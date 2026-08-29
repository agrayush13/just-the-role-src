import assert from "node:assert/strict";
import test from "node:test";
import { Window } from "happy-dom";
import { resolveSafeModuleCandidates } from "../src/content/candidates";

function fixture(): { document: Document; root: Element } {
  const window = new Window();
  const document = window.document as unknown as Document;
  document.body.innerHTML = `
    <main data-sdui-screen="com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails">
      <header>
        <a href="https://www.linkedin.com/jobs/view/123/">Senior Engineer</a>
        <a aria-label="Apply on company website" href="https://example.com/apply">Apply</a>
      </header>
      <div class="visual-card-shell">
        <div aria-hidden="true"></div>
        <div class="wrapper">
          <section id="JobMatchRef_123">
            <div data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.jobMatch">
              <h2>Job match</h2>
            </div>
          </section>
        </div>
      </div>
      <section id="JobDetails_AboutTheJob_123">
        <div data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob">
          <h2>About the job</h2>
          <p>Keep this job description.</p>
        </div>
      </section>
    </main>
  `;
  return {
    document,
    root: document.querySelector("[data-sdui-screen]")!,
  };
}

test("nested SDUI matches resolve to the complete visual card shell", () => {
  const { document, root } = fixture();
  const matches = [
    document.querySelector("[id^='JobMatchRef_']")!,
    document.querySelector("[data-sdui-component$='.jobMatch']")!,
  ];

  const resolved = resolveSafeModuleCandidates(matches, root);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0]?.classList.contains("visual-card-shell"), true);
});

test("card-shell expansion never crosses meaningful sibling content", () => {
  const { document, root } = fixture();
  const shell = document.querySelector(".visual-card-shell")!;
  const group = document.createElement("section");
  const keep = document.createElement("p");
  keep.textContent = "Keep this neighboring content.";
  shell.before(group);
  group.append(keep, shell);

  const candidate = document.querySelector("[id^='JobMatchRef_']")!;
  const [resolved] = resolveSafeModuleCandidates([candidate], root);
  assert.equal(resolved, shell);
  assert.equal(group.contains(resolved), true);
});
