# P11 Stock audit — tour decision and blocked specification

Status: **the wrong tour is removed in GT-08. PI-06 and PI-07 are fixed (2026-09-30); the dedicated tour (GT-B1) is still BLOCKED only on the senior designer finishing §D against the fixed page.** Gujarati/Hindi: native review pending, not done.
Shared rules: [`GUIDED_TOURS_REFINEMENT_PLAN.md`](../../GUIDED_TOURS_REFINEMENT_PLAN.md) D-11. Evidence: [`audit/stock-and-dispatch.md`](../audit/stock-and-dispatch.md) §3.

## A. Identity and evidence

| Item | Value |
| --- | --- |
| Route | `/owner/stock/audit` → `InventoryAuditClient.tsx`; reached only from the "Audit Inventory" buttons on Fabric and Yarn Stock (`QualityStockClient.tsx:129`, `YarnStockClient.tsx:107`) |
| Entitlement | Base (owner). |
| Workflow | Pick an audit date → record physical counts per fabric quality and yarn → review variances → Adjust (writes an `audit_adjustment` movement) → Finalize (freezes the snapshot); CSV export. |
| Yarn you own (owner rule D-19, 2026-09-27) | Total yarn = loose yarn in Yarn Stock **plus** yarn held in finished fabric not yet dispatched, worked out from each quality's costing kg per 100 m. Already implemented: KPI cards "Yarn Embodied in Fabric" and "Total Represented" and the Material Position table (`InventoryAuditClient.tsx:298-325, 366-520`; formula text at 375-379). The audit tour must teach this. |
| Role (owner rule D-20, 2026-09-27) | The full dated count of all fabric and yarn, kept as a finalized record. Routine counts are **not** done here: owners use Correct balance on Fabric Stock and Yarn Stock, because a routine count is about produced fabric in stock and loose yarn available. |
| Tour today | The **Fabric Stock** tour (`audit/page.tsx:16-19`). |

## B. Diagnosis

| ID | Sev | Type | Finding |
| --- | --- | --- | --- |
| SA-1 | Major | Tour | The page runs a tour for a different page (opening stock, correct balance) and records Fabric completion. |
| SA-2 | Major | Product | Changing the date keeps the old audit id, mixing two audits (PI-06). **Fixed 2026-09-30:** the page asks for the new date only, ignores older answers, and the database lets an audit id decide the date. |
| SA-3 | Major | Product | The adjustment shown can differ from the one applied (PI-06). **Fixed 2026-09-30:** the page shows count minus stock as of the audit date and sends it; the database applies that same variance on top of current stock and refuses it if it changed. |
| SA-4 | Major | Product | The whole page is English only (PI-07). **Fixed 2026-09-30:** every label, toast, dialog and aria-label reads `stockAudit.*` keys in en/gu/hi, numbers use the owner's language locale, and the loading skeleton title is translated. Gujarati/Hindi wording is unreviewed by a native speaker. |
| SA-5 | Minor | Product | "No variances recorded…" shows when nothing has been counted; no way back to an earlier date after finalizing. **Fixed 2026-09-30:** an empty Reconciliation tab now says nothing is counted yet, and the date picker stays enabled after finalizing (a finalized date loads read-only). |

## C. Decision

1. **Now (GT-08):** render `InventoryAuditClient` without `StockGuidedTour`. The page gets no guide slot. Owners learn that the page exists and what it is for from the Fabric and Yarn tours (`correct.detail` in both).
2. **Later (GT-B1, BLOCKED):** a dedicated tour, specified below, may be built only after all of these hold:
   - ~~PI-06 fixed (date change loads the right audit; the adjustment shown equals the one applied)~~ **done 2026-09-30**;
   - ~~PI-07 fixed (page strings through translation keys in en/gu/hi)~~ **done 2026-09-30**;
   - ~~the owner confirms which correction path owners should use for a routine count~~ **resolved 2026-09-27 (D-20):** routine counts use Correct balance; the audit is the full dated record.

Why not now: a tour that teaches a date picker which mixes audits, or a page Gujarati and Hindi owners cannot read, would make the problem look like the owner's mistake.

## D. Outline for GT-B1 (to be completed when unblocked)

Seven steps, live page (PS-LIVE; `data-tour-anchor="audit.*"`, all proposed): `sa-purpose` (header: a full dated count of all fabric and yarn, kept as a record; for regular counts use Correct balance on Fabric Stock or Yarn Stock, D-20), `sa-date` (audit date), `sa-yarn-owned` (Material Position: loose yarn + yarn in unsold fabric = total yarn you own; the in-fabric part comes from each quality's kg per 100 m, so fabric already dispatched no longer counts), `sa-count` (Record count on a fabric row), `sa-variance` (read system vs counted), `sa-adjust` (Adjust writes the difference; cannot be undone except by another adjustment), `sa-finalize` (Finalize freezes the audit; handoff to the first Record count button). Copy is written when the page's behavior is fixed, following the plan's §4.8 rules and glossary.

## E. Comprehension check (for GT-B1)

"At year end you count every quality and yarn on one day. Which page do you use, how much yarn do you own if 100 kg is loose and 200 m of a quality using 10 kg per 100 m is still in the godown, and what does Finalize change?" Expected: Stock audit; 100 + 20 = 120 kg; Finalize freezes that day's counts and adjustments as a record.
