type StyleReader = (element: Element) => Pick<CSSStyleDeclaration, "display" | "visibility">;

export function isRendered(element: Element, readStyle: StyleReader = getComputedStyle): boolean {
  if (!element.isConnected || element.closest("[hidden], [aria-hidden='true']")) return false;
  const style = readStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (element.getClientRects().length > 0) return true;
  if (style.display !== "contents") return false;
  return [...element.children].some((child) => isRendered(child, readStyle));
}
