# Sprint 13 — Estimator Aesthetic and Responsive Refinement

Date: 2026-08-03
Status: **Production-ready and live**
Scope: owner estimator result cockpit, pricing-assumptions disclosure, responsive layout, accessibility polish

## Outcome

The estimator now leads with the decision-critical result: production cost, suggested price, actual margin, and break-even price. Detailed pricing inputs remain available through a compact **Pricing assumptions** disclosure instead of competing with the result above the fold.

Existing costing calculations, saved-costing behavior, database access, API contracts, and business rules were not changed. The only result-level logic adjustment is presentation-only: a valid per-metre actual margin can be shown before an order quantity is set; quantity remains required for quote totals and save behavior.

## Delivered changes

- Replaced the large assumptions block with an accessible disclosure row.
  - Quick mode starts collapsed.
  - Detailed mode starts expanded.
  - Manual expand/collapse is preserved while switching modes during the current interaction.
  - `aria-expanded`, `aria-controls`, keyboard focus styling, status warnings, and a 44px touch target are present.
  - Missing quantity, unavailable cost, and incomplete calculations are surfaced with text and warning icons.
- Simplified expanded assumptions into one contained section with subtle dividers:
  - Overhead — monthly expenses ÷ output or direct rate — ₹/m
  - Commission — %
  - Transport — ₹/m
  - Target margin — %
  - Quantity — value or Not set
  - Technical snapshot/version is behind a secondary Technical details disclosure.
- Reworked the result hierarchy:
  - Active cost estimate, quality indicator, and current factory baseline appear first.
  - Production cost and suggested price are the primary values.
  - Actual margin uses a restrained positive/negative/warning treatment with explanatory text.
  - Break-even remains visible but secondary.
  - Material context and cost composition sit below the primary metrics.
- Added width-driven layout behavior:
  - Below 430px: single-column metric layout.
  - At wider mobile/tablet widths: balanced metric grid and existing application shell behavior.
  - At large layout widths in Detailed mode: estimate and assumptions use a constrained two-column structure.
  - Long quality names and large currency values wrap without horizontal scrolling.
- Added reduced-motion handling for disclosure expansion and chevron rotation.

## Responsive QA matrix

The compiled production build was checked at representative widths with a populated estimate and no horizontal overflow.

| Viewport | Mode/state checked | Result |
| --- | --- | --- |
| 320×800 | Quick, assumptions collapsed | Single-column metrics; `scrollWidth = 320`; no overflow |
| 360×800 | Quick, assumptions collapsed | Mobile screenshot captured; safe-area navigation visible; no clipping |
| 480×900 | Quick, assumptions collapsed | Wider mobile/fold-cover behavior; `scrollWidth = 480`; no overflow |
| 768×1024 | Detailed, assumptions expanded | Tablet portrait; metrics remain readable and assumptions stay below the result |
| 1024×768 | Detailed, assumptions expanded | Laptop threshold; estimate and assumptions use the detailed two-column structure |
| 1280×900 | Detailed, assumptions expanded | Constrained desktop shell; result remains visually dominant |
| 1440×1000 | Detailed, assumptions expanded | Generous margins; no oversized full-width cards or clipped content |

Captured screenshots:

- [360px Quick / collapsed](../../../output/playwright/estimator-refinement/estimator-360-quick-collapsed.png)
- [768px tablet / Quick collapsed](../../../output/playwright/estimator-refinement/estimator-768-quick-collapsed.png)
- [1280px Detailed / expanded](../../../output/playwright/estimator-refinement/estimator-1280-detailed-expanded.png)
- [1440px Detailed / expanded](../../../output/playwright/estimator-refinement/estimator-1440-detailed-expanded.png)

The screenshots use a temporary local QA fixture created for visual verification. The fixture and its records were removed after capture; no temporary QA records remain.

## Accessibility and interaction checks

- Disclosure uses a native button with `aria-expanded` and `aria-controls`.
- Entry-mode controls retain tab semantics, visible focus rings, and 44px touch targets.
- Warning states include text, not color alone.
- Quantity warnings are announced in the disclosure label and expanded status row.
- Technical identifiers are not prominent in the primary user-facing hierarchy.
- Reduced-motion preferences suppress the expansion/chevron animation.
- Long labels, quality names, material names, and currency values use wrapping/min-width-safe layout rules.

## Verification

- `npm run lint` — pass
- `npx tsc --noEmit` — pass
- Focused estimator/refinement tests — 4 files, 18 tests passed
- `npm test` — 134 files passed; 861 tests passed; 1 skipped (862 total)
- `npm run build` — pass with the production environment loaded locally
- `git diff --check` — pass
- Compiled-build browser QA — no console errors; touch targets measured at 44px; responsive matrix above passed

The build emitted only the existing Browserslist stale-data notice; no compilation or runtime error was observed.

## Files changed

- `app/(dashboard)/owner/estimator/EstimatorClient.tsx`
- `app/globals.css`
- `__tests__/sprint-estimator-aesthetic.test.ts`
- `output/playwright/estimator-refinement/*.png`

## Production release

- Release branch: `main`
- Merged release commit: `f450100` (`feat(estimator): refine responsive pricing disclosure`)
- Vercel deployment: `dpl_FesAqLsyKFYyoHYUkgggDtYVofap`
- Deployment state: `READY`
- Production URL: `https://textile-accounting.vercel.app`
- Deployment URL: `https://textile-accounting-mj7idm249-rajpatel86420-9825s-projects.vercel.app`
- Aliases: `textile-accounting-rajpatel86420-9825s-projects.vercel.app` and `textile-accounting-git-main-rajpatel86420-9825s-projects.vercel.app`
- Vercel prebuild: 132 test files passed, 2 skipped; 845 tests passed, 17 skipped; Next.js compilation and TypeScript completed successfully.
- Production smoke check: `/` returned HTTP 200; `/owner/estimator` returned the expected HTTP 307 redirect to `/login` for an unauthenticated request.
- Runtime logs after promotion: only the expected GET requests above; no error-level entries observed.

## Remaining limitations

This sprint does not add new pricing inputs or change the underlying costing model. The estimator remains dependent on the existing source data and factory profile; when those inputs are absent, the new warning treatment communicates the incomplete state without inventing a value.
