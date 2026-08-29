export type SearchCardStatus = "viewed" | "applied";

export function isSponsoredLabel(value: string): boolean {
  return /\b(promoted|sponsored)\b/i.test(value);
}

export function recognizedCardStatus(labels: readonly string[]): SearchCardStatus | null {
  for (const value of labels) {
    const normalized = value.trim().toLocaleLowerCase();
    if (/^applied\b/.test(normalized)) return "applied";
    if (/^viewed\b/.test(normalized)) return "viewed";
  }
  return null;
}
