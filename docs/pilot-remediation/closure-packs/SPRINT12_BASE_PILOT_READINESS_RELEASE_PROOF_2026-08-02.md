# Sprint 12 — Base Pilot Readiness and Release Proof

Date: 2026-08-02  
Verdict: **GO for a controlled Base pilot**  
Release commit: `f4c59be` — `Sprint 12: harden Base pilot release proof`

## Production release

- Vercel production deployment: `dpl_8Uj6b5TeePVTACtdKeQhQg4iqx3H`
- State: `READY`; aliased to `https://textile-accounting.vercel.app`
- Deployment commit metadata: `f4c59be06d4f8f68ee4114a22cf495431926fe77`
- Final Vercel build: completed successfully; no build errors
- Final deployment runtime error/warning query: no logs found
- Vercel prebuild: 131 test files passed, 2 skipped; 843 tests passed, 17 skipped

The preserved pre-existing untracked paths `.playwright-cli/` and `test-artifacts/` account for Vercel's local `gitDirty` flag; they were not included in the release commit.

## Base owner and golden costing proof

QA run: `PILOTQA-20260802-2114-YBZN`  
Factory: `PILOTQA-20260802-2114-YBZN-BASE MILL`  
Organization: `e79ee9e2-bff2-4bc0-9e75-863d4e0eee7e`

Factory-cost profile was configured and saved with 50 looms, 26 working days, 30,000 m monthly output, ₹150,000 monthly expenses, ₹5/m overhead, warp ₹2/kg, sizing ₹1.50/kg, processing ₹0.75/m, finishing ₹0.50/m, 10% target margin, 2% commission, ₹1.50/m transport, 6% crimp, and 5% waste.

Golden scenario result:

- Quality: `PILOTQA-20260802-2114-YBZN-Grey 75D / 68 Picks`
- Quantity: 5,000 m; warp ₹140/kg; weft ₹135/kg
- Production cost: ₹14.91/m
- Suggested price: ₹18.65/m; break-even: ₹16.74/m
- Expected profit: ₹9,350; canonical snapshot: `estimator_v3_2026_08`

Save/reopen/version/duplicate/compare/archive/restore all passed. v1 and v2 shared the costing group and preserved historical rates; v2 changed quantity to 6,000 m, margin to 12%, transport to ₹1.75/m, quote to ₹19.37/m, and expected profit to ₹13,920. The duplicate received a distinct template and costing group. v1 was archived, verified absent from the active list, then restored; final QA query showed all three snapshots unarchived.

Rate update proof: the live warp rate moved from ₹140 to ₹145/kg with a history row retaining the previous value. Existing v1/v2/duplicate snapshots still contain ₹140/kg warp and ₹135/kg weft.

## Artifact inspection

Internal Cost Sheet PDF:

- [Downloaded internal PDF](/Users/rajpatel/Downloads/cost-estimate-pilotqa-20260802-2114-ybzn-grey-75d-68-picks-2026-08-02.pdf)
- SHA-256: `c2b4cf67796b3c77c493cd652742139058843b53b30f131f28dcf0879448a786`
- One-page A4, unencrypted; visually inspected after rendering; headline values, breakdown, assumptions, and commercial inputs were readable with no clipping.

Customer Quotation PDF:

- [Downloaded customer PDF](/Users/rajpatel/Downloads/quotation-pilotqa-20260802-2114-ybzn-customer-pilotqa-20260802-2114-ybzn-grey-75d-68-picks-2026-08-02.pdf)
- SHA-256: `91965cea3ff3b6faa6c99c9129c0371a3c55c7acb8d45c002e452a4b397dd4b6`
- One-page A4, unencrypted; visually inspected; contained customer, quantity, quoted price, quotation value, validity, and GST disclaimer only.
- Text scan found no production cost, margin, profit, break-even, overhead, commission, or yarn-rate fields.
- Customer-preview Print was clicked successfully; no browser console error followed.

Organization export:

- [Downloaded JSON export](/Users/rajpatel/Downloads/weavly-org-export-20260802164113718.json)
- SHA-256: `a88a07602ca95f9548d8ba0d5558edd98a0090e282384d58733e76435692ede4`
- Valid JSON; `schema_version: sprint11-v1`; `export_scope: current_owner_org`; one organization, one profile, two templates, three quotes, one factory profile, two rates, one rate-history row, one subscription, and no Full Suite datasets.
- `auth.users` was absent. Join-code, phone, and access-code-sensitive values were redacted; the QA tenant prefix was the only identity namespace present.
- Two stale catalog entries (`incidents`, then `estimator_settings`) initially caused controlled export failures. Both were removed from the catalog, the final export generated, and the production fix is in the release commit.

## Responsive and boundary verification

The active estimator was verified with no horizontal overflow and with navigation/export controls present at:

- Desktop: 1280×720; `scrollWidth = clientWidth = 1280`
- Tablet: 768×1024; `scrollWidth = clientWidth = 768`
- Mobile: 390×844; `scrollWidth = clientWidth = 390`; mobile Navigation control present

Base navigation exposed Cost Estimate, Yarn Rate Book, Saved Costings, Settings, and Billing. Direct checks of Orders, Factory Today, Dispatches, Payroll, and Analytics showed Full Suite upgrade walls; Inventory showed the archived-feature wall. No Full Suite operational action was reachable from Base surfaces; only the expected upgrade CTA was shown.

The critical browser flow produced no error/warning console entries. Targeted browser and database checks confirmed the saved-quality data remained in the original tenant and was not visible to a second Base owner.

## Tenant isolation and cleanup

An isolated Base owner was provisioned with the QA fixture run `BASEGO-1784911662693-8A36A0`. Its Saved Costings page showed zero qualities, its Rates page showed zero active rates, and neither page or the estimator contained the primary QA prefix. Database counts were primary tenant 3 quotes / 2 templates / 2 rates versus isolated tenant 0 / 0 / 0.

After evidence capture, both exact QA organizations were removed. Reconciliation returned zero organizations, profiles, quotes, templates, factory profiles, rates, rate history, subscriptions, export runs, referral codes, and audit rows for both fixture IDs; both Auth users returned not found; the costing-snapshot protection trigger was confirmed enabled again. The temporary fixture secret was removed. No production customer tenant was modified.

## Technical checks

- Local `npm test`: 133 files passed; 859 tests passed; 1 skipped.
- Targeted security/billing/tenant/export suite: 9 files, 57 tests passed.
- `npm run lint`: pass.
- `npx tsc --noEmit --pretty false`: pass.
- `npm run build`: pass locally and in the final Vercel deployment.
- `npm ci --ignore-scripts`: pass.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.
- `git diff --check`: pass.
- Production migration list matches the local latest migration through `20260802121858_sprint10_saved_costing_library_state`; no migration was applied during this sprint.
- Supabase advisor scan remains non-zero at the platform baseline (95 security notices: 5 INFO / 90 WARN; 434 performance notices: 142 INFO / 292 WARN). These are existing broad-schema lints, not Sprint 12 migration findings; the Base-targeted security and tenant tests passed.

## Go gate

**GO.** No open Base P0/P1 workflow issue was found in the exercised scope. Formula outputs, immutable historical snapshots, versioning, rate history, PDF privacy, JSON export scope/redaction, billing gating, tenant isolation, responsive layouts, and final production deployment evidence all passed. QA data was cleaned up and production remained unmutated apart from the exact temporary QA records created and removed for proof.
