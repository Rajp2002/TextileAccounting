/**
 * Lite routes whose Hindi/Gujarati copy must come only from complete phrases.
 *
 * On these routes a sentence with no curated translation stays in English.
 * They never use the word-by-word fallback, which leaves half-translated
 * sentences in English word order. Kept apart from the phrase files so the
 * always-loaded i18n provider can check the route cheaply.
 */
export const LITE_COMPLETE_SURFACE_PREFIXES = [
  '/owner/estimator',
  '/owner/quotes',
  '/owner/rates',
  '/owner/settings',
  '/owner/billing',
  '/onboarding',
  '/signup',
  '/plans',
]

export function isLiteCompleteSurfacePath(pathname: string) {
  return LITE_COMPLETE_SURFACE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
