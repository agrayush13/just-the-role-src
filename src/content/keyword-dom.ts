import { emptyKeywordCounts, findKeywordMatches } from "../shared/keywords";
import type { KeywordRule, KeywordType } from "../shared/settings";

export const KEYWORD_MARK_ATTR = "data-jtr-mark";

export interface HighlightResult {
  counts: Record<KeywordType, number>;
  elapsedMs: number;
}

function isVisibleTextNode(node: Text, description: Element): boolean {
  const parent = node.parentElement;
  if (!parent || !node.data.trim() || !description.contains(parent)) return false;
  if (parent.closest("a, button, input, textarea, select, option, script, style, [hidden], [aria-hidden='true']")) {
    return false;
  }
  if (parent.closest("[data-jtr-hidden], [data-jtr-mark], [data-jtr-ui]")) return false;
  const view = description.ownerDocument.defaultView;
  const style = view?.getComputedStyle(parent);
  return !style || (style.display !== "none" && style.visibility !== "hidden");
}

export function restoreKeywordHighlights(root: ParentNode): Record<KeywordType, number> {
  const parents = new Set<Node>();
  root.querySelectorAll<HTMLElement>(`mark[${KEYWORD_MARK_ATTR}]`).forEach((mark) => {
    if (mark.parentNode) parents.add(mark.parentNode);
    mark.replaceWith(mark.ownerDocument.createTextNode(mark.textContent ?? ""));
  });
  parents.forEach((parent) => parent.normalize());
  return emptyKeywordCounts();
}

export function highlightDescriptionText(
  description: Element,
  rules: readonly KeywordRule[],
): HighlightResult {
  const started = performance.now();
  const counts = emptyKeywordCounts();
  const walker = description.ownerDocument.createTreeWalker(description, 4);
  const textNodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (current.nodeType === 3 && isVisibleTextNode(current as Text, description)) {
      textNodes.push(current as Text);
    }
  }

  for (const textNode of textNodes) {
    const matches = findKeywordMatches(textNode.data, rules);
    for (const match of [...matches].reverse()) {
      textNode.splitText(match.end);
      const matched = textNode.splitText(match.start);
      const mark = description.ownerDocument.createElement("mark");
      mark.setAttribute(KEYWORD_MARK_ATTR, "true");
      mark.dataset.jtrKeywordType = match.type;
      mark.dataset.jtrRuleId = match.ruleId;
      const label = match.type === "positive" ? "Desired" : match.type === "dealbreaker" ? "Check" : "Notice";
      mark.title = `${label}: ${match.text}`;
      mark.setAttribute("aria-description", `${label} keyword`);
      mark.textContent = matched.data;
      matched.replaceWith(mark);
      counts[match.type] += 1;
    }
  }
  return { counts, elapsedMs: Math.round((performance.now() - started) * 10) / 10 };
}
