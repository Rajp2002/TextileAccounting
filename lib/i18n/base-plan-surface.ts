/**
 * Routes whose Hindi/Gujarati copy uses the strict Base-plan phrase set.
 *
 * Kept apart from base-plan-phrases.ts so the always-loaded i18n provider can
 * check the route without pulling the non-English phrase dictionaries into
 * every English first load.
 */
export const BASE_PLAN_SURFACE_PREFIXES = [
  '/free',
  '/onboarding',
  '/owner/estimator',
  '/owner/quotes',
  '/owner/rates',
  '/owner/production',
  '/owner/operations',
  '/owner/setup',
  '/owner/workers',
  '/owner/machines',
  '/owner/assignments',
  '/owner/payroll',
  '/owner/settings',
  '/owner/billing',
]

export function isBasePlanSurfacePath(pathname: string) {
  return BASE_PLAN_SURFACE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
