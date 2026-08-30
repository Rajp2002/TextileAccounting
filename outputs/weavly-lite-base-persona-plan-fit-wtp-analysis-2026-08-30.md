# Weavly Lite and Weavly Base: Persona, Plan Fit, and Willingness-to-Pay Analysis

**Review date:** 30 August 2026  
**Live product:** `https://textile-accounting.vercel.app`  
**Plans reviewed:** Weavly Lite and Weavly Base  
**Commercial prices reviewed:** Lite ₹2,999 first year / ₹1,499 annual renewal; Base ₹9,999 first year / ₹4,999 annual renewal, all GST-inclusive  

## Executive verdict

### Weavly Lite — strong enough to charge now

Lite is a coherent product rather than a cut-down Base trial. It solves a specific, expensive problem for a grey-fabric weaving owner or costing operator: preserving the assumptions behind a price so the same quality can be costed, reviewed, reused, compared, and quoted again without rebuilding a spreadsheet.

At ₹2,999 for the first year (about ₹250/month) and ₹1,499 on renewal (about ₹125/month), the value proposition is strong for a factory that prepares even a few costings per month. One avoided underquote, one recovered costing, or roughly one hour of saved owner time can repay a meaningful part of the annual fee. The live product supports the promised outcome with a detailed estimator, saved qualities, immutable costing versions, Rate Book history, old-versus-new comparison, defaults, archive/restore, an internal cost sheet, and a customer-safe quotation.

**Recommendation:** Sell Lite now. Position it around a defensible price decision and reusable factory knowledge, not merely around “a calculator.”

### Weavly Base — valuable, but payment confidence is conditional

Base has a credible narrow persona and a logical upgrade from Lite. The costing can become a production job; the owner can track target, produced, and remaining metres; machines can be connected to piece-rate workers and costings; daily metres can roll into gross pay; advances and capped recovery are visible.

The ₹7,000 first-year premium over Lite is commercially plausible (about ₹583/month), but the live trust story is not yet strong enough for an unqualified recommendation. In the reviewed tenant, production showed 230 metres and ₹1,881.60 for an “Unallocated worker total,” while Payroll showed the named worker at 0 metres and ₹0 gross. Jobs also displayed produced metres while remaining in `planned` status with a visible “Start job” action. The live Base Payroll page did not expose a historical settlement ledger. These may partly reflect older QA fixture state, but they are exactly the inconsistencies a paying owner will judge: whether production metres, job state, and worker money agree.

**Recommendation:** Offer Base to a controlled pilot or assisted rollout. Make it generally purchasable only after production-to-payroll exceptions, job-state integrity, and immutable settlement history are unmistakably resolved and verified in production.

## Review method and confidence boundary

The production app was reviewed through an authenticated paid Base QA workspace named `Base pilot testing`. The walkthrough covered:

- public positioning, prices, inclusions, exclusions, renewal language, and plan CTAs;
- Cost Estimate, Settings, Yarn Rate Book, Saved Costings, version breakdown, comparison, internal Cost Sheet, and Customer Quotation;
- Base Setup, production job creation, Jobs, Daily production, machine/worker assignment context, recent production, Payroll, advances, and settlement presentation;
- Billing entitlement and visible plan identity;
- browser console warnings and errors on the reviewed flows.

No production records, advances, settlements, payments, or customer documents were created. The review was deliberately read-only.

Base inherits every Lite capability, so the complete Lite workflow was exercised through the paid Base account. A separate paid Lite browser credential was not configured; Lite-only navigation and server entitlement boundaries were therefore supported by repository capability/access-gate evidence rather than a second live paid session. No browser console warnings or errors were observed during the reviewed routes.

## Plan 1: Weavly Lite

### Detailed primary persona

**Persona name:** The owner-led costing desk  
**Representative user:** A grey-fabric weaving proprietor, partner, sales-costing operator, or trusted family member who approves prices  
**Factory shape:** One factory; roughly 4–24 looms; repeat fabric qualities; changing yarn prices; no desire to operate production or payroll inside software yet  
**Team:** One owner and possibly one costing/sales assistant; the current costing workspace behaves as an owner-controlled workspace  
**Quote volume:** Typically 5–40 costing decisions per month, with a mix of repeat and variant qualities  
**Current tools:** Excel, calculator, notebook, WhatsApp yarn quotes, memory, and previously sent PDFs  
**Device/language context:** Desktop or Android/PWA; English, Hindi, or Gujarati; intermittent factory internet is plausible  

### What this person is trying to achieve

When a party asks for a price, the owner wants to answer three questions quickly and safely:

1. What will this fabric really cost per metre using today’s yarn and factory assumptions?
2. What price protects the desired margin after commission, transport, GST, waste, and overhead?
3. If the price changes next month, can I explain why without reconstructing the old spreadsheet?

The deeper need is not calculation. It is **commercial memory with an audit trail**.

### Buying triggers

- A yarn-rate change makes an old quote unsafe.
- The same quality is rebuilt repeatedly in spreadsheets.
- Different people produce different numbers for the same construction.
- An old quote cannot be explained after the file or notebook is lost.
- The owner sends an internal calculation to a customer by mistake.
- Monthly output changes the factory-expense allocation per metre.

### Required outcomes and live plan fit

| Requirement | Importance | Live evidence | Fit |
|---|---:|---|---|
| Calculate warp, weft, crimp, waste, weaving, warping/sizing, overhead, margin, commission, transport, quantity, and GST coherently | Must-have | Guided Quick/Detailed Cost Estimate with required-input status and live economics | Strong |
| Save a reusable quality rather than re-enter construction | Must-have | Saved qualities can be opened, reused, duplicated, or saved as a new quality | Strong |
| Keep previous costings immutable | Must-have | Versioned snapshots retain captured factory inputs and canonical result data | Strong |
| Explain why a new price changed | Must-have | Old/new comparison separates cost, selling price, margin, and quantity and states “New minus Old” | Strong |
| Maintain current yarn rates without rewriting history | Must-have | Rate Book shows current/previous values, effective date, review status, source, linked records, activity, and archive | Strong |
| Establish trustworthy defaults | Must-have | Settings shows output basis, monthly expenses, overhead method, target margin, optional assumptions, review cadence, and business identity | Strong |
| Produce an internal review artifact | Must-have | Internal Cost Sheet includes cost breakdown, yarn calculations, commercial assumptions, break-even, margin, quantity, and expected profit | Strong |
| Produce a customer-safe artifact | Must-have | Customer Quotation includes customer, validity, price, quantity, total, terms, and GST disclaimer while hiding internal cost/margin | Strong |
| Find and retire old records safely | Important | Search, sort, margin filters, favourites, snapshot/quality archive, and restore language are present | Strong |
| Recover drafts and work with unreliable internet | Important | Product messaging promises PWA/draft continuity; previous production QA also covered draft recovery | Adequate; saving/export still needs internet |
| Separate costing from production complexity | Important | Lite’s capability model excludes production, setup, and payroll while retaining the complete costing desk | Strong by design |
| Support multiple users/approvals | Situational | The reviewed experience is owner-controlled; no Lite costing-operator role or approval handoff was demonstrated | Gap for larger costing teams |
| Import existing spreadsheet knowledge | Situational | No spreadsheet import/migration path was visible | Adoption friction, not a core blocker |

### Value proposition assessment

**Current value proposition:** “Quote with a number you can explain.”

This is strong because it connects features to an owner-level risk: margin leakage. The live product earns that claim through versioning, Rate Book history, canonical comparison, and separate internal/customer documents.

The weakest marketing phrase is “complete estimator with live costing calculations.” Calculators are easy to compare with Excel and hard to defend as subscriptions. The strongest offer is the persistent decision record:

> Build the true cost once, preserve every assumption, and safely reuse the quality when yarn rates or customer terms change.

### Willingness to pay

**Likely willingness:** High for the primary persona; low for a factory that creates only occasional one-off costings.

Economic anchors:

- First-year price is about ₹250/month.
- Renewal is about ₹125/month.
- At 10 costings/month, the first-year software cost is about ₹25 per costing.
- On a 10,000-metre order, preventing only ₹0.30/m of underpricing protects ₹3,000—approximately the entire first-year fee.
- Saving 60–90 minutes of owner/operator time per month is enough to make the fee feel modest even before margin-risk reduction.

### Lite offer to take to market

**For:** A weaving factory that wants better price decisions but does not want production administration.  
**Promise:** Know the true cost, preserve the assumptions, and reuse the decision when rates change.  
**Proof:** Saved qualities, Rate Book history, immutable versions, old/new comparison, internal Cost Sheet, customer-safe quotation.  
**Price framing:** ₹2,999 for the first year—less than ₹250/month—and ₹1,499/year after that.  
**Not for:** Factories that need machine production, worker metres, advances, settlement, stock, dispatch, or statutory payroll in the same tool.

### Lite verdict

**Plan sufficiency:** 8.5/10  
**Value proposition strength:** 9/10  
**Willingness-to-pay confidence:** High  
**Commercial recommendation:** General availability

## Plan 2: Weavly Base

### Detailed primary persona

**Persona name:** The owner-operated production loop  
**Representative user:** A proprietor who personally converts approved costings into small production jobs and controls piece-rate payouts  
**Factory shape:** One factory; approximately 2–10 active machines; simple job-based weaving; one primary piece-rate worker may operate one or more machines in a shift  
**Team:** Owner enters or reviews daily metres; no dedicated supervisor login is required; worker phone numbers and statutory HR data are intentionally unnecessary  
**Payroll shape:** Piece-rate metres, rate snapshots, occasional advances, capped recovery, and cash settlement  
**Current tools:** Costing spreadsheet plus production register plus a separate khata/advance notebook  

This is intentionally not the persona for a multi-department ERP. A factory needing supervisors, attendance, fixed salary, statutory deductions, inventory, dispatch, formal sales orders, or multi-factory controls is outside the current Base promise.

### What this person is trying to achieve

After approving a costing, the owner wants one connected operating record:

1. Start a production job from the saved costing without retyping the quality or economics.
2. Assign machines and piece-rate workers for the current shift.
3. Enter metres once per machine each day.
4. See planned, produced, and remaining metres.
5. Know gross worker earnings from the rate captured for that work.
6. Recover advances predictably and retain proof of what was settled.

The deeper need is **continuity from the commercial decision to factory progress and worker money**.

### Buying triggers

- The costing spreadsheet and production register disagree.
- The owner cannot see how far a job has progressed without calling the floor.
- Metres are re-entered separately for job progress and worker pay.
- A current piece rate changes and the owner cannot prove which rate applied to earlier production.
- Advance deductions cause disputes.
- The owner wants a smaller workflow than a full ERP.

### Required outcomes and live plan fit

| Requirement | Importance | Live evidence | Fit |
|---|---:|---|---|
| Create a production job from an active saved costing | Must-have | Saved Costing exposes Start Production; New job begins with a saved costing, target metres, dates, reference, and notes | Strong |
| Keep job economics attached | Must-have | Job card shows quality/costing reference and planned cost | Strong |
| Track planned, produced, and remaining metres | Must-have | Job cards show target, produced, progress percentage, and remaining metres | Strong |
| Connect machines, workers, and costings | Must-have | Setup shows machines, workers, shift assignments, and current costing per machine | Strong for a small owner-run setup |
| Enter daily metres once and calculate pay | Must-have | Machine sheet carries assigned worker, costing rate, metres, and worker payroll roll-up | Strong conceptually |
| Preserve the rate used for completed work | Must-have | UI describes costing-rate application and repository model stores rate snapshots | Strong design |
| Handle advances and bounded recovery | Must-have | Payroll shows pending advances and states recovery is the lower of balance or 50% of gross; balance carries forward | Strong conceptually |
| Reconcile every production metre to a worker or explicit exception | Must-have | Reviewed recent production showed 230 m / ₹1,881.60 as “Unallocated worker total,” while Payroll showed the worker at 0 m / ₹0 | Weak; trust blocker |
| Enforce a coherent job lifecycle | Must-have | Jobs with 100 m and 130 m produced were still `planned` and retained a “Start job” action | Weak; status semantics are not trustworthy |
| Retain immutable settlement history and proof | Must-have | Current Payroll view showed only the current period; no historical settlement ledger was visible | Material gap in live product |
| Correct mistakes with an audit trail | Important | No visible correction/reversal flow was demonstrated for Base production entries or settlements | Needs explicit proof/design |
| Make daily use practical beyond a few machines | Important | Owner must enter machine metres; no Base supervisor role or bulk sheet was visible | Adequate only for a narrow small-factory persona |
| Support fixed salary/statutory payroll/payslips | Out of scope | UI explicitly excludes fixed salary, statutory deductions, payslips, and WhatsApp | Honest boundary |
| Support party orders, stock, dispatch, and broader operations | Out of scope | New production job explicitly says it is not a formal party order; public copy excludes broader modules | Honest boundary |

### Value proposition assessment

**Current value proposition:** “Keep the job and its economics connected.”

This is strategically right. The jump from Lite to Base should not be sold as “more modules”; it should be sold as removing duplicate entry between costing, daily production, and piece-rate settlement.

The problem is that the most important noun in the promise is **connected**. A visible unallocated production total, a zero payroll total for the same named worker context, or a job with output that is still “planned” directly undermines the paid upgrade story. A factory owner will tolerate a narrow product; they will not tolerate uncertainty around metres and worker money.

### Willingness to pay

**Likely willingness:** Medium today; high after trust gaps are closed for the narrow persona.

Economic anchors:

- Base costs ₹9,999 in year one, ₹7,000 more than Lite (about ₹583/month incremental).
- Renewal costs ₹4,999, ₹3,500 more than Lite (about ₹292/month incremental).
- If the connected workflow saves 10–15 minutes per operating day, the owner recovers roughly 4–6 hours per month; that easily supports the price.
- One avoided ₹1,000–₹3,000 worker-pay dispute or one caught production shortfall materially supports annual renewal.
- With only two machines and one worker, a notebook may still feel cheaper; Base becomes more compelling around 4–10 machines, multiple active jobs, repeat daily entry, and recurring advances.

The price is not the primary objection. **Trust and adoption effort are.**

### Base offer after remediation

**For:** An owner-run weaving unit that wants to carry an approved costing through a simple piece-rate production loop without buying an ERP.  
**Promise:** Start from the costing, enter machine metres once, and know job progress and worker payout from the same record.  
**Proof required:** Every metre allocated or flagged, every rate snapshotted, every job state coherent, every settlement retained and reviewable.  
**Price framing:** ₹9,999 in year one (about ₹833/month total) and ₹4,999/year after that. The upgrade over Lite is about ₹583/month in year one.  
**Not for:** Factories needing supervisor accounts, attendance, fixed salary, statutory payroll, stock, dispatch, formal order management, or multiple factories.

### Base verdict

**Plan sufficiency:** 6.5/10 live  
**Value proposition strength:** 8/10 concept, 6/10 current proof  
**Willingness-to-pay confidence:** Medium / conditional  
**Commercial recommendation:** Controlled paid pilot or assisted rollout; not an unqualified self-serve promise yet

## Cross-plan packaging assessment

| Question | Assessment |
|---|---|
| Is Lite sufficiently different from a free calculator? | Yes. Persistence, quality reuse, Rate Book history, version comparison, and document separation create defensible paid value. |
| Is Base a logical upgrade rather than a separate product? | Yes. Starting production directly from a costing is the correct bridge. |
| Is the price ladder understandable? | Yes. ₹2,999 to ₹9,999 is a large but explainable step because Base adds an operating loop, not cosmetic features. |
| Is the audience boundary clear? | Mostly. Public copy honestly excludes broader modules, but Base should state “owner-entered, piece-rate production” even more prominently. |
| Is annual/manual renewal understandable? | Yes on the public pricing page and Billing. |
| Is the in-app upgrade path clean? | Needs work. An authenticated visit to `/signup?plan=lite` redirected to `/owner/today`, which then displayed an outside-plan message instead of guiding the user to Billing. |
| Can users trust historical commercial decisions? | Strong in Lite. |
| Can users yet trust the complete production-to-payout chain? | Not sufficiently proven in the reviewed live Base data. |

## Highest-priority actions

### P0 — Make production-to-payroll reconciliation explicit

Every saved production entry must land in exactly one of these states:

1. allocated to a worker and included in payroll;
2. intentionally non-payroll with a named reason;
3. unresolved and prominently blocking settlement.

Add an owner-visible exception queue showing date, shift, machine, job, metres, captured rate, and the action needed. The current “Unallocated worker total” should not coexist quietly with a zero worker ledger.

### P0 — Make job state agree with production reality

Choose one consistent rule:

- block metre entry until the job is started; or
- automatically transition `planned` to `active` on the first accepted metre entry and record that transition.

Never show material produced on a job while still presenting “Start job” as if production has not begun.

### P0 — Ship immutable Base settlement history

After payment, the owner must be able to reopen the period and see:

- worker and period;
- machine/job earning lines;
- metres and snapshotted rates;
- gross earnings;
- advance deducted and balance carried forward;
- net payout, payment mode, paid date, and settlement ID;
- any correction or reversal as a separate audit event.

This is required for willingness to pay, not a reporting luxury.

### P1 — Prove the Base golden journey in a fresh paid tenant

Run a clean sequence with two machines, two jobs, one worker, two rate snapshots, one advance, and one settlement. Reconcile job totals, entry totals, worker totals, advance ledger, and settlement history after refresh. Existing legacy fixtures should not be the primary sales-demo proof.

### P1 — Route authenticated plan CTAs to Billing

If the user is already signed in, `Choose Lite` or `Choose Base` should open an in-app comparison/upgrade surface in Billing. It should not redirect to an excluded legacy home route.

### P1 — Keep Lite’s offer focused on the decision record

Lead with saved and explainable costings. Use “calculator” only as supporting language. Show the old/new comparison and the internal-versus-customer document split in the sales flow; these are more defensible than a list of inputs.

### P2 — Reduce Lite adoption friction

Provide a guided first quality, a sample costing, and a short migration template for the user’s five most repeated qualities. Do not add a broad CRM or spreadsheet-import project before validating that manual setup is preventing conversion.

### P2 — Keep Base narrow

Do not add stock, dispatch, attendance, statutory payroll, or a supervisor app merely to make the plan appear larger. First make the current costing → job → machine metres → worker earnings → advance → settlement chain indisputable.

## Final Go/No-Go by plan

| Plan | Persona fit | Requirements fit | Value proposition | Willingness to pay | Decision |
|---|---|---|---|---|---|
| Weavly Lite | Clear and common | Core needs sufficiently covered | Strong and differentiated | High at current pricing | **Go** |
| Weavly Base | Clear but narrow | Core flow exists; trust/audit gaps remain | Strong concept, incomplete proof | Conditional at current pricing | **Controlled Go / pilot** |

The commercial takeaway is straightforward: **Lite should be the confident default purchase. Base should be the earned upgrade once the factory has repeat production-entry pain and Weavly can prove that every metre reaches the correct job and worker settlement.**
