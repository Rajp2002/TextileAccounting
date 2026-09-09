# Standalone delivery challans

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
