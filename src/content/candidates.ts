import { isSafeCandidate, type CandidateSafetyOptions } from "./registry";

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

function expandThroughWrapperShells(
  candidate: Element,
  jobRoot: Element,
  options: CandidateSafetyOptions,
): Element {
  let current = candidate;
  while (current.parentElement && current.parentElement !== jobRoot) {
    const parent = current.parentElement;
    if (hasMeaningfulSibling(current) || !isSafeCandidate(parent, jobRoot, options)) break;
    current = parent;
  }
  return current;
}

export function resolveSafeModuleCandidates(
  matches: Iterable<Element>,
  jobRoot: Element,
  options: CandidateSafetyOptions = {},
): Element[] {
  const safeMatches = [...matches].filter((candidate) => isSafeCandidate(candidate, jobRoot, options));
  const expanded = new Set(
    outermost(safeMatches)
      .map((candidate) => expandThroughWrapperShells(candidate, jobRoot, options))
      .filter((candidate) => isSafeCandidate(candidate, jobRoot, options)),
  );
  return outermost([...expanded]);
}

export function chooseFocusBarAnchor(
  aiMatchCandidates: readonly Element[],
  description: Element,
): Element {
  return aiMatchCandidates[0] ?? description;
}
