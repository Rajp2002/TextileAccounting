# Weavly Master Feature Document

This document conjoins the focused feature analyses in `docs/features/` into one master reference. The individual feature documents remain the source-specific breakdowns for each module; this file is the unified product feature view as of May 1, 2026.

## Source Feature Documents

- `docs/features/advances_management.md`
- `docs/features/estimator_and_quotes.md`
- `docs/features/dispatches_and_tracking.md`
- `docs/features/floor_operations_supervisor_dashboard.md`
- `docs/features/production_and_packing.md`
- `docs/features/inventory_and_stock.md`
- `docs/features/party_ledger.md`
- `docs/features/orders_and_market_runs.md`
- `docs/features/payroll_and_settlements.md`
- `docs/features/compliance_and_admin.md`

## Unified Feature Map

Weavly's feature set forms one connected operating loop for Indian weaving factories:

1. Estimate fabric cost and generate a quote.
2. Convert the approved quote into an order, or create a speculative market run.
3. Assign looms, orders, and workers on the floor.
4. Log production by shift and optionally pack produced meters into fabric packages.
5. Manage yarn, beams, and grey stock.
6. Dispatch packed fabric with GST-aware Tax Invoice cum Delivery Challans and public tracking.
7. Record receivables, payments, shortage credit notes, and party balances in the ledger.
8. Settle payroll from production logs, recover worker advances, and send WhatsApp payslips.
9. Maintain audit trails, compliance packs, legal notices, grievances, DPAs, and tenant controls.

## Cross-Feature Dependencies

| Feature | Depends On | Feeds Into |
| --- | --- | --- |
| Estimator & Quotes | Factory cost profile, loom assumptions, yarn rates | Orders, Market Runs |
| Orders & Market Runs | Quotes, machines, parties | Supervisor Dashboard, Stock, Dispatches |
| Floor Operations & Supervisor Dashboard | Machines, workers, orders | Production Logs, Payroll, Owner Analytics |
| Production & Packing | Supervisor shift logs, order assignments | Grey Stock, Dispatches |
| Inventory & Stock | Yarn inflows, beam records, packed fabric | Production planning, Dispatches |
| Dispatches & Tracking | Orders, grey stock, parties | Party Ledger, public tracking, shortage handling |
| Party Ledger | Dispatch invoices, receipts, adjustments | Receivables, GST/accounting exports |
| Payroll & Settlements | Production logs, worker rates, advances | Worker payments, advance recovery, payslips |
| Advances Management | Worker profiles, payroll settlements | Payroll deductions, worker balance visibility |
| Compliance & Admin Console | Organization profiles, audit logs, legal records | Compliance exports, lockdowns, governance |

## Feature Analysis: Estimator & Quotes

### Overview

The Estimator is the commercial heart of Weavly. It allows factory owners to calculate the precise "Landed Cost" of a fabric before they even start production. Once an estimate is refined, it can be saved as a Quote and sent to a Party (Trader).

### Why It's Needed

In weaving factories, margins are often thin. A small miscalculation in yarn weight, wastage, or overhead can turn a profitable order into a loss. Owners need a scientific way to price their fabric that accounts for every variable: yarn rates, GST, crimp, shortage, and factory overheads.

### Pain Points Solved

- **Guesswork Pricing**: No more "feeling out" a price. Every paisa is accounted for.
- **Hidden Costs**: Automatically includes factory overheads (electricity, maintenance, salaries) which are often forgotten.
- **Complex Math**: Handles the "denier to grams" and "ends to weight" conversions that usually require complex Excel sheets or manual registers.
- **Template Management**: Easily reuse successful fabric configurations instead of re-entering data.

### Old Workflow Translation

- **Old way**: Owner uses a calculator and a paper "Parchi" to do rough math. They might forget to add the 5% GST on yarn or miss the 2% transport cost.
- **Weavly way**: A guided UI where the owner enters the quality parameters (Warp, Weft, Reed Space, PPI) and the system provides an instant, itemized cost breakdown.

### Value Provided

- **Profit Protection**: Ensures a minimum desired margin (up to 100%).
- **Faster Quoting**: Respond to Trader inquiries in seconds by applying a saved template.
- **Scenario Analysis**: Instantly see how a change in yarn rate or target price affects the bottom line.

### User Interaction

1. **Input Quality**: User enters Warp and Weft rows (Denier, Ends, Rate, GST).
2. **Configure Loom**: Selects Loom Type (Waterjet, Rapier, etc.) which auto-fills RPM and Power usage.
3. **Adjust Overheads**: System pulls factory-wide overheads (synced from Settings) and allocates them per meter based on monthly output.
4. **Save/Quote**: User saves as a "Fabric Template" for internal use or generates a "Quote" for a specific Party.

### Technical Logic

- **State Management**: Uses a complex React `useReducer` to manage dozens of interdependent variables in real-time.
- **Calculation Engine**: Centralized logic in `lib/estimator.ts` and `lib/finance.ts` ensures mathematical accuracy.
- **Server Actions**: Uses `upsertFactoryCostProfile` to keep factory-wide baseline costs (like electricity rates) synced across all estimates.

### Relation to Other Features

- **Orders**: An approved Quote is the required starting point for a new Order.
- **Settings**: Factory cost profiles (overhead items) are pulled into every estimate.
- **Market Runs**: Estimates can be used to start speculative production without a quote.

### Output/Result

- **Fabric Template**: A reusable configuration saved to the database.
- **Quote Record**: A timestamped price offer linked to a Party.
- **Cost Stack**: A visual pill-based breakdown showing Warp vs Weft vs Overhead vs Wage.

## Feature Analysis: Order Management & Market Runs

### Overview

Orders represent the live commitments a factory has with its customers (Parties). Market Runs are a specialized type of "speculative" order where the factory produces fabric for its own stock to sell later in the market.

### Why It's Needed

Factories need to track production progress against specific deadlines and quantities. Without centralized tracking, it's difficult to know which looms are free, which orders are overdue, and how much fabric is ready to be dispatched.

### Pain Points Solved

- **Deadline Blindness**: Owners get real-time alerts for orders at risk of missing their deadlines.
- **Machine Under-utilization**: Clearly see which machines are assigned to which order and move them as needed.
- **Speculative Risk**: Market Runs allow owners to keep the factory running even when customer orders are low, with full cost tracking.

### Old Workflow Translation

- **Old way**: A "Whiteboard" or "Chopdi" (register) listing active orders. Supervisors manually count rolls at the end of the day to estimate progress.
- **Weavly way**: A digital dashboard showing `Progress %`, `Pace Index` (are we fast enough?), and `Days Remaining`. Progress is updated automatically as supervisors log production.

### Value Provided

- **Operational Clarity**: Real-time visibility into what the factory is currently "weaving".
- **Customer Trust**: Provide accurate delivery estimates to Traders.
- **Financial Control**: Track the "Total Order Value" and "Landed Cost" to ensure the order remains profitable throughout its lifecycle.

### User Interaction

1. **Creation**: Converts an approved Quote into an Order by setting a `Target Quantity` and `Deadline`.
2. **Machine Assignment**: Owner assigns specific machines to the order via a drag-and-drop or checklist interface.
3. **Monitoring**: Tracks the "Progress Bar" and "Pace Index" on the Orders dashboard.
4. **Completion**: When target is reached, the order is marked "Completed", freeing up machines for the next task.

### Technical Logic

- **Progress Tracking**: Calculated via an RPC that aggregates `production_logs` against the `total_target_meters` of the order.
- **Pace Index**: A specialized calculation (`meters_produced / (meters_targeted / total_days) * days_elapsed`) to determine if the current speed will meet the deadline.
- **Access Codes**: Sensitive edits (like changing the target quantity after production has started) require an "Owner Access Code" for security.

### Relation to Other Features

- **Estimator**: Every Order/Market Run must originate from a fabric estimate.
- **Supervisor Dashboard**: Assignments made here dictate what the supervisor sees on the floor.
- **Stock & Dispatches**: Finished fabric packages are linked to the Order for tracking.

### Output/Result

- **Order Progress Dashboard**: Visual cards with pace and deadline markers.
- **Machine Assignments**: Linkages between looms and specific fabric qualities.
- **Market Run Stock**: Fabric produced without a party is tagged as "Market Stock".

## Feature Analysis: Floor Operations & Supervisor Dashboard

### Overview

The Supervisor Dashboard is the primary interface for the factory floor. It combines worker attendance, machine assignment, and production logging into a single, mobile-optimized "unified" view.

### Why It's Needed

Floor operations are chaotic. Workers change shifts, machines break down, and production data needs to be captured accurately twice a day. Supervisors need a tool that is fast, resilient to poor internet, and easy to use with one hand.

### Pain Points Solved

- **Paper Trail Lag**: No more waiting for the end of the shift to enter data from a notebook.
- **Assignment Confusion**: Clearly shows which worker is on which machine and which fabric they should be weaving.
- **Breakdown Downtime**: Instant status updates (Running/Idle/Maintenance) allow owners to see why a loom is stopped.
- **Data Entry Errors**: Bulk logging with "Duplicate Guard" prevents supervisors from accidentally entering the same meters twice.

### Old Workflow Translation

- **Old way**: Supervisor walks the floor with a "Hajiri" register and a "Production" register. At 6 PM, they hand these to the owner, who enters them into an Excel sheet.
- **Weavly way**: Supervisor walks the floor with their phone. They tap to assign a worker, enter the "Closing Meters" from the loom, and tap "Submit". Data is instantly synced to the owner's dashboard.

### Value Provided

- **Real-time Oversight**: Owner can see floor activity from anywhere.
- **Accurate Payroll**: Piece-rate wages are derived directly from these logs, eliminating disputes.
- **Historical Context**: "Copy Previous Shift" saves 10 minutes of setup time every morning.

### User Interaction

1. **Shift Setup**: Select Date and Shift (Day/Night). Use "Copy Yest." to quickly fill assignments. Each loom assignment supports two worker slots: `Weaver` (`primary_worker_id`, required) and `Helper/Khadki` (`helper_worker_id`, optional).
2. **Machine Check**: Tap machine cards to update status (e.g., mark as "Service" for a mechanical failure).
3. **Logging**: Enter the loom counter reading for each loom. If the counter was reset during the shift, check "Counter was reset this shift"; production for that row becomes the closing reading and the opening reading is stored as null.
4. **Submission**: Tap "Submit Shift Logs" to save all entries. Use "Submit & Pack" if physical fabric packages need to be created immediately.

### Technical Logic

- **Unified State**: Manages a complex grid of machines, workers, and orders using a responsive client-side state.
- **Offline Recovery**: Uses `localStorage` to cache meter entries. If the browser refreshes or internet drops, the numbers are preserved.
- **Atomic Sync**: `upsertShiftAssignment` ensures that worker/order changes are saved instantly even before the final submission.
- **Two-Worker Loom Assignment**: `shift_assignments` stores `primary_worker_id`/`worker_id` for the weaver and optional `helper_worker_id` for the helper/khadki. The supervisor dashboard displays both slots. If no helper is assigned, the single operator receives the full configured piece-rate.
- **Payroll Split**: For a shift with both workers, payroll creates separate earnings:
  - Weaver: `shift_meters * weaver_rate_per_meter`.
  - Helper: `shift_meters * helper_rate_per_meter`.
  The helper rate is snapshotted on the shift assignment so later worker rate edits do not rewrite historical payroll.
- **Counter Reset Handling**: When `closing_reading < opening_reading`, the UI warns as before. If the supervisor marks "Counter was reset this shift", then `shift_meters = closing_reading` and `opening_reading = null` for that production log.
- **Duplicate Guard**: A server-side check prevents logging the same (Machine, Date, Shift) combination unless an Owner Access Code is provided.

### Relation to Other Features

- **Orders**: The dashboard pulls active orders to link production to them.
- **Payroll**: Production logs are the "source of truth" for piece-rate wage calculations.
- **Machines & Workers**: Consumes the master lists managed by the owner.

### Output/Result

- **Production Logs**: Immutable records of meters produced per machine/worker/shift.
- **Machine History**: A log of maintenance categories (Mechanical, Electrical, Warp Break) and notes.
- **Real-time Dashboard**: Live "Running" vs "Idle" machine counts for the owner.

## Feature Analysis: Production & Packing (Submit & Pack)

### Overview

While "Production Logging" records *how much* was woven, "Packing" records the *physical items* created. The "Submit & Pack" feature allows supervisors to turn a meter entry into a "Fabric Package" (roll or bale) in the inventory system with a single tap.

### Why It's Needed

In many factories, production is logged, but the physical rolls sit in a pile until someone manually counts them. This leads to "Ghost Inventory" - you know you produced 500 meters, but you don't know where it is or if it's been packed and graded.

### Pain Points Solved

- **Inventory Mismatch**: Ensures that what is logged as produced is also logged as physical stock.
- **Grading Lag**: Allows for immediate packing and quality tagging on the floor.
- **Dispatch Delays**: You can't dispatch what isn't in stock. Packing creates the stock records needed for dispatches.

### Old Workflow Translation

- **Old way**: Supervisor writes down meters. Later, a "Folder" or "Packer" manually creates a "Takka" (roll) list on paper. The owner then types this list into a ledger.
- **Weavly way**: Supervisor logs 100 meters on Machine 5 and clicks "Submit & Pack". The system instantly creates a new "Fabric Package" in the `stock` table, ready for dispatch.

### Value Provided

- **Physical Accountability**: Every meter produced is accounted for as a physical unit.
- **Streamlined Workflow**: Combines two operational steps (Logging + Stock Entry) into one.
- **Dispatch Readiness**: Stock is immediately available to be added to a dispatch invoice/challan.

### User Interaction

1. **Entry**: Supervisor enters meters for multiple machines.
2. **Action**: Instead of "Submit Shift Logs", they click "Submit & Pack".
3. **Outcome**: System logs the production and creates one "Bulk Package" per machine-order combination for that shift.
4. **Refinement**: Owner can later go to the Stock module to split bulk packages into individual rolls or bales.

### Technical Logic

- **RPC Logic**: Uses `packProductionIntoBulkPackages` which takes the shift logs and performs a batch insert into the `fabric_packages` table.
- **Order Linkage**: Each package is automatically linked to the `order_id` from the shift assignment, preserving the chain of custody.
- **Tenant Scoping**: All packages are org-scoped to ensure factory data isolation.

### Relation to Other Features

- **Stock Management**: This is the primary "Inflow" for the Stock module.
- **Dispatches**: Only "Packed" packages can be dispatched to a customer.
- **Orders**: Updates the "Produced" vs "Packed" stats for the order.

### Output/Result

- **Fabric Packages**: New entries in the stock ledger with unique package numbers.
- **Updated Inventory**: Increases the "Total Grey Stock" for the factory.
- **Production Audit**: A link between the production log and the physical package ID.

## Feature Analysis: Inventory & Stock Management

### Overview

Weavly tracks three critical layers of inventory:

1. **Yarn Stock**: Raw material (cones/bags).
2. **Beams**: Wound yarn ready for the loom.
3. **Grey Stock**: Finished fabric packages (rolls/bales) ready for dispatch.

### Why It's Needed

Inventory is tied up capital. Knowing exactly how many bags of yarn are in the warehouse or how many meters of a specific quality are in stock prevents over-buying and helps in planning future production.

### Pain Points Solved

- **Stock Outs**: Alerts when yarn for an active order is running low.
- **Wastage Tracking**: Compare "Yarn Issued" vs "Fabric Produced" to identify excessive wastage.
- **Warehouse Confusion**: Clearly see what is "Available" vs "In-Transit" vs "Dispatched".

### Old Workflow Translation

- **Old way**: A "Godown" register where a clerk writes down every bag of yarn that arrives. Fabric rolls are counted manually once a week.
- **Weavly way**: Digital ledgers for Yarn, Beams, and Fabric. Entries are made as soon as material arrives or fabric is packed.

### Value Provided

- **Working Capital Efficiency**: Don't buy yarn you already have.
- **Production Continuity**: Ensure beams are ready before a loom goes "Idle".
- **Dispatch Accuracy**: Ensure you have enough packed stock to fulfill an upcoming dispatch.

### User Interaction

1. **Yarn Inflow**: Owner records new yarn purchases (Inward).
2. **Beam Inflow**: Supervisor/Owner records when yarn is wound onto a beam.
3. **Grey Stock**: Auto-populated via "Submit & Pack" on the supervisor dashboard.
4. **Inspection**: Owner can "Inspect" a fabric package to mark it as "A Grade" or "B Grade" before it is available for dispatch.

### Technical Logic

- **Package-level Tracking**: Grey stock is tracked as individual `fabric_packages`, each with its own ID, weight, and meter count.
- **Atomic Operations**: Inventory increments and decrements are handled via server actions to ensure data integrity.
- **Relationship Mapping**: Beams are linked to specific machines, and fabric packages are linked to specific orders.

### Relation to Other Features

- **Production & Packing**: The primary source of Grey Stock.
- **Dispatches**: Dispatches remove items from "Grey Stock".
- **Estimator**: Real-world inventory costs can be used to update estimator baselines.

### Output/Result

- **Inventory Dashboard**: Charts and tables showing current stock levels.
- **Stock Audit**: A history of all movements (Inward, Internal, Outward).
- **Grading List**: A list of packed fabric rolls categorized by quality grade.

## Feature Analysis: Dispatches & Tracking

### Overview

The Dispatch module handles the physical movement of fabric from the factory to the Trader. For normal Surat grey fabric sales, dispatch is also the sale event, so the generated document is a **Tax Invoice cum Delivery Challan**, not a standalone Delivery Challan. It provides a compliant invoice, a movement document, and a public tracking link for the customer.

### Why It's Needed

Once fabric leaves the factory, it enters a "Black Box". Owners need to know if the Trader has received it, if there was a shortage, and when they can expect payment. Traders also appreciate being able to track their orders without calling the factory owner.

### Pain Points Solved

- **The "Has it arrived?" Call**: Traders can check the status themselves via a secure link.
- **Shortage Disputes**: Traders can log "Received Meters" on the tracking portal, allowing the owner to instantly see any discrepancies (Shortages).
- **Manual Billing**: One-click generation of professional Tax Invoice cum Delivery Challans with QR codes.
- **GST Compliance Risk**: Dispatch documents include GSTIN, HSN 5407, GST split, taxable value, and sequential invoice number for GSTR-1 filing.

### Old Workflow Translation

- **Old way**: A carbon-copy bill/challan book. One copy goes with the driver, one stays in the book. If the driver loses it, the record is gone.
- **Weavly way**: A digital dispatch record. The Tax Invoice cum Delivery Challan is generated as a PDF, and a "Tracking Link" is sent to the Trader via WhatsApp.

### Value Provided

- **Professional Image**: Factory looks tech-forward and reliable to the Trader.
- **Instant Reconciliation**: Shortages are flagged immediately, not weeks later during payment.
- **Logistical Control**: Track which "Transporter" or "Vehicle" was used for each batch.

### User Interaction

1. **Creation**: Select an Order and pick specific "Available" fabric packages from stock.
2. **Dispatch**: Click "Confirm Dispatch". System generates a Tax Invoice cum Delivery Challan PDF and a unique Tracking Token.
3. **Sharing**: Send the "Tracking Link" to the Trader.
4. **Trader Portal**: Trader opens the link, sees the roll list, and clicks "Confirm Receipt" (optionally entering received meters).
5. **Shortage Adjustment**: If received meters are lower than sent meters, prompt the owner: "Create adjustment for {shortage_meters}m shortage?". On confirmation, create a linked credit note entry in the party ledger.

### Technical Logic

- **Stock Integration**: Confirming a dispatch moves fabric packages from `available` to `in_transit` status.
- **Invoice Document**: Dispatch generates a "Tax Invoice cum Delivery Challan" with:
  - Factory GSTIN and Trader GSTIN.
  - HSN Code `5407` for synthetic filament woven grey fabric.
  - Taxable value as `meters * rate_per_meter`.
  - GST at 5%.
  - CGST 2.5% + SGST 2.5% when the Trader state matches the factory state, otherwise IGST 5%.
  - Total invoice value including GST.
  - Sequential invoice number suitable for GSTR-1 filing.
- **Ledger Debit**: The automatic party ledger debit is the total invoice value including GST. The ledger stores base taxable value and GST amount separately for reconciliation.
- **E-Way Bill Awareness**: If total invoice value exceeds `50000`, show a non-blocking banner: "This dispatch requires an E-Way Bill before the vehicle departs. Generate on the GST portal." Link to `https://ewaybillgst.gov.in`, and allow the owner to save an optional `eway_bill_number` on the dispatch record.
- **Shortage Credit Note**: When a shortage is confirmed by the Trader portal or owner-side receipt entry, the owner can create a one-tap credit note for `shortage_meters * rate_per_meter + GST`. The credit note is linked to the original dispatch invoice and labelled with i18n key `ledger.creditNote.shortageAdjustment`.
- **Public Portal**: A specialized Next.js route `/track/[token]` that provides a read-only (and receipt-confirmable) view of the dispatch without requiring a login.
- **QR Codes**: Every invoice/challan includes a QR code that links directly to the public tracking portal.

### Relation to Other Features

- **Stock Management**: Dispatches consume items from the Grey Stock.
- **Orders**: Updates the "Dispatched Quantity" for the order.
- **Party Ledger**: Automatically creates a debit entry for the full invoice value, with taxable value and GST tracked separately.

### Output/Result

- **Tax Invoice cum Delivery Challan (PDF)**: A professional GST-compliant document with factory/party details and itemized roll list.
- **Public Tracking Link**: A URL (e.g., `weavly.app/track/xyz`) for the Trader.
- **Shortage Alert + Credit Note Prompt**: A notification if the Trader records fewer meters than sent, followed by an optional linked ledger credit note.

## Feature Analysis: Party Ledger

### Overview

The Party Ledger is the financial record-keeping system for interactions with Traders (Parties). It tracks sales (dispatches), payments received, and the running balance for each customer.

### Why It's Needed

Factory owners often deal with dozens of Traders. Keeping track of who owes how much for which batch of fabric is a full-time job. A digital ledger ensures that no bill is missed and every payment is recorded.

### Pain Points Solved

- **Payment Delays**: Clearly see "Overdue" balances and follow up with Traders.
- **Billing Disputes**: Link every ledger entry to a specific Tax Invoice cum Delivery Challan or Invoice.
- **Tax Readiness**: Export ledger data for accounting and GST filing.

### Old Workflow Translation

- **Old way**: A massive physical ledger book where each page belongs to a Party. Bills are handwritten and stuck into the book.
- **Weavly way**: A clean, digital ledger that auto-populates when a dispatch is confirmed and allows for quick entry of "Payment Received" notes.

### Value Provided

- **Financial Health**: Instant view of "Total Receivables" (money owed to the factory).
- **Professionalism**: Share professional-looking ledger statements with Traders via PDF or WhatsApp.
- **Audit Accuracy**: Every entry is timestamped and linked to an order or dispatch.

### User Interaction

1. **Selection**: Select a Party to view their specific statement.
2. **Transaction Entry**: Manually record a "Payment Received" (Cash, Bank, Cheque).
3. **Automatic Entries**: Dispatch invoices automatically create a "Debit" entry (Party owes money) in the ledger for the total invoice value including GST.
4. **Statement Sharing**: Export the ledger as a PDF to send to the Trader for reconciliation.

### Technical Logic

- **Tabbed Interface**: Organized into "Transactions", "Pending Invoices", and "Analytics" for a comprehensive view.
- **Real-time Totals**: Summarizes debits and credits to show the "Net Balance" at the top of the page.
- **GST Split**: Invoice debits store taxable value, GST percent, GST amount, and net invoice value separately. For Surat/Gujarat parties, GST is split into CGST 2.5% + SGST 2.5%; for out-of-state parties, it is IGST 5%.
- **Receivables Aging**: Party summary and transaction list show aging buckets:
  - Current `< 30 days` in normal text.
  - Overdue `30-60 days` in amber.
  - Overdue `> 60 days` in red with a "Follow up" badge.
- **Shortage Credit Notes**: Shortage adjustments are stored as linked credit note entries against the original dispatch invoice, using i18n key `ledger.creditNote.shortageAdjustment`.
- **Soft Deletion**: Ledger entries are carefully managed to ensure the audit trail is never broken.

### Relation to Other Features

- **Dispatches**: Tax Invoice cum Delivery Challans are the primary driver of ledger debits.
- **Orders**: Ledger entries are often tagged with an Order ID for context.
- **Settings**: Party profiles are managed in the central settings/parties area.

### Output/Result

- **Ledger Statement**: A list of all financial interactions.
- **Net Balance**: The current amount owed by or to the Party.
- **Aging Breakdown**: Current, 30-60 day overdue, and >60 day overdue receivables.
- **PDF Export**: A formal financial document for reconciliation.

## Feature Analysis: Payroll & Settlements

### Overview

Weavly's Payroll module automates the complex task of calculating and paying wages for both piece-rate (meter-based) weavers and fixed-salary staff. It handles statutory deductions, advance recoveries, and delivery of itemized payslips.

### Why It's Needed

Payroll is the biggest friction point in factory management. Disputes over meters, missing advances, and "over-payment" are common. Owners need a transparent, audit-ready system that the workers can trust.

### Pain Points Solved

- **Advance Recovery Stress**: Automatically calculates how much to deduct from a worker's salary to pay back their advances, while respecting the 50% legal cap.
- **Meter Disputes**: Since wages are derived directly from the supervisor-logged meters, there is a single "Source of Truth".
- **Statutory Compliance**: Automatically calculates PF (Provident Fund) and ESI (Insurance) for eligible workers.
- **Messaging Overhead**: No more printing and handing out slips; every worker gets an itemized breakdown on WhatsApp.

### Old Workflow Translation

- **Old way**: Owner sits with a "Parchi" list of meters and an "Advance" book. They manually subtract debts and write a total on a slip of paper.
- **Weavly way**: Owner clicks "Settle" for a worker. The system pulls all meters for the month, calculates gross pay, subtracts advances (up to the cap), adds bonuses/fines, and generates a PDF payslip.

### Value Provided

- **Financial Precision**: Every paisa of wage and debt is tracked.
- **Worker Retention**: Transparency and professional WhatsApp payslips build trust with the workforce.
- **Legal Protection**: Adheres to wage deduction caps and provides an audit trail for all payments.

### User Interaction

1. **Review**: Owner opens the Payroll dashboard and sees "Pending" settlements for the month.
2. **Configuration**: Sets the "Cycle Start Day" (e.g., the 1st or 7th of every month).
3. **Settlement**: Clicks "Settle". A drawer shows the itemized breakdown (Meters x Rate - Advances - PF/ESI + Bonuses).
4. **Finalize**: Clicks "Confirm Payment". System creates a `payroll_settlements` record and fires a WhatsApp notification.

### Technical Logic

- **Atomic RPC**: `settle_worker_payroll` ensures that the wage payment, advance deduction, and ledger update happen as a single database transaction (ACID compliant).
- **Snapshot Rates**: Uses `worker_rate_snapshot` from production logs to ensure that if a rate changes mid-month, previous production is still paid at the old rate.
- **Deduction Cap**: Logic in `lib/finance.ts` ensures that automatic advance deductions never exceed 50% of the gross wage, preventing worker hardship and legal issues.
- **Edge Functions**: Uses Supabase Edge Functions to generate PDFs and interface with the Meta WhatsApp Cloud API.

### Relation to Other Features

- **Supervisor Dashboard**: Provides the meters used for piece-rate calculations.
- **Advances**: Settlements are the primary way workers pay back their advances.
- **Party Ledger**: Factory wage expenses are indirectly reflected in the overall business health.

### Output/Result

- **Payroll Settlement Record**: An immutable record of the payment.
- **PDF Payslip**: A professional, itemized document.
- **WhatsApp Summary**: A message sent to the worker with their take-home pay and a link to the breakdown.

## Feature Analysis: Advances Management

### Overview

In the Indian textile industry, "Advances" are interest-free loans given to workers for personal needs. Weavly tracks these advances, provides receipts to workers, and manages the automatic recovery of these loans during payroll.

### Why It's Needed

Worker advances are a massive hidden liability. Owners often lose track of who owes what, leading to financial leakage. Workers also need clarity on their outstanding balance to avoid feelings of being "cheated" by the factory.

### Pain Points Solved

- **Balance Confusion**: Both owner and worker can see the current "Outstanding Balance" at any time.
- **Manual Deduction Errors**: No more forgetting to deduct an advance during the monthly settlement.
- **Audit Trails**: Every advance given and every rupee recovered is logged with a timestamp and reason.

### Old Workflow Translation

- **Old way**: A small notebook (Chopdi) where the owner writes "Rs 5000 given to Ramesh". When Ramesh gets paid, the owner tries to remember to subtract it and crosses it out.
- **Weavly way**: Owner records a "New Advance" in the app. Ramesh gets a WhatsApp confirmation. During payroll, Weavly automatically calculates the deduction and updates the balance.

### Value Provided

- **Cash Flow Control**: Real-time visibility into the total "Money on the Floor" (sum of all worker debts).
- **Reduced Friction**: Automated deductions remove the need for "negotiation" during payday.
- **Worker Stability**: Clear debt tracking helps workers manage their finances better.

### User Interaction

1. **Issuance**: Owner enters worker name, amount, and category (e.g., "Medical", "Travel").
2. **Notification**: System sends a WhatsApp "Advance Receipt" to the worker.
3. **Recovery**: During the "Settle" action in the Payroll module, the system suggests a deduction amount.
4. **Tracking**: Owner views the "Advances Ledger" to see a history of all loans and repayments for a specific worker.

### Technical Logic

- **Ledger-based Tracking**: Advances are stored as debits in a worker-specific ledger.
- **Settlement Bridge**: The `settle_worker_payroll` RPC looks up the current `total_outstanding` for the worker and applies the deduction logic.
- **Reversal Safety**: If a payroll settlement is "Unsettled", the system automatically reverts the advance recovery, restoring the worker's debt balance.

### Relation to Other Features

- **Payroll**: The primary mechanism for advance recovery.
- **Workers**: Advances are linked to the worker profile.
- **WhatsApp Integration**: Sends instant receipts for every advance transaction.

### Output/Result

- **Advance Record**: Timestamped entry in the `worker_advances` table.
- **WhatsApp Receipt**: Confirmation message sent to the worker.
- **Outstanding Balance**: A real-time number shown on the worker's profile and payroll card.

## Feature Analysis: Compliance & Admin Console

### Overview

The Admin Console is the "Governance" layer of Weavly. It manages sensitive legal and data requirements, such as Data Processing Agreements (DPAs), legal notices, and worker grievances.

### Why It's Needed

As factories scale, they face increasing regulatory pressure (e.g., DPDP Act, labor laws). Centralizing compliance documentation and response workflows ensures that the factory owner is protected against legal liabilities.

### Pain Points Solved

- **Compliance Fragility**: No more losing paper DPAs or forgetting to respond to a legal notice.
- **Audit Stress**: A single place to show regulators all signatures and grievance resolutions.
- **Data Privacy**: Ensures that all factory-trader interactions are governed by a valid legal agreement.

### Old Workflow Translation

- **Old way**: Physical folders for "Legal" and "Staff Issues". These are often disorganized and hard to search during an emergency.
- **Weavly way**: A structured database of all notices, agreements, and grievances with expiration dates and priority levels.

### Value Provided

- **Risk Mitigation**: Protects the factory from fines and legal disputes.
- **Worker Harmony**: A formal grievance system shows workers that their issues are taken seriously.
- **Centralized Oversight**: Owners (or their lawyers) can oversee multiple factories' compliance status from one screen.

### User Interaction

1. **DPA Management**: Admin creates a new DPA version and assigns it to factories.
2. **Notice Registry**: Record incoming legal or government notices and track the "Response Deadline".
3. **Grievance Handling**: Workers or supervisors can log a grievance, which the Admin then reviews and "Resolves".
4. **Lockdown State**: In case of a major data or security breach, Admins can trigger a "Lockdown" to protect tenant data.

### Technical Logic

- **Template Versioning**: DPAs are versioned to ensure that old signatures remain valid while new requirements are rolled out.
- **Signed Proofs**: Uses Supabase Storage to store PDF/image proofs of physical signatures.
- **Role-based Access**: Admin routes are strictly guarded to ensure only authorized personnel can see factory-wide compliance data.

### Relation to Other Features

- **Settings**: Factory profiles link to the compliance status.
- **Workers**: Grievances are often linked to specific worker profiles.
- **Audit Logs**: Every compliance action is recorded in the system-wide audit log.

### Output/Result

- **Compliance Scorecard**: A bird's-eye view of which factories are "Compliant" vs "At Risk".
- **Grievance Resolution Log**: An audit trail of how worker issues were addressed.
- **Exportable Compliance Packs**: Bundles of documents for legal or regulatory review.

## Master Notes

- The feature documents are intentionally preserved as module-level references. This master document should be updated when a feature-level document changes materially.
- The strongest product chain is `Estimator -> Quote -> Order/Market Run -> Supervisor Logging -> Packing -> Stock -> Dispatch -> Ledger -> Payroll/Advances -> Compliance/Audit`.
- WhatsApp appears across operational trust surfaces: advance receipts, dispatch tracking links, payroll payslips, and business notifications.
- Auditability is a repeated theme across finance, stock, payroll, dispatch, and compliance; any future feature should preserve tenant scoping, immutable history where appropriate, and clear reversal logic.
