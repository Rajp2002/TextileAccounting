# Base plan: operational continuity and friction review

Reviewed 2026-08-31 against local checkout `da114f2` and the current working tree. This is an analysis, not an implementation or production certification. Existing unrelated working-tree changes were left alone.

## Decision

Keep Base focused on an owner-operated factory: saved costing → job → machine/worker assignment → daily metres → piece-rate earnings → settlement → permanent proof. Preserve the existing visual system and rate/history safeguards.

The highest priority is payroll correctness across time, followed by recoverable mistakes and preserved working context. Clickable recent rows are worthwhile but are only one instance of a broader problem: the owner frequently has to reconstruct the context the application already knows.

Do not expand this work into inventory, dispatch, statutory payroll, supervisor roles, or a general ERP redesign.

## Evidence and limits

- Read current Base production, assignment, payroll, history, loader, server-action, calculation, correction-migration, and translation code. Used earlier workflow/persona documents as background, not as proof of current behavior.
- Ran five existing test files: `base-production-core`, `base-payroll-readiness`, `base-payroll-history`, `base-production-correction-history`, and `base-plan-localization`. **26 tests passed.** These include calculation and source-contract assertions; they are not end-to-end proof.
- Executed a synthetic month-boundary case directly against `calculateBaseWorkerPayables`, with no database writes.
- No authenticated browser walkthrough, production database query, migration-deployment check, mobile usability session, or load test was performed in this review. Findings about repository behavior must not be described as freshly observed production incidents.
- Runtime translation exists, including translation of placeholders and accessibility attributes. English source text is not evidence that Hindi or Gujarati is missing at runtime.

## Prioritized findings

### B01 — Unpaid earnings can disappear from the current payable view at month rollover

**Priority: P0; locally reproduced calculation defect and confirmed workflow gap.**

`getWorkerPeriodStart` defaults to the current month and clamps an earlier settlement's next day to that month. The Base action always settles through today; the Base payroll page does not expose an earlier outstanding-period selector. Payroll records only expose already settled periods.

Synthetic fixture: one worker, no settlements or advances, 100 m produced on 2026-08-31 at a saved ₹8/m rate.

| Calculation date | Period start | Metres shown | Gross/net shown |
|---|---|---:|---:|
| 2026-08-31 | 2026-08-01 | 100 | ₹800 |
| 2026-09-01 | 2026-09-01 | 0 | ₹0 |

The production record is not deleted. Its unpaid value is omitted from the current calculation, leaving no normal Base UI path to settle it.

There is also a client/server mismatch: the checked-in settlement SQL uses the previous settlement end + one day without the client’s month clamp. After a prior-month settlement, the server can include older work the current preview omits. With no previous settlement, the SQL also defaults to the selected end date's month. These SQL paths were inspected, not executed against a deployed database.

**Improve:** define one authoritative outstanding-earnings boundary used by preview, readiness, settlement, and history. Show older unpaid work explicitly. Support a validated settlement-through date or clearly separated outstanding periods. Do not permit arbitrary overlapping ranges. Link earning lines to their settlement so backdated work cannot silently disappear behind an already-paid date range.

**Acceptance:** first settlement after month rollover, delayed settlement, previous-month partial settlement, mid-month payout, year rollover, and backdated entries all reconcile. The confirmed amount and persisted amount must match; stale previews require renewed review. No unpaid earning disappears merely because the calendar changes.

Evidence: `lib/base-production-core.ts:349`, `app/(dashboard)/owner/production/actions.ts:688`, `app/(dashboard)/owner/payroll/page.tsx:25`, `supabase/migrations/20260830110000_base_machine_first_production.sql:1020`.

### B02 — Payment locks a shared shift, but recovery has no Base interface

**Priority: P1; confirmed in source.**

Settling one worker finalizes every shared batch containing that worker during the settlement period. The production UI also disables a batch when any participating worker is settled. Other workers' entries in the same shift become uneditable even if those workers are still unpaid. Current confirmation language says settlement freezes production but does not spell out this shared-sheet consequence.

BasePayrollRecords provides period selection, search, breakdowns, CSV, and PDF. It does not expose a settlement correction/reversal action. The Base server actions likewise have no recovery action.

**Improve:** introduce a controlled “Resolve payment mistake” flow on the settlement record. Distinguish a record incorrectly marked paid from money actually paid with incorrect earnings. A record correction must never imply that a bank transfer or cash payment was undone.

The flow should show affected worker(s), source shifts, advances, original and proposed balances, reason, and confirmation. Preserve the original settlement and link a compensating record or replacement. Reject duplicate recovery requests and handle later settlements/advance recoveries explicitly. Avoid deleting history or naively subtracting an old advance recovery from the current balance.

For shared batches, either allow changes confined to unpaid lines while proving paid lines unchanged, or retain the lock and offer linked correction adjustments. Choose this accounting model before implementing a button. Do not unlock the whole batch just because one settlement is reversed when other paid workers still depend on it.

**Acceptance:** pay worker A, then discover an error for unpaid worker B in the same shift. B's issue can be resolved without changing A's paid proof. Resolve a settlement mistake both before and after a later settlement/advance recovery; the complete ledger must reconcile.

Evidence: `supabase/migrations/20260830120000_base_settlement_finalizes_batches.sql`, `app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx:151`, `app/(dashboard)/owner/production/BasePayrollRecords.tsx`.

### B03 — Unsaved production lacks continuity

**Priority: P1; source-confirmed missing protection, browser reproduction still required.**

Production rows live in component state. Effects rebuild rows when the selected batch and related inputs change. No sheet-local persistent draft or dirty-navigation guard is present. Date/shift changes, tab unmounting, navigation to Setup, or reload can therefore lose work. Cost-estimator draft support does not establish production-sheet draft support.

**Improve:** retain drafts by organization, user, date, shift, and base revision. Make “Unsaved”, “Saved on this device”, “Saving”, “Saved to server”, and “Could not save” distinct. Preserve the request ID through an uncertain retry. Detect a stale draft instead of overwriting a newer server revision. Clear or isolate local data on account changes.

Offer save/keep draft/discard on meaningful navigation, and restore the interrupted date/shift after Setup. A local draft is not an offline payroll settlement and must not be presented as server-confirmed production.

**Acceptance:** enter multiple machines, switch shift, visit Setup, return, reload, lose connectivity during save, and retry. No silent loss and no duplicate production. Two open tabs cannot silently replace one another's corrections.

Evidence: `app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx:105` and `:243`.

### B04 — Record-to-action navigation repeatedly drops context

**Priority: P1; confirmed in source.**

- Recent production renders static rows, limited to the latest 12.
- A payroll issue's Review link opens generic `/owner/production`, even though the issue contains the production date, shift, and entry ID.
- A job's Daily production action only switches a local tab; it does not carry the job.
- Manage-worker actions navigate to generic Setup, without the worker or return destination.
- Production routing currently accepts a costing ID but not a production record/date/shift selection.

**Improve:** create a shared, validated navigation contract for entry/batch, date, shift, worker, machine, job, selected tab, and return destination as applicable. Resolve IDs within the owner’s organization. Add “View log” as a real link, then display the exact sheet with the relevant row highlighted. Keep inspection and editing distinct for paid/finalized records.

Add a searchable production history beyond the recent 12, with date/shift/job/worker/machine filters. Preserve filters and scroll when returning. Contextual shortcuts should open existing screens rather than create competing copies of the workflow.

**Acceptance:** recent record → exact log; payroll warning → exact issue → correction → same worker/payroll context; job → its assigned machines; missing assignment → Setup → original unsaved sheet. No date or identity re-entry in these paths.

Evidence: `BaseProductionClient.tsx:308`, `:592`, `:627`; `BasePayrollReadinessPanel.tsx:80`; `production/page.tsx`.

### B05 — Correction history is richer in storage than in the owner experience

**Priority: P1 for dispute resolution; confirmed in source.**

The correction snapshot stores worker entries and machine allocations, and the revision records an actor. The loader normalizes the snapshot down to summary counts/metres and does not select the actor. The UI shows totals, reason, and time.

Moving 20 m from one worker to another can leave total production unchanged while changing both workers' money. “No total change” is insufficient explanation for that correction.

**Improve:** show before/after worker, machine, job, metres, saved rate, and earnings differences, plus who changed them and why. Use a compact summary first with expandable line differences. Keep snapshot identity understandable after names/jobs change. Preview the same impact before saving the correction.

**Acceptance:** a zero-net-metres reallocation clearly identifies both affected workers and pay changes; old receipts remain interpretable after renames and deactivation.

Evidence: `supabase/migrations/20260901110000_base_production_correction_history.sql:55`, `production/loaders.ts:79`, `BaseDailyProductionSheet.tsx:713`.

### B06 — Scale requires data completeness work, not just smaller cards

**Priority: P1 verification/data-design gate.**

Production, Setup, and Base Payroll share a loader that requests organization-wide costings, jobs, production, allocations, assignments, advances, settlements, lines, and revisions. There is no explicit pagination on those collections. Client calculations consume the returned rows. History has useful search, expandable content, and content-visibility styling, but these do not guarantee complete datasets or bounded payloads.

If an API row limit is reached, production and allocation queries can return different partial slices. Incorrect/incomplete totals are a risk, not a demonstrated production incident in this review. Live API limits were not queried.

**Improve:** load each route's working dataset, fetch history/detail on demand, and calculate authoritative totals from complete server-side data. Use paginated history with explicit completeness/error handling. Never derive a full payroll total from the visible history page. Check indexes/query plans during implementation instead of assuming the present parallel queries solve scale.

Current payroll also renders every worker card with no current-payroll search/status filter. Add Ready / Needs review / Paid / No earnings filters, worker search, and actionable counts. Preserve the existing history search and Setup filters.

**Acceptance:** verify 5-machine typical and 10-machine mature accounts, then a 25-machine stress fixture, each with two shifts and 12 months of history. These are proposed test fixtures, not new plan entitlements. Cross the actual API row cap deliberately and reconcile UI totals, server results, and exports. Compare older and newer periods and first-page versus later-page records.

Evidence: `production/loaders.ts:90`, `BaseProductionClient.tsx:677`, `BasePayrollRecords.tsx:193`.

## Refined owner journey

| Owner intent | Proposed default journey | Friction to remove |
|---|---|---|
| Get started | Show existing setup readiness → create/reuse costing → create job → assign machine and worker → first shift | Explain dependencies and prefill existing choices; do not force established owners through a wizard |
| Start the day | Open today's selected shift → see missing setup and entries → resolve only exceptions | Carry recurring assignments; do not imply yesterday's metres or attendance are today's facts |
| Enter production | Machine, worker, quality/rate, metres → live worker-pay summary → save receipt | Keep Enter-to-next input and sticky save; show exact row errors and visible unfinished counts on mobile |
| Correct production | Find record → inspect → reason → before/after production and pay → confirm | Preserve date/shift; distinguish editable work from paid work needing an adjustment |
| Pay a worker | Choose outstanding window → inspect earning lines → review advance balance/recovery → confirm payment details → open receipt | Show the worker-specific period, exact amount including paise, and shared-sheet lock impact before confirmation |
| Recover a payment mistake | Open settlement → select mistake type → inspect linked consequences → append audited resolution | Never require silent history editing or imply an external transfer was reversed |
| Find old work | Search/filter history → open exact record → return to same results | Avoid manual calendar reconstruction and reset filters |

Use a small contextual “Needs attention” area on Production/Payroll rather than introducing a new mandatory dashboard. Order work by what prevents completion: missing assignment/costing, unfinished entries, unreconciled earnings, older unpaid work. Every item needs a direct next action.

## UX details worth retaining and refining

- Retain machine-first entry, saved rate snapshots, distinct blank/zero/absent states, keyboard advancement, the sticky save control, locked saved logs, reason-required corrections, and permanent payroll exports.
- Setup already has a mobile assignment picker; improve and verify it instead of assuming users must drag connectors. Keep touch and keyboard alternatives visible on larger layouts too.
- Surface “3 machines left” and inline field guidance near the current action. Do not hide all completion context on small screens or rely only on a disabled Save button/toast.
- Let users inspect current earning lines before settlement, not only after they become permanent history.
- Move payment method into worker confirmation, with a remembered default, so it is explicit for each payment. State that Mark paid records a payment; it does not send money.
- Make advance entry retry-safe and offer audited correction of erroneous advances, including advances already partially recovered. The current advance action inserts without a request identifier; an uncertain retry deserves verification.
- Avoid accidental financial rounding in confirmation: overview cards may be compact, but the final payable, recovery, and receipt should agree at full stored precision.
- Do not make bulk payment the first scale shortcut. Add it only after individual review, partial failure reporting, repeat-request safety, and recovery are dependable.

## Runtime verification and release evidence

| Scenario | Required evidence |
|---|---|
| EN / HI / GU complete journey | Setup → job → production → correction → payroll → history/export in each language; inspect visible text, errors, dialogs, accessibility names, and long-name wrapping |
| Mobile and accessibility | Narrow Android viewport, real touch/keyboard, zoom, focus restoration, visible reasons for disabled actions, no essential hover-only controls, save bar unobscured by keyboard/navigation |
| Month/year rollover | Outstanding earnings remain visible and settle for the reviewed amount; UI/server/history agree |
| Partial settlement | Settled worker remains protected while another worker's error can be resolved |
| Connection failure / retry | Draft preserved, no double production/advance/payment, final state explicitly reconciled |
| Two tabs | Stale correction or payment preview cannot silently overwrite newer state |
| Mature history | Complete totals beyond row limits; historical records/find/export remain usable with bounded loading |
| Audit | Same-total reallocation, reversal/adjustment, later advance recovery, and deactivated/renamed workers retain understandable proof |
| Owner usability | Representative Base owners complete the journey without moderator rescue; record detours, wrong turns, assistance, and time to resolve errors |

Suggested product targets, to calibrate with owners: open a known log in one action; resume a setup interruption without re-entry; routine prepared 10-machine shift entry within roughly three minutes; reach and resolve an ordinary unpaid correction within roughly two minutes. These are proposed acceptance goals, not measured results.

Track durable server outcomes for saves, corrections, advances, settlements, and adjustments. Add privacy-minimal UX measures for draft restore, validation failures, issue-to-resolution completion, and time to first saved shift. Existing plan events are broad, browser fire-and-forget events; they are not proof of successful ledger operations. Do not include worker names, free-text reasons, or payment details in product telemetry.

## Delivery order

1. **Protect money across time:** unify period calculation/preview/settlement and expose older outstanding earnings. Lock in rollover and delayed-payment regression coverage.
2. **Make mistakes recoverable:** agree the shared-batch and settlement adjustment model; implement audited settlement/advance recovery and full correction differences.
3. **Preserve the owner's context:** production drafts, stale-write checks, record deep links, focused Setup handoffs, searchable history, and direct return paths. Navigation can be developed alongside the financial work once its context contract is agreed.
4. **Prove everyday usability:** route-specific complete data loading, current-payroll filtering, mobile/language/accessibility journeys, network failure cases, and real-owner tasks at mature account sizes.

A dependable Base plan lets the owner answer four questions at any point: which work am I looking at, has it been saved, how does it affect worker money, and how do I safely resolve a mistake? That is the acceptance standard for the next investment.
