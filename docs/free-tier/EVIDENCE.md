# Weavly Free — revised shared-estimator evidence

The user's 9 September clarification supersedes the original brief's no-storage/no-export restrictions. Free uses the **actual Lite `EstimatorClient`**, with its Quick and Detailed views and the same authoritative calculation engine. There is no separate Free input form or alternate formula implementation.

## Current capability contract

| Capability | Free |
|---|---|
| Cost Estimator | Same component, inputs, engine and breakdown as Lite |
| New completed calculations | Two per Monday 00:00 Asia/Kolkata week; no carryover |
| Saved Costings | Every completed calculation creates an immutable saved snapshot |
| Reopen / breakdown / PDF export | Available without consuming allowance, including at zero allowance |
| Saved qualities / reusable recipes | Unavailable |
| Rate Book / yarn propagation | Unavailable; manually entered rates remain inside the costing snapshot |
| Business navigation | Cost Estimator and Saved Costings only |
| Draft recovery / automatic recalculation | No unsubmitted draft persistence; changed inputs need explicit metered calculation |
| Paid upgrade | Existing checkout and paid estimator; earlier Free snapshots remain visible in paid Saved Costings |

Account settings and logout remain available. Paid Lite/Base behavior remains the default component path. No existing paid costing data was migrated or rewritten.

## Atomic persistence and authorization

Migration `20260908205605_free_saved_costings_shared_estimator.sql` adds a service-only snapshot table and a transaction combining quota receipt and saved costing. Failure inserting the snapshot rolls back the debit. Request-ID retries keep the original snapshot and debit once. Snapshot lifetime is independent of the 30-day operational receipt; saved content remains until account deletion. Existing qualities and Rate Book triggers are not invoked.

`GET /api/free/costings` derives the subject and organization from the authenticated owner, scopes both database filters, and pages results. Clients cannot read/write the table or invoke the save RPC directly. Existing application guards, restrictive business-table RLS, Storage boundary, and paid lifecycle resolution remain in force. Suspension/paused estimation does not remove saved-history access for the verified owning account.

The estimator uses submitted totals/results until another successful calculation. Editing marks them stale; export uses a frozen snapshot. Unsubmitted form state is not autosaved. Free telemetry excludes costing content and paid estimator analytics; result-view events reference the committed request ID only.

## Executed revised-flow checks

- **Database:** failed save rolls back usage and receipt; ten simultaneous duplicates produce one debit/snapshot; twenty requests with one remaining allowance produce one success; no paid quote, saved-quality or Rate Book propagation; anon/authenticated roles denied table/RPC access; receipt removal preserves snapshots; organization deletion removes snapshots. [Log](evidence/shared-saved-db.log).
- **Authenticated local API:** validation no-charge, first/second saves, replay, changed-input conflict, third result withheld, fabricated demo rejected, no-store success/failure, saved history readable at zero allowance with exact submitted inputs and authoritative results, guest denial and invalid pagination rejection. [Log](evidence/shared-http.log).
- **Browser:** entered manual yarn/weaving/overhead/margin inputs in the actual shared Quick estimator; first save reduced allowance from two to one. Changed margin displayed stale-result guidance. Opened Saved Costings and the existing internal-cost-sheet preview. Downloaded the actual PDF and rendered it for visual inspection: all cost lines and yarn rows were readable without clipping. Browser fixture production cost ₹24.57/m, selling price ₹30.71/m at 20% margin; its weaving input was ₹0.096/m. [PDF](evidence/shared-export.pdf), [render](evidence/shared-export.png).
- **Regression:** broad run had 221 passing files, 1,472 passing tests and one skip, with two failures. The telemetry mock compatibility and paid-route source assertion were corrected; focused rerun passed all four files/31 tests. Earlier revised Free run passed five files/26 tests. The subsequent shared-estimator/Free/draft/telemetry regression selection passed 21 files/175 tests. Final type check passed; scoped lint has zero errors and one pre-existing unused `accent` warning.

An initial second submission timed out during development recompilation, before a calculation was sent. After switching to the production build, the second browser costing completed at ₹34.07/m production cost and ₹43.13/m selling price (21% margin), reduced the allowance to zero, and remained in Saved Costings alongside the first snapshot. Read-only API/database reconciliation confirmed two snapshots, unchanged usage after history reads, no saved quality or paid quote, and only the planted Rate Book sentinel. [Reconciliation](evidence/shared-browser-db.log), [history](evidence/shared-saved-history.jpg).

A fresh fixture verified the corrected shared result panel at ₹34.07/m production/break-even and ₹42.59/m selling price (20% margin). Free has no saved-quality action in this panel. [Result](evidence/shared-result.jpg). Mobile checks at 390px captured [English](evidence/shared-en-mobile.jpg), [Gujarati](evidence/shared-gu-mobile.jpg) and [Hindi](evidence/shared-hi-mobile.jpg), with no horizontal overflow; language changes retained the allowance. These are layout checks, not native terminology approval.

Local public-schema lint reported four unrelated existing function errors (`settle_worker_payroll`, `get_daily_brief_stats`, `get_yield_alert`, `replace_shift_production_logs`), and no new Free-function error. [Lint](evidence/shared-db-lint.log).

## Verified upgrade closeout

The final production build passed (76s compilation, 74s TypeScript, 56 static pages; exit 0). [Build log](evidence/shared-verified-build.log). The final upgrade test used only a synthetic captured transaction in local Supabase; it did not contact Razorpay or charge money. Wrong amount/currency/account and duplicate activation were checked by the existing activation test.

The initial in-place upgrade test caught a server-page redirect that discarded current inputs. The redirect was removed from the shared entry page. Retesting in the corrected production build preserved the costing name, 100/150 denier yarns, ₹200/₹230 rates, width, quantity and unsaved margin change from 20% to 21%. Navigation changed to Lite with Rate Book and saved qualities. Before explicit Save there were zero paid quotes. Clicking **Save Quality & Create Costing** created exactly one paid costing and one saved quality. The original Free snapshot retained its original 20% margin and one-unit usage. Paid Saved Costings displayed both its Free history and the new paid record. [Activation log](evidence/shared-upgrade.log), [database confirmation](evidence/shared-upgrade-closeout.log), [preserved editor](evidence/shared-upgrade-preserved.jpg), [paid history](evidence/shared-paid-history.jpg).

The upgrade bridge keeps inputs in the mounted shared estimator and disables draft autosave on that bridge. It does not temporarily persist an unfinished Free draft or create paid content merely because entitlement changed. Normal paid routes retain their existing autosave behavior.

## Files and migration order

- Shared UI: `app/(dashboard)/owner/estimator/EstimatorClient.tsx`, `hooks/use-free-meter.tsx`, `hooks/useAutosave.ts`, `components/navigation/owner-sidebar.tsx`.
- Thin Free entry and account/history pages: `app/free`; saved snapshot endpoint: `app/api/free/costings/route.ts`.
- Shared saved-document viewer: `CostingExportDialog` and `createCostingExportModel`; paid history includes previous Free snapshots only for accounts with a Free grant.
- Foundation, runtime, first-upgraded-quality fallback, then shared saved-costing migration, in timestamp order.

## Release state

Implementation is local. No production migration, deployment, flag enablement or real charge has occurred. Rollout defaults remain disabled. Remaining release acceptance includes native Gujarati/Hindi terminology review, five owner sessions, actual gateway sandbox success/cancel/failure/delayed callbacks, deployed telemetry/privacy checks and native PWA/device/accessibility checks from the brief. These cannot be represented as completed automated checks.

Previous foundation/runtime/billing evidence remains in [EVIDENCE-INITIAL.md](EVIDENCE-INITIAL.md), explicitly historical. Its separate-form screenshots and no-storage/no-export assertions do not describe the revised implementation. Unrelated weaving research remains untouched.

## Benefit-led Lite discovery — 9 September follow-up

Replaced the always-visible checkout in the shared estimator's Free meter with a compact expandable Lite benefits preview. It explains unlimited calculations in the same estimator, reusable saved-quality inputs, and Rate Book updates across linked active qualities. A clearly labeled fixed example changes one warp yarn rate from ₹200/kg to ₹220/kg across three sample qualities; it reads no paid data and performs no costing. Historical saved-costing figures remain explicitly distinguished from rates used by new costings. Pricing from the shared billing catalog and the existing checkout appear only after choosing to see pricing. Existing upgrade event and verified in-place activation callbacks are retained.

English/Gujarati/Hindi copy added; native review is still pending. Scoped ESLint passed, TypeScript passed, and four targeted suites passed (22 tests: Free policy, estimator, service, Rate Book readiness). This follow-up has not been browser-verified or deployed; earlier UI screenshots show the previous upgrade panel. No billing, quota, persistence or calculation-engine behavior was changed.

## Lite / Base choice — 9 September follow-up

Expanded the benefit preview to compare Lite (full costing, saved qualities and linked Rate Book updates) with Base (all Lite features plus production logging and automatic payroll calculation from production logs/configured pay rates). Both cards use catalog first-year/renewal prices and their own existing tier-specific checkout; payment UI remains behind the pricing toggle. Added English/Gujarati/Hindi copy (native review pending).

Verified-plan activation now passes the server-returned subscription tier into the Free workspace, rather than hardcoding Lite. Navigation and estimator production capability props follow the same tier rules as the regular paid estimator, retaining the mounted costing and its inputs. Scoped lint and TypeScript pass; four Free/billing regression suites pass (20 tests). The two-plan preview and real Base checkout have not been browser-verified or deployed.
