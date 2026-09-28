# Landing page redesign (September 2026)

Progress record for the `/` redesign on branch `claude/weavly-landing-redesign-321f6f`. Keep it short; it exists so decisions survive context changes.

## Protected

- The black navbar (`components/landing/header.tsx`) and its intro hooks (`data-weavly-intro-panel`, `data-weavly-intro-target="landing"`) keep their geometry and behaviour. The one change, requested by the owner, is the text colour of the saffron "Start with Free" pill (white → `text-zinc-950`, desktop and mobile menu); white on that gradient was about 2.1:1.
- Section ids keep the navbar's anchors: `#product`, `#workflow`, `#plans`, `#pricing`, `#faq`.
- `app/page.tsx` keeps the order asserted by `__tests__/weaving-intro.test.ts`: pre-paint script, intro, header, then the `data-weavly-intro-page` plane. Landing fonts and colour tokens live on the plane (`landing.module.css` `.page`), never on `<main>`.
- Navbar geometry, measured before and after (identical): at 1440×900 the panel is `160,0 1120×92` and the logo target `189,10.5 196×70`; at 390×844 the panel is `14,0 362×78` and the logo target `29,10.5 140×56`.

## Direction

The page argues that grey-fabric margins are counted in paise per metre, and shows it with an interactive example Cost Sheet calculated by the real engine (`calcFullTotals` + `buildCostingResult`, `components/landing/sample-costing.ts`). The server renders the starting numbers; the engine chunk loads only when a visitor reaches for a control, so it does not compete with first paint or the intro's 1.5s start watchdog.

Visual system, "Neel": cotton-white paper, indigo for ink, actions and bands (a richer take on the app's loom navy), saffron as the one thread; the black navbar stays the only pure black. Chosen on 2026-09-28 after rendering five palettes on the real page (steel, Neel, kora + madder, mill green, charcoal dark) with only the tokens swapped; the earlier greige and steel drafts made saffron read as a tint rather than an accent. The navbar panel's edges continue down the page as two warp hairlines (`Beam`). Anek Latin/Gujarati/Devanagari (Ek Type) for display, Geist Mono for figures, Inter for body. CSS Module rules are unlayered and beat Tailwind utilities, so colour variants live in the module (`primaryOnLoom`, `secondaryOnLoom`), not as utility overrides.

Sections: hero + live sheet, cost stack (#product), paise band, enquiry-to-pay-slip (#workflow), made for the unit, plan table (#plans), pricing and terms (#pricing), FAQ (#faq, native exclusive `<details>`), closing, footer. Removed: blur blobs, mandatory scroll-snap (`globals.css`), and the estimator screenshot that showed retired party-order/quotation/market-run actions.

## Policy pages

`/terms`, `/privacy`, `/refund-policy`, `/privacy-request` and `/security-incident` share `components/policies/legal-chrome.tsx` (black header panel in the navbar's proportions, landing type and colour, landing footer). The first three keep `PolicyPage`/`PolicySection`/`PolicyCallout`/`PolicyContactPanel` with unchanged props, so their legal text is untouched. `/privacy-request` and `/security-incident` were restyled onto the shell with their text unchanged. `next/font` is stubbed for Vitest (`__tests__/stubs/next-font-google.ts`, aliased in `vitest.config.ts`) because tests render these pages to static markup.

## Evidence used for claims

- Plans and capabilities: `lib/subscription-access.ts`, `lib/owner-navigation.ts`, `lib/billing-constants.ts`, `docs/public-plans-and-policies.md`.
- Estimator inputs, outputs, Quick/Detailed: `app/(dashboard)/owner/estimator/EstimatorClient.tsx`, `lib/estimator.ts`.
- Cost Sheet export (A4 PDF, internal cost sheet or customer quotation, all plans): `components/estimator/CostingExportDialog.tsx`, `lib/estimator-export.ts`, `app/free/costings/SavedFreeCostings.tsx`.
- Rate Book updates matching saved qualities; saved costings stay unchanged: `app/(dashboard)/owner/rates/actions.ts`, `supabase/migrations/20260721203000_atomic_base_rate_updates.sql`.
- Server recomputation refuses mismatched totals (Lite/Base save path): `app/(dashboard)/owner/estimator/actions.ts` (`totalsMatchAuthoritative`).
- Base: day/night production, yarn stock deducted by production, delivery challans, weaver wage per quality, cash/bank/UPI/cheque settlement: `lib/i18n/yarn-stock.ts`, `lib/i18n/locales/en.ts`, `lib/finance.ts`.
- Hindi/Gujarati labels shown on the page come from `lib/i18n/base-plan-phrases.ts`.
- No approved social proof exists; none is shown. Workflow panels are labelled as example data.

## Open questions for the owner

- Free is the default for every new account (owner decision, 2026-09-28). `/signup` without a `plan` now signs up on Free, and `supabase/migrations/20260928160000_free_enrollment_default_on.sql` turns `enrollment_enabled` and `estimation_enabled` on. The migration is a file only: it must be applied to production (CLAUDE.md forbids `supabase db push` from a session). Until it is, if the switches are off in production, every Free signup (landing, navbar and plain `/signup`) ends in "Free enrollment is not available for this account yet."
- `app/manifest.ts` still describes the app as able to "automate daily briefs" (out of scope here).

## Status

- [x] Discovery and direction
- [x] Implementation, then a second pass after owner feedback (less copy, palette, navbar pill contrast), then the policy pages
- [x] Browser verification in dev at 1440×900, 768×1024 and 390×844: layout, no horizontal overflow, slider demo (pointer and keyboard), anchors, FAQ, internal routes (all 200), `/privacy-request` footer, intro handoff, skip, and final navbar geometry
- [x] `npx tsc --noEmit`, `npx vitest run` (229 files, 1975 passed, 1 skipped: HEAD's 1970 plus 5 in `__tests__/landing-page.test.ts`), `eslint` on every touched file (clean)
- [x] Contrast audit in the browser: every text/background pair on `/`, `/terms` and `/security-incident` is at least 5.4:1
- [ ] `npm run build` not run: blocked as a production-env action in this session. Reduced motion could not be emulated in the preview browser; it is handled by the intro policy (unit-tested) and `prefers-reduced-motion` guards in `landing.module.css`.
