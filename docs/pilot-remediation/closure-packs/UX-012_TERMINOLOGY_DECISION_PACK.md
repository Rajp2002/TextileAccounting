# UX-012 — Factory-Supervisor Terminology Decision Pack

Prepared: 2026-07-14 IST

Current status: `PASS` (`pilot_core`) by explicit Founder approval; factory-side review is a mandatory pilot-run control

Pre-pilot approver: **Raj, Founder**

Pilot-run reviewer: **named supervisor/operator from the pilot factory who uses these workflows**

Reviewer name: **Raj**

Factory/role: **Weavly Founder / product owner (preliminary review; factory-side operational role not asserted)**

Languages used for the initial pilot: [x] Gujarati [ ] Hindi [x] English [ ] Other: ______

Language scope note: Hindi remains available in the product but is outside this UX-012 approval scope unless a pilot user will enable it. Gujarati terminology and spelling remain pending fluent factory-side review.

Founder approval date/time/time zone: **2026-07-17, IST**

Facilitator: **Codex**

Founder review opened: **2026-07-16 IST**

Approval boundary updated 2026-07-17: Raj explicitly approves the implemented terminology as Founder and authorizes `UX-012` as pre-pilot `PASS`. A named factory-side operator's review is now a mandatory first-pilot-run control rather than a pre-pilot gate. This pack must not represent Founder approval as a factory-operator signature; any disputed term during pilot reopens UX-012 as a change request.

## Canonical requirement

> Factory terminology review with brother/supervisor.

Expected labels match actual language for: **loom, shift meters, quality/run, godown, party, challan, Upaad/Kharchi, and hisaab**.

Existing source evidence shows these concepts in the product, but `output/qa/blocked-row-campaign/B19-external-evidence-review.json` found no named, dated factory-supervisor approval/change register. This template does not fill that gap until the real reviewer completes it.

Supporting review documents:

- [Complete factory-facing inventory](UX-012_TERMINOLOGY_INVENTORY.md)
- [Recommended canonical glossary](UX-012_RECOMMENDED_GLOSSARY.md)

No product wording was changed during preparation. The inventory found no isolated typo that could be corrected without also choosing factory vocabulary, a financial meaning, or a unit convention.

## What the reviewer is deciding

The reviewer must see each term in context, explain what they think it means without coaching, and choose **Approve**, **Change**, or **Unclear**. Alternatives below are prompts, not decisions; the reviewer may write the factory's actual word.

| Concept | Current product wording and location | Plain-language meaning | Alternatives to discuss |
| --- | --- | --- | --- |
| Loom | “Looms”, “Loom”, “Loom Assignments”; owner `/owner/machines`, supervisor `/supervisor/machines` and `/supervisor/dashboard`. English source: `lib/i18n/locales/en.ts`; cards: `components/MachineManagement.tsx`. Hindi/Gujarati navigation currently uses the equivalent of “machines”, so review each used locale. | The physical weaving machine on which a worker produces fabric. | Loom; Machine; Machine/Loom; factory's word: ______ |
| Shift meters | “Shift Meters”, “Shift Meter Log”, “Total metres this shift”; supervisor `/supervisor/dashboard`. Source: `lib/i18n/locales/en.ts` and `app/(dashboard)/supervisor/dashboard/page.tsx`. Hindi/Gujarati navigation currently says “Production Log” while the form explains shift totals. | Metres produced on one loom during the selected day or night shift, entered as the shift total. | Shift Meters; Production Meters; Shift Production; Meter Entry; ______ |
| Quality / run | Loom card shows assigned cost analysis/quality and whether the target is a Market Run or a party order; owner `/owner/machines`, supervisor `/supervisor/dashboard`, setup `/owner/estimator`. Sources: `components/MachineManagement.tsx`, `app/(dashboard)/supervisor/dashboard/page.tsx`, `app/(dashboard)/owner/estimator/EstimatorClient.tsx`. | The fabric recipe/order or market-stock run that the loom is currently making; it is not the loom itself. | Quality; Fabric Quality; Design/Item; Order; Market Run; Job; ______ |
| Godown | “Godown Stock”, “Godown Ledger”, “Godown”; owner `/owner/stock` and `/owner/today`. Sources: `lib/i18n/locales/en.ts`, `components/factory-today/QuickActionsCard.tsx`, `app/(dashboard)/owner/stock/TakaStockClient.tsx`. | The physical stock location and its digital stock record after fabric is produced/inwarded. | Godown; Stock; Stock Room; Warehouse; Maal Stock; ______ |
| Party | “Party Name”, “Party Ledger”, “Party / Customer”; owner `/owner/ledger`, `/owner/estimator`, and sale/dispatch flows. Sources: `lib/i18n/locales/en.ts`, `app/(dashboard)/owner/ledger/LedgerClient.tsx`, `components/dispatches/SellAndDispatchDialog.tsx`. | The buyer/customer whose order, bill, payment, or receivable is being recorded. | Party; Customer; Buyer; Client; Merchant; ______ |
| Challan | “Challan Number”; owner `/owner/dispatches`, order dispatch view, and stock-sale dialog. Sources: `app/(dashboard)/owner/dispatches`, `components/dispatches/DispatchModals.tsx`, `components/dispatches/SellAndDispatchDialog.tsx`. | The factory's dispatch/delivery document reference sent with fabric; it is not the invoice/payment itself. | Challan; Delivery Challan; Dispatch Slip; Delivery Note; ______ |
| Upaad / Kharchi | “Advances (Upaad)” for worker advance and “Record Kharchi” for supervisor floor cash; owner `/owner/advances`, supervisor `/supervisor/workers`. Sources: `lib/i18n/locales/en.ts`, `app/(dashboard)/supervisor/workers/page.tsx`, `components/supervisor/KharchiDialog.tsx`. | **Upaad** is money advanced to a worker and later deducted; **Kharchi** is cash issued/spent through the supervisor float. They must not be treated as the same ledger event. | Upaad/Advance; Worker Advance; Kharchi/Petty Cash; Floor Expense; Cash Given; ______ |
| Hisaab | “Payroll / Hisaab” and “Settle Hisaab”; owner `/owner/today` and `/owner/payroll`. Sources: `components/factory-today/PayrollHisaabCard.tsx`, `components/factory-today/QuickActionsCard.tsx`. | Closing a worker's pay cycle: gross earning, advances/deductions, net payout, and carried balance. | Hisaab; Payroll; Wage Settlement; Pay Cycle; Pagar Hisaab; ______ |

### Additional high-risk choices found by the full inventory

These are not extra canonical matrix words, but the reviewer must decide them if they appear in the pilot screens or exports being used.

| Choice | Why approval is required | Preferred choice / notes |
| --- | --- | --- |
| Loom counter reading vs shift total | They are different measurements; the quick form currently asks for a shift total. | ____________________ |
| Metre unit style: `m`, metre/metres, meter/meters, `mtrs` | Mixed UI, validation and PDF labels can obscure quantity versus rate. | ____________________ |
| Estimate vs quotation | Internal cost and customer-facing price must not be confused. | ____________________ |
| Taka vs roll/package/bale | These may be different physical units in the factory. | ____________________ |
| Metres sold vs sent vs received | Each changes a different stock/dispatch/claim state. | ____________________ |
| Piece-rate worker vs meter worker | “Meter worker” may sound like a counter reader. | ____________________ |
| Fixed worker vs salaried worker/staff | “Fixed” may describe employment status rather than pay mode. | ____________________ |
| Warp/weft Gujarati floor words | Reversal creates a material costing and yarn-entry error. | ____________________ |
| `kg/100m` vs `m/kg` helpers | These are inverse measures and must remain visibly distinct. | ____________________ |
| Party ledger vs Commercials | The owner needs one understandable name for money due/received. | ____________________ |

## Reproducible screenshot instructions

Use a laptop at 1440×900 and, for supervisor screens, also capture 390×844 mobile emulation. Use the deployed build approved for the pilot and an existing authorized pilot account. Do not create or alter production entries merely to make a screenshot. Redact party/worker names, phone numbers, amounts, and identifiers before storing evidence.

Capture these files under `output/qa/pilot-gate-closure/YYYY-MM-DD/UX-012/screenshots/`:

1. `01-owner-looms-quality-run.png`: owner sign-in → `/owner/machines` → show page title, one loom card, and its quality/run selector or assigned target.
2. `02-supervisor-shift-meters.png`: supervisor sign-in → `/supervisor/dashboard` → show “Shift Meter Log”, day/night control, one loom, quality/run context, and meter field. Do not save.
3. `03-owner-godown.png`: owner → `/owner/stock` → show Godown label, quality, and available-meters context.
4. `04-owner-party-ledger.png`: owner → `/owner/ledger` → show “Party Ledger” and party selection; redact names/amounts.
5. `05-owner-challan.png`: owner → `/owner/dispatches` → open an existing dispatch detail or create form without submitting; show “Challan Number”.
6. `06-supervisor-upaad-kharchi.png`: supervisor → `/supervisor/workers` → capture the Upaad/advance context and open the Kharchi dialog without submitting.
7. `07-owner-hisaab.png`: owner → `/owner/today` → show “Payroll / Hisaab” and “Settle Hisaab”, or `/owner/payroll` if the card is empty.
8. Repeat any screen in every language actually used by the reviewer. Record the selected locale in the filename, for example `02-supervisor-shift-meters-gu.png`.

9. `08-owner-estimate-vs-quote.png`: owner → `/owner/estimator` and `/owner/quotes` → show the internal costing result and the saved customer quote label without exposing party details.
10. `09-owner-stock-units.png`: owner → `/owner/stock` → show a non-sensitive row/form context containing metres and the configured taka/roll/package unit; do not save.
11. `10-owner-dispatch-quantities.png`: owner → `/owner/dispatches` → show sold/pending, sent, and received quantity labels from an existing redacted record or non-submitted form.
12. `11-generated-payslip.png`: generate only from an existing authorized test/QA settlement or use a redacted previously generated slip; show worker-type, metres, Upaad/deductions and Hisaab/payslip terminology. Do not generate from or expose an unrelated production worker.

For every screenshot record: deployed URL, build/commit, account role, route, viewport, locale, capture time/time zone, and redaction operator. A screenshot proves wording/location only; it does not prove approval.

## Dated decision register

| Concept | Reviewer explanation in their own words | Decision (Approve / Change / Unclear) | Exact preferred label and language | Reason / risk if unchanged | Screenshot IDs | Reviewer initials |
| --- | --- | --- | --- | --- | --- | --- |
| Loom | The umbrella factory asset on which fabric is manufactured and against which production, workers, quality and runs are recorded; it may be a power loom, rapier, water-jet or Jacquard-equipped machine. | Change | Machine (English); Gujarati/Hindi equivalents pending factory-side verification | “Loom” is narrower than the represented asset and would constrain future machinery terminology. Keep Machine distinct from Fabric Quality, Market Run and Party Order. | Pending implementation screenshots | Raj |
| Shift meters | The total production entered for the selected machine and shift; it is not the physical counter device or its cumulative reading. | Change | Metres Produced This Shift (English); Gujarati pending | “Shift Meters” is abbreviated and may be mistaken for a meter/counter device. | Pending implementation screenshots | Raj |
| Quality / run | Fabric Quality is the assigned fabric specification; Market Run and Party Order separately identify why or for whom production occurs. | Approve | Fabric Quality; Market Run; Party Order (English); Gujarati pending | Mixing these with Machine would make asset, specification and production purpose ambiguous. | Pending screenshots | Raj |
| Godown | Finished fabric held in the physical godown and represented in the stock ledger. | Approve | Godown Stock (English); Gujarati pending | Must remain distinct from raw-material/yarn inventory and unrecorded physical stock. | Pending screenshots | Raj |
| Party | The buyer/customer whose quotation, order, dispatch, payment, receivable or ledger entry is being recorded; not the order or dispatch itself. | Approve | Party (English); Gujarati pending | Preserve one buyer/account identity across commercial workflows. | Pending screenshots | Raj |
| Challan | The dispatch document accompanying fabric; not an invoice or payment record. | Approve with contextual labeling | Delivery Challan on headings/first use; Challan or Challan Number in established compact context; Gujarati pending | The delivery meaning must be explicit on first use. | Pending screenshots | Raj |
| Upaad | Money advanced specifically to a worker and later included as a deduction or adjustment in Worker Hisaab. | Approve with contextual labeling | Upaad (Worker Advance) on first use; Upaad afterward; Gujarati pending | Must remain distinct from Kharchi. | Pending screenshots | Raj |
| Kharchi | Factory-floor cash issued to or recorded through the supervisor. | Approve with contextual labeling | Kharchi (Floor Cash) on first use; Kharchi afterward; Gujarati pending | Must remain a distinct Kharchi entry and never be presented as worker Upaad. | Pending screenshots | Raj |
| Hisaab | Complete worker pay-period close: earnings, Upaad and other deductions, prior/carried balances and final payable amount. | Approve with helper | Worker Hisaab; helper “Payroll Settlement”; Gujarati pending | It is more than salary calculation and must retain the complete settlement meaning. | Pending screenshots | Raj |
| Counter reading vs shift total (if used) | Counter Reading is the cumulative value displayed by the physical machine counter; Metres Produced This Shift is the entered production total for one selected shift. | Approve distinction | Counter Reading / Metres Produced This Shift (English); Gujarati pending | The UI must never imply the two values are automatically the same. | Pending screenshots | Raj |
| Unit labels (`m`, `₹/m`, `kg`, `₹/kg`, `kg/100m`, `m/kg`) | These are distinct textile quantities and rates. `kg/100m` means kilograms required per 100 metres; `m/kg` means metres represented by one kilogram. | Approve with helpers | `m`, `₹/m`, `kg`, `₹/kg`, `kg/100m`, `m/kg`; add plain-language helpers for the inverse measures | Silent substitution or weak labeling could invert a production calculation. | Pending screenshots | Raj |
| Estimate / quotation | A Cost Estimate is the factory's internal manufacturing-cost calculation. A Quotation is the customer-facing commercial offer derived from it. | Approve distinction | Cost Estimate; Quotation (English); Gujarati pending | Treating them as interchangeable obscures whether a value is internal cost or a customer offer. | Pending screenshots | Raj |
| Taka / roll / package / bale | Taka is the exact finished-fabric unit used for the pilot. Metres and Taka remain separate quantities unless linked by an explicit metres-per-Taka value. | Approve Taka only | Taka; Number of Taka; Taka Count; Metres per Taka | Roll, Package and Bale are not approved synonyms and could change the physical meaning of stock. | Pending screenshots | Raj |
| Sold / sent / received metres | Metres Sold is the commercial quantity sold; Metres Dispatched is fabric that left the factory; Metres Received by Party is fabric the party confirms receiving. | Approve with one change | Metres Sold; Metres Dispatched (compact: Dispatched Metres); Metres Received by Party (compact: Metres Received) | Dispatched and received quantities must not be assumed equal; “received” refers to fabric, not money. | Pending screenshots | Raj |
| Piece-rate / salaried worker | A Piece-Rate Worker is paid from production output; a Salaried Worker is paid under the salaried/fixed-pay workflow. | Change | Piece-Rate Worker; Salaried Worker | “Meter Worker” sounds like a counter reader and “Fixed Worker” can be mistaken for employment status. | Pending screenshots | Raj |
| Warp / weft floor words | Warp Yarn and Weft Yarn are separate fabric inputs and formula components. | Approve distinction | Warp Yarn; Weft Yarn (English); Gujarati/factory-floor terms pending | Combining or swapping them would alter fabric construction and costing meaning. | Pending screenshots | Raj |
| Party ledger / Commercials | Party-level money due and received: receivables, payments, adjustments and outstanding balances. | Change | Party Ledger for the active party-money screen; Commercials only as a future umbrella category; Gujarati pending | “Commercials” is broader and less descriptive for the active screen. | Pending screenshots | Raj |

## Change-request record

Complete one row per requested change. “No change” must be an explicit reviewer decision, not an empty table.

| ID | Current text | Route/component/locale | Requested exact text | Meaning to preserve | Owner | Implemented commit | Retest evidence | Reviewer re-approval/date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UX012-CR-01 | Loom; Looms; Loom Assignments; Loom Number; Loom Type | Owner/supervisor navigation, headings, cards, forms, selectors, validation, empty states, help text, reports, exports and all pilot locales | Machine; Machines; Machine Assignments; Machine Number; Machine Type | Physical factory production machine on which fabric is manufactured and against which production, workers, quality and runs are recorded. Preserve specific technical type values. Keep internal database/API/code identifiers unchanged unless a separate technical benefit justifies migration risk. Gujarati/Hindi wording requires factory-side verification. | Raj | English working tree implementation; commit pending | `output/qa/pilot-gate-closure/2026-07-17/UX-012/03-owner-navigation-terminology.png`; `05-owner-machines.png`; `12-supervisor-machines.png`; `13-owner-add-machine-dialog.png`; source/test evidence in founder review | English screenshots captured; pending factory-side English/Gujarati review |
| UX012-CR-02 | Shift Meters; Shift Meter Log; Total metres this shift and equivalent English shift-total labels | Supervisor navigation/dashboard, setup prompts, owner quick actions, landing/help copy and English validation/feedback | Metres Produced This Shift; sentence-case grammatical variants may say “metres produced this shift” | Total production entered for the selected machine and shift. Keep separate from the cumulative physical Counter Reading. Gujarati wording requires factory-side verification. | Raj | English working tree implementation; commit pending | `output/qa/pilot-gate-closure/2026-07-17/UX-012/11-supervisor-dashboard.png`; source/test evidence in founder review | English shift-total screenshot captured; Counter Reading context and factory-side English/Gujarati review pending |
| UX012-CR-03 | Challan in first-use headings/explanations | Dispatch forms, explanatory text and generated/user-facing references | Delivery Challan on first use; Challan Number in compact established context | Dispatch document reference, not invoice or payment. | Raj | English working tree implementation; commit pending | Founder evidence; focused tests, full 685-test suite, TypeScript and ESLint passed | Pending screenshots and factory-side English/Gujarati review |
| UX012-CR-04 | Advances; Give/Record Advance | Owner navigation and worker-advance page/dialogs | Upaad (Worker Advance) on first use; Upaad afterward | Worker-specific advance recovered or adjusted in Worker Hisaab; distinct from Kharchi. | Raj | English working tree implementation; commit pending | `output/qa/pilot-gate-closure/2026-07-17/UX-012/07-owner-upaad.png`; source/test evidence in founder review | English screenshot captured; factory-side English/Gujarati review pending |
| UX012-CR-05 | Record Kharchi; cash advance wording | Supervisor Kharchi dialog and help/feedback | Kharchi (Floor Cash) on first use; Kharchi afterward | Supervisor/factory-floor cash, recorded distinctly as Kharchi and never described as Upaad. | Raj | English working tree implementation; commit pending | Founder evidence; explicit `kharchi` RPC type guard; focused tests, full 685-test suite, TypeScript and ESLint passed | Pending screenshots and factory-side English/Gujarati review |
| UX012-CR-06 | Payroll; Payroll / Hisaab; Settle Hisaab | Owner navigation, Worker Hisaab page, Factory Today and quick actions | Worker Hisaab; “Payroll Settlement” helper where useful | Complete worker pay-period settlement including earnings, Upaad/other deductions, balances and payable amount. | Raj | English working tree implementation; commit pending | `output/qa/pilot-gate-closure/2026-07-17/UX-012/03-owner-navigation-terminology.png`; `06-owner-worker-hisaab.png`; source/test evidence in founder review | English screenshots captured; factory-side English/Gujarati review pending |
| UX012-CR-07 | Commercials as the active party-money screen label | Owner navigation, `/owner/commercials`, Factory Today and setup guidance | Party Ledger | Party receivables, payments, adjustments and outstanding balances. Internal route/code identifiers remain unchanged. | Raj | English working tree implementation; commit pending | `output/qa/pilot-gate-closure/2026-07-17/UX-012/03-owner-navigation-terminology.png`; `08-owner-party-ledger.png`; source/test evidence in founder review | English screenshots captured; factory-side English/Gujarati review pending |
| UX012-CR-08 | Estimate and Quote used interchangeably | Estimator, quotation history, owner navigation, setup/help and English copy | Cost Estimate for internal costing; Quotation for customer-facing offer | Preserve the boundary between manufacturing cost analysis and the commercial offer. Internal route, action and table identifiers remain unchanged. | Raj | English working tree implementation; commit pending | `output/qa/pilot-gate-closure/2026-07-17/UX-012/03-owner-navigation-terminology.png`; `04-owner-cost-estimate.png`; source/test evidence in founder review | Authenticated Cost Estimate and navigation screenshots captured; data-dependent Quotation History context and factory-side English/Gujarati review pending |
| UX012-CR-09 | Taka mixed with roll/package/bale or weak count labels | Active Godown Stock and dispatch labels/help | Taka; Number of Taka; Taka Count; Metres per Taka | Taka is the approved pilot finished-fabric unit. Metres remain a separate quantity. Legacy internal package identifiers remain unchanged. | Raj | English working tree implementation; commit pending | `output/qa/pilot-gate-closure/2026-07-17/UX-012/10-owner-godown-stock.png`; source/test evidence in founder review | Godown Stock context captured; populated Taka quantities and factory-side English/Gujarati review pending |
| UX012-CR-10 | Sent metres; ambiguous received metres | Dispatch workflow, receipt reconciliation and help text | Metres Dispatched; Dispatched Metres; Metres Received by Party; Metres Received | Distinguish sold, dispatched and party-confirmed fabric quantities; received never means money in this context. | Raj | English working tree implementation; commit pending | 53 focused tests, TypeScript and focused ESLint passed | Pending screenshots and factory-side English/Gujarati review |
| UX012-CR-11 | Meter Worker; Fixed Worker | Worker directory, machine assignment, Worker Hisaab, validation and payslips | Piece-Rate Worker; Salaried Worker | Preserve pay-mode meaning while avoiding confusion with a physical meter/counter or employment status. Internal schema/type identifiers remain unchanged. | Raj | English working tree implementation; commit pending | 53 focused tests, TypeScript and focused ESLint passed | Pending screenshots and factory-side English/Gujarati review |
| UX012-CR-12 | Weak inverse-unit helpers; generic warp/weft labels | Cost Estimate input and explanation panels | Warp Yarn; Weft Yarn; approved unit abbreviations with `kg/100m` and `m/kg` helpers | Preserve distinct yarn directions and prevent inverse-unit misreading. Formulas remain unchanged. | Raj | English working tree implementation; commit pending | 53 focused tests, TypeScript and focused ESLint passed | Pending screenshots and factory-side English/Gujarati review |

Implementation rules:

- Apply the decision consistently across navigation, headings, forms, dialogs, validation/toasts, help text, and all used locales.
- Preserve the separate business meanings of loom vs quality/run and Upaad vs Kharchi.
- If the reviewer requests a translation but cannot verify its spelling, obtain a second fluent reviewer; do not let Codex invent the wording.
- Run type-check, focused localization/UI tests, and screenshots of every changed location. Return the changed screens to the original reviewer.

## Approval / change-request form

I reviewed the listed terms in the product screens and explained their meanings in my own words.

Decision:

- [ ] **APPROVE** — every listed term is understood and acceptable in each pilot language.
- [ ] **CHANGE REQUESTED** — the attached change rows are required; approval is withheld until implementation and re-review.
- [ ] **NOT APPROVED / UNCLEAR** — at least one term remains confusing; pilot use is not authorized.

Reviewer name: ____________________

Reviewer role/factory: ____________________

Review date/time/time zone: ____________________

Signature or traceable electronic approval: ____________________

Facilitator/witness: ____________________

Re-review date (if changes): ____________________

Final decision after re-review: ____________________

## Exact approval wording to send back

Use this only after the named supervisor has personally reviewed the screenshots/screens. Replace every bracket; do not send a blank or assumed choice.

```text
I, [FULL NAME], confirm that I am the [FACTORY SUPERVISOR / FACTORY-SIDE ROLE] at [FACTORY]. On [YYYY-MM-DD, HH:MM, TIME ZONE], I reviewed Weavly build/commit [COMMIT] in [LANGUAGES] on the owner and supervisor screens listed in the UX-012 pack.

My approved factory terms are:
- physical weaving equipment: [TERM]
- per-shift production total: [TERM]
- actual loom counter value, if used: [TERM / NOT USED]
- fabric quality: [TERM]
- market-stock run: [TERM]
- godown/fabric stock: [TERM]
- buyer/customer account: [TERM]
- dispatch document: [TERM]
- worker advance: [TERM]
- supervisor floor cash: [TERM]
- worker payroll close: [TERM]
- fabric unit (taka/roll/package/bale): [TERM]
- metres sold / sent / received: [THREE DISTINCT TERMS]
- piece-rate worker / salaried worker: [TWO DISTINCT TERMS]
- warp / weft: [TWO DISTINCT TERMS]
- unit labels: [m, ₹/m, kg, ₹/kg, kg/100m, m/kg OR EXACT CHANGES]
- party money screen (Party Ledger/Commercials): [TERM]

[CHOOSE ONE]
APPROVED: I understand every listed term in context and approve it for this pilot. I have no open change request or unclear term.

CHANGE REQUESTED: Approval is withheld. Apply change-request rows [IDS] exactly, show me the changed screens/exports, and obtain my dated re-approval before UX-012 is marked PASS.

Traceable approval/signature: [SIGNATURE, APPROVED EMAIL/WHATSAPP MESSAGE REFERENCE, OR OTHER TRACEABLE RECORD]
```

If changes were requested, the final re-approval must say:

```text
I, [FULL NAME], [FACTORY-SIDE ROLE] at [FACTORY], re-reviewed UX-012 change requests [IDS] on deployed build/commit [COMMIT] in [LANGUAGES] on [YYYY-MM-DD, HH:MM, TIME ZONE]. The requested wording is implemented in the reviewed UI and generated outputs. I approve every UX-012 term for the pilot, with no open or unclear item. Traceable approval/signature: [REFERENCE].
```

## Required pilot-run operating-control artifacts

- [ ] Named reviewer's completed decision register covering every listed concept.
- [ ] Dated signature or traceable approval and reviewer role/factory.
- [ ] Screenshot set with route, locale, build, viewport, and redaction metadata.
- [ ] Every change request linked to an implementation commit and focused test/screenshot evidence.
- [ ] Same reviewer's dated re-approval after changes, if any.
- [ ] No unresolved “Unclear”, blank decision, or unverified used locale.

## Pilot-run review criteria

`UX-012` is already pre-pilot `PASS` by Raj's explicit Founder acceptance and
scope decision. This does not substitute for or claim a factory-operator
signature.

During the first pilot run, a real named factory-side operator must review the
listed concepts in populated context and exact Gujarati wording. Any disputed
or unclear term reopens UX-012 as a change request; the correction must be
implemented, tested, shown back to the operator and accepted before wider pilot
use.

## Exact matrix-update procedure after pilot-run review

1. Store the signed register, screenshot metadata, change requests, implementation proof, and final approval under `output/qa/pilot-gate-closure/YYYY-MM-DD/UX-012/`.
2. If the operator approves without changes, keep `status: "pass"` and append the reviewer name/role, date, languages and evidence paths.
3. If any term is disputed or unclear, reopen only `UX-012` in `output/qa/PILOTQA-20260621-2058-8QIH/results.json`, record the exact change request, and return it to `pass` only after implementation/retest/operator confirmation.
   - `notes`: state that all named terms were approved in the used locales with no open change request;
   - `updatedAt`: real final approval time;
   - preserve `release_scope: "pilot_core"` and `pilot_gating: true`.
4. Update only the matching `TEST_MATRIX.md` row, recalculate ledger counts with the command in the pack index/`TECH-011` procedure, and verify all evidence paths exist.
5. Reconcile `REMAINING_GATE_REPORT.md`, `FAILURE_BACKLOG.md`, `LOOP_STATE.md`, `FIX_LOG.md`, and `PILOT_READY_DEFINITION.md` to the new artifact and calculated counts. Do not promote any other row.
6. Run `git diff --check` and obtain a second-person check of the row and evidence before commit.

## Exact human and laptop actions still required

1. **Human:** nominate the actual pilot supervisor/brother and list the languages they use.
2. **Facilitator laptop:** capture/redact the seven required screen contexts from the approved deployed build, including used locales.
3. **Supervisor:** explain each term, complete every decision row, choose Approve/Change/Unclear, and sign/date the form.
4. **Developer laptop:** implement each requested change, run focused tests/type-check, and recapture affected screens; do not change text based only on this template.
5. **Supervisor:** re-review changed screens and provide dated final approval.
6. **Documentation operator:** the pre-pilot matrix records Founder-approved `PASS`. During pilot, retain the factory-side review as an operating-control artifact and reopen UX-012 if the operator requests or disputes any wording.
