# Base Plan user persona

## 1. Primary persona: the owner who buys reliable costing

**Fictional name:** Mahesh Patel

**Role:** Proprietor or commercial decision-maker of a small/mid-sized grey-fabric weaving unit in Gujarat, often also the person who approves yarn purchases and customer rates.

**Plan:** Weavly Estimator / Base Plan

**Digital role in the current product:** Owner. Base is not currently modeled as a separate costing-clerk workspace; the protected Base routes and actions require the owner role.

**One-line description:**

> “I need to quote quickly, but I cannot afford to forget what the quote was based on.”

## 2. Context

Mahesh’s factory may have several looms, repeat fabric qualities, changing yarn suppliers, and a mixture of notebook, calculator, Excel, and WhatsApp habits. He may personally do costing at a desk or supervise a trusted person who prepares numbers for him. He is not trying to become an accountant or textile technologist; he wants a dependable answer that fits the way his factory already talks about fabric.

His working day is fragmented:

- a supplier sends a new yarn rate on WhatsApp;
- a trader asks for a price for a familiar quality;
- a partner asks why this month’s price increased;
- monthly output changes, so fixed factory expense must be spread over a different number of metres;
- an unfinished calculation may be left open while he answers a floor or family call;
- a customer needs a clean PDF, but internal cost and margin must remain private.

## 3. Why Base is valuable to him

Base is not valuable merely because it performs arithmetic. It is valuable because it turns a fragile number into a reusable, explainable business record:

```text
current rate → repeatable quality → immutable snapshot → explainable comparison → safe document
```

The product reduces four recurring risks:

1. **Rate memory risk:** the owner forgets which yarn rate was used.
2. **Recalculation risk:** a repeat quality is re-entered differently by mistake.
3. **History risk:** an old quote is overwritten and cannot be explained later.
4. **Privacy risk:** a customer sees production cost or margin in a shared sheet/PDF.

## 4. Goals and desired outcomes

### Primary goals

| Goal | What success feels like |
|---|---|
| Quote a known quality quickly | “I opened the quality and had a credible number without rebuilding the recipe.” |
| Keep rates current | “I know which rates need review, what changed, and when.” |
| Preserve history | “Last month’s cost is still last month’s cost.” |
| Explain price movement | “I can show that yarn or output assumptions caused the difference.” |
| Share safely | “The customer sees price and terms, not my internal economics.” |
| Keep working through interruptions | “The unfinished estimate came back when I reopened the app.” |
| Retain control of data | “I can export my factory’s information if I need to.” |

### Jobs-to-be-done

> When a customer asks for a price on a known quality, help me produce a defensible per-metre price using current yarn and factory assumptions so I can respond without exposing internal cost.

> When a supplier changes a yarn rate, help me re-cost the same quality and preserve the old version so I can explain the new price rather than arguing from memory.

> When the factory’s monthly output changes, help me understand how fixed expense per metre moves before I commit to a price.

> When I have to share a document, help me choose an internal or customer-safe view so the wrong numbers never leave the factory.

## 5. Behaviour and frequency model

These are persona assumptions for design and demonstrations, not product telemetry claims.

| Activity | Likely cadence | Mental mode |
|---|---:|---|
| Open a saved quality and review price | Daily or several times/week | Fast, outcome-oriented |
| Update/review yarn rate | Weekly, supplier-event driven, or monthly | Audit and trust |
| Create a new quality | Occasionally | Careful setup |
| Create a new costing version | Whenever rate/overhead/margin changes materially | Preserve history |
| Compare versions | When challenged or repricing | Explain the delta |
| Download customer PDF | Per serious customer response | Professional handoff |
| Download internal sheet | Periodically or for partner review | Detailed verification |
| Archive/restore old records | Monthly/quarterly | Library hygiene |
| Export organization data | On demand, renewal, or transition | Portability/control |

## 6. Environment and constraints

### Devices

- Laptop/desktop is likely for detailed costing and PDFs.
- Mobile is likely for checking a saved number, opening a share sheet, or receiving a supplier/customer message.
- The UI must remain touch-friendly because the wider product is used on factory-floor phones, even though Base is primarily a desk workflow.

### Connectivity

Connectivity may be uneven, but the owner cannot assume that a local screen equals a saved financial record. Base supports browser draft recovery and an offline-tolerant shell; the owner should still see a clear distinction between “saved locally as draft” and “saved to the factory record.”

### Language

The Base language policy supports English, Hindi, and Gujarati across navigation, estimator, Saved Costings, Rate Book, Settings, Billing, validation, exports, and statuses. Mahesh may understand technical words such as warp and weft but prefer a short explanation beside them.

### Domain literacy

He understands factory shorthand—warp, weft, PPI, rate per kg, metres, crimp, waste, commission—but a generic software label like “template,” “revision,” or “record kind” is not automatically meaningful. The product should retain familiar terms and explain the system meaning in plain language.

## 7. Current workflow before Weavly

The likely pre-product stack is:

```text
supplier WhatsApp message
        + handwritten rate notebook
        + calculator/Excel formula
        + saved quality memory
        + customer WhatsApp/PDF
```

Typical failure modes:

- the owner remembers a price but not the yarn rate or overhead basis;
- the same quality is entered with a slightly different width/PPI/ends value;
- a new price overwrites the old sheet;
- internal margin is accidentally included in a customer-facing file;
- a browser/Excel tab closes before the estimate is saved;
- the owner knows the rate changed but cannot quantify the exact impact.

Weavly should feel like a more trustworthy version of the owner’s existing register/calculator—not like a generic enterprise ERP that asks for irrelevant master data before giving value.

## 8. Mental model the persona can learn

The product should teach five simple ideas:

1. **Rate Book:** “what inputs cost now.”
2. **Factory Defaults:** “what this factory usually assumes for conversion and overhead.”
3. **Fabric Quality:** “what construction we are making.”
4. **Saved Costing:** “what that construction cost under a particular set of assumptions.”
5. **Version comparison:** “what changed between the old answer and the new answer.”

The persona should not need to learn these implementation terms:

- `EstimateState`;
- JSONB;
- `record_kind`;
- RPC;
- RLS;
- costing fingerprint;
- effective tier.

Those are engineering concepts. The user-facing equivalent is “current assumptions,” “saved quality,” “saved costing,” “new version,” and “customer-safe PDF.”

## 9. Representative story: May to July repricing

Mahesh saves **Quality A** in May. The snapshot records the then-current warp/weft rates, overhead method, output basis, commission, margin, and suggested price.

In July:

1. The supplier changes the weft rate from ₹220/kg to ₹240/kg.
2. Mahesh updates the current Rate Book and reviews the change.
3. He opens Quality A; the recipe is unchanged but the current rate is applied.
4. He sees the new production cost and suggested selling price.
5. He saves a new Costing version instead of overwriting May.
6. The comparison shows the rate, yarn cost, production cost, and price movement as New minus Old.
7. If output also changed from 54,000m to 70,000m, he switches to the monthly-expenses basis, reviews the capacity warning, and saves another deliberate version.
8. He downloads an internal sheet for discussion and a customer-safe quotation PDF for the buyer.

The technical architecture matters because the user story depends on historical immutability. If the May row were recalculated against July defaults, the feature would fail even if the current July number were correct.

## 10. What trust means to this persona

Trust is practical, not abstract:

- the same input produces the same result;
- the result tells him what it includes;
- a changed rate changes future estimates but not old records;
- the system does not silently treat missing data as zero;
- a warning explains what is unusual and what to do;
- a customer PDF does not leak margin;
- “saved” means the record is in the factory account, not merely in the browser;
- a share action does not pretend that delivery was confirmed;
- an archive can be restored;
- export is available if the business needs to leave or audit the system.

## 11. Likely objections and good answers

| Objection | What he is really asking | Good product answer |
|---|---|---|
| “I already have Excel.” | Why should I change? | The value is reusable quality history, reviewed rates, version comparison, and customer-safe export—not arithmetic alone. |
| “Why do I need to save a version?” | Will this create duplicate work? | Save a version only when the economic answer changes; the old answer remains explainable. |
| “Why are there two widths?” | Which factory number is correct? | Cost the finished output width; raw reed/loom width can overstate weft consumption. |
| “Why can’t I mark this PDF sent?” | Did the system record delivery? | Base PDF sharing is an artifact/handoff; durable quotation status belongs to Full Suite. The UI must not show a misleading action. |
| “Why is my old estimate different now?” | Did the system alter history? | It should not. Open the saved snapshot; current Rate Book values affect future versions only. |
| “Why can’t I delete it?” | Do I control my records? | Archive preserves restore/export/auditability; organization export remains available. |
| “Why does the app ask for review?” | Is the rate wrong? | A discovered/stale rate may be used as a suggestion, but owner confirmation makes the trust decision explicit. |
| “Why do I need the Full Suite?” | Is Base incomplete? | Base now closes the small owner loop from costing to job, metres, and piece-rate settlement; formal floor production, stock, orders, supervisor access, and advanced payroll still need Full Suite. |

## 12. Success measures for the persona

The product is working for Mahesh when he can:

- produce a repeat-quality estimate without re-entering the entire construction;
- identify the exact reason a price changed;
- preserve an old costing while creating a new one;
- create a readable internal PDF in one attempt;
- create a customer-safe PDF with no internal economics;
- recover an interrupted draft without distrust;
- update rates without cross-tenant or historical corruption;
- find/restore an old quality;
- export the organization data without support intervention.

Useful qualitative questions during a pilot:

- “Can you tell me what changed from the old price to the new one?”
- “Which number would you show your customer?”
- “Which number must stay inside the factory?”
- “If the supplier changes yarn rate tomorrow, where would you update it?”
- “What do you think Save Version Only changes?”
- “What would you expect Archive to do?”

## 13. Product/design implications

1. Lead with the result and its drivers, not the database model.
2. Keep the workflow quality-first: a known construction should be one action away from a current costing.
3. Make current-vs-historical assumptions visible at the moment of reuse.
4. Avoid hidden active values. If commission/transport/quantity is non-zero, show whether it is included.
5. Use “Saved Costings” for Base and reserve “Quotations” for a supported customer lifecycle.
6. Explain warnings in factory language: width, waste, crimp, output capacity, commission, margin.
7. Keep PDF privacy modes visibly separate and previewable.
8. Preserve familiar terminology and add plain-language help instead of replacing every factory term.
9. Make mobile interaction forgiving, but never imply that local draft persistence equals server persistence.
10. Treat export, archive, history, and review as first-class trust features, not administrative extras.

## 14. Who this persona is not

Mahesh is not:

- the supervisor entering a day/night shift production log;
- a worker checking Upaad or payslip details;
- a warehouse operator reconciling godown stock;
- a full accountant using a party/supplier ledger;
- a multi-site enterprise administrator;
- a generic SaaS finance user who thinks in invoices and SKUs first.

Those users may exist in the Full Suite or future scope. The Base persona is the owner making a fabric-cost and price decision.

## 15. Short explanation for the engineer demonstrating the product

> “This plan is a costing desk for a weaving-factory owner. The owner keeps a current rate diary, saves fabric constructions, and preserves each cost answer as a dated version. The important promise is not just that the calculator works today; it is that a July recalculation does not rewrite May, the owner can explain the difference, and a customer gets only the price document—not the factory’s internal economics.”
