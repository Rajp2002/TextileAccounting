# Current public plans and policies

Updated September 12, 2026. This records the implemented offer used by the landing page and public policies; it supersedes the older setup-fee proposal in `pricing-strategy-and-billing-migration-guide.md`.

| Plan | First period | Later renewal | Included workflow |
| --- | --- | --- | --- |
| Free | ₹0, no subscription fee | No annual renewal | Two successful costings per month, saved completed records, breakdowns, Cost Sheet export |
| Lite | ₹2,999 for 365 days | ₹1,499/year | Unlimited costing, saved costing history and reuse, reusable qualities, Rate Book, costing defaults, exports |
| Base | ₹9,999 for 365 days | ₹4,999/year | Lite plus owner-led production jobs, planned/produced/remaining metres, machines, piece-rate worker pay, advances, settlements |

Paid totals include the catalog's 18% GST component. The landing page, Terms, and Refund Policy derive paid amounts from `lib/billing-constants.ts`. Checkout determines the lawful tax treatment and document type; payment receipts must not be presented as GST invoices before supplier and tax configuration are ready.

Free's current database policy allows two calculations per verified owner per calendar month, resetting on the first day of each month at 00:00 Asia/Kolkata. No rollover. New successful calculations consume allowance; viewing and export do not. Changes to that policy must be reflected in landing copy, Terms, and plan-chooser translations. A successful calculation saves business inputs and results separately from operational receipts. Unfinished Free inputs are held in page memory, without recoverable draft autosave.

Paid renewal is manual and opens in the final 30 days. The implemented access resolver restricts expired Lite access unless another entitlement applies. A completed paid Base period retains Lite access when Base expires, with Base production actions restricted. Expiry never silently grants Free. Plan expiry itself does not delete records.

Public pages updated together: `/`, `/terms`, `/privacy`, `/refund-policy`, `/privacy-request`, and `/security-incident`. Signup links support `plan=free`, `plan=lite`, and `plan=base`. The Terms and Privacy versions in `lib/legal-documents.ts` are September 12, 2026; new signup acceptance records use these versions. Existing acceptance records are not rewritten.

Privacy distinguishes saved Free business records from quota receipts and limited usage events. Legal framework wording retains phased DPDP commencement; reference: [MeitY final DPDP Rules and notifications](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025) and [CERT-In directions](https://cert-in.org.in/Directions70B.jsp).

Implementation sources: `lib/billing-constants.ts`, `lib/subscription-access.ts`, `lib/subscription.ts`, `lib/free-service.ts`, `lib/upgrade-wall.ts`, `supabase/migrations/20260908182417_free_tier_foundation.sql`, `supabase/migrations/20260908205605_free_saved_costings_shared_estimator.sql`, and `supabase/migrations/20260912130854_free_monthly_allowance.sql`.

## Verification

The optimized production build and TypeScript checks pass.

- Full suite: 245 test files passed, 1,700 tests passed, one skipped.
- Lint passes for the changed TypeScript/TSX files. Repository-wide lint still reports two pre-existing errors in `components/estimator/FreeUsageCard.tsx` and `hooks/use-gutter-dock.ts`, plus unrelated warnings.
- Browser checks cover the three signup links and public policy routes, desktop pricing alignment and header clearance, and 320px/390px mobile widths.
- The public `/security-incident` information page is explicitly allowed without a session. Protected security and account APIs are unchanged.
- Legal light-mode body text and prices use readable dark text; inactive dark-theme surface classes no longer trigger the global dark-panel contrast rule.
- This change updates public copy, Free quota enforcement, and the legal versions used for new acceptance records. It does not change plan charges or rewrite existing acceptance records.
