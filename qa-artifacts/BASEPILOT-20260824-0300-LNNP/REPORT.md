# Base Plan initial-rollout QA report

Run: `BASEPILOT-20260824-0300-LNNP`  
Target: `https://textile-accounting.vercel.app`  
Assessment date: 24 August 2026 (IST)

## Final decision

**NO-GO for granting initial access to five external test customers.**

The Base estimator’s arithmetic, persistence, document privacy boundary, export, mobile layout, localization data preservation, and session revocation are good enough for a tightly controlled internal owner check. The release is not safe for five-customer pilot access because production has two High tenant/business-integrity vulnerabilities, deployed-code/database migration drift, a stale restore drill, no independent signed factory truth sheet, and no five-tenant acquisition/isolation proof. These are release-integrity and authorization blockers, not cosmetic concerns.

## Coverage

The authoritative Base matrix contains all 65 Base rows. It is fully dispositioned:

| Status | Count |
| --- | ---: |
| Pass | 45 |
| Fail | 2 |
| Blocked by safety/scope | 6 |
| Code-verified (runtime not repeated) | 12 |
| Not run | 0 |

Full Suite production/order/stock/payroll/dispatch/market workflows are outside the Base initial-rollout scope and were treated as out-of-scope rather than product failures. The full row ledger remains available for a later Full Suite run.

## Golden Base journey result

The Base golden costing journey completed end to end:

1. Restored factory defaults and saved the run-prefixed quality.
2. Matched the independent single-warp/single-weft oracle exactly at v1.
3. Changed the current Weft rate ₹350→₹360 and reopened the quality.
4. Saved immutable v2 and compared v1/v2 deltas.
5. Changed monthly output 54,000→60,000, saved v3, and reconciled the overhead delta.
6. Generated an internal cost-sheet preview and a customer-safe quotation preview.
7. Generated a tenant-scoped organization JSON export and checked redaction.
8. Restored QA defaults and the Weft rate; no destructive archive/delete was performed.

The companion market/order golden journey is Full Suite scope and therefore not applicable to this Base decision.

## Costing verdict

The arithmetic gate passed. See the full inputs, tolerances, formulas, and v1–v3 reconciliation in [COSTING_ORACLE.md](COSTING_ORACLE.md).

The canonical result was exactly:

- Warp 3.322222 kg/100m, ₹11.63/m
- Weft 1.832371 kg/100m, ₹6.41/m
- Weaving ₹8.00/m; warping ₹0.40/m; overhead ₹5.75/m
- Production ₹32.19/m; break-even ₹34.37/m; landed ₹34.47/m
- Suggested price ₹39.17/m; margin 12.0%; expected profit ₹4,700 on 1,000 m

v2 correctly moved to ₹32.37/m production and ₹39.38/m quote when the Weft rate changed. v3 correctly moved to ₹36.95/m production and ₹44.71/m quote when monthly output changed to 60,000 m. Database snapshots for v1/v2/v3 remained immutable and matched the UI within tolerance.

## What worked well

- Invalid login was neutral; valid Base login landed on the correct tenant and plan.
- Premium owner routes showed upgrade walls without premium data. Logout revoked both tabs after reload.
- Rate Book current/previous/history semantics worked; linked yarn names were clearly locked.
- Blank/incomplete estimator inputs, negative denier, extreme denier, 100% margin, blank rate name, and required fields were guarded without partial writes.
- Explicit zero waste differed from blank/default waste as documented; cm/inch conversion was accurate.
- Formula/manual warp and weft modes matched; in-house/outsourced sizing changed only the intended layer.
- Internal preview included cost economics; customer quotation excluded cost, rates, overhead, break-even, margin, and profit and included the quotation-only/GST disclaimer.
- Organization export was Base-scoped and contained no non-redacted reviewed sensitive fields.
- 390×844 and 320×844 estimator checks plus 390×844 Rate Book/Settings checks had no horizontal overflow.
- English→Hindi→Gujarati→English preserved all key costing numbers. Translation is visibly mixed English/local-language in some explanatory strings, so localization is functionally usable but not polished.
- Browser console collection after the executed journeys returned zero errors/warnings.

## Findings that block or materially reduce pilot confidence

### High — direct Base owner can create Premium records

`start_party_order_from_estimator_v2` and the legacy `start_party_order_from_estimator` are authenticated-executable `SECURITY DEFINER` functions that check owner/tenant lock state but do not enforce the Premium subscription tier. A read-only dry run in the real Base-owner context passed authorization and reached the first Premium-record insert; it was stopped only by PostgreSQL read-only mode. The normal UI hides the action, but an authenticated Base customer can invoke the RPC directly.

Required fix: enforce current owner membership and Premium entitlement inside both functions; make the legacy entry point internal/service-only; add a regression test using a Base JWT.

### High — client can forge “verified” costing truth

`save_estimator_costing_revision_v2` mass-populates an `estimator_quotes` row from client JSON and overrides identity/version fields only. It does not independently recompute or override `reconciliation_status`, `costing_result_snapshot`, `calculation_version`, or derived price/cost/margin/profit scalars. A synthetic Base-owner payload reached the insert boundary with `verified`, a forged calculation version/snapshot marker, production cost 1, and quote price 999; read-only mode stopped the write. Current pilot rows are internally consistent, but that does not prove server-side truth.

Required fix: explicit allowlist, trusted/database recomputation, remove direct client authority for canonical costing truth, and add tamper tests.

### Release-integrity blockers

- The deployed alias is commit `2f89ecc…`, while production Supabase is at migration `20260824040000` with three newer migrations not present in deployed main. This means the browser is not proven to exercise the same release represented by the current database.
- The latest restore drill is stale relative to the current migration head. A current-schema restore drill is required before pilot data is trusted.
- A reviewer-approved, factory-signed truth sheet is absent. The independent oracle in this run is strong arithmetic evidence, not the business approval gate.
- Five independent owner tenants were not provisioned or browser-tested. Signup final account creation and any fresh-customer email/payment side effects were intentionally not submitted because browser policy requires action-time confirmation for those external effects. RLS/tenant SQL probes were positive, but this is not a substitute for five-customer onboarding/isolation evidence.

### Product defects / polish issues

- **P1 routing boundary:** direct `/owner/today` remains on an upgrade wall instead of canonicalizing to the estimator. `/supervisor/dashboard` also exposed a factory-floor shell to a Base owner (“Viewing as Owner”, Shift Production/Workers/Hajiri/Looms) even though no Base factory data was present.
- **P1 costing state:** reopening the saved quality restored the weaving-rate field blank/Required while still calculating with the old ₹8/m value and allowing v2 save. The saved toast/date and card dates also differed around the UTC/IST boundary.
- **P1 date boundary:** near 03:xx IST the Rate Book default/effective/review date showed the previous UTC date (23 Aug while local date was 24 Aug). At 14:21 IST the form showed 24 Aug, so this is a boundary defect rather than an all-day failure.
- **Runtime noise:** Vercel aggregation showed four invalid-refresh-token middleware errors and one `/owner/analytics` server error (“Full Suite subscription required”) while rendering the Base boundary. The analytics error should be handled as an expected upgrade state, not an application error.
- **Localization polish:** Hindi/Gujarati retained values but explanatory strings were partly mixed-language.

## Technical/security gate

At the exact deployed commit, npm ci, lint, TypeScript, test (980 passed, 1 skipped live-Supabase test), build, and production dependency audit passed. The full dev audit still reports 12 dev-only vulnerable dependency nodes (11 high, 1 moderate). Supabase project health is active; all 28 scoped tables have RLS and no anon/PUBLIC DML, with zero cross-tenant relationship mismatches in 13 checks. The security advisor reports 51 items, including 48 authenticated-executable `SECURITY DEFINER` warnings, disabled leaked-password protection, and two fail-closed no-policy tables.

## Pilot gate to reach GO

1. Align the deployed commit and migration head; rerun the current-schema restore drill.
2. Fix and regression-test the two High RPC/canonical-truth findings.
3. Freeze and sign the factory truth sheet, then rerun canonical plus boundary costing cases.
4. Provision five independent Base QA owners (or explicitly approve a safe fixture path), run signup/legal/landing/re-login/export, and cross-tenant access attempts.
5. Fix `/owner/today`, the supervisor-dashboard exposure, the weaving-field restoration defect, and the UTC date handling; clear or explicitly accept the runtime analytics error.
6. Decide whether billing lifecycle rows BILL-003–BILL-006 are in pilot scope. If customers self-pay, execute an isolated/sandbox lifecycle; if manually provisioned, record billing as explicitly out of scope.

Until those gates close, limit access to the existing internal QA owner and do not issue five customer invitations.

## Evidence

- [Base 65-row ledger](base-ledger/TEST_MATRIX.md)
- [Evidence index](EVIDENCE_INDEX.md)
- [Costing oracle](COSTING_ORACLE.md)
- [Retained browser captures](evidence/screenshots)
