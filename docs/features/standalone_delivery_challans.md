# Standalone delivery challans

**Orange/Legacy lines (2026-10-15):** each lot row says whether it comes from orange stock or untagged legacy stock; confirmation and reversal move each part from its own stock. See [legacy fabric stock](legacy_fabric_stock.md).

**Yarn tracking:** Once an owner starts [yarn inventory](yarn_inventory.md), confirmation also deducts the linked costing's yarn kg atomically with fabric metres. A missing formula or insufficient yarn prevents confirmation. Allowed physical reversals restore the original yarn weight; receipt and payment changes remain neutral to stock.

Implemented on the aggregate quality stock base (`b1ee8719`, stock PR #94). New dispatches live at `/owner/dispatches` for owners with production access (Base and eligible legacy plans). No party, customer account, sales order, reservation or individual taka stock record is created. Customer details and selling price are entered for each transaction.

## Workflow

1. Select a quality and enter sender, customer, delivery and optional transport/GST/reference details. Enter each lot identifier and metres; identifiers are document lines. Save, edit and print drafts without changing stock.
2. Confirm that the dispatch has left. The issued document is frozen. The RPC shares the stock implementation's tenant advisory lock, reconciles production, checks sufficient stock and records one linked negative movement. Optimistic versions reject stale edits; request IDs make retries idempotent and reject changed retry payloads. An uncertain browser save retains its original request in session storage for recovery after reload.
3. Confirm received as sent, or enter acknowledged total metres and an optional HTTPS evidence reference. A difference remains under review until accepted or disputed. Accepting changes chargeable metres only; disputing retains sent-metres charges. Neither changes stock. Receipt corrections require a reason, preserve prior events, and can reopen history.
4. Record dated payments with method/reference. Positive and negative charge adjustments require reasons. Overpayment is explicit customer credit, not another payment. Refunds cannot exceed current credit. Payment, refund and adjustment entries can each be reversed once with a reason. Correct an erroneous entry by reversing it and recording a replacement. Dependent corrections that would make paid money or total charges negative are rejected.
5. Automatic history requires confirmed receipt, no unresolved difference, and exactly zero balance. Credits remain active until refunded or explicitly resolved with a reasoned charge adjustment. Later changes can reopen an archived transaction.

Example: 7 lots (75, 70, 85, 92, 88, 77, 98 metres) total 585 m. Sending from 1,000 m leaves 415 m. At Rs40/m, initial charges are Rs23,400. Accepting 583 m changes charges to Rs23,320; stock stays 415 m. If Rs23,400 was already paid, Rs80 remains customer credit until refunded.

## Corrections and preserved data

Issued sender/customer/quality/lot/rate fields cannot be silently rewritten. An erroneous sent dispatch can be reversed only before receipt and before any financial entries, with a reason and explicit confirmation that all fabric is physically back in stock. That action records a positive reversal movement and preserves the original document. Create a fresh independent draft for the replacement. General partial physical returns and post-receipt document amendments are outside this release; do not use receipt discrepancies as stock returns.

The migration is additive. It creates `delivery_challans`, immutable `delivery_challan_events`, a number sequence and one owner RPC; it extends stock movement kinds. Existing production, legacy dispatch, party and financial rows are not deleted or backfilled into the new transaction model. Historical legacy workflows remain at `/owner/dispatches/legacy`, with their existing Full Suite access boundary. Their pre-cutover stock accounting must not be debited again against new quality stock.

Apply the stock migration before `20260908235614_standalone_delivery_challans.sql`. Apply the forward migration transactionally before enabling this UI. No production migration or deployment was performed by this task. New tables have explicit SELECT grants and owner RLS; all writes go through the authenticated, writable-organization, production-owner checked RPC. No anonymous or service-role execute grant is added.

## Documents and GST scope

Print preview uses the original transaction snapshot and three labelled copies with repeatable table headers, totals, transport/references and signature/receipt space. The browser's **Print / Save as PDF** dialog downloads the PDF and supports Indian-script customer text using browser fonts. Evidence is retained as an HTTPS reference, not uploaded or fetched by Weavly; owners must maintain access to external evidence. No public tracking token exposes customer details.

Checked official sources on 9 September 2026: [CBIC Rule 55](https://taxinformation.cbic.gov.in/content-page/explore-rules/1000146/1000001) and [CBIC published rules](https://cbic-gst.gov.in/pdf/01012020-CGST-Rules-2017-Part-A-Rules.pdf). Rule 55 specifies the circumstances for transportation using a challan and its required particulars, serial numbering and copy labels. A challan is not a universal replacement for a tax invoice or applicable e-way bill. The application includes GSTIN, HSN, place-of-supply, tax-reference, invoice and e-way-bill fields; it does not determine tax treatment, calculate/file GST, generate statutory invoices or integrate with government e-way-bill services. Applicable monetary taxes/charges must also be recorded as explicit financial adjustments; descriptive tax-reference text does not change the balance.

## Verification

Run `CHALLAN_TEST=1 STOCK_TEST_DATABASE_URL=postgresql://...@127.0.0.1:PORT/postgres node scripts/qa/quality-stock-db.mjs`. This creates a disposable database, replays the existing migrations, verifies the stock baseline and runs the challan scenarios. It refuses remote database hosts. 30 scenarios cover stock, concurrency, retry payloads, receipts, acceptance/dispute, payment/refund/adjustment reversal, re-opening, negative-charge prevention and access isolation. Four unrelated external WhatsApp schedule migrations are skipped because they require Supabase extensions.

The browser harness (`scripts/qa/challan-browser/server.mjs`) renders the actual production React components and executes the actual SQL functions as the fixture owner. It accepts only a retained disposable loopback database. Its test transport does not verify hosted Supabase auth or PostgREST; those boundaries are separately checked in server code and role/RLS integration tests. Do not expose this test server externally.

Final checks: 1,426 Vitest tests passed (one existing skip); TypeScript, changed-file ESLint and the production build passed. Browser verification created the seven-lot example, confirmed dispatch, accepted 583 m, recorded two payments, and verified automatic history plus a persisted 415 m stock balance. The three-copy PDF was exported and visually checked.

## Keyboard entry and live preview

The draft editor groups fabric/rate, sender/customer/delivery and numbered lot rows. Transport/GST/reference fields are in an expandable section. The row number is automatic; the lot identifier is free text and retains leading zeros. Enter advances from lot ID to metres, then to the next lot row, creating an empty row when needed. Shift+Enter moves backwards using the estimator's shared navigation helper. Enter in an input never submits the draft; Save draft is explicit. Duplicate lot IDs and invalid metre values do not advance.

A desktop document preview updates while typing. On mobile, running totals stay visible beneath the entry area and a Live preview button opens the full preview. Lot counts and total metres include completed, identified rows only. Untouched empty rows are omitted on save; partially entered rows must still be completed and are never silently dropped. Changes to rows or selling rate recalculate the preview with decimal arithmetic.

Usability verification: browser-tested header-to-lot navigation, automatic rows, Enter/Shift+Enter, duplicate IDs, invalid quantities, decimal entry, leading-zero identifiers, editing/removing rows, mobile entry/preview, and saving two lots with an untouched trailing row. Example 225 m + 275 m displays 2 lots / 500 m / Rs20,000 at Rs40/m. Focused draft-entry tests, all 1,460 unit tests (one existing skip), TypeScript and changed-file lint pass. Screenshots are in `output/challan-ux/`. No schema migration is needed for these entry improvements.

### Agreed payment dates and partial payments

Drafts accept an optional **Full payment due date** and **Agreed payment terms** note (up to 1,000 characters). The date starts blank, has no suggested credit periods, and accepts any valid calendar date chosen by the owner. Both fields update in the live preview. Existing challans remain undated after migration.

Outstanding issued dispatches show **Due date not set**, **Due in N days**, **Due today**, or **Overdue by N days**, using the Asia/Kolkata business date. Drafts, reversals, fully paid balances and customer credits do not receive overdue labels. Receipt disputes remain visible separately. Partial payments continue through Record payment: each receipt reduces the balance without changing the due date; one full payment uses the same flow.

After issue, **Change payment terms** requires a 3–500 character reason. Owners can replace or clear the date and note. The immutable event stores the previous date/note alongside the new payload, actor and timestamp; optimistic version checks and request IDs prevent stale updates and duplicate events. Changing terms does not move stock or change money. Printed copies retain the date and terms in the document as issued; current collection terms appear in dispatch details and history.

Implementation migration: `20260909045727_challan_payment_terms.sql`. Apply before deploying the updated application. It has been tested against disposable local PostgreSQL, not applied to production in this implementation session.

Verification: 32 stock/challan database scenarios pass, including custom dates, blank dates, invalid-date rejection, multiple partial payments, deadline extension/clearing, previous-term audit, unchanged issued snapshot, unchanged stock/balance, stale versions, retry deduplication and final settlement. Unit suite: 1,464 passed, one skipped. TypeScript and targeted ESLint checks pass. Browser evidence is under `output/challan-payment-terms/` (draft live preview, partial-payment audit, issued print).

## Print from the draft editor and branded document

The draft editor has a **Save & print** button beside Save draft. It is disabled until the draft could be saved: every required field (marked `*`), a quality, a positive selling rate, and at least one complete lot with no unfinished or duplicate rows. GST, transport, payment terms and the other optional fields stay optional, but a value in them must be valid (a real due date, an HTTPS evidence link). A line under the buttons names what is still missing. The check, `challanPrintReadiness` in `lib/challan-draft-entry.ts`, runs the same schema the server applies on save, so it cannot allow a print the save would refuse.

A challan prints with its number, which saving assigns, so the button saves first and then opens `/owner/dispatches/[id]/print` in a new tab. The tab is opened inside the click so popup blockers allow it, and is closed again if the save fails. A saved draft left unchanged skips the save, so printing does not add a version or a history entry. If the browser blocks the tab anyway, the saved challan opens and Preview / Print / Save PDF in its details still works. Printing never moves stock.

Every printed copy now carries the Weavly masthead used by the costing documents: the Weavly wordmark, the factory's name from its account (`organizations.name`, falling back to the consignor name on the challan), the navy and saffron bar, and a "Generated by Weavly" footer. The editor's live preview carries the same masthead (brand bar, Weavly mark, factory name, document type), so what you type is previewed in the document it prints on. The three labelled copies, required particulars, repeated table headers and one-copy-per-page breaks are unchanged; a seven-lot challan fits one A4 page per copy. The factory name is not stored on the challan: a reprint shows the account's current name, while the consignor, customer and lots stay as issued. No migration is needed. Per-factory logos are not part of this release.
