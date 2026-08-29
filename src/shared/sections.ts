export const SECTION_DICTIONARY = {
  responsibilities: ["responsibilities", "what you'll do", "what you will do", "the role"],
  requirements: ["requirements", "qualifications", "what you'll need", "what you will need"],
  benefits: ["benefits", "perks", "what we offer"],
  aboutRole: ["about the role", "about this role", "position overview"],
  aboutCompany: ["about the company", "about us", "who we are"],
} as const;

export type SectionKind = keyof typeof SECTION_DICTIONARY;

export function normalizeHeading(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[:\s]+$/g, "").replace(/\s+/g, " ");
}

export function recognizeSectionHeading(value: string): SectionKind | null {
  const normalized = normalizeHeading(value);
  for (const [kind, labels] of Object.entries(SECTION_DICTIONARY) as [SectionKind, readonly string[]][]) {
    if (labels.includes(normalized)) return kind;
  }
  return null;
}
