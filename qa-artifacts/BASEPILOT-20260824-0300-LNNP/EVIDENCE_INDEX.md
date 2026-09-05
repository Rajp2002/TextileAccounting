# Base Plan QA evidence index

Run ID: `BASEPILOT-20260824-0300-LNNP`  
Production URL: `https://textile-accounting.vercel.app`  
Authoritative row ledger: [base-ledger/TEST_MATRIX.md](base-ledger/TEST_MATRIX.md)

## Browser captures

The retained screenshots are in [evidence/screenshots](evidence/screenshots):

- `AUTH-001-base-login.png` — authenticated Base shell
- `NAV-003-base-supervisor-boundary.png` — premium/supervisor boundary evidence
- `EST-001-manual-oracle.png` — canonical arithmetic result
- `QUAL-002-save-quality-v1.png` — saved quality/v1 flow
- `RATE-001-rate-book.png` — Rate Book
- `RATE-007-utc-date-default-defect.png` — early-IST previous-day date defect
- `EST-012-reopen-current-rate.png` and `EST-012-reopen-missing-weave-input.png` — current-rate reopen and contradictory required weaving input
- `EST-013-compare-v1-v2.png` — version comparison
- `SET-002-defaults-60000.png`, `SET-002-defaults-persisted.png`, `SET-002-overhead-v3-preview.png` — settings/output/overhead v3
- `AUTH-002-invalid-login.png` — neutral invalid-login response

Additional current-run browser evidence is recorded as DOM/browser-evaluation references in the row ledger for document previews, export redaction, mobile viewports, language switching, auth revocation, draft recovery, and archive cancellation.

## Persisted production evidence

- Supabase production project: `vzhwahudircrpgtitwzd`.
- Base pilot organization was unique, onboarded, unlocked, with one active owner, one active Base entitlement, and one captured first-year payment of ₹8,260.
- Final cleanup reconciliation: 5 active templates, 13 active quotes, 3 run-prefixed QA versions, Weft 50D current ₹350/kg, 54,000 m/month, commission/transport defaults 0, and 5 export runs.
- v1/v2/v3 database IDs and scalar snapshots are listed in [COSTING_ORACLE.md](COSTING_ORACLE.md).

## Organization export evidence

The production export was downloaded to the browser Downloads folder and parsed read-only:

- File: `weavly-org-export-20260823215332196.json`
- Size: 2,073,979 bytes
- SHA-256: `7b4455adc562e24e5c2b4d11e4b8325de7090e085bb260e02245214e9f0aee00`
- Scope: `current_owner_org`; schema marker `base-legal-v1`
- Counts included 1 organization, 19 estimator quotes, 13 rates, 27 rate-history rows, and no workers/orders/parties/stock/payroll rows in this tenant.
- The export's sensitive-field review reported 20 reviewed occurrences: 12 `[REDACTED]`, 8 null, 0 non-redacted.

The JSON is intentionally not copied into this repository because it contains tenant operational/billing data; only its hash, size, scope, counts, and redaction result are recorded here.

## Deployment/release evidence

- Deployed production commit and alias: `2f89ecc08f3cc15402c788650263c9896ea1122a` (`dpl_HHyD45TFndcMDL9VjnMhVRT15GXK`).
- Technical gate at the exact commit: npm ci, lint, typecheck, tests (980 passed, 1 skipped live-Supabase test), build, and production dependency audit all passed; full dev audit reported 12 dev-only vulnerable dependency nodes.
- Production migration head was `20260824040000`, including three migrations not present in the deployed main commit. This version alignment gap is a release blocker.
- Latest encrypted backup succeeded at the deployed commit; the latest restore drill was stale (through `20260715113013`) relative to the current production migration head.

## Runtime/security evidence

- Vercel runtime error aggregation (last 7 days) showed four invalid-refresh-token middleware events and one `/owner/analytics` “Full Suite subscription required” server error. The latter is consistent with a Base deep-link boundary that logs an error instead of cleanly returning the upgrade state.
- Supabase security gate: all 28 scoped public tables RLS-enabled, no anon/PUBLIC DML, zero cross-tenant relationship mismatches in 13 checks, but two High findings permit direct Base-owner RPC abuse (premium order creation and forged verified costing snapshots).
