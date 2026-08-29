import type { CategoryKey } from "../shared/settings";

export interface ModuleRule {
  category: CategoryKey;
  selectors: readonly string[];
}

// Conservative selectors only. Each match is independently safety-checked before hiding.
// Keep this registry centralized and versioned so LinkedIn changes are easy to audit.
export const SELECTOR_MAP_VERSION = "2026-08-27.1";

export const MODULE_RULES: readonly ModuleRule[] = [
  {
    category: "aiMatch",
    selectors: [
      ".job-details-how-you-match-card__container",
      ".jobs-details__job-match-card",
      "[data-view-name='job-match-card']",
    ],
  },
  {
    category: "applicantInsights",
    selectors: [
      ".jobs-premium-applicant-insights",
      ".job-details-jobs-unified-top-card__applicant-insights",
      "[data-view-name='job-applicant-insights']",
    ],
  },
  {
    category: "premiumUpsells",
    selectors: [
      ".jobs-premium-company-growth",
      ".jobs-premium-job-details-card",
      "[data-view-name='premium-upsell-card']",
    ],
  },
  {
    category: "recommendations",
    selectors: [
      ".jobs-similar-jobs-list",
      ".jobs-recommended-jobs-list",
      "[data-view-name='similar-jobs-card']",
      "[data-view-name='recommended-jobs-card']",
    ],
  },
  {
    category: "footerPromotions",
    selectors: [
      ".jobs-details__footer",
      ".jobs-details__promoted-jobs",
      "[data-view-name='job-details-footer-promo']",
    ],
  },
  {
    category: "applicantCount",
    selectors: [
      ".job-details-jobs-unified-top-card__applicant-count",
      ".jobs-unified-top-card__applicant-count",
    ],
  },
  {
    category: "hiringTeam",
    selectors: [
      ".jobs-poster",
      ".hirer-card__container",
      "[data-view-name='job-hiring-team-card']",
    ],
  },
  {
    category: "peopleConnections",
    selectors: [
      ".jobs-company__box",
      "[data-view-name='job-connections-card']",
      "[data-view-name='job-school-connections-card']",
    ],
  },
  {
    category: "companyOverview",
    selectors: [
      ".jobs-company",
      ".jobs-company__card",
      "[data-view-name='job-company-card']",
    ],
  },
  {
    category: "topNavigation",
    selectors: ["header.global-nav", ".global-nav"],
  },
  {
    category: "searchResultsPane",
    selectors: [
      ".jobs-search-results-list",
      ".jobs-search-two-pane__left-rail",
      "[data-view-name='jobs-search-results-list']",
    ],
  },
] as const;

export const JOB_ROOT_SELECTORS = [
  ".jobs-search__job-details--container",
  ".jobs-search__job-details",
  ".jobs-details",
  ".job-view-layout",
] as const;

export const TITLE_SELECTORS = [
  ".job-details-jobs-unified-top-card__job-title",
  ".jobs-unified-top-card__job-title",
  "[data-view-name='job-title']",
] as const;

export const DESCRIPTION_SELECTORS = [
  "#job-details",
  ".jobs-description",
  ".jobs-box__html-content",
  "[data-view-name='job-description']",
] as const;

export const PROTECTED_SELECTORS = [
  ...TITLE_SELECTORS,
  ...DESCRIPTION_SELECTORS,
  ".jobs-apply-button",
  ".jobs-save-button",
  "[data-control-name*='share']",
  "[data-control-name*='report']",
] as const;

export function isSafeCandidate(candidate: Element, jobRoot: Element): boolean {
  if (candidate === jobRoot || candidate.contains(jobRoot)) return false;
  if (PROTECTED_SELECTORS.some((selector) => candidate.matches(selector))) return false;
  if (PROTECTED_SELECTORS.some((selector) => candidate.querySelector(selector))) return false;
  return true;
}
