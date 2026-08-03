# Sprint 14 — Persona Test NO-GO Remediation

Date: 2026-08-03
Status: **Code remediation complete; pilot remains NO-GO pending product/configuration gates and authenticated retest**

## Decision

The persona test correctly identified pricing-trust and purchase-confidence blockers. The production alias was not changed during this remediation pass.

The code changes below are ready for a controlled QA retest, but they do not by themselves authorize a pilot release. GST tax-invoice availability and complete Gujarati/Hindi localization remain unresolved product/configuration gates.

## Finding disposition

| Finding | Current disposition | Evidence or remaining gate |
| --- | --- | --- |
| Zero looms/output and zero-denominator baseline | Code fixed | Wizard disables continuation for non-positive capacity; server action rejects invalid monthly profiles. Requires authenticated browser retest. |
| Comparison direction | Code fixed | Snapshots are ordered old → new and the UI states “New minus Old” with explicit Old/New columns. Covered by comparison regression test. |
| Waste default versus applied row waste | Code fixed | Detailed mode separates “Default weft waste” from “Applied to pricing”; engine calculations were not changed. Requires authenticated browser retest. |
| Quotation lifecycle | Code fixed | Status labels, updated timestamp, status-history dialog, and audit-log-backed history are visible in the quotation workflow. Requires authenticated browser retest. |
| Save Quality versus Save Costing | Clarified, behavior preserved | Copy now states that Save Quality creates the reusable recipe and initial v1 snapshot; Save Costing is for a later version. The existing atomic data behavior was intentionally preserved. |
| GST tax invoice | **Open product/configuration gate** | Billing now states before payment that a receipt is not a GST tax invoice and reports whether invoice configuration is enabled. Supplier tax identity, feature flag, and compliance approval still need confirmation. |
| Draft management | Code fixed | Draft banner now shows full Surat date/time and has Restore, Rename, and Discard controls. Requires authenticated browser retest. |
| App update notice | Code fixed | Update toast is session-deduplicated and finite-duration instead of persistent. Requires authenticated browser retest. |
| Gujarati/Hindi localization | **Partially addressed; open** | Core suggested-price label now uses the locale key. Full mixed-language navigation and estimator copy still need a translation-completion decision and review. |
| Rate dates/timezone | Code fixed in Rate Book | Date defaults and displays use Asia/Kolkata helpers; audit timestamps include local time. Requires authenticated browser retest. |
| Detailed-mode cognitive load | Code fixed/iterated | Quick mode is the default; pricing assumptions remain progressive disclosure with reduced-motion support. Requires authenticated browser retest. |
| Async feedback and modal wording | Code fixed in reviewed surfaces | Rate, costing archive, and quotation actions include the affected object/status in progress feedback. Requires authenticated browser retest. |
| Saved Costings search width | Code fixed | Search toolbar is min-width-safe and stacks before the wide desktop layout. Requires authenticated browser retest. |
| Record deletion expectations | Documented policy | Archive/restore remains the non-destructive workflow. Permanent deletion was not added; retention policy must be communicated in product/legal copy. |

## Implementation scope

- `FactoryCostWizard.tsx` and estimator server actions reject zero/non-finite loom count, working days, productivity, monthly output, and monthly-expense baselines.
- `saved-costings.ts` and `QuotesClient.tsx` centralize Old → New comparison order and label the direction.
- `EstimatorClient.tsx` distinguishes configured default weft waste from row-applied waste, defaults to Quick mode, improves draft controls, and clarifies save semantics.
- `actions.ts` and `QuotesClient.tsx` expose quotation status history from the existing audit log without changing pricing or quotation APIs.
- `RatesClient.tsx` uses Surat timezone date formatting and object-specific archive feedback.
- `pwa-update-notice.tsx` no longer uses an infinite-duration toast.
- Billing copy exposes GST invoice availability before payment; no invoice compliance claim is made until supplier configuration is verified.

## Verification

- `npm test`: **135 files passed; 866 tests passed; 1 skipped**.
- `npm run lint`: **pass**.
- `npx tsc --noEmit`: **pass**.
- `npm run build`: **pass**; the build also reran the full test suite and completed Next.js compilation, TypeScript, static generation, and optimization.
- Focused remediation suite: **20 tests passed** across the new pilot suite and existing estimator/comparison readiness suites.
- Authenticated browser retest: **blocked**. The local route correctly redirected to `/login`; the available private QA credential was rejected, and the connected in-app browser had no signed-in tab. No auth bypass or test data mutation was performed.

## Release gate

Do not push/merge/deploy this remediation until:

1. A valid isolated owner QA account is supplied/configured and the persona flow is rerun at 320, 480, 768, 1024, 1280, and 1440px widths.
2. GST tax-invoice issuance is either enabled with approved supplier configuration or explicitly accepted as a post-pilot limitation by the product/business owner.
3. Gujarati/Hindi support is either completed for the pilot surface or explicitly labeled as partial support.
4. The persona test confirms the two Critical issues and the quotation/waste trust issues are resolved in the browser.
