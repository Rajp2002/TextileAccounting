# Weavly Base Plan: Persona, User Goals, and End-to-End Workflow Gap Analysis

**Review date:** 9 August 2026
**Live environment:** `https://textile-accounting.vercel.app`
**Account scope:** Paid Weavly Estimator/Base Plan, owner role, QA tenant `Base pilot testing`
**QA boundary:** Base/Estimator surfaces only. Premium production, orders, stock, payroll, dispatch, and analytics were not entered.

## Executive conclusion

The Base Plan now covers the core costing-desk workflow well enough for the primary owner persona:

1. Maintain a current Yarn Rate Book with review status, previous values, effective dates, activity history, and archive/restore.
2. Save a reusable fabric quality/recipe and an immutable first costing snapshot.
3. Reuse that same quality after a supplier-rate change and save a new version without changing the historical snapshot.
4. Change a monthly overhead assumption, deliberately create another version, and compare the cost movement.
5. Produce an internal cost sheet and a customer-facing quotation that hides internal economics.
6. Recover an interrupted draft, start a new quality from an existing costing, export organization data, and restore archived records.

The most important gaps are not in the estimator calculation itself. They are in the surrounding workflow:

- **Base Settings is currently an onboarding gap:** the live page displays “Estimator Defaults” and “Saved Fabric Qualities,” but neither section renders usable controls. There was no visible error or warning in the browser console.
- **Saved-quality reuse does not make commercial-state behavior clear:** after loading the saved quality for the rate-change scenario, commission, transport, and quantity were not visibly carried over as expected from the prior costing. Non-zero commercial values could remain hidden while their sections were switched off, forcing a “Review unusual values” acknowledgement.
- **Customer PDF export exposes a quotation-only status action:** “Mark as sent” appears for a Base standalone costing, although standalone costings do not support quotation statuses. Clicking it produced no durable sent state and a confusing transient updating/archive-like UI state.
- **PDF download is verified:** customer and internal PDF generation/download completed successfully in the QA workflow.

The product should stay focused on the reliable costing desk. A CRM, trend dashboard, spreadsheet import, and full production workflow are not necessary to close the highest-value Base jobs yet.

## Review method and scope

Estimator arithmetic was intentionally **not retested**, per request. Existing valid example inputs were used only to create realistic persisted records so the surrounding lifecycle could be examined.

The live QA run used the prefixed records `BASEQA-20260809160322-*`. It covered the following workflow actions:

- Base entitlement and billing boundary.
- Saved-quality creation and first costing snapshot.
- Yarn-rate review, change, activity history, archive, and restore.
- Same-quality reuse after a yarn-rate change.
- New costing-version creation and duplicate-save protection.
- Direct-overhead to monthly-expenses/output change at a higher monthly production volume.
- Snapshot comparison and historical-value preservation.
- Internal cost-sheet preview, verified PDF download, and customer-quotation preview/privacy with verified PDF download.
- Draft recovery and “Use as Starting Point.”
- Organization data export.
- Costing archive and restore.
- Premium upgrade wall without entering Premium workflows.

The scoped QA records were archived after the run because the live workflow explicitly states that permanent deletion is unavailable. The organization export audit entry is retained by the product’s own retention behavior.

## Primary persona

### The owner who buys reliable textile costing

**Role:** Owner/proprietor of a small or mid-sized weaving unit, or the person directly responsible for approving rates and quoting fabric.

**Working environment:** One factory, several repeat qualities, changing yarn suppliers, variable monthly output, and a small costing or sales desk. The owner may do the costing personally or supervise the operator who does it. Base currently behaves like an owner-controlled workspace rather than a multi-role production system.

**Why this user pays for Base:** They need a trustworthy, repeatable costing record without buying the full production suite. Their value is not merely “calculate a number”; it is being able to explain where a number came from and reproduce it later.

**Typical triggers:**

- A customer asks for a price on a familiar quality.
- A supplier sends a new yarn quote.
- The owner reviews a historical quote and realizes the yarn rate has changed.
- Actual monthly production rises or falls, changing the per-metre share of factory expenses.
- A customer needs a professional document without seeing internal margins or factory economics.
- A browser closes or an operator leaves an incomplete costing.
- A historical quality is no longer active but must remain auditable.

### Representative story: May to July repricing

In May, the owner saves **Quality A** with the then-current yarn rates and commercial assumptions. In July, the same quality is requested again:

1. The owner changes the current weft-yarn rate in the Yarn Rate Book.
2. The saved quality’s current layer is updated for future estimates, while the May snapshot remains frozen.
3. The owner opens the same quality in Estimator and sees the current rate.
4. The owner saves a new costing snapshot rather than overwriting May.
5. The comparison explains the new yarn rate, yarn cost, production cost, and suggested price as **New minus Old**.
6. If July production volume also changed, the owner opens the latest version, switches to monthly expenses divided by actual output, enters the new output, and intentionally saves another version.
7. The owner can provide an internal cost sheet for review and a customer quotation with internal economics omitted.

This is the central Base Plan job. It is now functionally supported, with the commercial-state reuse and export-status issues noted below.

## User goals and acceptance criteria

| Goal | The user should be able to… | Current assessment |
|---|---|---|
| Establish a stable costing desk | Configure default factory/monthly assumptions and see saved qualities from Settings | **Gap on live Base page**: headings exist, controls did not render |
| Trust the rate source | Review a discovered rate, confirm it, see when it became effective, inspect history, and archive/restore it | **Covered** |
| Save a reusable recipe | Name a quality, save its construction and initial costing, and find it later | **Covered** |
| Re-cost an existing quality | Load the same quality against current rates without destroying historical values | **Covered, with commercial-state friction** |
| Preserve history | Know that an ordinary repeat save does not duplicate or mutate a snapshot; create a version deliberately | **Covered** |
| Explain cost movement | Compare two snapshots and see rate, overhead, margin, commercial, and price differences | **Covered** |
| Model production-volume changes | Recalculate overhead from saved monthly expenses and actual output, then save a distinct version | **Covered** |
| Prevent accidental decisions | See warnings for unusual inputs and above-capacity monthly output before saving | **Covered, but warning workflow is noisy** |
| Produce an internal review document | Show detailed assumptions, internal cost, break-even, margin, and expected profit | **Covered in preview/UI** |
| Produce a customer-safe document | Show customer, validity, quantity, and price without internal economics | **Covered in preview/UI** |
| Record delivery status | Mark a Base customer document as sent only if the Base model supports that state | **Defect: action appears but is rejected for standalone costing** |
| Recover work | Restore an unsaved draft and continue from a saved costing as a new quality | **Covered** |
| Retire records safely | Archive and restore rates, qualities, and snapshots without destructive deletion | **Covered; retention is explicit** |
| Take data with the business | Generate a complete organization export and see its audit entry | **Covered in UI; physical file not inspected** |
| Stay within the plan | Understand which production workflows require Full Suite | **Covered** |

## End-to-end workflow assessment

### 1. Onboarding and defaults

**User need:** Before entering the first recipe, set business identity, monthly expenses, production assumptions, and reusable costing defaults.

**Live behavior:** The Settings page showed the business/profile controls and the headings “Estimator Defaults” and “Saved Fabric Qualities.” The corresponding defaults/quality-management content did not render after waiting for the page to settle. The browser console showed no error or warning.

**Impact:** A new owner can still use the estimator’s in-page controls, but the product’s central configuration surface does not currently support the onboarding promise. This creates uncertainty about where monthly expenses, production assumptions, or saved recipes are meant to be managed.

**Assessment:** **P1 onboarding blocker.** Fix before positioning Base as a self-serve costing workspace.

### 2. Yarn-rate maintenance

**User need:** Keep one current rate per yarn, review discovered values, understand the previous value, and preserve the audit trail.

**Live behavior:** Saving a quality discovered the prefixed warp/weft rates automatically. Both appeared as “Owner review needed,” with source “Saved costing” and usage linked to the saved quality. Review confirmation cleared the due count and showed the next review date. Changing the weft rate from ₹220/kg to ₹240/kg showed the previous rate, retained history, and stated that future estimates use the new rate while existing snapshots remain unchanged. The Activity view showed both the rate change and the earlier owner confirmation.

**Assessment:** **Covered.** This is strong support for the May-to-July repricing scenario.

### 3. Save a quality and first costing

**User need:** Save a recipe once, then reuse it without reconstructing all the yarn, loom, overhead, and commercial inputs.

**Live behavior:** Save as New Quality created the named quality and v1 snapshot. The Saved Costings library grouped the quality, displayed the latest cost and snapshot count, and exposed the history.

**Assessment:** **Covered.** The distinction between “Save quality/recipe,” “Save costing snapshot,” and “Create new version” is understandable and supports the correct mental model.

### 4. Reuse the same quality after rates change

**User need:** Apply the new yarn rate to the same construction, see the resulting cost, and save a separate version for the new period.

**Live behavior:** Reopening the same quality picked up the current weft rate of ₹240/kg. Saving the new snapshot produced v2; the previous snapshot remained at its original ₹220/kg and ₹43.99/m, while v2 showed ₹240/kg and ₹45.17/m. The toast explicitly said the existing snapshots were not changed.

**Friction:** The reused form did not visibly restore the prior commission, transport, and quantity state as expected. Re-entering the non-zero commercial inputs caused the “Review unusual values” warning because those sections were switched off while their values were non-zero. The user must understand a hidden-state interaction before saving.

**Assessment:** **Core scenario covered, but the reuse contract is ambiguous.** The UI should either restore all persisted commercial values and enabled flags, or reset all values consistently and explain that choice. It should not leave values that are both non-zero and visually inactive.

### 5. Higher production month and overhead change

**User need:** Re-cost the same quality when factory output changes, so the monthly expense allocation reflects the new production month.

**Live behavior:** Opening v2 and switching from direct overhead to monthly expenses divided by output showed the saved monthly expense base of ₹620,000 and an output baseline of 54,000 m/month. Changing actual output to 70,000 m/month changed the displayed factory expense to ₹8.86/m and production cost to ₹46.03/m. The app warned that the output exceeded rated loom capacity and required review. “Create new version” made the change explicit, and the save dialog offered “Save Version Only” versus “Save Version & Update Quality.” Saving Version Only produced v3 and preserved v2.

**Assessment:** **Covered.** This is the second half of the requested May/July workflow and gives the owner a defensible explanation for a cost movement.

### 6. Compare costings and explain the decision

**User need:** Compare old and new snapshots without mentally diffing two forms.

**Live behavior:** v1→v2 comparison showed the weft rate moving ₹220→₹240, weft cost moving ₹12.99→₹14.17/m, production cost moving ₹43.99→₹45.17/m, and suggested price moving ₹51.69→₹53.04/m. v2→v3 isolated the overhead method/output change and showed production cost moving ₹45.17→₹46.03/m. The dialog clearly stated that the difference is **New minus Old** and included detailed yarn, waste, overhead, margin, commercial, and price sections.

**Assessment:** **Covered.** Comparison is one of the highest-value Base features because it answers “why did the price change?” rather than only showing the new number.

### 7. Internal and customer-facing documents

**User need:** Review the economics internally, then send a professional price document without exposing internal information.

**Live behavior:** The Internal Cost Estimate preview showed business name, detailed cost breakdown, yarn assumptions, commercial assumptions, monthly output, production cost, suggested price, break-even, margin, and expected profit. The Customer Quotation preview showed business, customer, validity, quantity, quoted price, quotation value, notes, and GST/document disclaimer. It did not contain production cost, commercial assumptions, break-even, margin, overhead, or expected profit.

**Assessment:** **Covered.** Internal and customer PDF generation/download were verified, and the customer preview excluded production cost, commercial assumptions, break-even, margin, overhead, and expected profit.

### 8. Customer “sent” lifecycle

**User need:** Know whether a quotation was merely generated/shared or actually sent.

**Live behavior:** After customer PDF generation, the Base standalone costing dialog displayed “Share PDF” and “Mark as sent.” “Mark as sent” did not produce a durable status or a quotation ledger entry for the Base costing; the UI briefly showed an updating/archive-like state. The live behavior is inconsistent with the Base standalone-costing model, where quotation status transitions are not supported.

**Assessment:** **P1 product defect.** Base should either hide “Mark as sent” for standalone costings and treat the document as download/share-only, or create a real quotation record through an explicitly supported workflow. The current action makes the user believe a status was recorded when it was not.

### 9. Draft recovery and starting points

**User need:** Avoid losing half-completed work and avoid accidentally overwriting a saved quality when exploring a variant.

**Live behavior:** Reloading an unfinished form showed an “Unsaved Cost Estimate” banner with Restore, Rename, Discard, and Keep for later. Restore repopulated the full form. “Use as Starting Point” loaded the recipe, rate, overhead, commercial, and quantity values into “New quality” and required a new quality name before saving, preventing a silent duplicate.

**Assessment:** **Covered.** This is valuable for real-world browser interruptions and experimentation.

### 10. Archive, restore, export, and plan boundary

**User need:** Retire old rates/records without losing auditability, take data out, and understand what Base does not include.

**Live behavior:** Rate and costing archive dialogs explicitly said archive is not deletion and provided restore paths. Organization export generated a timestamped JSON filename and a new Recent organization exports audit entry. Billing showed an active annual Weavly Estimator plan. The Orders route showed the Full Suite upgrade wall and kept Base costing/export functionality in scope.

**Assessment:** **Covered.** The permanent-retention behavior should be made clear in product documentation because operators may expect deletion.

## Highest-priority gaps and recommendations

### P1 — Repair Base Settings rendering

The live Settings page promises the exact configuration surfaces a new Base owner needs, but the two relevant sections are empty. The local page still mounts `FactoryCostProfile` and `TemplateManager`, so this should be investigated as a production rendering/data-loading defect rather than treated as a missing product concept.

**Recommended acceptance test:** On a fresh Base account, Settings renders default expense/output controls and the saved-quality manager; editing a default persists after reload; the estimator uses the saved baseline; saved qualities are visible and actionable.

### P1 — Make saved-quality reuse explicit and deterministic

Separate the persisted “quality recipe” from “commercial terms for this costing.” On reuse, show a small summary such as:

- Current Rate Book values applied.
- Prior commercial assumptions restored or reset.
- Quantity restored or reset.
- Overhead method and output baseline.

Then keep commission/transport values and their enablement state aligned. The user should not see an inactive section with a non-zero value that will still be included.

### P1 — Remove quotation-only status actions from Base standalone exports

For Base standalone costings, keep Download PDF and Share PDF. Hide Mark as sent, quotation status, sent timestamp, and quotation-history affordances unless the record is a supported quotation. If status tracking is valuable, define a separate Base-safe “exported/shared” event rather than exposing a rejected quotation transition.

The local implementation currently gates the main quotation ledger by quotation capability but passes `onMarkAsSent` into the export dialog for any draft record. See [QuotesClient.tsx](/Users/rajpatel/Projects/textile%20Saas/app/%28dashboard%29/owner/quotes/QuotesClient.tsx:1382) and [CostingExportDialog.tsx](/Users/rajpatel/Projects/textile%20Saas/components/estimator/CostingExportDialog.tsx:154).

### P2 — Improve the change-review handoff

The version flow is already good. Make it even more useful by presenting a compact “What changed since v2?” summary before the user reaches the unusual-value warning: yarn-rate changes, overhead method/output, commercial terms, and quality-baseline choice. The current version dialog is the right place to reinforce the decision.

### P2 — Treat customer reuse as a measured follow-up, not a Base expansion by default

Base currently supports customer fields in a document but does not need a full CRM. Repeated manual entry will eventually be friction, but first collect evidence about repeat-customer volume. A lightweight customer alias or recent-customer picker may be enough; do not add a production/customer module prematurely.

### P2 — Defer trend dashboards, spreadsheet import, and monthly activity reporting

These can be useful later, but they are not required to close the core costing job. The current rate history and snapshot comparison are a better foundation. Add telemetry or conduct short owner interviews first:

- How often does the same quality get re-costed?
- How often is the reason a rate change versus overhead/output versus margin policy?
- How many saved costings are actually reused?
- How often is a customer PDF regenerated because of changed terms?

## Recommended release regression suite

1. Settings renders Base defaults and saved-quality controls after a cold load.
2. Save quality v1; reload; open it; confirm all intended recipe and commercial-state fields are explicit.
3. Change a current yarn rate; confirm the quality’s future estimate updates while v1 remains unchanged.
4. Save v2 for the same quality; compare v1/v2 and confirm the rate delta is visible.
5. Change monthly output; confirm the warning, change summary, and v3 save path.
6. Repeat-save an unchanged version; confirm no duplicate snapshot.
7. Generate internal and customer documents; assert internal economics are absent from the customer document.
8. Confirm Base standalone customer export does not expose a non-functional quotation-status action.
9. Restore a draft and use a starting point; confirm neither mutates the original snapshot.
10. Archive and restore a rate and costing; confirm historical values and active-list behavior.
11. Generate organization export and verify the downloaded file outside the in-app Browser.
12. Confirm Premium routes remain upgrade-walled for the Base account.

## Bottom line

The Base Plan is close to a credible owner-facing costing desk. The May-to-July rate-change scenario and the higher-production-overhead scenario are both represented well by the current versioning, comparison, and audit model. The next work should be concentrated on making configuration available, making reuse semantics unambiguous, and removing the misleading Base quotation-status action. Those changes would materially improve trust without expanding Base into the Full Suite.
