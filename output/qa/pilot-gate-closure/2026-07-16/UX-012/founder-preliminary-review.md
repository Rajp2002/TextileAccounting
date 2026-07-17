# UX-012 founder preliminary review

Date: 2026-07-16 IST

Reviewer: Raj

Role: Weavly Founder / product owner

Decision: `CHANGE REQUESTED`

Change request: `UX012-CR-01`

Additional change request: `UX012-CR-02`

Batch 2 change requests: `UX012-CR-03` through `UX012-CR-07`

Batch 3 change requests: `UX012-CR-08` through `UX012-CR-12`

## Requested terminology

Use **Machine** as the user-facing umbrella term for the physical factory production asset:

- Loom → Machine
- Looms → Machines
- Loom Assignments → Machine Assignments
- Loom Number → Machine Number
- Loom Type → Machine Type

Specific technical selectable types such as Power Loom, Rapier, Water Jet, Jacquard, Other and factory-defined custom values remain valid. Database tables, API fields, routes and internal identifiers remain unchanged unless a separate technical need justifies migration risk.

Machine must remain distinct from Fabric Quality, Market Run and Party Order.

## Implementation state

English owner, supervisor, setup, estimator, validation, landing and primary locale surfaces have been changed in the working tree. A focused regression test protects the principal Machine terminology and stable internal identifiers.

The English production-entry label is now **Metres Produced This Shift**. **Counter Reading** remains a separate physical-machine measurement and is not inferred from or presented as the entered shift total.

Founder-approved English meanings also retain these boundaries:

- Fabric Quality: the fabric specification/construction assigned to a machine.
- Market Run: production for general stock or market sale without a named party order.
- Party Order: production associated with a specific buyer/customer order.
- Godown Stock: finished fabric held in the physical godown and represented in the stock ledger.

Batch 2 founder decisions add these boundaries:

- Party: the buyer/customer identity, not an order or dispatch.
- Delivery Challan: the dispatch document; use Delivery Challan on first use and Challan Number in established compact context. It is not an invoice or payment record.
- Upaad (Worker Advance): worker-specific money advanced and later included in Worker Hisaab. It remains distinct from Kharchi.
- Kharchi (Floor Cash): supervisor/factory-floor cash. The existing atomic RPC stores it with explicit `kharchi` type and links the supervisor float transaction; the UI no longer calls it a cash advance or Upaad.
- Worker Hisaab: the complete worker pay-period close, with Payroll Settlement as supporting explanation.
- Party Ledger: the active party-money screen for receivables, payments, outstanding balances, adjustments and booked profit. The compatible internal route/code identifiers remain `commercials`.

Batch 3 founder decisions add these boundaries:

- Cost Estimate: the internal manufacturing-cost calculation. Quotation: the customer-facing commercial offer derived from it. User-facing English labels no longer use the terms interchangeably; internal estimator/quote routes, actions and schema identifiers remain compatible.
- Taka: the approved pilot finished-fabric unit. Active Godown Stock and sale help now use Taka labels, with Metres per Taka explicit. Metres and Taka remain distinct quantities; roll/package/bale are not presented as synonyms. Legacy internal package identifiers were not migrated.
- Metres Sold, Metres Dispatched and Metres Received by Party are separate fabric quantities. “Received” in dispatch reconciliation does not mean payment, and dispatched quantity is not assumed to equal party-received quantity.
- Piece-Rate Worker replaces Meter Worker in user-facing English. Salaried Worker replaces Fixed Worker. Internal `workers`, `fixed_workers`, `meter_worker` and `fixed_worker` identifiers remain unchanged.
- Warp Yarn and Weft Yarn remain separate inputs and formula paths. Approved unit abbreviations remain `m`, `₹/m`, `kg`, `₹/kg`, `kg/100m` and `m/kg`; plain-language helpers now distinguish kilograms per 100 metres from metres represented by one kilogram. No formula changed.

The initial pilot-language scope is English and Gujarati. Gujarati exact terminology and spelling remain pending factory-side review. Hindi remains available but is outside UX-012 approval scope unless enabled for a pilot user; it must not be represented as approved without fluent factory-side review.

## Verification

- Batch 3 focused Vitest: 5 files, 53 tests passed, including 9 UX-012 terminology assertions.
- Full Vitest verification: 97 non-backup files passed with 677 tests passed and 1 intentionally skipped; the isolated backup inventory file passed 13/13 with a 15-second timeout, for 690 passing tests total and 1 skip.
- TypeScript: `npx tsc --noEmit` passed.
- Focused ESLint over changed implementation/test files passed.
- Database/schema/API migration: none.
- Production or QA mutation: none.
- The first full-suite attempt exposed stale terminology assertions, which were updated and now pass. The unrelated backup sanitized-inventory test exceeded its existing 5-second per-test timeout under local load, then passed 13/13 when isolated with `--testTimeout=15000`; this is a local timing characteristic, not a UX-012 product regression.

## Approval boundary

This is founder preliminary review and implementation evidence only. `UX-012` remains `BLOCKED`. Closure still requires a named factory-side operator to review the terms in context, confirm every pilot language, request any corrections, and sign/date the completed decision register after implementation screenshots exist.

The 2026-07-17 runtime pass verified the corrected public English terminology
and the authenticated owner/supervisor terminology using temporary accounts in
the confirmed QA project. The initial authenticated attempt was traced to a
`127.0.0.1` versus `localhost` development-origin mismatch rather than an
application Auth defect; the correct origin completed both owner and supervisor
login without a code change. The disposable accounts, organizations and test
subscriptions were deleted after capture. Evidence is recorded in
`output/qa/pilot-gate-closure/2026-07-17/UX-012/runtime-evidence.md` and
`output/qa/pilot-gate-closure/2026-07-17/UX-012/screenshot-index.md`.

## Final Founder decision — 2026-07-17

Reviewer: Raj

Role: Founder

Decision: **APPROVE for pre-pilot readiness**

Raj explicitly accepts the implemented English terminology and authorizes
`UX-012` to move from `BLOCKED` to `PASS`. The prior factory-side sign-off
requirement is re-scoped as a mandatory pilot-run control rather than a
pre-pilot gate.

This decision does not claim that Raj reviewed as a factory-side operator.
During the first pilot run, a named factory-side operator must review the
populated English contexts and exact Gujarati terminology. Any correction must
be recorded as a UX-012 change request and completed before wider pilot use.
