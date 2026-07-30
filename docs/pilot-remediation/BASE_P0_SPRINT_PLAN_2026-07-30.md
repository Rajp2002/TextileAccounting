# Weavly Base P0 Remediation Sprint

**Sprint objective:** Close every P0 blocker in the 30 July Base Pilot Go/No-Go report and produce objective evidence for a Base-only pilot retest.

**Source report:** `output/pdf/WEAVLY_BASE_PRODUCT_PILOT_GO_NO_GO_REPORT_2026-07-30.pdf`

**Scope:** Weavly Base / Estimator only. Full Suite workflow remediation is excluded.

**Decision at sprint start:** No-Go

**Sprint length:** 5 working days plus a controlled deployed-environment retest.

## Exit rule

The sprint is complete only when all four P0 workstreams meet their acceptance gates:

1. Transport changes the authoritative quote price everywhere.
2. Estimator UI, saved assumptions, internal PDF, and customer PDF agree on price and margin.
3. Failed, dismissed, and stale Razorpay checkouts are truthful and immediately retryable; a Netbanking success is proven in the deployed environment.
4. The production dependency audit has zero untriaged high or critical findings.

Passing unit tests alone is not sufficient. Commercial and billing fixes require deployed runtime evidence.

## Sprint workstreams

| ID | Workstream | Owner role | Estimate | Dependency | Status |
| --- | --- | --- | ---: | --- | --- |
| P0-PRICE | Authoritative transport-aware pricing | Product engineer | 1.0 day | None | Implemented locally |
| P0-EXPORT | PDF commercial consistency | Product engineer + QA | 0.75 day | P0-PRICE | Implemented locally |
| P0-BILL | Razorpay failure/retry state and Netbanking proof | Product engineer + release owner | 1.5 days | Deployed test keys/webhook | Application recovery implemented; deployed success proof pending |
| P0-DEPS | Production dependency remediation | Platform engineer | 0.75 day | Build verification | Implemented locally; production audit and build clean |
| P0-RETEST | Base-only regression and Go/No-Go rerun | QA/release owner | 1.0 day | All workstreams | Local gates complete; deployed retest pending |

## Day-by-day execution

### Day 1 - Commercial invariant

- Make non-zero transport an explicit authoritative pricing input even when a legacy/default section toggle is false.
- Calculate actual margin per metre rather than from aggregate order totals.
- Preserve zero-quantity Base costings without emitting `0 / 0` margin behavior.
- Add formula regressions for:
  - production cost `35.1718`, transport `1.50`, commission `2%`, margin `10%` -> quote `41.6725`;
  - production cost `35.1718`, transport `2.00`, commission `2%`, margin `10%` -> quote `42.2407`;
  - order quantity absent -> margin still `10%`.

**Acceptance:** Client totals and server-authoritative persistence use the same formula and round only at the snapshot boundary.

### Day 2 - Export consistency

- Recompute historical export economics from the immutable saved assumptions rather than trusting a previously persisted buggy quote price.
- Show profit per metre when Base has no order quantity.
- Show total expected profit only when quantity is present.
- Keep customer quotation free of internal cost and margin fields.
- Parse and render both generated PDFs during retest.

**Acceptance:** UI, internal PDF, and customer PDF show the same transport-aware unit price. Internal PDF shows the configured margin and never labels a missing quantity as zero expected profit.

### Day 3 - Billing recovery

- Treat Razorpay order creation as `pending`, not payment receipt.
- Reserve `activating` language for a verified `authenticated` lifecycle row.
- Correlate failed payment rows to the exact subscription/order and return a retryable state.
- Mark dismissed and failed checkout orders `cancelled`/`halted` through an authenticated, tenant-scoped endpoint.
- Replace the non-working advertised test-card instruction with the approved Netbanking pilot path.
- Keep activation server-authoritative; the browser callback cannot grant access.

**Acceptance:** Failure, dismissal, and a stale order never show "payment received." The owner can retry without database cleanup. A deployed Netbanking mock success produces exactly one captured payment and one active Base entitlement.

### Day 4 - Dependency gate

- Upgrade Next.js, Sentry, PostCSS, and aligned tooling to patched releases.
- Remove the deprecated unused `crypto` package; retain Node's built-in `crypto` imports.
- Override the vulnerable Workbox build-only EJS chain only if full build validation passes.
- Run both production-only and full dependency audits.
- Do not use `npm audit fix --force`.

**Acceptance:** Zero high/critical production advisories, or a written exploitability decision with owner and expiry. Tests and the optimized production build remain green.

### Day 5 - Verification and release decision

- Run focused P0 regression tests.
- Run the full Vitest suite, lint, TypeScript/Next production build, and dependency audits.
- Deploy to the target environment.
- Reuse the retained Base QA account or create a new isolated `BASEPILOT` account.
- Execute:
  - transport `1.50` and `2.00` quote oracle;
  - internal and customer PDF downloads and visual inspection;
  - Netbanking failure, dismissal, retry, and success;
  - database reconciliation for quote snapshots, payment, and entitlement cardinality.
- Update the Go/No-Go report.

## Detailed acceptance ledger

| Gate | Required proof | Failure condition |
| --- | --- | --- |
| PRICE-01 | Non-zero transport affects `calcFullTotals().orderQuote.quotePricePerM` even with a stale disabled toggle | Transport changes but price does not |
| PRICE-02 | Server rejects client totals that differ from the transport-aware authoritative total | Client can persist an alternate price |
| EXPORT-01 | Historical saved assumptions export the corrected derived price | Export trusts the old buggy persisted price |
| EXPORT-02 | No-quantity internal PDF shows target/actual margin and profit per metre | Margin is 0%, profit is Rs 0, or NaN/Infinity appears |
| EXPORT-03 | Customer PDF hides production cost, margin, and profit | Internal economics leak |
| BILL-01 | Created order says payment is pending, not received | UI claims receipt before verification |
| BILL-02 | Failed/dismissed checkout becomes retryable immediately | Manual row cleanup or 15-minute wait is required |
| BILL-03 | Checkout-state mutation is owner-authenticated, tenant-scoped, exact-order scoped, and only updates `created` rows | Cross-tenant or paid-state mutation is possible |
| BILL-04 | Netbanking success yields one captured payment and one active Base entitlement | Duplicate/missing payment or entitlement |
| DEPS-01 | `npm audit --omit=dev` has zero high/critical findings | Any untriaged high/critical production advisory |
| BUILD-01 | Focused tests, full tests, lint, and production build pass | Any regression or compile failure |

## Implementation map

| Area | Files |
| --- | --- |
| Pricing invariant | `lib/estimator.ts` |
| Export reconciliation | `lib/estimator-export.ts`, `app/(dashboard)/owner/quotes/QuotesClient.tsx` |
| Billing state resolver | `lib/billing-lifecycle.ts`, `app/(dashboard)/owner/billing/page.tsx` |
| Checkout recovery endpoint | `app/api/billing/checkout-state/route.ts` |
| Razorpay client recovery | `components/billing/SubscribeButton.tsx` |
| Regression coverage | `__tests__/estimator.test.ts`, `__tests__/base-estimator-refinements.test.ts`, `__tests__/base-p0-remediation.test.ts` |
| Dependency closure | `package.json`, `package-lock.json` |

## Risks and controls

- **Historical data:** Existing quote rows retain the old stored result. Export now derives from saved assumptions; a separate reviewed backfill is required before using old database price columns for reporting.
- **Razorpay environment:** Local tests can prove state handling but cannot prove the provider's hosted Netbanking flow. Deployed runtime proof remains mandatory.
- **Webhook race:** Checkout recovery updates only `created` rows. A verified/activated row cannot be downgraded by a late dismissal callback.
- **Dependency overrides:** The EJS override is accepted only if the PWA production build completes and offline artifacts are generated.
- **Development audit:** The production audit is clean. The full audit retains a high-severity `brace-expansion` advisory only through ESLint development tooling; npm's proposed force-fix would install a breaking, older Next ESLint configuration and is not accepted for this sprint.
- **Dirty worktree:** Pre-existing estimator quality-save changes are preserved and are not folded into the P0 scope.

## Local verification evidence

- Focused P0 regression: 4 files, 59 tests passed.
- Full Vitest suite: 115 files passed; 778 tests passed and 1 intentionally skipped.
- Lint: full repository lint passed; changed-file lint passed after final test stabilization.
- Production build: Next.js 16.2.12 optimized Webpack/PWA build passed, including TypeScript and 45 static pages.
- Production dependency audit: `npm audit --omit=dev` found 0 vulnerabilities.
- Full dependency audit: development-only ESLint chain retains 9 high advisory paths rooted in `brace-expansion`; no production package is affected.
- Sprint-plan PDF: rendered to four A4 pages and visually inspected.

## Definition of done

- All local gates are green.
- The target deployment contains the exact tested commit.
- A fresh or retained Base account completes the Netbanking success flow.
- Tenant-scoped reconciliation proves one captured payment and one active Base entitlement.
- Two transport scenarios match the independent oracle in UI, database, and both PDFs.
- The updated pilot report has no open P0 finding.
