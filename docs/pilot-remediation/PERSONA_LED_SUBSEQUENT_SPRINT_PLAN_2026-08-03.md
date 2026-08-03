# Persona-led subsequent sprint plan — Base Estimator

**Prepared:** 2026-08-03
**Scope:** Base Plan / Estimator only
**Customer lens:** Rajesh Patel, grey fabric weaving unit owner, Surat
**Status:** Proposed follow-on plan after Sprint 14 remediation

## Mission

Make the Base Estimator feel easier than Excel during a busy costing and quotation day:

> “I can enter my fabric details quickly, understand every important assumption, trust the price, and confidently send the quotation to my trader.”

This plan follows the customer review and the existing [Sprint 14 remediation closure pack](closure-packs/SPRINT14_PERSONA_NO_GO_REMEDIATION_2026-08-03.md). Sprint 14 reports several code-level fixes, but authenticated browser evidence, the GST invoice decision, and complete localization are still release gates. These sprints therefore treat runtime proof and customer comprehension as part of the product work—not as optional QA after it.

## Product decisions that apply to every sprint

1. **Rajesh’s trust comes before feature breadth.** A wrong-looking number, hidden assumption, or ambiguous status is a release blocker even when the underlying formula is correct.
2. **The next action must be obvious.** Every screen should answer “What do I do now?” without requiring software knowledge.
3. **Never allow a false result.** Zero production inputs, incomplete costing inputs, and stale data must be blocked or clearly marked—not converted into a believable ₹0.00/m result.
4. **Show the business meaning.** Prefer “New price is ₹0.69/m higher than old price” over an unlabeled `-₹0.69/m` delta. Prefer “Applied weft waste: 8%; default: 10%” over two unexplained waste numbers.
5. **Separate recipes from historical snapshots.** A current rate change may affect a future estimate, but must never silently rewrite an old costing or quotation.
6. **Quick mode remains the default.** Detailed mode should be available when Rajesh needs to inspect assumptions, not imposed on him for every estimate.
7. **Use Surat time and familiar language.** Dates, timestamps, Hindi/Gujarati labels, textile terms, and billing language must be understandable to a factory owner and learnable by staff.
8. **No Full Suite expansion.** Do not spend these sprints on inventory, production, accounting, or other modules outside the Base Plan / Estimator gate.

## Release policy

- Sprint 15 must pass before calling the current remediation pilot-ready.
- A failure in any pricing-truth or quotation-integrity scenario is a **No-Go**, regardless of automated test results.
- The GST invoice question must have an explicit product/configuration decision before paid conversion is discussed. The product must not imply that a payment receipt is a GST tax invoice.
- Gujarati/Hindi coverage must be judged on the actual Base Plan screens, not only on translation files.
- Every release candidate must be checked at 320, 480, 768, 1024, 1280, and 1440 px, with a keyboard pass and reduced-motion pass where relevant.
- Evidence must include sanitized screenshots, the exact inputs, expected result, actual result, and discrepancy disposition. “The code is fixed” is not evidence of customer readiness.

## Issue-to-sprint traceability

| Review finding | Customer risk | Primary sprint | Release treatment |
|---|---|---|---|
| Zero looms/output could produce a believable ₹0.00/m result | Rajesh may send an invalid quotation or trust a false cost | 15 | P0 blocker; runtime proof required |
| Cost comparison showed an unlabeled/reversed-looking negative delta | Rajesh cannot tell whether a new price is higher or lower | 15, 17 | P0 blocker; business-language comparison required |
| Default and applied weft waste were inconsistent/unclear | Hidden waste assumption changes price confidence | 15, 17 | P0 blocker; one canonical applied value |
| “Mark as sent” did not clearly show lifecycle/history | Customer and staff cannot know what was actually sent | 15, 17 | P0 blocker for quotation use |
| Save Quality and Save Costing created confusing version behavior | Duplicate or wrong historical costing may be used | 15, 17 | Must explain recipe vs snapshot and version creation |
| Billing exposed receipt-only behavior without a clear GST invoice decision | Paying business may be unable to claim the expected document | 16 | Paid conversion gate |
| Stale draft restore banner and unclear draft actions | Old assumptions can be restored accidentally or ignored | 15, 18 | Must be explicit and dismissible |
| Update notice was distracting/repeated | Interrupts work and reduces confidence in the app | 15, 18 | Session-deduplicated, finite, dismissible |
| Gujarati/Hindi experience was mixed English and Gujarati | Staff may not understand actions or validation | 16 | Decision and screen-level proof required |
| Rate dates appeared one day earlier than entered | Historical rate audit becomes unreliable | 15, 17 | Surat timezone proof required |
| Detailed mode was dense and long | Rajesh may avoid the product or make entry mistakes | 15, 18 | Quick-first, progressive disclosure |
| Async/modal wording was unclear or interruptive | User hesitates because the app appears to be doing something unexpected | 15, 18 | Plain status language and recoverable actions |
| Search text appeared clipped | Records become harder to find during a busy day | 18 | Responsive acceptance check |
| Archive/restore policy was not obvious; permanent deletion was unclear | Staff may fear losing records or misuse archive | 16, 18 | Policy visible at action point |

## Sprint 15 — Authenticated persona retest and critical trust gate

**Suggested duration:** 1–2 working days
**Priority:** P0
**Outcome:** A real isolated owner account proves that the Sprint 14 fixes work in the deployed product.

### Work items

**15.1 Provision a usable test environment.** Use a fresh isolated owner account with no production data, valid credentials, and a reproducible reset/cleanup path. Record deployment/version, browser, account, and timezone. Do not mark a scenario passed from source inspection alone.

**15.2 Re-run the critical costing truth scenarios.** Using a realistic grey-fabric case—48 looms, 26 days, 50 m/loom/day, actual output 54,000 m, monthly expenses ₹620,000, 75D warp, 150D weft, 60 PPI, 110 cm, 8% row waste, 5% crimp, realistic yarn rates, GST, and margin—verify:

- zero looms, zero working days, zero productivity, and zero output are each blocked or explained before a result can be saved;
- no division-by-zero, `₹0.00/m`, `NaN`, or other believable-but-invalid output appears;
- the displayed cost, suggested price, margin, and profit match an independent truth sheet;
- comparison is explicitly **Old → New**, with the correct sign and plain-language direction;
- default waste, row/applied waste, and effective waste have distinct labels and the breakdown uses the same applied value shown to the customer.

**15.3 Re-run quotation lifecycle.** Generate a customer-facing quotation, inspect its contents, mark it sent, reload it, and inspect the status and history. Confirm a user can distinguish Draft, Sent, Accepted, and Rejected, and can see when a status changed. “Archiving…” or other internal implementation wording is not acceptable customer feedback.

**15.4 Re-run save and draft workflows.** Save a quality recipe and a costing snapshot separately. Confirm the screen explains when the first snapshot becomes v1 and does not make an identical accidental v2. Restore, rename, discard, reload, and revisit an old costing. Confirm current rate changes do not rewrite historical snapshots.

**15.5 Re-run runtime presentation checks.** At all required widths, inspect Quick/Detailed mode, assumptions, large rupee amounts, long quality/customer names, search, update notice, toasts, focus order, and date/time. Test around midnight in Asia/Kolkata for Rate Book dates.

### Exit criteria

- 100% pass on zero-input, comparison, waste, quotation status/history, and snapshot immutability scenarios.
- Every discrepancy has either a linked fix or an explicit product decision; “known” is not a pass.
- No P0 issue is open.
- Evidence is attached to the existing [retest plan](RETEST_PLAN.md), including expected result, actual result, and discrepancy.

### Persona gate

Rajesh can answer these without developer explanation: “Which price is newer?”, “What waste was actually used?”, “Was this quotation sent?”, and “Will changing today’s yarn rate change my old quotation?” If he cannot, Sprint 15 fails.

## Sprint 16 — Billing trust and usable local language

**Suggested duration:** 3–5 working days
**Priority:** P1 / paid-conversion gate
**Outcome:** A paying weaving business understands exactly what it receives and staff can use the Base Plan in the chosen language.

### Work items

**16.1 Resolve the GST document product decision.** Put the answer before payment, not after it. The team must choose and implement one explicit state:

- If GST tax invoices are supported: collect and validate supplier legal name, address, state, GSTIN and invoice details; generate a compliant invoice; prove the PDF/print output with a realistic business identity.
- If only payment receipts are supported: say so plainly on the billing screen and checkout confirmation, and state what document the customer will receive. Do not use “invoice” where the product only produces a receipt.
- If availability depends on configuration or approval: show “available after supplier setup/approval” and make the dependency visible before purchase. Assign an owner and target date; do not leave it as an implicit assumption.

**16.2 Complete the Base Plan language decision.** Decide whether the paid pilot promises English only, Hindi, Gujarati, or all three. If Hindi/Gujarati are promised, cover navigation, estimator labels, field help, validation, save/archive actions, quotations, Saved Costings, Rate Book, Settings, billing, export, and status/toast messages. Avoid mixed strings such as English technical labels embedded in Gujarati unless the term is deliberately retained and explained.

**16.3 Validate factory terminology with a Surat reviewer.** Use Rajesh’s terms—warp, weft, PPI, crimp, waste, pick rate, costing, quotation, trader, margin, GST—not generic accounting translations that change meaning. Include a one-line explanation for any unavoidable technical term.

**16.4 Preserve language and dates.** Reloading, navigating, restoring a draft, and opening a quotation must retain the selected language. Display dates and timestamps consistently in Asia/Kolkata, with an unambiguous format and visible timezone where the date matters for audit.

**16.5 Document archive policy at the action point.** Explain that archive removes a record from active lists and that restore is available. If permanent deletion is intentionally unavailable, say so. Include the retention/privacy implication in plain language rather than making staff guess whether data is lost.

### Exit criteria

- GST state is recorded as Supported, Configured-Later, or Not-Supported, with product owner/compliance sign-off and a proof or explicit limitation visible before payment.
- No Base Plan screen has untranslated action/error text in a language the product claims to support.
- At least one Rajesh-like owner and one staff user can identify the primary action, understand validation, and explain the resulting document/status in the selected language.
- Archive/restore behavior and data retention are understandable without support.

### Persona gate

Rajesh should not have to ask, “Will I get the GST bill I need?” Staff should not have to ask, “Which button saves this?” If either answer is unclear, the product is not ready for paid adoption in that customer segment.

## Sprint 17 — Costing, comparison, and quotation workflow hardening

**Suggested duration:** 3–5 working days
**Priority:** P0/P1
**Outcome:** The end-to-end job from fabric assumptions to trader-ready quotation is fast, explainable, and safe to repeat.

This sprint is conditional on Sprint 15 evidence. If the runtime retest passes, preserve the fixes with regression coverage and improve the customer-facing explanation; if it fails, fix the defect before adding polish.

### Work items

**17.1 Make price movement obvious.** On comparison, show the old and new values side by side and a sentence such as “New suggested price is ₹0.69/m higher.” Use `New − Old` consistently for numeric deltas. Include the changed inputs—rate, waste, width, margin, commission, transport—so Rajesh can explain the difference to a trader.

**17.2 Make waste one source of truth.** Show `Default weft waste`, `Applied weft waste`, and, when relevant, `Effective waste after construction adjustments`. Label which value enters the formula. If a row overrides the default, show the override beside the row and in the cost breakdown. An explicit 0% must display as 0%, not disappear or fall back silently.

**17.3 Make save semantics visible.** Present recipe saving and historical costing saving as separate actions with short helper text:

- **Save quality/recipe:** reusable construction and assumptions;
- **Save costing snapshot:** frozen result for this rate/date/quantity;
- **Create new version:** deliberate action with a reason or changed-input summary.

After save, show the version, timestamp, rate basis, and whether it is a recipe or snapshot. Do not require Rajesh to remember whether an earlier save already created v1.

**17.4 Make quotations a small, dependable ledger.** A quotation should have a visible identifier, customer, created date, validity, amount/price basis, and state. “Mark as sent” should immediately show Sent with a timestamp and appear in history after reload. Reopening a quotation must not reset it. If status transitions are restricted, explain why and what the next allowed action is.

**17.5 Protect historical truth.** Rate Book changes should affect new estimates only. Old costing snapshots and quotations should show their rate basis and remain unchanged. Add regression cases for rate updates, quality edits, duplicate saves, archive/restore, and reopening a quotation.

**17.6 Keep customer output separate from internal economics.** Internal cost sheets may show overhead, margin, and assumptions; trader quotations should expose only what is appropriate for the customer. The boundary must be consistent in UI and PDF, with a clear “Internal” label where relevant.

### Exit criteria

- A new estimator can be created, checked, saved, compared, quoted, marked sent, reopened, and audited without unexplained state changes.
- Independent calculations match displayed values for at least three scenarios: normal, rate-change, and edge-case waste/commission.
- No duplicate-looking versions are created by ordinary save behavior.
- A staff member can reproduce the same quotation from the saved snapshot without relying on Rajesh’s memory.

### Persona gate

During a phone call with a trader, Rajesh can explain the price in under a minute: the rate basis, applied waste, margin, and what changed from the previous version. If the app cannot support that explanation, it is still harder than Excel.

## Sprint 18 — Daily speed, simplicity, and staff learnability

**Suggested duration:** 3–5 working days
**Priority:** P1
**Outcome:** The product is comfortable to use repeatedly, including on a phone in a factory environment.

### Work items

**18.1 Keep the common path short.** Quick mode should be the landing/default path. Group detailed fields into meaningful sections, use sensible textile defaults, and reveal advanced assumptions only when needed. Preserve access to the full calculation without forcing every user through it.

**18.2 Make the first-run path teach itself.** Add concise examples or helper text for loom capacity, actual output, PPI, width, crimp, waste, commission, transport, and margin. Use a realistic grey-fabric example or starter recipe. Do not make Rajesh read an ERP manual before his first costing.

**18.3 Remove interruption friction.** Draft restore should offer clear `Restore`, `Rename`, `Discard`, and `Keep for later` outcomes. Update notices should be dismissible, shown once per session/version, and never cover a save or quote action. Async messages should use plain language such as “Saving costing…” and “Saved”; errors should explain recovery.

**18.4 Finish responsive behavior.** Ensure no clipped search placeholders, horizontal overflow, hidden primary buttons, or unusable dialogs at 320–480 px. Check long trader/quality names, large rupee values, keyboard focus, touch targets, zoom, and rotation where supported.

**18.5 Make record finding and recovery obvious.** Search should identify whether it searches qualities, costings, quotations, or rates. Empty results should suggest the next action. Archive/restore should be available where Rajesh expects it, with confirmation that names the record.

**18.6 Measure learnability with tasks, not opinions.** Ask a Rajesh-like owner and a staff member to complete: create one quality, make one Quick costing, inspect one assumption, change one rate, compare two versions, produce one quotation, and restore one archived record. Observe hesitation, backtracking, help requests, and wrong clicks.

### Exit criteria

- First-time staff can complete a normal Quick costing with minimal guidance.
- No critical action is hidden by a banner, modal, or viewport clipping.
- At least 80% of pilot-prep users complete the core task sequence without live coaching; every failure is categorized and addressed or consciously accepted.
- The app remains understandable when Rajesh is busy, interrupted, or returning to an old costing days later.

### Persona gate

Rajesh should be able to hand the phone to a staff member and say, “Make the same costing for this new rate,” without worrying that the staff member will overwrite the old result or get lost in detailed fields.

## Sprint 19 — Controlled pilot evidence and willingness-to-pay gate

**Suggested duration:** 1–2 weeks of real pilot use
**Priority:** Release decision
**Outcome:** The team learns whether the product solves the daily business problem, not merely whether screens work.

### Pilot protocol

- Use isolated, consenting Base Plan pilot accounts for weaving units with repeat trader quotations.
- Capture a baseline manual/Excel costing for the same fabric constructions.
- Ask each owner to perform recurring work: a new costing, a rate update, a comparison, a quotation, a correction, and a revisit of an old quotation.
- Record time to first usable costing, number of corrections, support questions, quotation rework, and whether the final number matched the owner’s trusted calculation.
- Ask after the first day and after one week: “Do you trust the number?”, “Was this easier than Excel?”, “Could your staff use it?”, and “Would you pay for it?”
- Do not use the pilot to expand into Full Suite workflows or to excuse unresolved P0 issues.

### Suggested success measures

- 100% of sampled saved quotations retain their original rate/assumption basis.
- 0 invalid zero-input results accepted as valid costings.
- 100% of sampled comparisons explain direction and changed inputs correctly.
- At least 80% of owners complete the core flow without founder intervention after onboarding.
- Median time for a repeat costing is lower than the owner’s existing Excel process, or the owner can name a clear confidence benefit that justifies the time.
- At least two pilot owners independently say they would pay, with the reason recorded; a polite “maybe” is not treated as willingness to pay.

### Exit criteria

Choose one outcome:

- **READY FOR PILOT:** all P0 gates pass, billing/GST state is explicit, language promise is honest, and pilot evidence shows trusted repeat use;
- **READY WITH MINOR IMPROVEMENTS:** no trust blocker remains, but bounded usability issues have owners and dates;
- **NEEDS SIGNIFICANT WORK BEFORE PILOT:** any P0 discrepancy, ambiguous paid-document promise, silent historical mutation, or repeated staff failure remains.

## Definition of done for persona-led work

A story is done only when all of the following are true:

- the normal Rajesh workflow is shorter or clearer, not merely technically possible;
- the expected result and actual result are recorded for at least one realistic textile scenario;
- invalid or incomplete input has a safe, understandable outcome;
- historical data, status, date, and rate basis are visible where a business decision depends on them;
- the action works at the smallest supported viewport;
- automated coverage protects the behavior, and authenticated browser evidence proves the deployed experience;
- the result has been reviewed using the persona questions: “Would I trust this?”, “Could staff learn it?”, “Could I make an expensive mistake?”, and “Would I pay for it?”

## Recommended sequencing and ownership

1. **Sprint 15:** Product + QA unblock the isolated authenticated retest and make a hard release decision.
2. **Sprint 16:** Product + billing/compliance owner resolve GST and localization promises before paid conversion.
3. **Sprint 17:** Design + engineering harden the costing/quotation trust flows uncovered by Sprint 15.
4. **Sprint 18:** Design + engineering reduce daily friction and validate staff learnability.
5. **Sprint 19:** Product runs the controlled pilot and decides based on repeat business outcomes and willingness to pay.

The next sprint should not be declared complete until the previous sprint’s evidence is available. This prevents the team from polishing detailed screens while Rajesh still cannot confidently answer whether a quotation was sent or whether the displayed price is based on the correct waste and rate.
