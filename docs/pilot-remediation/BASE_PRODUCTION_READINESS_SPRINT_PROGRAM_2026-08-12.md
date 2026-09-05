# Weavly Base Plan production-readiness sprint program

**Prepared:** 12 August 2026  
**Source run:** `BASEE2E-20260811-0030-GV01`  
**Source evidence:** `output/base-plan-coverage/BASEE2E-20260811-0030-GV01/REPORT.md`, `TEST_MATRIX.md`, `results.json`, and `result-updates.json`  
**Production revision tested:** `2e12978ef7c279f73f375419e9435a5072d73018`  
**Starting decision:** No-Go for unrestricted production; conditional Go for a small, closely supported owner pilot only after R0 passes  
**Scope:** Base Plan / owner costing experience. Full Suite expansion is excluded.

## 1. Program outcome

Move Weavly Base through three controlled release states:

1. **Technically safe pilot:** production schema, export, referral runtime, checkout boundary, dependencies, and observability are safe enough for isolated owners.
2. **Scale-ready pilot:** Base-relevant security, costing boundaries, data lifecycle, settings, localization, and all remaining P0/P1 matrix scenarios have deployed evidence.
3. **Unrestricted launch candidate:** a real owner cohort demonstrates repeat, independent value and price acceptance; operations can support and recover the product.

The program does not treat green unit tests, a healthy Vercel deployment, a paid QA subscription, or a large number of historical passes as production-readiness proof by themselves. Each release gate requires evidence from the exact deployed revision, an isolated tenant, and tenant-scoped database reconciliation.

## 2. Planning assumptions

The dates below assume kickoff on 13 August 2026, two engineers, one QA/release owner, and part-time product/security/local-language reviewers. Estimates are person-days, not elapsed days. If capacity differs, keep the dependency order and recalculate dates.

- R0 is a five-working-day stabilization sprint with a release freeze on unrelated Base changes.
- R1–R4 are ten-working-day sprints.
- R5 is a four-week evidence sprint because retention cannot be compressed into a code milestone.
- R6 is a five-working-day launch closeout.
- Production money tests require an isolated organization, finance approval, bounded amounts, and an agreed reconciliation/refund procedure.
- Referral marketing remains disabled until the product and scheme gates in this program pass, even if the referral runtime becomes technically functional in R0.
- Current first-year pilot price remains **INR 8,260 including GST**. Pricing changes require evidence from R5 rather than being used as a remedy for reliability defects.

## 3. Roadmap and release states

| Sprint | Target dates | Objective | Primary release result |
| --- | --- | --- | --- |
| R0 — Stop-the-line stabilization | 13–19 Aug 2026 | Remove all current public-launch P0 blockers | Eligible for a tightly supported pilot only |
| R1 — Security and data-control hardening | 20 Aug–2 Sep | Close Base auth, RPC, tenant, deletion, metadata, and route risks | Security-reviewed pilot build |
| R2 — Costing and concurrency integrity | 3–16 Sep | Prove unsafe inputs, stale writes, costing modes, copies, and historical versioning | No open Base calculation-integrity P0 |
| R3 — Record lifecycle and settings reliability | 17–30 Sep | Close rate/quality lifecycle, drafts, settings, and export freshness boundaries | All 30 formerly not-run scenarios executed |
| R4 — Language, referral trust, and adoption readiness | 1–14 Oct | Finish promised localization and feature-flag a reputation-safe referral/adoption experience | Cohort-ready build; referral campaign still off |
| R5 — Controlled owner pilot | 15 Oct–11 Nov | Prove repeat use, business value, price acceptance, support load, and referral intent | Evidence-based launch recommendation |
| R6 — Launch candidate and gradual release | 12–18 Nov | Rerun the complete gate, rehearse recovery, and make final Go/No-Go decision | Unrestricted launch candidate or explicit hold |

## 4. Ownership model

| Role | Accountable for |
| --- | --- |
| Product/release owner | Scope, policy decisions, risk acceptance, pilot consent, and final Go/No-Go |
| Technical lead | Architecture, merge discipline, deployment sequence, and release sign-off |
| Backend/database engineer | Migrations, RLS/RPC grants, billing/referral, exports, concurrency, and data reconciliation |
| Frontend/product engineer | Costing flows, lifecycle UI, settings, localization integration, and recovery states |
| QA/release engineer | Matrix ownership, independent oracles, deployed browser evidence, fixtures, and regression packs |
| Security reviewer | Supabase advisor disposition, negative authorization tests, dependency exceptions, and deletion/export review |
| Gujarati/Hindi textile reviewer | Meaning, terminology, readability, artifact copy, and target-owner comprehension |
| Pilot/customer-success owner | Owner onboarding, support log, weekly metrics, interviews, and issue escalation |

One named person may fill multiple roles, but each gate must retain a distinct implementer and verifier where money, tenant isolation, export, deletion, or `SECURITY DEFINER` access is involved.

## 5. Global delivery rules

Every story is complete only when:

- requirements and failure behavior are explicit;
- client, server, and database enforcement agree;
- unit/integration coverage includes normal, invalid, replay, and cross-tenant cases where relevant;
- migrations are forward-only, reviewed, tested on a production-like clone, and paired with backup/recovery notes;
- `npm test`, `npm run lint`, `npm run build`, and `npm audit --omit=dev` meet the sprint gate;
- the exact tested commit is deployed and recorded;
- the deployed browser result is reconciled to tenant-scoped database rows;
- screenshots/logs contain no secrets or unrelated customer data;
- evidence is attached to the corresponding matrix item;
- a scenario recorded as `not_run`, `code_verified`, or “fixed locally” is never reported as a runtime pass.

No sprint may expand Base access into Orders, Production, Payroll, Today, or another Full Suite workflow.

---

## Sprint R0 — Stop-the-line stabilization

**Duration:** 5 working days  
**Goal:** Remove the five explicit P0 launch blockers and prove the repaired production chain.  
**Entry condition:** Current production remains No-Go; unrelated Base deployments are frozen.  
**Exit state:** Conditional Go for a small, named, closely supported pilot—not public launch and not a referral campaign.

### R0 backlog

| ID | Story and implementation | Owner | Estimate | Dependency | Acceptance and required evidence |
| --- | --- | ---: | ---: | --- | --- |
| R0-01 | Establish the release baseline: record Vercel commit, production migration head, Supabase project, current audit outputs, feature flags, QA tenant, and a rollback/forward-fix contact tree. | Tech lead + QA | 0.5d | None | One signed baseline identifies the exact app and database states; unrelated releases are frozen until R0-07. |
| R0-02 | Deploy the three missing migrations in order: `20260809193000_zero_warp_crimp_defaults.sql`, `20260809193305_sprint21_sync_saved_quality_yarns_to_rate_book.sql`, and `20260810182342_referral_year_credits.sql`. Validate on a production-like clone, take/verify a recoverable backup, inspect locks and expected row impact, deploy in a low-traffic window, and refresh/verify the PostgREST schema cache. | Backend/DB + release owner | 1.5d | R0-01 | Production migration head equals repository head; all three schema objects/changes exist; no failed statements, unexpected row count changes, RLS gaps, or sustained locks; app golden journey still loads. |
| R0-03 | Restore organization export and harden its schema contract. Keep the export complete rather than silently dropping a missing dataset; return an actionable service-readiness error when schema compatibility is absent. Exercise `referral_year_credits`, export-run audit history, tenant filters, recursive redaction, and download initiation. | Backend + QA | 1.0d | R0-02 | `EXP-004` passes in production. Export downloads, parses, contains the QA tenant's expected Base records, contains no other-tenant sentinel, redacts secrets/join codes/phone/token fields, records one successful export run, and does not leave a false successful history entry on failure. |
| R0-04 | Prove the current annual referral runtime end to end with isolated fixtures: eligible code creation, valid attribution, retired/invalid code feedback, self-referral rejection, duplicate/replay idempotency, paid conversion, inactive/unpaid boundaries, five-credit cap, concurrent conversion, redemption inside the final 30 days, rejection outside the window, and one free annual entitlement. | Backend + QA + security | 2.0d | R0-02 | Paid Base owner sees a working referral panel; `BILL-008`/`BILL-009` runtime cases pass; each conversion creates at most one use/credit; cap is five; cross-tenant reads/writes fail; redemption is single-use and changes entitlement exactly once. Referral campaign remains feature-disabled. |
| R0-05 | Enforce Base-only self-serve checkout on the server and prove the payment recovery boundary. Missing `planTier` must resolve to the explicit Base rollout default or be rejected; Premium and any unknown tier must be rejected before pricing, lifecycle resolution, claim creation, or Razorpay order creation. Use `BILLING_SELF_SERVE_PLAN_TIERS` as the server allowlist. In an approved isolated provider environment, run failed, dismissed/abandoned, retry, success, concurrent, duplicate, delayed, and reordered webhook cases. | Backend + QA + finance/release owner | 1.5d | R0-01 | Authenticated absent/`premium`/malformed/forged tiers cannot create Premium checkout attempts/orders. Explicit Base creates/reuses only an INR 8,260 initial or eligible INR 2,360 renewal order. `BILL-003`–`BILL-006` have deployed/provider runtime evidence: failures/cancellations grant no access, retry keeps first-year pricing, and duplicate/reordered callbacks create exactly one captured payment and one entitlement. Rejections have zero provider/DB side effects. |
| R0-06 | Close production dependency risk using compatible updates/overrides. Trace each of the six production findings (`brace-expansion`, `fast-uri`, `nanoid`, `dompurify` via `jspdf`, and transitive paths), update without an unreviewed force downgrade, and document any exception with exploitability, compensating control, accountable owner, and expiry. | Tech lead + security | 1.5d | `npm audit --omit=dev` has no unaccepted high finding. Full tests, lint, build, PDF render checks, browser download, PWA/offline generation, and quotation sanitization pass. No `npm audit fix --force`. |
| R0-07 | Run the deployed release gate and reconcile evidence. Repeat login, Base route boundary, v1→rate update→v2→compare, customer/internal output, export, referral panel, Base checkout rejection/allowlist, mobile smoke, console inspection, and database cardinality checks. | QA + release owner | 1.5d | Exact commit and migration head are recorded; no new P0 regression; report exit criteria 1–5 pass; Go/No-Go record is signed. |
| R0-08 | Install pilot guardrails: named-account access, referral-campaign hold, visible support contact, monitored Sentry/runtime signals for export/referral/billing failures, alert owner/threshold, and tested safe-disable/forward-fix paths. | Release owner + platform | 1.0d | R0-01 | Pilot exposure is bounded to approved organizations; actionable alerts reach a named responder; checkout/referral can be safely disabled without exposing Premium or corrupting entitlements; support and incident contacts are documented. |

### R0 day plan

- **Day 1:** Baseline/freeze, clone rehearsal, migration review, dependency path analysis, checkout test first.
- **Day 2:** Backup verification and migration deployment; schema/cache checks; fast golden-journey smoke.
- **Day 3:** Export and referral runtime reconciliation; fix any schema/grant defect before proceeding.
- **Day 4:** Dependency closure, billing failure/cancellation/success and webhook replay tests, referral concurrency tests, full local gate.
- **Day 5:** Deploy exact revision, run R0-07, record conditional pilot decision.

### R0 stop conditions

Stop and return to No-Go if any of the following occurs:

- migration checksum/order differs from the reviewed repository files;
- the backup cannot be verified or the production target cannot be unambiguously identified;
- export is partial, cross-tenant, or unredacted;
- referral replay creates more than one credit or entitlement;
- payment replay creates more than one captured payment or entitlement, or a failed/cancelled payment grants access;
- unavailable Premium checkout reaches Razorpay or creates a billing intent;
- a production high dependency finding lacks an approved, expiring disposition;
- the deployed revision differs from the tested revision.

---

## Sprint R1 — Security and data-control hardening

**Duration:** 10 working days  
**Goal:** Turn the 95 Supabase security notices into an owned, tested disposition and close Base auth/data-control risks.  
**Entry condition:** R0 passes.  
**Exit state:** Security-reviewed pilot build with no unknown Base-relevant advisor item.

### R1 backlog

| ID | Story and implementation | Owner | Estimate | Dependency | Acceptance and required evidence |
| --- | --- | ---: | ---: | --- | --- |
| R1-01 | Export a versioned advisor register. Classify all 90 warnings and 5 informational notices by object, exposure (`anon`, `authenticated`, service role), Base reachability, intended caller, tenant guard, severity, action, owner, and expiry. Performance notices are placed in a separate backlog unless they cause a correctness or availability risk. | Security + backend | 1.0d | R0 | 100% of security notices have a disposition; no “bulk accepted” row; Base-relevant and anonymous-callable items are individually named. |
| R1-02 | Fix the 25 mutable function search paths. Use explicit safe `search_path`, schema-qualify referenced objects, rerun migrations/tests, and avoid changing function semantics unintentionally. | Backend/DB | 2.0d | R1-01 | Advisor no longer reports mutable search paths for addressed functions; positive tests still work; shadowed-object test cannot redirect function behavior. |
| R1-03 | Audit all 63 authenticated-callable and the anonymous-callable `SECURITY DEFINER` functions. Revoke broad execution, grant only intended roles, verify `auth.uid()`/organization derivation, prevent caller-supplied tenant authority, and add same-tenant, cross-tenant, anonymous, non-owner, and replay tests. Prioritize saved-quality creation/revision, yarn discovery/rates, export, account deletion, billing, and referrals. | Backend + security | 4.0d | R1-01 | Anonymous definer access is removed or narrowly justified; every Base-reachable definer RPC has explicit grants and negative evidence; no caller can operate on another organization by changing an ID. |
| R1-04 | Complete `AUTH-003`: test the password-reset entry for registered and unregistered addresses with neutral copy, equivalent observable behavior, safe rate limiting, expiry, single use, and session invalidation after reset. Enable leaked-password protection or record a time-bounded product/security decision. | Frontend + backend + QA | 1.0d | Responses do not enumerate accounts; tokens expire and cannot be replayed; existing credentials/session behavior matches policy; advisor configuration is documented. |
| R1-05 | Prove account deletion and data retention on an isolated organization. Inventory all tenant rows/storage/auth identity, ensure reauthentication and confirmation, test idempotency/interruption, verify deletion/anonymization policy, audit evidence, and recovery limitation. | Backend + security + QA | 2.0d | Authorized owner can complete the documented deletion flow; another role/tenant cannot; retained legal/billing rows match policy and are not accessible as active customer data; no orphaned access survives. |
| R1-06 | Reconcile organization state. Define the source of truth among active subscription, `product_experience`, and `onboarding_complete`; repair the QA organization and add a controlled migration or invariant so new Base organizations cannot render Base while persisting contradictory Full Suite metadata. | Backend + product | 1.0d | QA organization and fresh Base fixture have `product_experience=base`; onboarding state reflects the completed checklist/policy; JWT/database/app route decisions agree after refresh and relogin. |
| R1-07 | Complete `NAV-004`: inventory public, onboarding, email, help, and in-app legacy links; canonicalize or intentionally 404 each wrong link without data leakage and add route tests. | Frontend + QA | 0.5d | Every advertised link reaches a valid Base destination; legacy deep links have a documented redirect/404 policy and never reveal Premium data. |
| R1-08 | Security closeout: rerun the advisor, dependency audit, auth/tenant negative pack, export/deletion checks, and deployed smoke; publish accepted-risk records with owner and expiry. | Security + QA + release owner | 1.0d | No unowned Base-relevant warning; no critical/high security exception without product/security approval; expiring risks are tracked and block release when overdue. |

### R1 exit gate

- `AUTH-003` and `NAV-004` are runtime passes.
- Base-relevant grants and definer functions have explicit negative evidence.
- Anonymous access is closed unless the endpoint is intentionally public and proven non-sensitive.
- Account deletion and export form a coherent data-control story: obtain data first, then delete under a documented retention policy.
- Organization metadata, JWT claims, subscription, navigation, and onboarding agree.

---

## Sprint R2 — Costing and concurrency integrity

**Duration:** 10 working days  
**Goal:** Prevent expensive mistakes from unsafe numeric inputs, duplicate identities, stale writes, ambiguous copies, or misleading historical actions.  
**Entry condition:** R1 security contracts are stable enough to test the final RPC surface.  
**Exit state:** No open Base calculation-integrity P0.

### R2 backlog

| ID | Story and implementation | Owner | Estimate | Dependency | Acceptance and required evidence |
| --- | --- | ---: | ---: | --- | --- |
| R2-01 | Define one numeric-domain contract for rates, counts, metres, PPI/EPI, width, waste/crimp, wage, overhead, commission, transport, margin, and quantity. Enforce finite numbers, business-safe maxima, precision/rounding, explicit zero versus blank/default, and no partial writes at UI, action/RPC, and database boundaries. | Product + frontend + backend | 2.0d | R1 RPC inventory | `RATE-003`, `RATE-004`, `EST-003`, and `EST-004` pass. Negative, zero where forbidden, `NaN`, Infinity, scientific notation abuse, excessive precision, and extreme totals never produce a believable quote or persisted partial row. Explicit 0% waste/crimp remains 0; blank uses the documented default. |
| R2-02 | Define tenant-scoped yarn identity and conflict behavior. Normalize names deliberately, handle same-category duplicates, make warp/weft cross-category reuse either supported or explicitly rejected, and return actionable inline conflict feedback without duplicate history. | Backend + frontend + QA | 1.5d | R2-01 | `RATE-005` and `RATE-006` pass under case/space variants and concurrent attempts. No silent duplicate or cross-tenant collision occurs. |
| R2-03 | Prove optimistic concurrency for quality/rate updates using two actual browser sessions. Stale timestamp/version writes must return a recoverable conflict, preserve the winning row, and allow the loser to reload/compare rather than overwrite. | Backend + frontend + QA | 2.0d | `QUAL-006` passes in a deployed two-tab run; exactly one competing write wins; history contains no lost or duplicated update; conflict copy names what changed and offers reload/retry. |
| R2-04 | Complete costing-mode boundaries: blend add/remove, loom formula/manual wage, missing wage, in-house/outsourced sizing, overhead override, and winding/processing/finishing toggles. Reconcile each mode to an independent oracle and prove each optional charge is included exactly once. | Frontend + QA | 3.0d | `EST-005` through `EST-009` pass for enabled/disabled, blank/zero, and reopen cases. UI, saved snapshot, internal export, and customer-safe price agree; no hidden or duplicate charge. |
| R2-05 | Make “Start From” an independent identity operation for quality and costing. Clear source IDs, timestamps, request IDs, and lineage; preserve only the intended construction/commercial values; create nothing until explicit save. | Frontend + backend + QA | 1.5d | `QUAL-009` and `EST-014` pass. Copy receives a different template and costing-group ID at v1; source remains byte-for-byte unchanged; cancelled copy produces no row. |
| R2-06 | Fix direct historical-version editing. Opening v1 and choosing `Save New Version` must append the next immutable snapshot to the intended lineage without attempting to create a duplicate quality. If the action is intentionally unsupported, remove/rename it and route the user to the supported current-rate workflow. | Frontend + backend + product | 1.5d | The user-visible promise and runtime behavior agree. Direct v1 edit produces exactly one valid next version with v1 frozen, or the UI prevents the action before entry with a clear supported path. Duplicate-quality error is not the outcome. |
| R2-07 | Build and run a deployed calculation-integrity regression pack with three realistic textile oracles: normal single warp/weft, rate-change version, and extreme/boundary modes. | QA | 2.0d | All R2 matrix IDs carry exact inputs, expected calculations, actual UI/snapshot/export values, deployed commit, and sanitized evidence. No P0 is closed from source-only proof. |

### R2 exit gate

- Every persisted costing is finite, bounded, tenant-scoped, and independently reproducible.
- Stale writes cannot silently win.
- Start From cannot mutate or extend the source lineage.
- Historical-version actions match their labels and do not surface an avoidable duplicate error.
- Old snapshots remain immutable when current rates, recipes, defaults, or optional settings change.

---

## Sprint R3 — Record lifecycle and settings reliability

**Duration:** 10 working days  
**Goal:** Make everyday maintenance, archive/restore, defaults, drafts, and exports predictable across refreshes and devices.  
**Entry condition:** R2 establishes stable validation and version contracts.  
**Exit state:** Every one of the 30 previously not-run matrix scenarios has deployed evidence.

### R3 backlog

| ID | Story and implementation | Owner | Estimate | Dependency | Acceptance and required evidence |
| --- | --- | ---: | ---: | --- | --- |
| R3-01 | Complete Rate Book lifecycle: lock or safely migrate linked yarn names, confirm archive/cancel archive, preserve historical snapshots, and prove current/due soon/overdue date filters at Asia/Kolkata boundaries. | Frontend + backend + QA | 2.0d | R2 identity rules | `RATE-009`–`RATE-012` pass after refresh and near date boundaries. Cancel changes nothing; archive removes only current reuse; old costing remains readable; review filters match the defined cadence and timezone. |
| R3-02 | Complete saved-quality lifecycle: rename with historical-context preservation, delete cancel, confirmed soft-delete, restoration/retention policy, and manager/estimator consistency. | Frontend + backend + QA | 2.0d | R2 version rules | `QUAL-004`, `QUAL-007`, and `QUAL-008` pass. Confirmed deletion is non-destructive/soft according to policy; snapshots and customer documents remain readable; cancellation causes zero writes. |
| R3-03 | Finish explicit draft recovery. Detect source age/version and offer understandable restore, keep, overwrite/replace, rename, and discard behavior; avoid silently applying stale rates/defaults. | Frontend + QA | 1.5d | R2 numeric/version rules | `EST-015` passes across refresh, relogin, source update, and mobile. Each choice has deterministic persistence; discarded drafts do not reappear; restored drafts disclose rate/default age. |
| R3-04 | Prove settings persistence and reversibility: business name, costing defaults, target margin/rates/toggles, optional sections, and saved-quality manager. New costings use current defaults while prior snapshots remain frozen. | Frontend + backend + QA | 2.5d | R2/R3-02 | `SET-001`–`SET-004` pass through save, reload, new costing, reopen old costing, revert, and second reload. No setting change corrupts a historical snapshot or leaks a Premium feature. |
| R3-05 | Close service-worker/export freshness. Version caches, avoid stale generated artifacts, update users safely, and prove that refresh/reload uses the deployed export code and latest snapshot rather than an old service worker. | Frontend/platform + QA | 1.5d | R0 export contract | `EXP-003` passes in an upgrade scenario: pre-update app, new deployment, refresh/update, generate both PDFs/JSON export, and verify revision-specific content. No stale quotation or internal data appears. |
| R3-06 | Run responsive/accessibility recovery on changed workflows at 390×844 plus smallest supported width: focus management, touch targets, dialogs, long names, large INR values, status announcements, and keyboard operation. | Frontend + QA | 1.0d | R3-01–05 | No horizontal overflow or hidden destructive/primary action; confirmations name the record; errors and conflicts are announced; core flow remains usable without precise pointer control. |
| R3-07 | Matrix reconciliation and closeout. Rerun all R0–R3 changed scenarios and reconcile the 30 formerly not-run IDs to runtime evidence. | QA + release owner | 2.0d | R3-01–06 | Matrix has zero `not_run` for the original 30. Any failure is reopened with severity/owner and blocks the appropriate release state; results totals and report agree. |

### R3 exit gate

- The original 30 not-run scenarios are all executed, not merely converted to `code_verified`.
- All P0 scenarios pass; any P1 exception has explicit customer impact, compensating control, owner, and expiry.
- Rate/quality archive behavior is reversible and never rewrites historical economics.
- Settings/defaults affect new work only and survive reload.
- Current deployment, service worker, browser artifacts, and database rows agree.

---

## Sprint R4 — Language, referral trust, and adoption readiness

**Duration:** 10 working days  
**Goal:** Make the target owner experience coherent in promised languages and make future referral-led growth safe for the referrer's reputation.  
**Entry condition:** Core workflows and data controls are stable.  
**Exit state:** Cohort-ready build. Referral campaign remains off pending retained-use evidence.

### R4 backlog

| ID | Story and implementation | Owner | Estimate | Dependency | Acceptance and required evidence |
| --- | --- | ---: | ---: | --- | --- |
| R4-01 | Declare the language promise for pilot and launch. Inventory every Base surface and state: navigation, estimator quick/detailed modes, validation, rate history, saved costings, comparison, archive/restore, drafts/conflicts, PDFs, Settings, export, billing, referral, auth, toasts, errors, empty/loading/offline states. | Product + i18n reviewer + QA | 1.0d | R3 stable copy | Coverage ledger has one owner and status per string/surface; intentionally retained English textile terms are listed and explained. |
| R4-02 | Rewrite Gujarati/Hindi strings for meaning rather than word substitution. Remove accidental mixed-language sentence fragments, standardize common textile/commercial terms, and validate numbers, INR, GST, dates, pluralization, and action verbs. | Gujarati/Hindi textile reviewer + frontend | 3.0d | R4-01 | No untranslated operational fragment exists on a language the product claims to support; terminology is consistent across UI and artifacts; fallback is detectable in tests, not silently shipped. |
| R4-03 | Add automated locale completeness and interpolation tests plus screen-level browser sweeps for all core paths, long strings, mobile layout, validation, PDF/quotation copy, billing, export, and referral status. | Frontend + QA | 2.0d | Locale key parity passes; no raw key/missing interpolation appears; core screens remain operable at 390px; customer quotation remains free of internal economics in every language. |
| R4-04 | Make referral attribution visible and correctable before payment. Show applied code/referrer status to the referred owner, distinguish pending/converted/cap/revoked/redeemed states, provide a bounded support correction path, and never swallow invalid attribution during signup. | Product + frontend + backend | 2.5d | Both parties can see appropriate status without seeing another tenant's data; invalid/retired/self code gets actionable feedback; correction is audited and unavailable after the defined cutoff/payment rule. |
| R4-05 | Decide the post-pilot referral offer. Model a two-sided benefit, 30–60-day active-retention qualification, abuse/refund/cancellation rules, five-credit behavior, disclosure copy, accounting treatment, and a separate trained CA/consultant tier. Keep implementation behind a flag until R5 evidence. | Product + finance + security | 1.5d | Signed policy defines who benefits, when value vests, caps, reversals, disclosure, support, and unit economics. No public campaign can be enabled without the flag and policy version. |
| R4-06 | Build adoption instrumentation around the actual value loop: first trusted costing, rate update, reopen with current rates, save new snapshot, compare delta, generate customer quotation, export, repeat weekly use, support intervention, and referral prompt eligibility. Use tenant-safe analytics with consent and no sensitive costing payload. | Product + frontend/backend | 2.0d | Events have stable definitions, deduplication, tenant-safe identifiers, consent/retention documentation, and a QA dashboard/query. Funnel counts reconcile to test fixtures without collecting rates, customer names, or document contents. |
| R4-07 | Add a no-card guided sandbox or bounded trial/onboarding route that teaches the core loop without creating a misleading paid entitlement. Keep production data isolated and make conversion/reset behavior explicit. | Product + engineering + QA | 2.0d | New target owner reaches a trusted sample costing quickly, understands sample versus saved business data, cannot enter Premium routes, and cannot exploit trial state to earn/redeem referral credit. |
| R4-08 | Conduct comprehension tests with at least two Gujarati/Hindi target users before cohort onboarding. Ask them to complete a costing, change a rate, explain a delta, generate a quotation, export data, interpret billing, and explain the referral benefit. | Product research + local reviewer | 2.0d | Users can identify primary actions and explain outcomes without developer translation. Observed misunderstandings are fixed or change the declared language promise before R5. |
| R4-09 | Align positioning and support promises with the tested personas. State that Base is one owner's costing desk, not shared staff access, accounting/GST software, Tally/Zoho replacement, or Full Suite. Explain receipt versus GST tax invoice and point accountants/assistants to export/supporting records without implying unsupported workflows. | Product + legal/compliance + frontend | 1.0d | Landing, onboarding, billing, Terms/FAQ/help, sales script, and pilot consent use consistent scope and document language; no advertised link or claim implies delegated access or accounting functionality. |

### R4 product decisions

- Keep INR 8,260 first-year pricing through R5; test value and purchase behavior, not only stated willingness.
- Keep INR 2,360 renewal only if a support/hosting/unit-economics review confirms it is sustainable.
- Do not position Base as accounting/GST software, Tally replacement, multi-user operations software, or Full Suite.
- Lead with the precise value claim: current yarn rates → trusted repeat-quality price → immutable old snapshot → explainable delta → customer-safe quotation.
- Do not show a referral prompt before a verified value milestone.

### R4 exit gate

- The declared Gujarati/Hindi promise matches actual runtime coverage.
- Target users understand costing, price movement, billing document limits, export, and referral status.
- Referral redesign is feature-flagged and cannot launch accidentally.
- Pilot metrics are defined before data collection begins.

---

## Sprint R5 — Controlled owner pilot and commercial proof

**Duration:** 4 consecutive weeks  
**Goal:** Establish whether target owners repeatedly trust, use, and pay for the product under realistic conditions.  
**Entry condition:** R0–R4 exit gates pass; no open P0; consent, support, and incident paths are ready.  
**Exit state:** Evidence-based recommendation for unrestricted launch, another bounded iteration, or No-Go.

### Cohort design

- Recruit **8–12 grey-fabric weaving proprietors** who personally influence repeat-quality pricing.
- Include mobile-first owners and at least a small Gujarati/Hindi usage sample matching the language promise.
- Exclude participants who require shared staff accounts, accounting/GST replacement, production, inventory, payroll, or other Full Suite capabilities unless they explicitly accept the Base boundary.
- Use isolated tenants and the owners' own qualities/rates with consent. Never mix QA fixtures with pilot business data.
- Give every owner the same onboarding task: create or enter a quality, set current yarn rates, save v1, change one rate, reopen with current rates, save v2, explain the delta, and produce a customer-safe quotation.

### R5 backlog

| ID | Activity | Owner | Timing | Success evidence |
| --- | --- | --- | --- | --- |
| R5-01 | Capture baseline process: current spreadsheet/memory/WhatsApp flow, time, rework, confidence, pricing-error history, device/language, and support expectations. | Pilot owner | Before use | Baseline exists for every participant and avoids retrospective value inflation. |
| R5-02 | Measure time to first trusted costing and first completed value loop; distinguish independent completion from founder-assisted completion. | Pilot owner + product | Week 1 | Median and range recorded; every intervention categorized; owner validates the resulting number against their trusted method. |
| R5-03 | Observe weekly repeat use, rate updates, reopened qualities, new snapshots, comparisons, quotations, exports, corrections, failures, and support contacts. | Product analytics + customer success | Weeks 1–4 | Event data reconciles to weekly owner check-ins; sensitive business data is not copied into research notes. |
| R5-04 | Document business outcomes: avoided underquote/pricing error, decision-time saving, reduced spreadsheet/memory dependence, faster trader response, or improved price explanation. | Product research | Weeks 2–4 | Each claimed outcome includes the owner's concrete example and confidence, not a generic satisfaction score. |
| R5-05 | Test price acceptance with a real INR 8,260 checkout choice or equivalent binding pilot conversion decision. Do not rely on “would you pay?” alone. | Product + finance | Week 4 | Accepted/declined/deferred counts and reasons are recorded. No discount is introduced mid-test to hide reliability or positioning objections. |
| R5-06 | Review renewal unit economics: hosting, payment costs, founder/support time, onboarding, language support, expected renewal support, and referral liability. | Finance + product | Week 3 | Written decision retains or revises INR 2,360 renewal with contribution-margin assumptions and sensitivity. |
| R5-07 | Measure unaided referral intent only after a successful retained-use milestone. Test the proposed two-sided offer and disclosure; do not launch broad referral marketing. | Product research | Week 4 | Owners explain who benefits and when; reputational objections, friend benefit, timing, and preferred support are captured. |
| R5-08 | Run weekly safety reviews and a final cohort closeout: incidents, exports, deletions, billing truth, support SLA, P0/P1 defects, and retention. | Release owner + QA | Weekly/final | No unresolved data isolation, money, export, deletion, or pricing-truth incident; all defects have severity and disposition. |

### R5 success thresholds

All launch-critical thresholds must be met:

- 8–12 target owners complete onboarding with their own business inputs.
- At least **5 owners use Weavly independently for four consecutive weeks**.
- 100% of sampled saved costings/quotations preserve their original rate and assumption basis.
- 0 cross-tenant, false-entitlement, duplicate-credit, invalid-but-believable costing, or customer-document leakage incidents.
- At least 80% of active pilot owners complete the core repeat-quality loop without live intervention after onboarding.
- At least 5 owners reach a real price decision; accepted/declined outcomes and reasons are known.
- At least 3 owners document an avoided pricing risk or meaningful decision-time/confidence benefit.
- Support load and INR 2,360 renewal economics are sustainable under an explicit operating model.
- Referral intent is measured after retained value, and participants understand the two-sided benefit and disclosure.

Missing a threshold is not automatically failure if sample attrition has a documented external cause, but changing a threshold after observing results requires an explicit product/release decision.

### R5 outcome choices

- **Proceed to R6:** technical gates hold and commercial thresholds are met.
- **Extend controlled pilot:** no safety/trust blocker exists, but the cohort is too small or four-week evidence is incomplete.
- **Return to remediation:** repeat-use, value, language, support, or price friction has a specific solvable cause.
- **No-Go/reposition:** owners do not repeatedly use or pay for the narrow value loop even after reliable onboarding.

---

## Sprint R6 — Launch candidate and gradual release

**Duration:** 5 working days  
**Goal:** Convert the proven build and pilot evidence into an operationally safe release decision.  
**Entry condition:** R5 recommends proceeding.  
**Exit state:** Unrestricted launch candidate, or an explicit hold with blocking evidence.

### R6 backlog

| ID | Story | Owner | Estimate | Acceptance and required evidence |
| --- | --- | ---: | ---: | --- |
| R6-01 | Cut a release candidate and freeze scope. Record app commit, migration head/checksums, dependency lockfile, environment/configuration, language promise, pricing/referral policy versions, and feature flags. | Tech lead | 0.5d | One immutable release manifest is signed by engineering and release owner. |
| R6-02 | Rerun the complete 65-scenario Base matrix on fresh isolated fixtures, including live/deployed money scenarios authorized for the gate. Reconcile browser, database, artifacts, console, and telemetry. | QA + finance/release owner | 2.0d | No P0/P1 failure; zero `not_run` for launch-required items; report/result JSON/matrix totals agree; code-only evidence is labeled as such. |
| R6-03 | Rerun security advisor, dependency audits, full test/lint/build, RLS/RPC negatives, export/deletion, service-worker upgrade, mobile, localization, and customer-safe document checks. | Security + QA | 1.0d | No unaccepted production high, no overdue risk, no Base-relevant unknown advisor finding, and all technical gates pass on the release candidate. |
| R6-04 | Rehearse operations: database backup/restore evidence, forward-fix migration, Razorpay/webhook replay, referral reversal/cap support, export support, account-deletion escalation, incident severity/contacts, customer communication, and feature-flag rollback. | Release owner + platform + support | 1.0d | Timed tabletop/runbook exercise has named responders, monitoring links, thresholds, and a tested safe-disable path for checkout/referral if needed. |
| R6-05 | Launch gradually: internal/retained cohort → small percentage/named waitlist → wider Base access. Monitor auth, costing-save, export, checkout/webhook, referral, error rate, latency, and support. | Product/release owner | Ongoing | Each expansion checkpoint is signed; any P0 signal stops expansion and activates rollback/feature-disable runbook. |

### Final unrestricted-launch gate

The decision is **Go** only when all of the following are true:

1. Production migration head and checksums equal the release manifest.
2. Referral panel/runtime, checkout allowlist, export, and deletion are operational and tenant-safe.
3. No unavailable tier can be purchased and money/webhook retries are idempotent.
4. Production dependency audit has no unaccepted high finding.
5. Every Base-relevant Supabase advisor notice has passed remediation or signed, expiring disposition with negative evidence.
6. The complete P0/P1 matrix required for launch has runtime evidence and no open failure.
7. Gujarati/Hindi runtime matches the advertised language promise.
8. Historical snapshots, current rates, copies, stale writes, settings, drafts, and artifacts preserve commercial truth.
9. R5 demonstrates repeat independent use and real price acceptance.
10. Monitoring, customer support, incident response, backup/recovery, and safe feature disablement are rehearsed.

If any condition fails, the decision remains a supported-pilot state or No-Go; it must not be softened to “Go with known P0.”

---

## 6. Finding-to-sprint traceability

| Source finding | Primary sprint | Closure evidence |
| --- | --- | --- |
| Production is three migrations behind | R0 | Repository and production heads/checksums match after clone rehearsal, backup, deployment, and schema-cache verification |
| Organization export fails on missing `referral_year_credits` | R0 | Complete tenant-only redacted JSON downloads and successful export audit row reconciles |
| Referral panel/runtime unavailable | R0 | Paid-owner panel plus attribution, conversion, cap, concurrency, and redemption runtime pack passes |
| Base-only rollout not enforced by checkout API | R0 | Missing/forged/Premium tiers rejected before side effects; Base pricing remains server-derived |
| Four high and two moderate production dependency findings | R0 | No unaccepted production high; tests/build/PDF/PWA checks pass; expiring exception register if needed |
| Failed/cancelled payments and webhook idempotency lack runtime evidence | R0 | Provider/deployed failure, cancellation, retry, success, duplicate, delay, and reorder cases reconcile to one entitlement |
| 95 Supabase security notices are untriaged | R1 | Complete disposition register, repaired search paths/grants, Base RPC negative tests, and accepted-risk approvals |
| Password reset, deletion/retention, and legacy routes are unproven | R1 | `AUTH-003`, deletion pack, and `NAV-004` deployed evidence |
| Organization metadata contradicts rendered/subscription state | R1 | Base experience, onboarding, JWT claims, and subscription state share a defined invariant |
| Historical v1 `Save New Version` leads to duplicate-quality error | R2 | Action either appends exactly one immutable version or is removed/replaced with the supported path |
| Stale writes, unsafe/extreme inputs, costing modes, and Start From remain unproven | R2 | Independent oracles, two-tab browser proof, server/database guards, and lineage reconciliation |
| Rate/quality lifecycle, drafts, settings, and service-worker export freshness remain unproven | R3 | All corresponding matrix scenarios become deployed runtime passes |
| Gujarati/Hindi contains mixed and unfinished operational copy | R4 | Declared language promise, locale parity, native textile review, screen/artifact sweeps, and comprehension tests |
| Referral offer is one-sided, deferred, and attribution is unclear | R4/R5 | Visible/correctable attribution, signed two-sided policy behind a flag, retained-use qualification, and owner research |
| One paid QA account does not prove willingness to pay or retention | R5 | 8–12 owner cohort, five independent four-week users, real price decisions, concrete business outcomes, and unit economics |
| Full matrix and operational launch readiness remain incomplete | R6 | Fresh 65-scenario release run, security/dependency gate, recovery rehearsal, and signed gradual-release decision |

## 7. Complete traceability of the 30 previously not-run matrix scenarios

| Sprint | Matrix IDs | Runtime proof required |
| --- | --- | --- |
| R0 | `BILL-006` | Duplicate and replayed webhook/order handling produces one payment and entitlement |
| R1 | `AUTH-003`, `NAV-004` | Neutral reset behavior; intentional safe legacy-route behavior |
| R2 | `RATE-003`, `RATE-004`, `RATE-005`, `RATE-006`, `QUAL-006`, `QUAL-009`, `EST-003`, `EST-004`, `EST-005`, `EST-006`, `EST-007`, `EST-008`, `EST-009`, `EST-014` | Invalid/duplicate numeric and identity boundaries, stale writes, costing modes, and independent Start From |
| R3 | `RATE-009`, `RATE-010`, `RATE-011`, `RATE-012`, `QUAL-004`, `QUAL-007`, `QUAL-008`, `EST-015`, `EXP-003`, `SET-001`, `SET-002`, `SET-003`, `SET-004` | Record lifecycle, drafts, service-worker freshness, and settings persistence |

Count check: 1 + 2 + 14 + 13 = **30**. `EXP-004` is the one explicit failure and is separately closed in R0.

## 8. Release evidence pack

Each deployed gate should produce a versioned directory containing:

- `RELEASE_MANIFEST.md`: commit, deployment ID/URL, migration head/checksums, environment, date/timezone, feature flags, dependency lockfile hash;
- `TEST_MATRIX.md`: one row per scenario with status, exact input, expected, actual, severity, and evidence pointer;
- `results.json`: machine-readable result ledger;
- sanitized browser screenshots and console/network evidence;
- independent costing oracle and parsed/exported artifact checks;
- tenant-scoped database reconciliation with row IDs/counts and no secrets;
- `SECURITY_DISPOSITION.md`: advisor/RPC/dependency register, approvals, owners, expiries;
- `MIGRATION_RUNBOOK.md`: rehearsal, backup, apply sequence, validation, and forward-fix plan;
- `GO_NO_GO.md`: explicit decision, signers, blockers, accepted risks, and next review date.

## 9. Program risk register

| Risk | Control | Release trigger |
| --- | --- | --- |
| Production migration locks or partial application | Clone rehearsal, backup verification, low-traffic window, ordered checks, immediate golden smoke, forward-fix owner | Any unexpected lock/error/row impact stops R0 |
| Security hardening breaks intended RPC calls | Inventory callers/grants first; positive and negative tests; deploy in small batches | Auth or Base golden-journey regression blocks release |
| Export succeeds but is incomplete or cross-tenant | Explicit schema catalog, tenant sentinels, redaction assertions, row-count reconciliation, no silent table skipping | Any missing required dataset or foreign tenant data is P0 |
| Live payment tests create financial/customer confusion | Isolated org, finance approval, bounded transaction, reconciliation/refund plan, clear receipt vs GST-invoice language | Unreconciled payment/entitlement is P0 |
| Referral replay/abuse or reputational damage | Idempotency/locks, paid/active checks, cap, delayed vesting, status disclosure, campaign feature flag | Duplicate credit, hidden attribution, or unclear benefit disables campaign |
| Dependency remediation causes PDF/PWA regression | Compatible updates only; render PDFs; check sanitization, download, build, and offline upgrade | Artifact leak or stale service worker blocks release |
| Localization changes business meaning | Native textile reviewer, task-based comprehension, canonical glossary, artifact review | Target user cannot explain action/result; language claim is reduced or release held |
| Pilot becomes a Full Suite discovery project | Base scope contract and inclusion criteria; route boundary tests | Required daily workflow needs shared staff/production/accounting; record for separate product decision |
| Support cost makes INR 2,360 renewal unsustainable | Track onboarding/support time and unit economics during R5 | Renewal price/policy must be revised before public promise |
| Metrics overstate adoption | Separate assisted from independent use; reconcile telemetry with interviews; keep thresholds fixed | Missing/ambiguous evidence extends pilot, not launch |

## 10. Recommended execution priority

Start with R0-02, R0-05, and R0-06 in parallel after R0-01. The migration unlocks both referral and export, while checkout and dependency work are independent. Do not spend the stabilization week polishing localization or redesigning referral rewards. Once R0 proves a safe technical pilot, prioritize authorization/data controls before expanding costing or UX work, because a visually polished workflow cannot compensate for a cross-tenant, export, deletion, or money boundary defect.

The program's critical path is:

`production schema` → `export/referral runtime` → `security contracts` → `costing/version contracts` → `record/settings lifecycle` → `language/adoption readiness` → `four-week retained use` → `full release gate`.
