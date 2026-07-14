# UX-012 — Terminology Decision Pack

Prepared: 2026-07-14 IST

Current status: amended pre-pilot criterion `PASS` at production commit `bfc93dd`; actual pilot-user comprehension control remains `OPEN`

Baseline approver: **product owner (provisional limited-pilot approval, 2026-07-14)**

Pilot reviewer: **named actual pilot factory user who uses these workflows**

Reviewer name: ____________________

Factory/role: ____________________

Languages used on the floor: [ ] Gujarati [ ] Hindi [ ] English [ ] Other: ______

Review date/time/time zone: ____________________

Facilitator: ____________________

## Canonical requirement and traceable amendment

> Factory terminology review with brother/supervisor.

Expected labels match actual language for: **loom, shift meters, quality/run, godown, party, challan, Upaad/Kharchi, and hisaab**.

The original wording required a brother/supervisor review before pilot. The product owner approved a traceable amendment on 2026-07-14: use the reconciled product-owner-approved baseline for pre-pilot acceptance, and obtain more representative dated contextual comprehension evidence from the actual pilot factory user during the pilot. See `UX-012_REQUIREMENT_AMENDMENT.md`.

No factory supervisor has approved the terminology. Product-owner approval must not be described as factory-supervisor approval.

Supporting review documents:

- [Complete factory-facing inventory](UX-012_TERMINOLOGY_INVENTORY.md)
- [Recommended canonical glossary](UX-012_RECOMMENDED_GLOSSARY.md)
- [Canonical mobile factory review register](UX-012_FACTORY_TERMINOLOGY_REVIEW_REGISTER.md) — complete this register for the current review; the shorter legacy table below is retained only for preparation-history context.

The approved wording is implemented across the product and outputs. Full local regression, TypeScript, production build, remote build, and representative authenticated owner/supervisor route checks passed. Production deployment `dpl_4z2xhBamSuufrjwGaS1wUS4rT1GD` is `READY`. No known terminology ambiguity capable of causing production, stock, payroll, dispatch, or financial error remains. Evidence is under `output/qa/pilot-gate-closure/2026-07-14/UX-012/`.

Pilot-user review and correction confirmation remain open until completed. No factory-supervisor approval has occurred or is implied. The terminology/location tables below retain pre-implementation observations for traceability; the implemented baseline and current locations are authoritative in `lib/terminology.ts`, `UX-012_RECOMMENDED_GLOSSARY.md`, and the runtime evidence pack.

## What the pilot user will validate

The actual pilot user must see each term in real work context, explain what they think it means without coaching, and choose **Approve**, **Change**, or **Unclear**. Alternatives below are prompts, not decisions; the reviewer may write the factory's actual word.

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
| Loom |  |  |  |  |  |  |
| Shift meters |  |  |  |  |  |  |
| Quality / run |  |  |  |  |  |  |
| Godown |  |  |  |  |  |  |
| Party |  |  |  |  |  |  |
| Challan |  |  |  |  |  |  |
| Upaad |  |  |  |  |  |  |
| Kharchi |  |  |  |  |  |  |
| Hisaab |  |  |  |  |  |  |
| Counter reading vs shift total (if used) |  |  |  |  |  |  |
| Unit labels (`m`, `₹/m`, `kg`, `₹/kg`, `kg/100m`, `m/kg`) |  |  |  |  |  |  |
| Estimate / quotation |  |  |  |  |  |  |
| Taka / roll / package / bale |  |  |  |  |  |  |
| Sold / sent / received metres |  |  |  |  |  |  |
| Piece-rate / salaried worker |  |  |  |  |  |  |
| Warp / weft floor words |  |  |  |  |  |  |
| Party ledger / Commercials |  |  |  |  |  |  |

## Change-request record

Complete one row per requested change. “No change” must be an explicit reviewer decision, not an empty table.

| ID | Current text | Route/component/locale | Requested exact text | Meaning to preserve | Owner | Implemented commit | Retest evidence | Reviewer re-approval/date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UX012-CR-01 |  |  |  |  |  |  |  |  |

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

## Required closure artifacts

- [ ] Named reviewer's completed decision register covering every listed concept.
- [ ] Dated signature or traceable approval and reviewer role/factory.
- [ ] Screenshot set with route, locale, build, viewport, and redaction metadata.
- [ ] Every change request linked to an implementation commit and focused test/screenshot evidence.
- [ ] Same reviewer's dated re-approval after changes, if any.
- [ ] No unresolved “Unclear”, blank decision, or unverified used locale.

## Amended acceptance criteria

`UX-012` may become `PASS` for limited-pilot pre-pilot acceptance when the product-owner-approved baseline is consistently implemented across UI, validation, locales, PDFs, exports, messaging, documentation, and help; all high-risk distinctions remain explicit; production deployment and regression validation pass; and no known ambiguity can cause production, stock, payroll, dispatch, or financial errors.

The following pilot operating action remains open after pre-pilot PASS: obtain dated contextual feedback from the named actual pilot factory user, record every confusing/rejected term, implement corrections, and obtain dated confirmation after changes. The row and verdict must disclose this open control. Product-owner approval is not factory-supervisor approval.

## Exact matrix-update procedure after amended pre-pilot closure

1. Store the product-owner amendment/approval reference, baseline, implementation proof, deployment evidence, regression output, screenshots, and ambiguity review under `output/qa/pilot-gate-closure/YYYY-MM-DD/UX-012/`.
2. Edit only `UX-012` in `output/qa/PILOTQA-20260621-2058-8QIH/results.json`:
   - `status: "pass"`;
   - `actual`: product-owner-approved baseline, amendment date, implementation/deployment/regression summary, and ambiguity review;
   - `evidence`: paths to the amendment, baseline, deployment, screenshots, and tests;
   - `notes`: explicitly state that no factory supervisor has approved the terminology and that actual pilot-user feedback/correction/reconfirmation remains open;
   - `updatedAt`: actual final pre-pilot evidence time;
   - preserve `release_scope: "pilot_core"` and `pilot_gating: true`.
3. Update only the matching `TEST_MATRIX.md` row, recalculate ledger counts with the command in the pack index/`TECH-011` procedure, and verify all evidence paths exist.
4. Reconcile `REMAINING_GATE_REPORT.md`, `FAILURE_BACKLOG.md`, `LOOP_STATE.md`, `FIX_LOG.md`, and `PILOT_READY_DEFINITION.md` to the new artifact and calculated counts. Do not promote any other row.
5. Run `git diff --check` and obtain a second-person check of the row and evidence before commit.

## Remaining pilot-user actions

1. **Facilitator:** record the actual pilot user's name, role, languages, date/time, route/task, and device.
2. **Pilot user:** explain each priority term in context and record every confusing/rejected term.
3. **Developer:** implement each correction, test it, deploy it, and recapture the affected context.
4. **Same pilot user:** provide dated confirmation after the correction.
5. **Documentation operator:** keep the pilot control open until all four steps are evidenced; do not imply prior factory-supervisor approval.
