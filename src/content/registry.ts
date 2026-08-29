import type { CategoryKey } from "../shared/settings";

export interface ModuleRule {
  category: CategoryKey;
  selectors: readonly string[];
  selectable: boolean;
}

// Conservative selectors only. Each match is independently safety-checked before hiding.
// Keep this registry centralized and versioned so LinkedIn changes are easy to audit.
export const SELECTOR_MAP_VERSION = "2026-08-29.4";

export const MODULE_RULES: readonly ModuleRule[] = [
  {
    category: "aiMatch",
    selectable: true,
    selectors: [
      ".job-details-how-you-match-card__container",
      ".jobs-details__job-match-card",
      ".job-assessment",
      "[id^='JobMatchRef_']",
      "[data-sdui-component$='.jobMatch']",
      "[data-view-name='job-match-card']",
    ],
  },
  {
    category: "applicantInsights",
    selectable: true,
    selectors: [
      ".jobs-premium-applicant-insights",
      ".job-details-jobs-unified-top-card__applicant-insights",
      "[id^='JobDetails_PremiumApplicantInsights_']",
      "[data-sdui-component$='.premiumApplicantInsightsForJobDetails']",
      "[data-view-name='job-applicant-insights']",
    ],
  },
  {
    category: "premiumUpsells",
    selectable: true,
    selectors: [
      ".jobs-premium-company-growth",
      ".jobs-premium-job-details-card",
      "[id^='JobDetails_PremiumCompanyInsights_']",
      "[data-sdui-component$='.premiumCompanyInsightsForJobDetails']",
      "[data-view-name='premium-upsell-card']",
    ],
  },
  {
    category: "recommendations",
    selectable: true,
    selectors: [
      ".jobs-similar-jobs-list",
      ".jobs-recommended-jobs-list",
      ".similar-jobs",
      ".people-also-viewed",
      "[data-view-name='similar-jobs-card']",
      "[data-view-name='recommended-jobs-card']",
    ],
  },
  {
    category: "footerPromotions",
    selectable: true,
    selectors: [
      ".jobs-details__footer",
      ".jobs-details__promoted-jobs",
      ".job-alert-redirect-section",
      ".similar-searches",
      "[data-view-name='job-details-footer-promo']",
    ],
  },
  {
    category: "applicantCount",
    selectable: true,
    selectors: [
      ".job-details-jobs-unified-top-card__applicant-count",
      ".jobs-unified-top-card__applicant-count",
    ],
  },
  {
    category: "hiringTeam",
    selectable: true,
    selectors: [
      ".jobs-poster",
      ".hirer-card__container",
      "[data-view-name='job-hiring-team-card']",
    ],
  },
  {
    category: "peopleConnections",
    selectable: true,
    selectors: [
      ".jobs-company__box",
      ".find-a-referral",
      "[id^='JobDetailsPeopleWhoCanHelpSlot_']",
      "[data-sdui-component$='.peopleWhoCanHelp']",
      "[data-view-name='job-connections-card']",
      "[data-view-name='job-school-connections-card']",
    ],
  },
  {
    category: "companyOverview",
    selectable: true,
    selectors: [
      ".jobs-company",
      ".jobs-company__card",
      "[id^='JobDetails_AboutTheCompany_']",
      "[data-sdui-component$='.aboutTheCompanyForJobDetails']",
      "[data-view-name='job-company-card']",
    ],
  },
  {
    category: "topNavigation",
    selectable: false,
    selectors: ["header.global-nav", ".global-nav"],
  },
  {
    category: "searchResultsPane",
    selectable: false,
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
  ".core-rail",
  "[data-sdui-screen='com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails']",
] as const;

export const TITLE_SELECTORS = [
  ".job-details-jobs-unified-top-card__job-title",
  ".jobs-unified-top-card__job-title",
  ".top-card-layout__title",
  "[data-view-name='job-title']",
  "[data-sdui-screen='com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails'] a[href*='/jobs/view/']",
] as const;

export const DESCRIPTION_SELECTORS = [
  "#job-details",
  ".jobs-description",
  ".description",
  ".jobs-box__html-content",
  "[data-view-name='job-description']",
  "[id^='JobDetails_AboutTheJob_']",
  "[data-sdui-component$='.aboutTheJob']",
] as const;

export const DESCRIPTION_CONTENT_SELECTORS = [
  ".jobs-box__html-content",
  ".show-more-less-html__markup",
  "[data-sdui-component$='.aboutTheJob']",
] as const;

export const PROTECTED_SELECTORS = [
  ...TITLE_SELECTORS,
  ...DESCRIPTION_SELECTORS,
  ".jobs-apply-button",
  ".jobs-save-button",
  "a[aria-label='Apply on company website']",
  "button[aria-label='Apply']",
  "button[aria-label='Save the job']",
  ".job-details-jobs-unified-top-card__company-name",
  ".job-details-jobs-unified-top-card__primary-description-container",
  "[data-view-name='job-company-name']",
  "[data-view-name='job-location']",
  "[data-control-name*='share']",
  "[data-control-name*='report']",
  "[data-control-name*='navigation']",
  "[data-control-name*='account']",
] as const;

export function isSafeCandidate(candidate: Element, jobRoot: Element): boolean {
  if (candidate === jobRoot || candidate.contains(jobRoot)) return false;
  if (PROTECTED_SELECTORS.some((selector) => candidate.matches(selector))) return false;
  if (PROTECTED_SELECTORS.some((selector) => candidate.querySelector(selector))) return false;
  return true;
}
