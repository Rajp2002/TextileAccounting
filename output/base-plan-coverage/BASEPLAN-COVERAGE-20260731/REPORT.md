# Weavly Base Plan Production-Standard Coverage Report

**Run:** `BASEPLAN-COVERAGE-20260731`
**Environment:** `https://textile-accounting.vercel.app`
**Account:** retained pilot Base owner account
**Tenant:** `BASEPILOT-20260730074621-8C0D1F-Factory`
**Test date:** 31 July 2026, Asia/Kolkata
**Scope:** Base / Estimator plan only

## Decision

**GO for the Base pilot on production.** The P0 base-plan blockers are closed in the deployed production build and database. The remaining items are P1 breadth/UX coverage and one browser-harness limitation, not a production-start blocker for the Base / Estimator pilot scope.

The current functional lifecycle pass is strong: yarn rates, saved qualities, costing versions, exports, settings, data export, and Base entitlement boundaries behaved correctly in the retained QA tenant. The prior P0 billing retry-pricing defect is closed by the deployed fix. The remaining base-rate hardening was implemented and deployed: server-side non-negative/range validation, unique-name conflict handling with inline feedback, and optimistic concurrency protection for stale edits. User-provided Razorpay evidence shows the INR 8,260 first-year checkout, the mock-bank success path, a successful Netbanking payment, an active Weavly Estimator subscription, and estimator access. Authoritative payment/entitlement reconciliation should still be retained as an operational release artifact.

This P1 workstream added production-standard coverage for blend add/remove, reversible optional-section toggles, and 390px settings operation. It also identified and locally fixed two reachability gaps: the Base quality-library view did not expose costing archive/restore controls, and the mobile rate card did not expose Archive. Those local changes are reviewable but are not yet deployed, so the live production result for those two controls remains a follow-up until the next approved push. The in-app browser could not provide a clean two-tab stale-edit capture because background-tab actions were routed through the active tab; the deployed database guard and focused tests remain the authoritative concurrency proof.

## Current run scorecard

| Area | Result | Evidence |
|---|---|---|
| Yarn add, edit, history, linked-name lock, archive | PASS | Trial rate created at INR 123.45/kg, updated to INR 125/kg, two history entries, archived and absent after reload. |
| Quality validation, save, rename/rate update, delete | PASS | Blank denier blocked; valid quality saved; name/rates updated; delete confirmed and stored as inactive soft-delete. |
| Costing save, reopen, update/version, compare, Start From | PASS | v1 at 5,000 m and v2 at 6,000 m; quote price moved INR 22.98/m to INR 23.04/m; comparison dialog showed the delta. |
| Internal and customer exports | PASS | Both product PDF variants downloaded; customer export kept internal costs and margin hidden. |
| Business name/defaults, restore, organization export | PASS | Temporary changes saved and restored; organization export completed with success toast and filename. |
| Base navigation and premium boundary | PASS | `/owner/today` redirected to estimator; `/owner/orders` showed the Full Suite upgrade wall. |
| Tenant persistence reconciliation | PASS | One active Base subscription; one archived trial rate; two rate-history rows; inactive deleted quality; two costing versions persisted. |
| Browser console | PASS | No warning or error entries after the current run. |
| Billing purchase/retry gate | PASS | Retry-price fix is closed; user-provided Razorpay evidence shows INR 8,260 Netbanking success, active Base entitlement, and estimator access. |
| Production deployment alignment | PASS | Migration `20260731123000_version_base_rate_updates.sql` applied; matching production deployment `dpl_3RhPZYDYUS2FYqwjrQAd2XBS67TV` is READY and aliased. |
| Base-rate hardening | PASS | Negative/range guards, duplicate conflict handling, inline save errors, and stale-edit protection are deployed and covered by focused tests. |
| Blend add/remove coverage | PASS | Production estimator added and removed warp and weft blend rows; the last remaining row had no remove action; focused tests cover the reducer guards. |
| Optional section toggle coverage | PASS | At 390px, Winding, Processing, and Finishing were enabled, saved, reloaded through the estimator, then restored to the original off/off/off state. |
| Costing archive/restore | P1 gap identified and locally fixed | The live Base quality-library view exposed the Archived filter but no archive/restore action. Local changes add record-level Archive/Restore controls; not deployed in this turn. |
| Mobile rate/settings checks | PARTIAL | Settings controls and Save Estimator Defaults worked at 390px. Live mobile rate cards lacked Archive; local mobile Archive action added; not deployed in this turn. |
| Clean browser two-tab proof | PARTIAL / harness-limited | Two tabs loaded the same QA tenant, but the in-app browser could not reliably focus the background tab for the stale-save action. No false pass is claimed. |

## User-provided Razorpay evidence

The screenshots supplied on 31 July 2026 show this sequence:

1. Weavly Estimator selected at INR 8,260 for the first year, with INR 2,360/year renewal from year 2.
2. Razorpay's demo bank page presented Success/Failure choices.
3. The payment completed through Netbanking.
4. Billing showed Weavly Estimator as active through 31 July 2027.
5. The estimator opened and displayed the Base actions, including Save Costing, Export Cost Sheet, and New Quality.

The report includes only the safe visual evidence files `plan-price.jpg`, `mock-bank.jpg`, `billing-active.jpg`, and `estimator-access.jpg` under the run's `user-evidence/` directory. Screenshots containing personal credentials or a payment identifier were intentionally excluded.

## Lifecycle findings

### Yarn Rate Book

- Add rate works with name, warp/weft use, current rate, effective date, review cadence, source, and notes.
- Updating the current value preserves the previous value and creates an auditable history entry. The QA rate moved from INR 123.45/kg to INR 125.00/kg.
- The linked yarn name is intentionally locked in the edit surface: “This name is locked because it matches yarn layers in saved qualities.” A user cannot rename a linked yarn in place.
- The explicit policy is: add a replacement rate with the new name, then update saved qualities intentionally; historical costing snapshots remain unchanged. The clearer page and edit-sheet policy copy is implemented locally and awaits deployment.
- The user-visible delete equivalent is **Archive Yarn Rate**, not hard delete. The archived rate disappears from the active rate book while saved quality and costing snapshots remain intact.
- Read-only reconciliation found one archived QA rate and two corresponding history rows.
- Negative and extreme rate values were rejected without creating a row or partial history.
- A duplicate same-category name was blocked by the server uniqueness policy and surfaced through the save error path; no duplicate row was created.
- The deployed edit path carries `updated_at` and the database wrapper rejects a stale or archived edit instead of overwriting a newer value.

**Policy status:** linked-yarn renames are intentionally create-new-rate operations, not in-place edits. If a guided replacement workflow is later required, it can be added without changing historical snapshots; the current safe behavior is now documented in local UI copy.

### Saved Fabric Qualities

- Saving an incomplete quality is guarded: a blank required denier returns “Warp row 1 denier must be greater than 0” and does not save.
- A valid QA quality was saved with one warp and one weft layer.
- The edit surface supports changing the saved quality name and default yarn rates; the QA quality was renamed to `BASEPLAN-COVERAGE-20260731 Quality Updated` and its rates changed to INR 146/kg and INR 136/kg.
- Delete requires an explicit browser confirmation. The UI removed the quality, and the tenant record became `is_active=false` rather than being physically erased. This is the correct retention model for historical costing references.
- Read-only reconciliation found the inactive deleted template plus a separate active costing template created by later costing work. Historical quote rows remained present.
- Delete-cancel was verified as a no-op; delete-confirm soft-deletes the template. The native confirmation dialog’s confirm click could not be automated reliably by the in-app browser harness, so the disposable record was cleaned up by exact tenant-scoped QA cleanup after reconciliation.

### Saved Costings

- A valid costing saved as version 1 with 5,000 m.
- Reopening restored party, quality, quantity, yarn rates, and commercial assumptions.
- Updating quantity from 5,000 m to 6,000 m and transport from INR 0.10/m to INR 0.15/m saved version 2 without rewriting version 1.
- Snapshot comparison showed quantity 5,000 m to 6,000 m, suggested price INR 22.98/m to INR 23.04/m, and stable 10.0% margin.
- Start From showed the local-draft replacement confirmation and, after explicit overwrite, opened an independent save-mode draft.
- The UI keeps historical snapshots available after quality deletion and yarn archival.
- The live Base quality-library view currently has no record-level Archive/Restore button even though its filter and server action exist. This P1 gap was reproduced with a disposable `BASEP1-20260731-1709-E4E1` costing, then locally fixed by adding Archive/Restore actions to the latest snapshot and history rows. The disposable costing and its linked template were removed by exact tenant-scoped cleanup after reconciliation; the local fix is not deployed yet.

### Exports and settings

- Internal cost-sheet PDF downloaded successfully.
- Customer quotation PDF downloaded successfully and exposed the GST-note option while keeping internal economics hidden.
- Business-name and estimator-default changes saved and were restored to the original fixture values; a reload showed the original target margin of 10% persisted.
- Organization data export completed with the success message `Data export downloaded` and filename `weavly-org-export-2026-07-30.json`.

## Full Base-plan stress matrix

The matrix below is the recommended production-standard acceptance pack. “Current pass” means exercised during this run. “Retest pass” means already proven in the latest pilot-readiness retest. “Next gate” means it should be added to the release run before pilot Go.

| ID | Scenario | Expected production behavior | Current state | Priority |
|---|---|---|---|---|
| AUTH-001 | Valid owner login | Session opens Base estimator and loads the correct tenant | Retest pass | P0 |
| AUTH-002 | Invalid login | Neutral error; no session or tenant data leak | Retest pass | P0 |
| AUTH-003 | Password reset entry | Neutral confirmation; no account enumeration | Retest pass | P1 |
| AUTH-004 | Logout and protected-route reload | Session is revoked; protected pages return to login | Retest pass | P0 |
| AUTH-005 | Cross-tab logout | Second tab cannot continue using stale session | Retest pass | P0 |
| NAV-001 | Base navigation | Only estimator, rate book, saved costings, settings, billing are exposed | Current pass | P0 |
| NAV-002 | `/owner/today` deep link | Safe redirect to estimator | Current pass | P1 |
| NAV-003 | Premium route `/owner/orders` | Upgrade wall; no premium data or actions | Current pass | P0 |
| NAV-004 | Wrong/legacy deep link | Either canonical redirect or intentional 404 with no data leak | Observed 404 for `/owner/production/today`; confirm advertised links | P1 |
| BILL-001 | Active Base billing view | Shows current plan, dates, renewal, upgrade option | Current pass | P0 |
| BILL-002 | First-year successful activation | Captured INR 8,260 and exactly one active Base entitlement | **Pass - user-provided visual evidence** | P0 |
| BILL-003 | Failed first purchase | No entitlement; failed payment truthfully shown | Retest pass | P0 |
| BILL-004 | Retry after failed first purchase | Still first-year INR 8,260, not renewal INR 2,360 | **Retest pass - fix closeout** | P0 |
| BILL-005 | Cancelled/abandoned checkout retry | Same first-purchase pricing and no entitlement | Retest pass - billing closeout | P0 |
| BILL-006 | Duplicate webhook/retry | Idempotent payment and entitlement rows | Retest pass - release suite and B17 proof | P0 |
| RATE-001 | Add valid warp rate | One active row with source, review cadence, and audit metadata | Current pass | P0 |
| RATE-002 | Add valid weft rate | One active row available for weft layers | Retest pass | P0 |
| RATE-003 | Blank name | Client/server validation; no row | Next gate | P1 |
| RATE-004 | Zero/negative/NaN rate | Reject; no row and no partial history | Current pass - runtime + server guard | P0 |
| RATE-005 | Duplicate name same category | Clear conflict policy; no silent duplicate | Current pass - unique constraint + inline feedback | P1 |
| RATE-006 | Duplicate name across warp/weft | Conflict resolution is explicit and tenant-scoped | Next gate | P1 |
| RATE-007 | Update current rate | Previous value preserved and current value updated | Current pass | P0 |
| RATE-008 | Rate history | Every reviewed value is visible in order with date/source/notes | Current pass | P0 |
| RATE-009 | Rename linked yarn | Either supported migration or clear locked-name product rule | Current pass: locked | P1 |
| RATE-010 | Archive yarn | Inactive after refresh; historical snapshots remain readable | Current pass | P0 |
| RATE-011 | Cancel archive | Active row remains unchanged | Current pass | P1 |
| RATE-012 | Review-status boundary | Current, due soon, overdue filters match dates and cadence | Retest pass | P1 |
| QUAL-001 | Save blank/incomplete quality | Required layer validation; no partial write | Current pass | P0 |
| QUAL-002 | Save valid quality | One active reusable template with all layer data | Current pass | P0 |
| QUAL-003 | Blank/duplicate quality name | Reject or apply explicit duplicate policy | Current pass - save disabled/no duplicate | P1 |
| QUAL-004 | Update quality name | New label persists; referenced snapshots retain original context | Current pass | P1 |
| QUAL-005 | Update quality rates | Template defaults change without rewriting old costing snapshots | Current pass | P0 |
| QUAL-006 | Concurrent stale update | Reject stale timestamp; do not overwrite the other tab | Production guard deployed; focused test pass; browser two-tab proof harness-limited | P0 |
| QUAL-007 | Delete quality cancel | No mutation | Current pass | P1 |
| QUAL-008 | Delete quality confirm | Inactive soft-delete; historical quotes stay readable | Current pass | P0 |
| QUAL-009 | Start From quality | New template/lineage independent from source | Retest pass | P0 |
| QUAL-010 | Quality reload and re-open | Same layers, rates, and label after refresh | Retest pass | P0 |
| EST-001 | Valid single warp/weft costing | Independent oracle agrees with UI and snapshot | Retest pass | P0 |
| EST-002 | Blank required fields | Save/export disabled or clear validation; no partial quote | Current pass | P0 |
| EST-003 | Negative and extreme inputs | Reject unsafe values; no NaN/Infinity or overflow | Current pass - runtime + server guard | P0 |
| EST-004 | Waste/crimp boundary | 0 means explicit zero; blank uses default; percentages bounded | Retest pass | P0 |
| EST-005 | Blend component add/remove | Totals update; removing last component leaves valid state | Current run pass; focused tests pass | P1 |
| EST-006 | Loom/wage boundary | Formula and manual modes agree; missing wage is guarded | Retest pass | P0 |
| EST-007 | Sizing in-house vs outsourced | Only intended cost changes; no hidden duplicate charge | Retest pass | P0 |
| EST-008 | Overhead override | Direct override is visible and included exactly once | Retest pass | P0 |
| EST-009 | Post-processing toggles | Winding, processing, finishing are included only when enabled | Retest pass | P0 |
| EST-010 | Party and quality context | Named context persists through save/reopen/export | Current pass | P0 |
| EST-011 | Save costing | Version 1 created once; duplicate clicks do not double-write | Current pass | P0 |
| EST-012 | Reopen/update costing | New immutable version; old version unchanged | Current pass | P0 |
| EST-013 | Compare snapshots | Selected versions show accurate commercial deltas | Current pass | P1 |
| EST-014 | Start From costing | Copy enters save mode and creates independent lineage only on save | Current pass | P0 |
| EST-015 | Refresh/draft recovery | Local draft is explicit; restore/keep/overwrite choices are clear | Current pass | P1 |
| EST-016 | Delete/archive saved costing | Retention policy and UI action are explicit; no accidental history loss | Live gap reproduced; local archive/restore controls added, not deployed | P1 |
| EXP-001 | Internal cost sheet | Detailed costs, assumptions, margin, break-even, profit included | Current pass | P0 |
| EXP-002 | Customer quotation | Internal cost and margin hidden; final commercial data correct | Current pass | P0 |
| EXP-003 | Export refresh boundary | Latest fixes/data used after refresh; no stale service-worker export | Retest pass | P1 |
| EXP-004 | Organization data export | Tenant-only data; secrets/join codes excluded or redacted | Current pass | P0 |
| SET-001 | Business name edit/restore | Save is explicit and value persists across reload | Current pass | P1 |
| SET-002 | Cost default edit/restore | Target margin/rates/toggles persist and apply to new costing | Current pass for margin | P0 |
| SET-003 | Optional section toggles | Toggle changes are reversible and do not corrupt saved snapshots | Current run pass: enabled, saved, estimator-verified, restored | P1 |
| SET-004 | Saved quality manager | List, update, delete, and reload agree with estimator surface | Current pass via estimator; settings list observed | P1 |
| RESP-001 | 390px mobile estimator | No horizontal overflow; critical actions remain usable | Retest pass | P1 |
| RESP-002 | Mobile rate book/settings | Forms and dialogs remain operable at 390px | Settings pass; live rate Archive gap locally fixed, not deployed | P1 |
| OBS-001 | Console errors/warnings | No new errors or warning bursts during core flows | Current pass | P1 |
| OBS-002 | Tenant database reconciliation | Browser state, persisted rows, versions, and entitlement agree | Current pass | P0 |

## Production release gates

1. Retain authoritative reconciliation for the user-provided successful payment: one captured INR 8,260 payment and exactly one active Base entitlement. This is an operational evidence requirement, not a release blocker for the already-proven pilot account.
2. Deploy the local linked-yarn policy copy and mobile rate Archive action after review; keep the create-new-rate replacement rule explicit.
3. Deploy and re-run the Base quality-library Archive/Restore controls, then verify active/archived filters and exact persisted state.
4. Capture a clean browser-native two-tab stale-edit proof when the automation harness supports native dialogs and stable tab lifecycle. The database guard is already deployed and covered by focused tests.

## Billing remediation closeout

The separate billing remediation thread closed `BASE-BILL-RETRY-PRICE` on the deployed production alias:

- Implementation commit: `ed6e32a`.
- Original billing-fix deployment: `dpl_7aJizgchjx96eLG8pQzvCxGw1UhL`; current production alignment deployment: `dpl_3RhPZYDYUS2FYqwjrQAd2XBS67TV`.
- Database backstop applied: `20260730214000_reject_unearned_billing_renewal_pricing.sql`.
- The retained failed-checkout account showed the preserved failed Netbanking invoice at INR 8,260, then `INR 8,260 / first year` and `Pay INR 8,260 & Activate`.
- A replacement checkout was created without captured payment or active entitlement; this proves truthful retry pricing and no false access.
- User-provided Razorpay evidence shows a later successful INR 8,260 Netbanking payment, active Base billing through 31 July 2027, and estimator access.
- The screenshot evidence is visual and user-supplied; authoritative payment/entitlement reconciliation remains the preferred persisted-state closeout artifact.

## Evidence artifacts

- Read-only reconciliation: `reconciliation-evidence.json`
- Product screenshot carried forward from the pilot run: `../../pilot-readiness/BASEPILOT-20260730074621-8C0D1F/RATE-updated-history.png`
- User-provided Razorpay evidence: `user-evidence/plan-price.jpg`, `user-evidence/mock-bank.jpg`, `user-evidence/billing-active.jpg`, `user-evidence/estimator-access.jpg`
- Latest pilot retest report: `../../pilot-readiness/BASEPILOTRETEST-20260730-2027-68W7/REPORT.md`
- Canonical workflow inventory: `../../outputs/base-plan-phase-1-workflow-verification/canonical-workflow-inventory.md`
- P1 source/test changes awaiting deployment: `app/(dashboard)/owner/rates/RatesClient.tsx`, `app/(dashboard)/owner/estimator/EstimatorClient.tsx`, `app/(dashboard)/owner/quotes/QuotesClient.tsx`, `components/settings/factory-cost-profile.tsx`, and `__tests__/base-p1-coverage.test.ts`
- Exact disposable cleanup: `BASEP1-20260731-1709-E4E1` costing, template, rate, and rate history reconciled to zero in the retained QA tenant.

Disposable `BASEEDGE-20260731-0401-HL4Y` QA rates, qualities, and quotes were removed after reconciliation; post-cleanup prefix counts were zero. No passwords or private credentials are included in this report.
