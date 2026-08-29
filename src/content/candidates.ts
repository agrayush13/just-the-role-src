import { isSafeCandidate } from "./registry";

function outermost(elements: readonly Element[]): Element[] {
  return elements.filter(
    (candidate) => !elements.some((other) => other !== candidate && other.contains(candidate)),
  );
}

function hasMeaningfulSibling(element: Element): boolean {
  const parent = element.parentElement;
  if (!parent) return false;
  return [...parent.children].some(
    (sibling) => sibling !== element && Boolean(sibling.textContent?.trim()),
  );
}

function expandThroughWrapperShells(candidate: Element, jobRoot: Element): Element {
  let current = candidate;
  while (current.parentElement && current.parentElement !== jobRoot) {
    const parent = current.parentElement;
    if (hasMeaningfulSibling(current) || !isSafeCandidate(parent, jobRoot)) break;
    current = parent;
  }
  return current;
}

export function resolveSafeModuleCandidates(matches: Iterable<Element>, jobRoot: Element): Element[] {
  const safeMatches = [...matches].filter((candidate) => isSafeCandidate(candidate, jobRoot));
  const expanded = new Set(
    outermost(safeMatches)
      .map((candidate) => expandThroughWrapperShells(candidate, jobRoot))
      .filter((candidate) => isSafeCandidate(candidate, jobRoot)),
  );
  return outermost([...expanded]);
}
