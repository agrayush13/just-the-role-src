import type { KeywordMatchMode, KeywordRule, KeywordType } from "./settings";

export const KEYWORD_RULE_LIMIT = 50;
export const KEYWORD_TEXT_LIMIT = 60;

export interface KeywordMatch {
  start: number;
  end: number;
  ruleId: string;
  type: KeywordType;
  text: string;
}

export type RuleValidation =
  | { valid: true; normalizedText: string }
  | { valid: false; error: string };

export function validateKeywordRule(
  text: string,
  existingRules: readonly KeywordRule[],
  editingId?: string,
): RuleValidation {
  const normalizedText = text.trim().replace(/\s+/g, " ");
  if (!normalizedText) return { valid: false, error: "Enter a word or phrase." };
  if (normalizedText.length > KEYWORD_TEXT_LIMIT) {
    return { valid: false, error: `Rules can be at most ${KEYWORD_TEXT_LIMIT} characters.` };
  }
  if (existingRules.length >= KEYWORD_RULE_LIMIT && !editingId) {
    return { valid: false, error: `You can enable up to ${KEYWORD_RULE_LIMIT} rules.` };
  }
  const duplicate = existingRules.some(
    (rule) => rule.id !== editingId && rule.text.trim().toLocaleLowerCase() === normalizedText.toLocaleLowerCase(),
  );
  if (duplicate) return { valid: false, error: "That rule already exists." };
  return { valid: true, normalizedText };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expressionFor(text: string, mode: KeywordMatchMode): RegExp {
  const escaped = text.split(/\s+/).map(escapeRegExp).join("\\s+");
  if (mode === "phrase") return new RegExp(escaped, "giu");
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "giu");
}

export function findKeywordMatches(text: string, rules: readonly KeywordRule[]): KeywordMatch[] {
  const candidates: KeywordMatch[] = [];
  const enabled = rules
    .filter((rule) => rule.enabled && rule.text)
    .sort((a, b) => b.text.length - a.text.length || a.id.localeCompare(b.id));

  for (const rule of enabled) {
    const expression = expressionFor(rule.text, rule.matchMode);
    for (const match of text.matchAll(expression)) {
      if (match.index === undefined || !match[0]) continue;
      candidates.push({
        start: match.index,
        end: match.index + match[0].length,
        ruleId: rule.id,
        type: rule.type,
        text: match[0],
      });
    }
  }

  candidates.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const selected: KeywordMatch[] = [];
  let lastEnd = -1;
  for (const candidate of candidates) {
    if (candidate.start < lastEnd) continue;
    selected.push(candidate);
    lastEnd = candidate.end;
  }
  return selected;
}

export function emptyKeywordCounts(): Record<KeywordType, number> {
  return { positive: 0, neutral: 0, dealbreaker: 0 };
}
