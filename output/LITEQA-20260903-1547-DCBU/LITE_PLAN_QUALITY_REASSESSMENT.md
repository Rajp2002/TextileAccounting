# Weavly Lite quality reassessment

Date: 3 September 2026 (Asia/Kolkata)  
Target: `https://textile-accounting.vercel.app`  
Account scope: authenticated Lite owner QA account  
Reference standard: `Weavly Lite Product, Domain & Costing Manual v2.0` plus the repository pre-pilot guide.

The comparison used the manual’s formula and worked example (pp. 6–7), quotation/markup contract (pp. 11–12), four-job workflow (pp. 16–18), product invariants (p. 23), golden rules (p. 24), and decision map (p. 25).

## Decision

**Overall quality tier: B- / Conditional Go — 7.7/10.**

The Lite costing engine is strong enough for a controlled pilot with a knowledgeable, English-speaking owner. It is not yet A-tier or safe for broad, unsupervised quoting because the product and the supplied manual disagree on markup versus margin, and the saved-costing comparison screen can display a non-applicable multi-layer rate as `0/kg`.

If the manual is the contractual product standard, this is **No-Go for customer quoting until the commercial formula/label is corrected**. If the product intentionally uses gross margin, update the manual and every affected explanation before release.

## Scorecard

| Area | Score | Result |
| --- | ---: | --- |
| Textile costing math and traceability | 9.0/10 | Strong; formulas, units, shortage order, overhead provenance, and validation behaved correctly. |
| Reuse, repricing, Rate Book, and history | 8.5/10 | Strong lifecycle; comparison display has one material defect. |
| Internal cost sheet and customer quotation privacy | 8.7/10 | Generated PDFs were valid, readable, and customer-safe. |
| Lite entitlement, billing, settings, and export | 7.3/10 | Boundary is mostly correct; export-history routing and tenant metadata need repair. |
| UX, localization, and domain wording | 5.0/10 | English is usable; Hindi/Gujarati are not release-quality and one winding label contradicts the engine. |
| Release/security hygiene | 4.0/10 | Tests/build/migrations pass, but lint warnings, dependency advisories, and Supabase advisor backlog remain. |

## Manual golden-rule comparison

| Manual non-negotiable | Result |
| --- | --- |
| Calculate every yarn layer separately | **Pass** — two warp layers and one weft layer each contributed once. |
| Preserve the kg/100m → Rs/100m → shortage → Rs/m → overhead chain | **Pass** — the detailed audit exposed each step. |
| Apply 10% shortage after combined yarn cost | **Pass** — ₹18.01/m base yarn became ₹19.81/m after 10%. |
| Separate construction from commercial variables | **Pass** — saved quality remained reusable while rates/overhead changed. |
| Saved Quality is not Saved Costing | **Pass** — recipe update did not create or rewrite a costing snapshot. |
| Rate Book is current commercial truth | **Pass** — add, update, review-conflict, source, notes, and current/previous values worked. |
| Historical costings remain immutable | **Pass** — the old snapshot retained ₹191/kg and ₹34.31/m after the current recipe rate changed to ₹192/kg. |
| Quick and Detailed have one result | **Pass** — same inputs produced the same result. |
| No valid inputs means no fake zero | **Pass** — zero loom rate blocked the result with a field-specific message. |
| Internal Cost Sheet is separate from Customer Quotation | **Pass** — customer PDF contained no internal cost, rates, overhead, commission, waste, or profit. |
| Reuse known construction for repeat business | **Pass** — saved quality loaded into the estimator with current rates. |
| Lite ends at costing/commercial output | **Pass** — operational routes were gated and absent from Lite navigation. |
| Actual overhead is evidence, not an automatic costing rate | **Pass** — direct overhead showed its source and monthly mode showed the reference rate separately. |
| Slider is markup, not margin | **Fail — contract mismatch** — the supplied manual requires `Markup` and cost × (1 + markup), while the deployed UI says `Target margin` and uses selling-price denominator math. |

## What was tested

### Calculate

- Reproduced the manual’s 75D/3,600-end, 150D/1,200-end, 60-PPI/60-inch example.
- Confirmed base yarn cost ₹18.01/m, 10% adjustment ₹1.80/m, adjusted yarn ₹19.81/m.
- Confirmed the application requires a positive weaving/loom rate; with ₹1.00/m loom cost and ₹13.50/m direct overhead, the resulting production cost was ₹34.31/m.
- Tested decimal GST: 5% GST changed the affected warp base cost from ₹5.73/m to ₹6.02/m and the full result from ₹27.39/m to ₹27.68/m in the isolated case.
- Tested width equivalence: 60 inches and 152.4 cm both produced ₹27.39/m.
- Tested 2 paise/pick × 60 picks: loom cost became ₹1.20/m with no 100× rupee/paise error.
- Tested formula/manual kg modes and observed the same warp result.
- Tested outsourced sizing at ₹1.50/kg and confirmed it applied to 5.50kg warp consumption; switching in-house removed the direct charge.
- Tested winding, processing, and finishing inputs. Each changed the total only when enabled.
- Tested direct overhead and monthly overhead. Monthly mode calculated ₹11,50,000 ÷ 90,000m = ₹12.78/m after capacity inputs were completed.
- Tested capacity: 24 looms × 144.23m/day × 26 days = 89,999.52m.
- Tested the invalid zero-weaving-rate state; save/result remained blocked.

### Reuse & Reprice / Maintain

- Created a run-scoped Rate Book yarn at ₹191/kg with source and notes.
- Updated it to ₹192/kg; the UI showed previous rate ₹191/kg and the database recorded both `recorded` and `changed` history events.
- Verified the saved-quality conflict review: the same yarn appearing at ₹180/kg and ₹191/kg was surfaced for owner review.
- Saved a reusable quality plus its first immutable costing snapshot.
- Loaded the saved quality, changed the saved recipe rate, and confirmed the UI explicitly said no costing snapshot was created.
- Verified the database still contained v1 at the original ₹191/kg and ₹34.31/m.
- Exercised Saved Costings search, filters, sort, favourites, archive, restore, duplicate-to-draft, detail view, and two-snapshot comparison.

### Save & Share

- Internal cost sheet PDF: one-page A4, with production cost, selling price, break-even, margin, cost shares, yarn rates, and commercial assumptions.
- Customer quotation PDF: one-page A4, with customer, fabric quality, quoted price, quantity, validity, and terms only.
- The actual downloaded PDFs were inspected as files and visually rendered; both were legible and correctly paginated.
- Customer export required a customer/party name before enabling download.
- Organization export generated successfully, was recorded as `generated`, used `base-legal-v1`, scoped to the current owner organization, and contained a redaction catalog.

### Lite boundary, account, and billing

- The authenticated shell exposed only Cost Estimate, Yarn Rate Book, Saved Costings, Billing, and Settings.
- A sweep of all owner page routes confirmed production, payroll, operations, machines, inventory, dispatch, commercial, analytics, ledger, advances, and other operational surfaces were not usable as Lite features. Some show a Base upgrade wall; others redirect back to the estimator.
- Public unknown tracking token returned a safe link-not-found message and did not expose data.
- Billing correctly showed active Weavly Lite, annual renewal state, payment history, receipt availability, and the Base upgrade option. No charge/upgrade/refund mutation was performed.
- Session survived a full page refresh.
- Settings correctly distinguished new-estimate defaults from saved-costing history and exposed account/data controls.
- Hindi and Gujarati language switching worked technically, but the copy was heavily mixed with English and grammatically awkward.

## Findings requiring action

### F-01 — P0 commercial contract mismatch: markup is implemented as margin

The supplied manual says the slider must be a **Markup Helper** and gives `₹33.31 × 1.15 = ₹38.31/m`. The deployed product labels the control **Target margin** and calculates:

`(production cost + transport) ÷ (1 − commission − target margin)`

That is mathematically valid gross-margin pricing, but it is not the manual’s markup helper. On ₹34.31/m with no extras, 15% markup is ₹39.46/m while 15% gross margin is about ₹40.37/m. This can materially change a textile quote.

Recommended resolution: choose one contract. Either rename the product/help/manual to `Target gross margin (% of selling price)` everywhere, or implement a clearly named `Markup (% over cost)` control and preserve separate commission handling.

### F-02 — P1 financial explanation defect: comparison renders unavailable as zero

Comparing the two saved snapshots loaded the correct immutable economics, but the detailed comparison showed `Warp yarn rate 180/kg → 0/kg` because a multi-layer side has no single representative rate. The correct display is `Multiple`, `Not applicable`, or a layer-by-layer comparison. Rendering zero can lead an owner to believe a yarn rate dropped to zero.

Code evidence: [`lib/saved-costings.ts`](</Users/rajpatel/Projects/textile Saas/lib/saved-costings.ts:717>) converts `null` with `Number(null)`, while the comparison intentionally supplies `null` for multi-layer sides at lines 814–816.

### F-03 — P1 localization/comprehension defect

Hindi and Gujarati switched successfully, but important workflow copy remained mixed or awkward: `margin`, `defaults`, `when`, `return`, `documents generated`, `account deletion`, and similar terms were left in English or embedded in broken sentences. The Lite manual requires translation to preserve workflow and costing meaning. This is especially risky for margin/markup, overhead, and account/data terminology.

### F-04 — P1 domain wording defect: winding scope contradicts the engine

With winding at ₹4/kg, the engine added ₹0.28/m from total yarn consumption of 7kg/100m, which matches the code’s documented total-yarn formula. The UI simultaneously said `Applied on 3.00 kg warp yarn consumption.` Clarify whether winding covers warp only or all yarn, then align the label, help, snapshot, and manual.

### F-05 — P2 visible data-export history route is unreachable for this Lite account

Settings exposes `View export history` and the dedicated page exists, but direct navigation to `/owner/data-export` redirected to the estimator because the account’s `onboarding_complete` flag is false and the proxy allowlist includes Settings but not Data Export. The inline export itself worked, so this is a route/functionality defect rather than an export-data loss.

### F-06 — P2 tenant metadata is contradictory

The active subscription is Lite (`plan_tier=lite`, `plan_id=weavly_lite_2026`) and runtime navigation/gating behaved as Lite, but the organization row still has `product_experience=full_suite`. Current access resolution falls back safely to Lite, but the provisioning/instrumentation invariant is broken and could create future entitlement or analytics drift.

### F-07 — P2 monthly-overhead setup is deceptively incomplete

Settings displayed a complete ₹11,50,000/month and 90,000m/month basis, but a fresh estimator in monthly mode remained unresolved until machine-count/capacity inputs were completed. The math becomes correct once those fields are entered; the issue is that the default-looking Lite setup does not make the required dependency obvious.

### F-08 — P1 release hygiene backlog

- `npm run lint`: 0 errors, 44 warnings; the guide’s acceptance standard is zero warnings.
- `npx vitest run`: 197 test files passed; 1,195 tests passed and 1 skipped. The skip is the live Supabase integration test because `RUN_LIVE_SUPABASE_TESTS` is unset.
- `npm run build`: passed successfully; a stale Browserslist data warning was emitted.
- Deployed and repository migrations matched at 273, with head `20260902135923_monthly_overhead_analytics_events`.
- `npm audit --omit=dev --audit-level=high` and full `npm audit --audit-level=high` both exited non-zero. Production dependency paths include high-severity browserslist and fast-uri advisories; the full report contains 13 high-severity findings.
- Supabase advisors reported relevant fail-closed/no-policy and security-definer-function notices around estimator attestations, Rate Book RPCs, estimator revision RPCs, and subscription/access functions, plus RLS/performance policy warnings. No in-app tenant leak was observed in this run, but these notices need explicit security-owner disposition.

## Coverage and limits

The production Lite-visible surface and its route boundaries were tested. Full-suite production, inventory, dispatch, commercial, receivables, worker, payroll, and supervisor workflows were intentionally treated as **out of Lite scope**; they were boundary-probed, not executed as business operations. Payment mutations, account deletion, another-tenant login, forced session revocation, one-hour expiry, backup restore, and source-map/Sentry verification were not performed in this owner-only run.

## Release recommendation

1. Resolve F-01 with an explicit product-owner decision and synchronized manual, UI, help, PDFs, and tests.
2. Fix F-02 before relying on Saved Costings comparison for repricing decisions.
3. Fix F-03 before a Hindi/Gujarati rollout; English-only controlled pilot is reasonable after F-01/F-02.
4. Correct F-04–F-07 and disposition the dependency/RLS advisor findings before calling Lite A-tier.

Evidence artifacts:

- [Run results JSON](</Users/rajpatel/Projects/textile Saas/output/LITEQA-20260903-1547-DCBU/results.json>)
- [Rendered test matrix](</Users/rajpatel/Projects/textile Saas/output/LITEQA-20260903-1547-DCBU/TEST_MATRIX.md>)
- [Customer quotation PDF](</Users/rajpatel/Downloads/quotation-liteqa-sample-customer-liteqa-20260903-1547-dcbu-savedquality-2026-09-03.pdf>)
- [Internal cost sheet PDF](</Users/rajpatel/Downloads/cost-estimate-liteqa-20260903-1547-dcbu-savedquality-2026-09-03.pdf>)
