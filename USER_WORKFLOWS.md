# Weavly — Complete User Workflows & Actions

> A comprehensive reference of all workflows, actions, and server interactions available to each user role in the Weavly platform. Organized by role and feature area.

## Table of Contents
1. [Owner — Dashboard & Estimator](#part-a-owner-analytics-dashboard)
2. [Owner — Orders & Machines](#part-c-order-management)
3. [Owner — Workers](#part-e-piece-rate-meter-worker-management)
4. [Owner — Payroll & Advances](#part-h-payroll-settlement-engine)
5. [Owner — Settings, Access Codes & Audit](#part-k-access-code-system)
6. [Supervisor — All Workflows](#overview-the-supervisors-daily-rhythm)
7. [Admin — Compliance & DPDP 2026](#part-l-admin-compliance-dashboard-admin)

---

## PART A: Owner Analytics Dashboard (`/owner/analytics`)

The Owner Dashboard is the **real-time command center** for the factory. It aggregates production data, order health, financial KPIs, and worker output into a single live view — updated the moment any supervisor logs production on the floor.

---

### Workflow A-1: View Real-Time Dashboard

**What It Does**
SSR-renders today's factory snapshot when the owner opens the dashboard. A Supabase Realtime WebSocket subscription is established immediately after page load so all subsequent changes (new production logs, order updates) appear live without any page refresh.

**Why It Exists**
The owner is often not physically on the factory floor. This screen gives the equivalent of walking the entire floor simultaneously — seeing every machine's output, every order's pace, every worker's contribution, all in one view.

**Inputs Required**
None. Data is loaded automatically for Surat Today (`Asia/Kolkata` timezone).

**How It Functions**
1. Server Component fetches: active orders, today's production logs, worker assignments, KPI aggregates.
2. Client-side WebSocket subscription opens on channel `org-{org_id}`.
3. When any production log is inserted by a supervisor, the WS fires → KPI strip and order cards re-query and repaint within ~1 second.

**Data Displayed**

| Section | Content |
|---|---|
| **Live Orders Panel** | One card per active order: party name, quality, meters produced vs target, progress %, Pace Index, forecast date, machine assignments |
| **KPI Strip** | Today's meters, today's piece-rate wages, pro-rated fixed payroll — with synchronization indicators and branded icons |
| **Production Trend** | High-precision scaling bar graph showing the last 7 days of production history, synchronized with today's metrics |
| **Worker Breakdown** | Accordion: each worker's machines, meters logged per machine, rate snapshot, row total in ₹ |

**Real-Time Resilience**
- **Connection Status**: UX indicators ("Syncing...", "Live") show the health of the Supabase Realtime connection.
- **Improved Cold-Boot**: Restrictive authentication guards have been removed to ensure the dashboard loads instantly on returning to the app.

**Value Derived**
- Catch pace issues before they become deadline failures
- See wage burn rate in real-time against production output
- Identify underperforming workers or machines immediately

---

### Workflow A-2: Rewind Dashboard to Historical Date

**What It Does**
Owner selects a past date using the date picker to view all production logs, KPIs, and order progress as they were on that specific day.

**Why It Exists**
Disputes over payroll, customer queries about output on a specific date, or performance reviews require looking back at specific historical days without generating a report manually.

**Inputs Required**
- `Date`: Any past date (date picker, defaults to today)

**How It Functions**
1. Owner selects a past date from the date picker.
2. All queries re-run with `date = selected_date` filter.
3. KPI strip and order cards recalculate using logs from that specific day.
4. Realtime subscription is **not active** for past dates (read-only historical view).

**Value Derived**
- Full audit-quality retroactive view of any production day
- Resolve worker disputes by showing exact meters logged on a given date
- Compare different days' output side by side (manual)

---

### Workflow A-3: Assign Machines to Orders (from Dashboard)

**What It Does**
Owner clicks the machine assignment block on an order card and selects which active machines should be fulfilling that order.

**Why It Exists**
Production flow changes constantly — a new order comes in, a machine breaks down. The owner needs to re-route production without going to a separate screen.

**Inputs Required**
- `Order ID`: Derived from the card being edited (no manual input)
- `Machine IDs`: Multi-select from active machines in a dropdown

**Action Triggered**
`assignOrderToMachines(orderId, machineIds[])` (owner/actions.ts)

**How It Functions**
1. Owner clicks "Assign Machines" on an order card.
2. A dropdown appears showing all active machines, indicating which order each is currently on.
3. Owner selects one or more machines.
4. On save:
   - All machines previously on this order have `current_order_id` cleared.
   - Selected machines have `current_order_id` set to this order's ID.
5. Dashboard repaints immediately showing new assignments.

**Validation**
- UUID validation on both order ID and machine IDs.
- Machines not in the org are rejected (RLS).

**Value Derived**
- Instantly re-route production capacity to priority orders
- Prevent machines from sitting unassigned (zero production attribution)

---

### Workflow A-4: Edit Fixed Worker Salary (Inline, from Dashboard)

**What It Does**
Owner clicks a fixed worker's salary field in the Worker Breakdown accordion and edits it inline without navigating away.

**Why It Exists**
Salary changes are time-sensitive. When a pay revision happens mid-month, the owner needs to update it immediately so the next payroll cycle calculates correctly.

**Inputs Required**
- `Worker ID`: Derived from the row (no manual input)
- `Monthly Salary (₹)`: Positive number, entered inline

**Action Triggered**
`updateFixedWorkerSalary(workerId, salary)` (owner/actions.ts)

**How It Functions**
1. Owner taps the salary figure in the Fixed Workers accordion row.
2. An inline editable field appears pre-filled with current salary.
3. Owner types the new salary and presses Enter or taps Save.
4. Server validates: positive number, worker belongs to org.
5. Both `/owner/analytics` and `/owner/fixed-workers` are revalidated.

**Value Derived**
- Reduces friction for routine salary updates
- Ensures future payroll calculations are immediate correct

---

## PART B: Weavly Estimator (`/owner/estimator`)

The Estimator is the **mandatory gateway** for all production. No new order can exist without a quote. It calculates the precise landed cost per meter using Surat-standard textile formulas and allows a one-click "Publish to Production Floor."

---

### Workflow B-1: Build a New Cost Estimate

**What It Does**
Owner inputs fabric specifications and cost parameters. The estimator computes the landed cost per meter, profit margin, and full cost breakdown in real-time — entirely client-side, no server round-trip needed for calculation.

**Why It Exists**
Negotiating a rate without knowing your exact cost is how mills lose money. This tool ensures every meter accepted is mathematically profitable before the order is committed.

**Inputs Required**

| Section | Input | Unit | Purpose |
|---|---|---|---|
| **Warp Setup** | Warp rows: yarn count (denier), beam ends, yarn rate | ₹/kg | Calculates warp yarn cost per meter |
| **Weft Setup** | Weft rows: picks, reed space, denier, yarn rate | Picks/inch | Calculates weft yarn cost + determines loom speed |
| **Per-Pick Cost** | Weaver rate | Paisa/pick | What the loom worker earns per pick of weft |
| **Factory Sections** | Warping rate, sizing rate, winding rate | ₹/kg | Processing charges |
| **Overhead** | Fixed salary staff items, factory expenses | ₹/month | Allocation per meter based on monthly output |
| **Monthly Output** | Estimated total factory output | Meters | Used to allocate overhead per meter |
| **Profit Margin** | Margin slider | % | Applied on top of landed cost |
| **Order Quantity** | Total meters to quote for | Meters | Used for total order profit calculation |
| **GST Settings** | Rate + inclusive/exclusive toggle | % | Applied to final landed cost |

**How It Functions**
1. Owner loads Estimator — optionally selects a saved template to pre-fill all inputs.
2. As inputs change, the engine (`lib/estimator.ts`) computes in real-time:
   ```
   Warp Cost/m = Σ(beamEnds × denier × yarnRate / 9000) × (1 + shortage%)
   Weft Cost/m = Σ(picks × denier × yarnRate / 9000)
   Pick Cost/m = Σ(picks) × perPickCostPaisa
   Processing/m = (warpingRate + sizingRate + windingRate) × totalYarnWeight / totalMeters
   Overhead/m  = Σ(monthlyItems) / monthlyOutputM
   Landed Cost  = sum of all above + commission + transport
   Sale Price   = landedCost / (1 − marginPct)
   ```
3. Live output card updates showing each cost line + final landed cost + sale price + per-meter profit.

**Output Display**
```
Grey (Warp) Cost:    ₹ 7.20/m
Grey (Weft) Cost:    ₹ 4.80/m
Pick Cost (Weaver):  ₹ 9.28/m
Warping + Sizing:    ₹ 1.10/m
Overhead Allocation: ₹ 0.42/m
─────────────────────────────
Pure Landed Cost:    ₹22.80/m
Margin: 15%
Sale Price:          ₹26.82/m
Per-meter Profit:    ₹ 4.02/m
Order (5000m):       ₹20,100 total profit
```

**Value Derived**
- Know your exact cost floor before negotiating a party rate
- Prevent accepting orders that look profitable but aren't
- Quantify the total order profit before committing

---

### Workflow B-2: Run Stress Test Scenarios

**What It Does**
After building an estimate, owner clicks "Stress Test" to automatically see how the landed cost changes under three adverse scenarios.

**Why It Exists**
Yarn rates fluctuate weekly in Surat. A quote valid today might lose money if the yarn batch is priced higher. This pre-validates the price's resilience.

**Inputs Required**
None — computed automatically from current estimate state.

**How It Functions**
`runStressTest()` in `lib/estimator.ts` computes three scenarios:

| Scenario | Variable Changed | Shows |
|---|---|---|
| Yarn Rate +5% | All yarn rates × 1.05 | New landed cost |
| Machine Efficiency −15% | Efficiency × 0.85 | New landed cost |
| Picks +5 | Each weft row picks + 5 | New landed cost |

Output is a comparison table: current vs. each scenario's landed cost and margin.

**Value Derived**
- Know in advance if your margin can absorb a yarn price hike
- Decide whether to lock in a yarn rate before accepting a party order

---

### Workflow B-3: Save Estimate as Template

**What It Does**
Owner saves the current fabric specification (warp/weft structure, yarn rates, overhead settings) as a named template for future recall.

**Why It Exists**
Looms often run the same fabric "quality" repeatedly — only the party name and order quantity change. Saving a template means future estimates take seconds, not minutes.

**Inputs Required**
- `Template Name`: Free text (e.g. "60g Georgette — May 2026 Rate")

**Action Triggered**
`saveAsFabricTemplate(data)` (owner/estimator/actions.ts)

**How It Functions**
1. Owner fills the name field and taps "Save as Template."
2. Server inserts into `estimator_templates` table:
   - Full warp_rows and weft_rows recipe arrays (V3 format)
   - Per-pick cost, tape length, yarn shortage %, overhead override
3. Template appears in the template picker on the next visit.

**Value Derived**
- Sub-10-second new estimates for recurring fabric types
- Historical rate snapshots (can save a new template when rates change, keeping old one for reference)

---

### Workflow B-4: Update Template Rates

**What It Does**
Owner opens an existing template and refreshes its yarn rates (warp + weft) without changing the fabric structure.

**Why It Exists**
The fabric structure (reed, picks, denier) stays constant but yarn market rates change. This allows rate-only refresh without rebuilding the entire template.

**Inputs Required**
- `Template ID`: Selected from template list
- Updated `Warp Rows` and `Weft Rows` with new yarn rates

**Action Triggered**
`updateTemplateRates({ id, warpRows, weftRows })` (owner/estimator/actions.ts)

---

### Workflow B-5: Rename or Delete a Template

**What It Does**
Owner can rename a template (fix a typo or update the label when rates change significantly) or soft-delete it (sets `is_active = false`, not a hard delete).

**Actions Triggered**
- `renameTemplate(id, name)` — owner/estimator/actions.ts
- `deleteTemplate(id)` — sets `is_active: false`, soft delete

**Value Derived**
- Keeps the template list clean and current
- Deleted templates are retained in DB for audit purposes

---

### Workflow B-6: Manage Quote Lifecycle

**What It Does**
Allows the owner to manage quotes through standard lifecycle stages (`Draft` → `Sent` → `Accepted` / `Rejected`). Quotes are persisted centrally in the Quotes History dashboard.

**Why It Exists**
Not all estimates are immediately converted to orders. Owners need to track quotes that are pending customer approval and seamlessly convert them to live orders once accepted, without losing the original costing context.

**How It Functions**
1. Owner generates an estimate.
2. Owner clicks "Save Quote" → status `Draft` or "Mark as Sent" → status `Sent`.
3. Quote is persisted to `estimator_quotes`.
4. From the Quotes Dashboard, owner can transition state to `Accepted` or `Rejected`.
5. Only `Accepted` quotes can be converted into Live Orders.

---

### Workflow B-7: Convert Accepted Quote to Live Order

**What It Does**
Once a quote is `Accepted` (owner is satisfied and customer confirmed), it is converted into a live order that immediately appears on the production dashboard.

**Inputs Required**
- `Party Name`: Who the order is for
- `Quality Label`: Free-text fabric name
- `Warp Instruction`: Free-text for supervisors
- `Weft Instruction`: Free-text for supervisors
- `Total Target Meters`: Order quantity
- `Deadline`: Target completion date

**Action Triggered**
`convertQuoteToOrder(data)` (owner/estimator/actions.ts)

**How It Functions**
1. Owner clicks "Convert to Order" on an `Accepted` quote.
2. Server action fires:
   a. Computes `workerRatePerM = Σ(picks) × perPickCostPaisa`.
   b. Inserts into `orders` table with `status: 'active'`, `start_date: today`, and computed `worker_rate_per_m`.
   c. Updates the existing `estimator_quotes` record with `order_id` link.
3. Revalidates `/owner/orders` and `/owner/analytics`.

**Value Derived**
- Every live order has an immutable cost snapshot.
- The `worker_rate_per_m` flows to shift assignments.
- Zero manual order entry — all data flows from the estimate.

---

### Workflow B-7: Load Surat Estimator Templates

**What It Does**
First-time setup shortcut — owner clicks "Load Surat Templates" to instantly populate the Estimator with 5 standard Surat fabric templates (60g Georgette, Japan Satin, Cotton 40s, Micro Crepe, Dani Georgette).

**Inputs Required**
None.

**Action Triggered**
`loadSuratEstimatorTemplates()` (owner/actions.ts)

**Value Derived**
- Removes setup friction for new factories already producing standard Surat fabrics
- Pre-populated fabric architectures that reflect market standards

---


---

## PART C: Order Management (`/owner/orders`)

Orders represent committed customer deliveries. Every order originates from a finalized Estimator quote, inheriting its cost snapshot and worker rate. This module covers all post-creation management actions an owner can perform on live and historical orders.

---

### Workflow C-1: View All Orders with Live Progress

**What It Does**
Loads all `active` and `completed` orders with real-time progress data — meters produced, pace index, forecast date, time elapsed, and machine assignments.

**Why It Exists**
The owner needs a persistent order register beyond the dashboard carousel — a place to see every order's status, sort by deadline, and drill into individual order details without the noise of the analytics KPI strip.

**Inputs Required**
None. Data loaded automatically on page visit.

**Data Source**
`order_progress_summary` view (PostgreSQL) — a pre-computed join of `orders`, `production_logs`, and `machines` that calculates:

| Field | Calculation |
|---|---|
| `total_meters_produced` | `SUM(production_logs.meters)` where `order_id = this order` |
| `progress_percent` | `(meters_produced / total_target_meters) × 100`, capped at 100 |
| `time_elapsed_percent` | `(today − start_date) / (deadline − start_date) × 100` |
| `pace_index` | `(progress%) / (time_elapsed%)` — ≥ 1.0 = on track |
| `assigned_machines_count` | `COUNT(machines WHERE current_order_id = this order)` |

**Value Derived**
- Single source of truth for all customer commitments
- Immediately see which orders are at risk before they miss deadline

---

### Workflow C-2: View Individual Order Detail with Quote Linkage

**What It Does**
Owner clicks into an order to see its full detail — including the original estimator quote's cost breakdown (landed cost, margin, full warp/weft recipe) alongside live production progress.

**Why It Exists**
Enables the owner to compare actual production economics with what was originally quoted — a living profitability audit per order.

**Inputs Required**
- `Order ID`: From URL param (clicking an order card)

**Action Triggered**
`getOrderWithQuote(orderId)` — fetches `order_progress_summary` + linked `estimator_quotes` + active machines list.

**Data Displayed**
- Order header: party name, quality label, warp/weft instructions, status badge
- Progress section: meters produced/target, progress bar, pace index, forecast date
- Quote section (if linked): landed cost/m, quote price/m, margin %, full warp/weft recipe rows
- Machine assignment panel: which machines are currently on this order, with selector to reassign

**Value Derived**
- Post-order profitability visibility: is actual wage cost in line with the quoted worker rate?
- Full traceability: every order links back to why it was priced how it was

---

### Workflow C-3: Edit Order Details

**What It Does**
Owner modifies an active order's editable fields — party name, quality label, warp/weft instructions, notes, target meters, or deadline.

**Why It Exists**
Orders change. A party increases quantity, extends a deadline, or the fabric spec gets adjusted mid-run. The owner needs to update these without recreating the order.

**Inputs Required**

| Field | Type | Notes |
|---|---|---|
| `party_name` | Text | Who the order is for |
| `quality_label` | Text | Free-text fabric name |
| `warp_instruction` | Text | Yarn setup for supervisors (e.g. "50/48 + 70/36") |
| `weft_instruction` | Text | Weft yarn for supervisors |
| `notes` | Text | General floor notes |
| `total_target_meters` | Decimal | New target quantity |
| `deadline` | Date | Extended or brought-forward deadline |

**Action Triggered**
`updateOrderDetails(orderId, data)` (owner/orders/actions.ts)

**How It Functions**
1. Owner opens order detail → taps "Edit."
2. Fields become editable inline or in a slide-out sheet.
3. Owner makes changes → saves.
4. Server validates: RLS ensures org isolation (`org_id` from JWT, never from client).
5. `UPDATE orders SET ...` where `id = orderId AND org_id = profile.org_id`.
6. Revalidates `/owner/orders`.

**Important Note**
Editing `total_target_meters` or `deadline` directly affects the pace index and forecast calculations. The owner should update these together to maintain a coherent picture.

**Value Derived**
- Keeps order data accurate without archiving and recreating
- Supervisor-facing instructions (warp/weft) can be corrected if there was an entry error

---

### Workflow C-4: Change Order Status

**What It Does**
Owner transitions an order between states: `active → completed` or `active → cancelled`.

**Why It Exists**
When a customer order is fully woven and dispatched, it must be marked complete so it stops appearing in the active production view. Cancellations archive the record without deleting historical production logs.

**Inputs Required**
- `Order ID`: From order card/detail
- `New Status`: `completed` or `cancelled`

**Action Triggered**
`updateOrderStatus(orderId, status)` (owner/orders/actions.ts)

**State Machine**
```
active  →  completed  (all meters woven, order dispatched)
active  →  cancelled  (party backed out, order abandoned)
completed / cancelled  →  (no production logs can be added; read-only)
```

**How It Functions**
1. Owner clicks "Mark Complete" or "Cancel Order" on the order card.
2. Confirmation dialog appears (especially for cancellation).
3. Server: `UPDATE orders SET status = newStatus WHERE id = orderId AND org_id = profile.org_id`.
4. Revalidates both `/owner/orders` and `/owner/analytics` — order disappears from active panels.

**Value Derived**
- Keeps the active work queue clean — only current orders show in the production view
- Completed orders remain queryable for historical analysis and payroll audit

---

### Workflow C-5: Delete an Order (Soft Cancel)

**What It Does**
Owner permanently removes an order by setting its status to `cancelled`. Unlike a hard delete, all linked production logs are preserved in the database.

**Why It Exists**
Accidental orders or test entries need to be removed from the active view without destroying the audit trail of any production that may have already been logged against them.

**Inputs Required**
- `Order ID`: From order card

**Action Triggered**
`deleteOrder(orderId)` (owner/orders/actions.ts) — sets `status = 'cancelled'`, does not hard-delete.

**Value Derived**
- Safe removal from the active UI
- Historical production logs remain intact for payroll and audit purposes

---

### Workflow C-6: Assign Machines to Order (from Orders Page)

**What It Does**
Owner selects which machines should be fulfilling a specific order. This is the same action available from the Dashboard but accessed from the dedicated orders page.

**Inputs Required**
- `Order ID`: From order selection
- `Machine IDs[]`: Multi-select from active machines

**Action Triggered**
`assignMachinesToOrder(orderId, machineIds[])` (owner/orders/actions.ts)

**How It Functions**
1. All machines currently linked to this order have `current_order_id` set to `null` (blanket unlink).
2. Selected machines have `current_order_id` updated to this order's ID.
3. This is a bulk replace — not additive — so the resulting state is exactly the machines in the selection.

**Important Constraint**
A machine can only be on one order at a time (`current_order_id` is a single FK). Assigning a machine that is currently on another order implicitly unlinks it from that other order.

**Value Derived**
- Precise production routing — ensures meters logged on that machine count toward the right order
- Changing machine assignments dynamically responds to floor realities (breakdowns, capacity changes)

---

### Workflow C-7: Dispatch Management (Batching & Tracking)

**What It Does**
Owner can group completed production into dispatches linked directly to the parent order. Generates secure, public-facing tracking portals for clients.

**Why It Exists**
Connects production output to actual delivery. Clients need real-time tracking of their batches without having full platform access. Strict RLS ensures isolation of tenant dispatch data.

**How It Functions**
1. Owner opens Dispatch Management for a specific order.
2. Creates a Dispatch Batch (e.g., "Batch 1 - 2000m").
3. System generates a secure `tracking_token`.
4. A public portal (`/track/[token]`) is instantiated, and a QR code is generated.
5. Clients scan the QR code to track the status.

---

## PART D: Machine Fleet Management (`/owner/machines`)

The Owner has full administrative control over the machine fleet — the atomic units of the factory floor. Every action triggers an audit trail entry.

---

### Workflow D-1: Add a New Machine

**What It Does**
Owner registers a new loom or machine in the system, making it available for production.

**Why It Exists**
Every machine that produces meters must be registered so production logs can be attributed correctly, worker assignments can be made, and the owner can see per-machine output.

**Inputs Required**
- `Machine Name`: Text (e.g. "Machine 7", "Loom 12") — must be non-empty after trim

**Action Triggered**
`addMachine(name)` (owner/actions.ts)

**How It Functions**
1. Owner taps "+ Add Machine."
2. Inline name input appears.
3. On save: `INSERT INTO machines (name, org_id, status: 'active')`.
4. Audit trigger fires: logs INSERT event with actor_id = owner's user ID.
5. Machine appears immediately in the list (optimistic update).
6. Revalidates `/owner/machines`.

**Value Derived**
- Expanding the registered fleet as the factory grows
- New machines appear in supervisor production interfaces immediately after creation

---

### Workflow D-2: Rename a Machine

**What It Does**
Owner renames an existing machine — corrects a typo or updates the label (e.g., "Machine 7" → "Dobby Loom A").

**Inputs Required**
- `Machine ID`: From the machine card (no manual input)
- `New Name`: Text, non-empty

**Action Triggered**
`renameMachine(machineId, newName)` (owner/actions.ts)

**How It Functions**
1. Owner clicks the machine name → it becomes an editable field.
2. Owner types the new name and press Enter.
3. Server validates UUID (machine ID) and non-empty name.
4. `UPDATE machines SET name = newName WHERE id = machineId AND org_id = profile.org_id`.
5. Audit trigger logs the name change with old_data/new_data diff.

**Value Derived**
- Keeps machine labels meaningful as the factory evolves
- Every name change is audited — owner can see when and by whom a machine was renamed

---

### Workflow D-3: Toggle Machine Active / Inactive

**What It Does**
Owner marks a machine as `inactive` (temporarily out of service) or restores it to `active` (back in operation).

**Why It Exists**
Machines break down, go for maintenance, or are seasonally decommissioned. Marking them inactive removes them from all supervisor production interfaces without deleting their history.

**Inputs Required**
- `Machine ID`: From machine card
- `Current Status`: Optimistic — derived from the UI state

**Action Triggered**
`toggleMachineStatus(machineId, currentStatus)` (owner/actions.ts)

**How It Functions**
1. Owner taps the status toggle on a machine card.
2. UI immediately reflects the new state (optimistic update).
3. Server: `UPDATE machines SET status = newStatus WHERE id = machineId AND org_id = profile.org_id`.
4. If the server call fails, the UI rolls back to the previous state.
5. Audit trigger logs the status change.

**Downstream Effects When Inactive:**
- Machine disappears from supervisor production logging screen
- Machine disappears from shift assignment dropdowns
- Machine remains visible in the Owner's machine management list with "Inactive" badge
- Machine assignment slots are not cleared (worker assignments are preserved for when it returns to active)

**Value Derived**
- Prevents supervisors from logging production on machines that aren't running
- Historical data and assignments are preserved for when the machine returns to service

---

### Workflow D-4: Delete a Machine (Requires Access Code)

**What It Does**
Owner permanently hard-deletes a machine from the database. This is a destructive, irreversible action protected by a one-time access code.

**Why It Exists**
When a loom is sold or scrapped permanently, it should be removed from the system entirely. The access code requirement creates a two-factor safeguard against accidental deletion.

**Inputs Required**
- `Machine ID`: From machine card
- `Access Code`: 6-character alphanumeric code from the owner's WhatsApp

**Action Triggered**
From Owner's machine view, owner clicks "Delete" → enters access code → `validateAndRotateAccessCode()` is called first, then if valid, machine is hard-deleted.

**How It Functions**
1. Owner clicks "Delete" on a machine card.
2. A dialog prompts: "This action requires your access code."
3. Owner taps "Generate Code" — `generateAccessCode()` fires, code sent to owner's WhatsApp.
4. Owner enters the code in the dialog.
5. Server validates code (SHA-256 hash comparison, timing-safe), checks TTL (15 min), single-use consumption.
6. On valid code: `DELETE FROM machines WHERE id = machineId AND org_id = profile.org_id`.
7. Audit trigger captures the full machine record in `old_data` before deletion (permanent record of what was deleted).

**Security Properties**
- Code is single-use — cannot be reused even within the 15-minute window
- Code is delivered out-of-band (WhatsApp) — attacker with screen access cannot proceed
- Rate-limited: 5 failures → 1-hour lockout (Upstash Redis)

**Value Derived**
- Safe, audited permanent removal of decommissioned equipment
- Two-factor protection prevents accidental or malicious fleet reduction

---

### Workflow D-5: Assign Worker to Machine Shift (Owner)

**What It Does**
Owner assigns a piece-rate worker to a machine's Day or Night shift slot directly from the machine management view.

**Why It Exists**
While supervisors typically handle shift assignments, the owner may need to set up assignments directly — especially for initial configuration or when covering supervisor absence.

**Inputs Required**
- `Machine ID`: From machine card
- `Worker ID`: Dropdown of active piece-rate workers
- `Shift`: `day` or `night`

**Action Triggered**
`updateMachineAssignment(machineId, workerId, shift, isExisting)` (owner/actions.ts)

**How It Functions**
- If a slot already has a worker (`isExisting = true`): `UPDATE machine_assignments SET worker_id = workerId WHERE machine_id = ... AND shift = ...`
- If slot is empty (`isExisting = false`): `INSERT INTO machine_assignments (...)`
- The upsert logic ensures no duplicate slots can exist for the same machine+shift combination.

**Value Derived**
- Correct attribution of production meters to the right worker
- Prevents a machine from operating without a registered worker (meters would not be payable)

---

### Workflow D-6: View Machine Fleet Summary

**What It Does**
Owner sees all machines with their current status, current order, and workers per shift — a complete operational snapshot of the entire fleet.

**Inputs Required**
None.

**Data Displayed per Machine Card**

| Field | Source |
|---|---|
| Machine Name | `machines.name` |
| Status Badge | `machines.status` (active/inactive) |
| Current Order | Order linked via `machines.current_order_id` |
| Day Shift Worker | `machine_assignments WHERE shift = 'day'` |
| Night Shift Worker | `machine_assignments WHERE shift = 'night'` |

**Value Derived**
- Instant overview of which machine is producing what, for which order, with which workers
- Spot idle machines (no order, no worker) that need to be activated

---


---

## PART E: Piece-Rate (Meter) Worker Management

Piece-rate workers are the core of the factory floor. They are paid per meter woven, and their production is tracked on every machine shift. All piece-rate worker data is stored in the `workers` table.

---

### Workflow E-1: Add a New Piece-Rate Worker

**What It Does**
Registers a new weaver or floor worker who will be paid per meter of fabric produced.

**Why It Exists**
Every worker who operates a machine and will appear in production logs must be registered. Unregistered workers cannot be assigned to machines or attributed meters.

**Who Can Perform**
Owner or Supervisor.

**Inputs Required**

| Field | Required | Notes |
|---|---|---|
| `Name` | Yes | Stored in English; auto-transliterated to Hindi/Gujarati on display |
| `PF/ESI Eligible` | Yes | Checkbox — affects payroll compliance display |
| `ESI Number` | If eligible | Text field |
| `PF Number` | If eligible | Text field |

**Action Triggered**
`addMeterWorker(data)` (supervisor/actions.ts)

**How It Functions**
1. Supervisor/Owner opens "Add Worker" sheet.
2. Fills the form and taps Save.
3. Server: `INSERT INTO workers (name, is_active: true, pf_esi_eligible, esi_number, pf_number, org_id)`.
4. Regular Supabase client used — `auth.uid()` is set from JWT, so audit trigger captures the actor correctly.
5. Worker appears in list immediately. Available in machine assignment dropdowns within seconds.

**Value Derived**
- Worker is now attributable in production logs, payroll, and advance tracking
- ESI/PF numbers stored for compliance display on payslips

---

### Workflow E-2: Toggle Worker Active / Inactive

**What It Does**
Marks a piece-rate worker as inactive (e.g., on leave, quit) or restores them to active status.

**Why It Exists**
Inactive workers should not appear in supervisor machine-assignment dropdowns — prevents accidental attribution of meters to someone who is not working. But their historical logs are preserved.

**Who Can Perform**
Owner or Supervisor.

**Inputs Required**
- `Worker ID`: From worker card (no manual input)
- `Current Active State`: Derived from UI

**Action Triggered**
`toggleWorkerActive(workerId, currentActive, table: 'workers')` (supervisor/actions.ts)

**Downstream Effects When Inactive**
- Worker disappears from machine assignment dropdowns immediately
- Worker disappears from production logging interface
- All historical production logs remain unchanged (wage calculations not affected)
- Worker still appears in the Payroll page if they have unsettled logs for the current month

**Value Derived**
- Prevents supervisor errors (logging meters for an absent worker)
- Clean active roster without destroying history

---

### Workflow E-3: Delete a Piece-Rate Worker (Requires Access Code)

**What It Does**
Supervisor initiates a permanent hard-delete of a worker record. Requires a one-time access code from the owner to proceed.

**Why It Exists**
Worker deletions are high-risk — they remove the assignment target for all future logs. The access code ensures the owner is aware and approves every deletion.

**Who Can Perform**
Supervisor initiates the request; Owner approves via WhatsApp code.

**Inputs Required**
- `Worker ID`: From worker card
- `Access Code`: 6-character code obtained from owner

**Action Triggered**
`deleteWorkerWithCode(workerId, accessCode)` (supervisor/actions.ts)

**How It Functions**
1. Supervisor taps "Delete" on worker card → UI shows: "This requires owner approval."
2. Supervisor taps "Request Code from Owner" → `requestAccessCode()` fires.
3. Owner receives WhatsApp: *"[Supervisor Name] is requesting an access code. Code: B7D2A1. Expires in 15 min."*
4. Supervisor enters code.
5. Server validates code: rate-limit check (Upstash) → format check → SHA-256 hash compare → TTL check → single-use consume.
6. On valid: `DELETE FROM workers WHERE id = workerId AND org_id = profile.org_id`.
7. Audit trigger captures the full worker record in `old_data` before deletion.

**Security**
- 5 wrong attempts = 1-hour lockout (Upstash Redis hard ban)
- 5 attempts per 10 min = sliding window rate limit
- Timing-safe comparison prevents timing oracle attacks

**Value Derived**
- Safe, owner-approved permanent removal of ex-workers
- Audit trail records who was deleted, by whom, and when

---

### Workflow E-4: Set Up Worker WhatsApp (Owner)

**What It Does**
Owner enables WhatsApp delivery of payslips and advance receipts directly to the worker's phone.

**Why It Exists**
Most textile workers do not use email. WhatsApp delivery of financial documents gives workers direct access to their own payslip and advance records in their language — satisfying transparency obligations under Indian labour law.

**Who Can Perform**
Owner only.

**Inputs Required**

| Field | Required | Notes |
|---|---|---|
| `Worker ID` | Yes | From worker card |
| `Worker Type` | Yes | `meter` or `fixed` |
| `Phone Number` | Yes | 10-digit Indian mobile (stripped of non-digits) |
| `Language` | Yes | `en` (English), `hi` (Hindi), `gu` (Gujarati) |
| `Consent Given` | Yes | Checkbox — **hard block if false** (DPDP Act compliance) |

**Action Triggered**
`saveWorkerWhatsApp(data)` (owner/actions.ts)

**How It Functions**
1. Owner opens worker card → taps "Set WhatsApp."
2. Fills form with phone, language preference, and explicitly ticks consent checkbox.
3. Server hard-blocks if `consentGiven = false` — no number is saved.
4. Validates: 10-digit number, strips non-digits.
5. Updates `workers` or `fixed_workers` table with `whatsapp_number` and `whatsapp_language`.

**Downstream Effects**
- Worker will now receive payslips via `send-payslip` Edge Function on settlement
- Worker will receive advance receipts via `send-advance-receipt` Edge Function when an advance is recorded
- Messages sent in worker's chosen language (en/hi/gu) using registered Interakt templates

**Value Derived**
- Workers get direct financial visibility without needing to approach the owner
- Builds trust and reduces payroll disputes
- DPDP Act compliance: explicit consent logged before any personal data is sent externally

---

## PART F: Fixed (Salaried) Worker Management (`/owner/fixed-workers`)

Fixed workers — managers, security staff, admin — are paid a fixed monthly salary. Their pay is attendance-weighted (present vs. absent days). Stored in the `fixed_workers` table.

---

### Workflow F-1: Add a New Fixed Worker

**What It Does**
Registers a new salaried employee who will be paid a fixed monthly amount (pro-rated by attendance).

**Who Can Perform**
Owner or Supervisor.

**Inputs Required**

| Field | Required | Notes |
|---|---|---|
| `Name` | Yes | Stored in English |
| `Role` | Yes | e.g., "Manager", "Security", "Admin" |
| `Monthly Salary (₹)` | Yes | Positive number |
| `PF/ESI Eligible` | Yes | Checkbox |
| `ESI Number` | If eligible | |
| `PF Number` | If eligible | |

**Action Triggered**
`addFixedWorker(data)` (supervisor/actions.ts)

**How It Functions**
`INSERT INTO fixed_workers (name, role, monthly_salary, is_active: true, pf_esi_eligible, esi_number, pf_number, org_id)`

**Value Derived**
- Worker is now tracked in the attendance system — daily present/absent marking by supervisor
- Monthly payroll calculation will include this worker's pro-rated salary automatically

---

### Workflow F-2: Edit Fixed Worker Details / Salary

**What It Does**
Owner updates a fixed worker's name, role, or monthly salary. Salary edits immediately affect the next payroll cycle's calculation.

**Who Can Perform**
Owner only (salary edits); Owner or Supervisor (name/role via `upsertFixedWorker`).

**Inputs Required**
- `Worker ID`: From worker card
- Updated fields: name, role, and/or monthly salary

**Actions Triggered**
- `upsertFixedWorker({ id, name, role, monthly_salary })` — owner/actions.ts (full edit)
- `updateFixedWorkerSalary(workerId, salary)` — owner/actions.ts (salary-only inline edit from dashboard)

**How It Functions**
- Full edit: `UPDATE fixed_workers SET name, role, monthly_salary WHERE id = workerId AND org_id = profile.org_id`
- Revalidates `/owner/fixed-workers` and `/owner/analytics` (dashboard re-fetches updated salary for KPI strip)

**Value Derived**
- Salary corrections take effect immediately for the current month's payroll
- Role labels keep the fixed workers list readable at a glance

---

### Workflow F-3: Toggle Fixed Worker Active / Inactive

**What It Does**
Marks a fixed worker as inactive (no longer employed) or restores them to active.

**Who Can Perform**
Owner or Supervisor.

**Action Triggered**
`toggleWorkerActive(workerId, currentActive, table: 'fixed_workers')` (supervisor/actions.ts)

**Downstream Effects When Inactive**
- Worker disappears from the daily attendance marking list
- Worker no longer appears in the payroll page for new cycles
- Historical attendance and payroll records are preserved

---

### Workflow F-4: Delete a Fixed Worker (Requires Access Code)

**What It Does**
Owner permanently hard-deletes a fixed worker. Protected by one-time access code.

**Who Can Perform**
Owner only (unlike piece-rate worker deletion which is supervisor-initiated).

**Inputs Required**
- `Worker ID`: From fixed worker card
- `Access Code`: Owner generates and enters themselves

**Action Triggered**
`deleteFixedWorkerWithCode(workerId, accessCode)` (owner/actions.ts)

**How It Functions**
1. Owner taps "Delete" on fixed worker card.
2. Owner generates access code themselves via `generateAccessCode()`.
3. Code arrives on owner's own WhatsApp.
4. Owner enters code → server validates → hard deletes.
5. Audit trigger captures full record in `old_data`.

**Value Derived**
- Removes terminated salaried staff without polluting future payroll
- Double-confirmation loop (generate → WhatsApp → enter) prevents accidental deletion

---



## PART H: Payroll Settlement Engine (`/owner/payroll`)

The payroll module is the financial backbone of Weavly. It calculates each worker's gross earnings from immutable production log snapshots, deducts outstanding advances under Indian labour law, and produces locked settlement records with optional WhatsApp payslip delivery.

**Core Principle**: Payroll is calculated from `worker_rate_snapshot` values frozen at the time of each production log entry — never from live quality rates. This means rate changes never retroactively affect past earnings.

---

### Workflow H-1: View Payroll for a Month

**What It Does**
Owner selects a month and sees the full payroll roster — every piece-rate and fixed worker with their calculated gross pay, pending advances, net payout, and settlement status.

**Why It Exists**
Monthly payroll calculation across dozens of workers with different rates, partial months, and advance deductions is error-prone manually. This screen automates the maths with legally compliant logic.

**Inputs Required**
- `Month`: Selected from month/year picker (defaults to current calendar month)
- `Cycle Start Day` (optional): If the factory uses a non-standard cycle (e.g., 15th to 14th), configured in payroll settings

**How It Functions**
1. Owner opens `/owner/payroll` and selects a month.
2. For each **piece-rate worker**:
   ```
   Gross Pay = SUM(production_logs.meters × production_logs.worker_rate_snapshot)
               WHERE worker_id = X
               AND date BETWEEN cycle_start AND cycle_end
   ```
3. For each **fixed worker**:
   - If `role = 'daily'`:
     ```
     Days Present = COUNT(attendance WHERE present = true AND date IN cycle)
     Gross Pay = (monthly_salary / 30) × days_present
     (Capped at monthly_salary)
     ```
   - Otherwise (salaried):
     ```
     Gross Pay = monthly_salary (full, no attendance weighting)
     ```
4. Pending advances fetched per worker → displayed as deduction preview.
5. Settlement status badge shown: `Pending` or `Settled`.

**Value Derived**
- Zero manual calculation — all gross pay numbers are mathematically derived from immutable logs
- Side-by-side view of all workers helps spot anomalies (unusually high/low earnings) before settlement

---

### Workflow H-2: Settle a Worker's Payroll (Mark as Paid)

**What It Does**
Owner marks a worker as paid for the selected month. The server atomically calculates gross pay, applies advance deductions (with legal cap), produces a net payout figure, creates an immutable settlement record, and optionally dispatches a WhatsApp payslip.

**Why It Exists**
Settlement is the critical moment where wages become a legal obligation. Weavly makes it atomic (single DB transaction), legally compliant (50% cap), and fully auditable.

**Who Can Perform**
Owner only.

**Inputs Required**
- `Worker ID` + `Worker Type` (`meter` or `fixed`): From payroll card
- `Month`: Selected month (YYYY-MM format)
- `Is Final Settlement`: Toggle — for workers being terminated (overrides 50% advance cap to 100%)

**Action Triggered**
`toggleWorkerPaid(workerType, workerId, month, currentPaid=false, isFinalSettlement)` (payroll/actions.ts)

**How It Functions — Full Atomic Flow (`settle_worker_payroll` RPC)**

The entire settlement runs as a single PostgreSQL function in one transaction:

```
Step 1: Calculate gross pay (server-side, using same formula as H-1 above)

Step 2: SUM all 'pending' advances for this worker

Step 3: Compute deduction cap:
   Normal:  cap = 50% of gross  (Indian Code on Wages, 2019)
   Final:   cap = 100% of gross (termination settlement)

Step 4: Actual deduction = MIN(total_advances, cap)

Step 5: Oldest-first advance loop:
   For each advance (oldest created_at first):
     If advance.amount ≤ remaining_budget → mark 'deducted', link settlement_id
     If advance.amount > remaining_budget →
       Original row → 'deducted' for partial_amount
       New row inserted → 'pending' for remainder (carry-forward)

Step 6: INSERT payroll_settlements:
   gross_pay, advance_deducted, net_payout, carried_forward_debt,
   compliance_flag (true if 50% cap was triggered),
   is_final_settlement, actor_id, month

Step 7: Return JSONB result to caller
```

**UI Display on Settlement Card**
```
┌─────────────────────────────────────────────┐
│ Ramesh Patel              April 2026         │
│ ─────────────────────────────────────────── │
│ Gross Earnings:       ₹4,200.00             │
│ Advances Deducted:   −₹2,100.00  [Cap 50%] │
│ Net Payout:           ₹2,100.00             │
│ Carry-Forward Debt:   ₹  800.00             │
│           [Send Payslip ▸]  [Settled ✓]     │
└─────────────────────────────────────────────┘
```

**Fire-and-Forget: WhatsApp Payslip**
After settlement, if the worker has a registered `whatsapp_number`, the server immediately (non-blocking) calls `send-payslip` Edge Function:
- Generates Interakt template message in worker's `whatsapp_language`
- Sends: worker name, month, gross, deductions, net payout, carry-forward
- Logged in `whatsapp_delivery_log` with status tracking

**Compliance Safeguards**
- 50% cap is enforced at the RPC (database) level — UI cannot override it
- `compliance_flag = true` triggers an amber badge: "50% Cap Applied" in the card
- Carry-forward debt is automatically rolled to the next month's advance total
- Final settlement (termination) mode deducts 100% — must be explicitly toggled

**Value Derived**
- One-tap settlement replaces hours of spreadsheet work
- Legal compliance guaranteed at the DB level — not dependent on UI behaviour
- Immutable settlement record = the payment that happened is preserved forever

---

### Workflow H-3: Unsettle a Worker's Payroll (Reverse Payment)

**What It Does**
Owner reverts a settlement — useful when a gross pay error is discovered or when production logs need to be corrected before finalizing.

**Why It Exists**
Mistakes happen. A supervisor may have logged incorrect meters, or a rate snapshot may have been applied to the wrong worker. Unsettling allows correction before physical payment.

**Who Can Perform**
Owner only.

**Inputs Required**
- `Worker ID` + `Worker Type` + `Month`: From the settled payroll card
- (No access code required — the owner's own role is the authorization)

**Action Triggered**
`toggleWorkerPaid(workerType, workerId, month, currentPaid=true)` → calls `unsettle_worker_payroll` RPC (payroll/actions.ts)

**How It Functions (`unsettle_worker_payroll` RPC)**
```
1. Find settlement record: (org_id, worker_id/type, month)
2. For all advances linked to this settlement:
   → Remove deducted_at, settlement_id → status back to 'pending'
   → Any carry-forward split rows that were created → deleted
3. DELETE payroll_settlements row
4. Production logs for that period unlock (no longer in a settled period)
```

**Important Constraint**
Unsettling restores all deducted advances back to `pending`. If the owner has already physically paid the worker, unsettling in the app reflects a corrective re-settlement — not a refund mechanism.

**Value Derived**
- Graceful error recovery without corrupting advance history
- Production logs become editable again for the correction period

---

### Workflow H-4: Send Payslip via WhatsApp (Manual Trigger)

**What It Does**
Owner manually triggers a payslip WhatsApp message to a settled worker — useful if the automatic fire-and-forget failed or the owner wants to resend.

**Who Can Perform**
Owner only.

**Inputs Required**
- `Settlement ID`: From the settled payroll card (no manual entry — derived from card)

**How It Functions**
Owner taps "Send Payslip" on a settled card → calls `send-payslip` Edge Function with `settlement_id`:
1. Edge Function fetches full settlement details
2. Generates multilingual Interakt template message
3. Delivers to worker's `whatsapp_number` in their `whatsapp_language`
4. Logs delivery attempt in `whatsapp_delivery_log`

**Value Derived**
- Manual resend for failed deliveries
- Lets the owner choose when to send (e.g., after physically handing over cash, then send digital record)

---

## PART I: Advance (Upaad) Management (`/owner/advances`)

Advances are cash payments made to workers before their payroll cycle. Weavly tracks every advance, deducts them at settlement time, and notifies workers via WhatsApp.

---

### Workflow I-1: Record a New Advance

**What It Does**
Owner records a cash advance given to a worker. The advance immediately enters the `pending` deduction queue for the worker's next settlement.

**Why It Exists**
Workers frequently take small cash advances for emergencies. Without tracking, these are lost — owners forget, workers dispute amounts, and payroll becomes a negotiation rather than a calculation.

**Who Can Perform**
Owner only.

**Inputs Required**

| Field | Required | Notes |
|---|---|---|
| `Worker` | Yes | Select from piece-rate or fixed workers |
| `Worker Type` | Yes | `meter` or `fixed` |
| `Amount (₹)` | Yes | Positive decimal |
| `Description` | Yes | Reason: `medical`, `school fees`, `personal`, `other` |

**Action Triggered**
`createAdvance(workerType, workerId, amount, description)` (advances/actions.ts)

**Validation**
`CreateAdvanceSchema` (Zod): all fields required, amount must be positive.

**How It Functions**
1. Owner opens "Record Advance" form on a worker card.
2. Fills amount and reason.
3. Server: `INSERT INTO worker_advances (org_id, amount, description, status: 'pending', meter_worker_id or fixed_worker_id)`.
4. Revalidates `/owner/advances` and `/owner/payroll`.

**Fire-and-Forget: WhatsApp Advance Receipt**
If advance insertion succeeds and the worker has a `whatsapp_number`:
- `send-advance-receipt` Edge Function called (non-blocking)
- Message to worker: *"Advance of ₹X received on [Date]. Reason: [Reason]."*
- Delivered in worker's `whatsapp_language`
- Logged in `whatsapp_delivery_log`

**Value Derived**
- Every advance is documented — no "I don't remember how much I gave" disputes
- Worker receives instant confirmation on their own phone
- Advance automatically appears in the next payroll settlement's deduction queue

---

### Workflow I-2: View Worker Advance History

**What It Does**
Owner views all recorded advances for a specific worker — both pending and already deducted — with dates, amounts, reasons, and settlement linkage.

**Inputs Required**
- `Worker ID` + `Worker Type`: From worker/advance card
- `Status Filter` (optional): `pending` only or `deducted` only or all

**Action Triggered**
`getWorkerAdvances(workerType, workerId, statusFilter?)` (advances/actions.ts)

**Data Displayed per Advance**

| Field | Description |
|---|---|
| Amount | ₹ value of the advance |
| Description | Reason given at recording time |
| Status | `pending` (unpaid) or `deducted` (settled in payroll) |
| Created At | Date advance was recorded |
| Settlement ID | Which payroll settlement deducted this (if status = deducted) |

**Value Derived**
- Full advance history per worker — verifiable by owner and worker
- Deducted advances show which settlement cleared them (complete chain of custody)

---

### Workflow I-3: Delete a Pending Advance

**What It Does**
Owner deletes a pending advance — used to correct a data entry error (wrong amount, wrong worker, duplicate entry).

**Who Can Perform**
Owner only.

**Guard Condition**
**Only `pending` advances can be deleted.** Once an advance has status `deducted` (it was included in a payroll settlement), it cannot be deleted. The owner must unsettle the payroll first if correction is needed.

**Inputs Required**
- `Advance ID`: From advance history list

**Action Triggered**
`deleteAdvance(advanceId)` (advances/actions.ts)

**How It Functions**
1. Server verifies: advance exists, belongs to this org, status = `pending`.
2. If not pending → returns error: *"Only pending advances can be deleted."*
3. If pending → `DELETE FROM worker_advances WHERE id = advanceId AND org_id = profile.org_id`.
4. Revalidates `/owner/advances` and `/owner/payroll`.

**Value Derived**
- Corrects data entry errors before they affect payroll
- Cannot accidentally delete settled advance history (immutability of closed records)

---

### Workflow I-4: View Pending Advances Summary (Payroll Context)

**What It Does**
Fetches a summary of all pending advances across every worker in the org. Used by the payroll page to show how much each worker has outstanding before settlement.

**Inputs Required**
None — automatically loaded on payroll page.

**Action Triggered**
`getPendingAdvancesSummary()` (advances/actions.ts)

**Data Returned**
Per worker: `meter_worker_id` or `fixed_worker_id` + total pending `amount`.

**How It Functions**
`SELECT meter_worker_id, fixed_worker_id, amount FROM worker_advances WHERE org_id = profile.org_id AND status = 'pending'`

The payroll page aggregates this into a per-worker sum and displays it as the "Advance owed" line on each settlement card before the owner settles.

**Value Derived**
- Owner sees the full financial picture (gross − advances) before confirming settlement
- No surprises: advance deductions are visible and expected before a single tap

---

### Workflow I-5: Check Individual Worker's Outstanding Debt

**What It Does**
Quickly checks how much a single worker currently owes in pending advances.

**Who Can Perform**
Owner or Supervisor (read-only access).

**Inputs Required**
- `Worker ID`: From worker card
- `Worker Type`: `meter` or `fixed`

**Action Triggered**
`getWorkerDebt(workerId, workerType)` (supervisor/actions.ts)

**Returns**
`{ balance: ₹X.XX }` — total pending advance amount.

**When It's Called**
- Supervisor views a worker card and sees the current debt balance
- Owner's payroll page loads a worker row
- Before recording a new advance (show current balance as context)

**Value Derived**
- Supervisors can inform workers of their outstanding balance without accessing the full payroll module
- Prevents excessive advance accumulation by giving real-time visibility

---

## PART J: Payroll Configuration

### Workflow J-1: Set Custom Pay Cycle Start Day

**What It Does**
Owner configures the day of month on which the payroll cycle begins. Affects all gross pay date range queries.

**Why It Exists**
Not all factories pay on a calendar month basis. Many Surat mills run a 15th-to-14th cycle to align with yarn purchase cycles or customer payment terms.

**Inputs Required**
- `Cycle Start Day`: Integer 1–28 (to avoid month-length issues with day 29, 30, 31)

**Storage**
`payroll_configs` table: `{ org_id, cycle_start_day }` — one row per organization.

**Effect on Payroll Math**
If `cycle_start_day = 15`:
```
April Payroll Cycle: 15 March → 14 April
All production_logs.date and attendance.date filtered within this range
```

**Value Derived**
- Payroll calculation aligns with the factory's actual cash flow rhythm
- Removes the need for manual date range selection every month

---


---

## PART K: Access Code System

The Access Code is Weavly's **digital approval mechanism** — a single-use, time-limited, out-of-band authorization token. Any consequential action (deletion, backdating, overrides) requires a code. It functions as a second factor: the supervisor can only proceed if the owner is aware and has approved.

---

### Workflow K-1: Generate an Access Code (Owner Initiates)

**What It Does**
Owner proactively generates a 6-character one-time code. The code is displayed on screen and simultaneously sent to the owner's registered WhatsApp number.

**Why It Exists**
When the owner needs to perform a sensitive action themselves (e.g., delete a fixed worker, backdate attendance), they generate a code and use it immediately. It also serves as the code the owner shares verbally or via phone with a supervisor who needs approval.

**Who Can Perform**
Owner only.

**Inputs Required**
None.

**Action Triggered**
`generateAccessCode()` (owner/actions.ts)

**How It Functions**
```
1. Server generates: crypto.randomBytes(3).toString('hex').toUpperCase()
   → Produces 6-char alphanumeric code (e.g., "A3F9C2")

2. SHA-256 hash of the code → stored in organizations.access_code_hash
   → Plaintext is NEVER stored in the database

3. Expiry: NOW() + 15 minutes → stored in organizations.access_code_expires_at

4. Fire-and-forget: calls send-access-code Edge Function
   → Owner's WhatsApp receives: "Your Weavly access code is: A3F9C2.
      Valid for 15 minutes."

5. Returns { success: true, code } → code displayed in plaintext on screen
```

**Security Properties**

| Property | Implementation |
|---|---|
| Single-use | Hash + expiry nulled on first valid consumption |
| Time-limited | 15-minute TTL enforced server-side |
| Out-of-band delivery | WhatsApp sends the real code — screen just confirms it was generated |
| Never stored as plaintext | SHA-256 stored in DB; only the hash is compared |
| Timing-safe comparison | `crypto.timingSafeEqual()` prevents timing oracle attacks |

**Value Derived**
- Owner can approve actions without being physically present (code travels via WhatsApp)
- Creates a two-factor checkpoint for all high-risk actions

---

### Workflow K-2: Request an Access Code (Supervisor Initiates)

**What It Does**
Supervisor requests a code from within the app. Weavly generates a code and sends it directly to the owner's WhatsApp with the supervisor's name, so the owner knows who is requesting and why before deciding to share the code.

**Why It Exists**
In most factories, the supervisor is on the floor and the owner may be at home or in a meeting. The supervisor cannot call to ask for a code without context — the WhatsApp message provides that context automatically.

**Who Can Perform**
Supervisor (or Owner on behalf of themselves).

**Inputs Required**
None — the supervisor's name is automatically fetched from their profile.

**Action Triggered**
`requestAccessCode()` (supervisor/actions.ts)

**How It Functions**
```
1. Server generates code (same as K-1: randomBytes → SHA-256 → 15 min TTL)
2. Saves hash to organizations table
3. Fetches requester's profile.name from DB
4. Calls send-access-code Edge Function with:
   { org_id, code, expires_at, requested_by: "Supervisor Name" }
5. Owner WhatsApp message:
   "[Supervisor Name] is requesting an access code.
    Code: B7D2A1. Expires in 15 minutes."
6. Returns { success: true } → UI shows "Code request sent to owner's WhatsApp"
```

**UX Flow on Device**
```
Supervisor tries to delete Machine 7
  → UI: "This action requires owner approval"
  → [Request Code from Owner] button
    → requestAccessCode() fires
      → Owner receives WhatsApp with code + supervisor name
        → Owner decides to approve → tells supervisor the code
          → Supervisor types code into dialog
            → Action proceeds or is blocked
```

**Value Derived**
- Owner always knows what is being requested before approving
- Zero friction for the supervisor — one button, no phone call coordination needed
- Owner can deny by simply not sharing the code (it expires in 15 minutes)

---

### Workflow K-3: Validate and Consume an Access Code

**What It Does**
Server-side validation of any access code submitted by a supervisor or owner. On success, the code is permanently consumed (cannot be reused).

**When It's Called**
Automatically called inside every protected server action:
- `deleteMachineWithCode()`
- `deleteWorkerWithCode()`
- `deleteFixedWorkerWithCode()`
- `savePastAttendance()`
- `unconsumeBatchWithCode()`
- `verifyAccessCode()` (standalone verify without a destructive action)

**How It Functions (Internal — `validateAndConsumeAccessCode`)**
```
Step 1: Check Upstash hard lockout (5 cumulative fails = 1-hour ban)
         → throws "Account temporarily locked" if banned

Step 2: Check Upstash sliding window (5 attempts per 10 min)
         → throws "Too many attempts. Try again in X seconds."

Step 3: Zod format validation (6 alphanumeric chars)
         → records failure in Upstash on bad format

Step 4: DB fetch: organizations.access_code_hash + access_code_expires_at

Step 5: Check TTL: NOW() > expires_at → reject + record failure

Step 6: SHA-256 hash of input code

Step 7: crypto.timingSafeEqual() comparison
         → reject + record failure if no match

Step 8: On match:
         → NULL out hash + expiry in DB (single-use consumed)
         → Set PostgreSQL session var: app.access_code_used = 'true'
            (audit trigger reads this and flags the log entry)
         → Reset Upstash failure counter

Step 9: Return true → calling action proceeds
```

**Audit Integration**
When `app.access_code_used = 'true'` is set in the PostgreSQL session, the audit trigger on the subsequent DML operation writes `access_code_used = true` on the `audit_log` row — permanently linking the deletion/edit to the code approval.

**Value Derived**
- Every code use creates an immutable audit record linking the action to owner approval
- Rate limiting and lockout make brute-force attacks computationally infeasible

---

### Workflow K-4: Standalone Verify Access Code

**What It Does**
Validates and consumes a code without performing a specific destructive action. Used as a "gateway" before enabling a locked edit flow (e.g., unlocking a production log for editing).

**Who Can Perform**
Owner or Supervisor.

**Action Triggered**
`verifyAccessCode(accessCode)` (supervisor/actions.ts)

**Use Case**
Supervisor wants to edit a locked production log entry. The UI first calls `verifyAccessCode()`. On success, the edit interface unlocks. The actual log edit is then performed in a separate call.

**Value Derived**
- Decouples authorization from the specific action — the unlocked UI state can be used for multiple edits within the same session before the next code is needed

---

### Workflow K-5: Update Factory Name (Settings)

**What It Does**
Owner updates the official name of the factory/organization. This name is used across all supervisor devices, order records, and printed worker payslips.

**Why It Exists**
Factory names may change legally or simply need correction. The owner needs a way to update this without administrative intervention.

**Who Can Perform**
Owner only.

**Inputs Required**
- `New Name`: Text (min 2, max 120 characters)

**Action Triggered**
`updateOrganizationName(newName)` (owner/actions.ts)

**How It Functions**
1. Owner opens Settings → enters new name in the Factory Name field.
2. Owner clicks "Save" or "Save Changes".
3. Server validates input using `UpdateOrgNameSchema`.
4. RLS ensures only the owner of the organization can perform the update.
5. Organization name is updated in the `organizations` table.
6. Client-side cache is invalidated, and the new name propagates to all views instantly.

**Value Derived**
- Professional flexibility in branding and legal naming
- No downtime or manual data correction needed for re-branding

---

## PART L: WhatsApp Preferences (`/owner/settings`)

---

### Workflow L-1: Set Up Owner WhatsApp Opt-In

**What It Does**
Owner registers their WhatsApp number and opts in to receive automated daily briefs, access codes, and pace alerts.

**Why It Exists**
The entire WhatsApp notification pipeline is gated on a consent opt-in. Without this, no automated messages are sent to the owner — privacy by default.

**Inputs Required**
- `Phone Number`: 10-digit Indian mobile number (stripped of spaces/dashes)
- `Opted In`: Boolean toggle

**Action Triggered**
`saveWhatsAppPreferences(phone, optedIn)` (owner/actions.ts)

**How It Functions**
- **Opting In**: Validates 10-digit number, sets `whatsapp_opted_in = true`, `whatsapp_number = phone`, `whatsapp_opted_in_at = now()` on `profiles`.
- **Opting Out**: Sets `whatsapp_opted_in = false`, `whatsapp_opted_in_at = null`. Number is **retained** in the DB (not wiped) so re-opting in restores service without re-entry.

**Downstream Effects**
After opting in, the owner begins receiving:
- Daily production brief at 20:00 IST (via `pg_cron` → `send-daily-brief`)
- Access codes on demand (via `generateAccessCode` / `requestAccessCode`)
- Pace alerts when orders fall behind (via `send-deadline-alert`)
- Monthly summary (via `monthly-brief`)

**Value Derived**
- Owner stays informed without needing to open the app
- Out-of-band delivery of access codes enables remote approval of sensitive actions

---

### Workflow L-2: View WhatsApp Delivery Log

**What It Does**
Owner sees a history of all outbound WhatsApp messages sent by the platform for their organization — delivery status, template used, recipient, timestamps.

**Why It Exists**
Payslips and advance receipts are legal financial documents. The owner needs to confirm they were actually delivered, and debug failures if a worker claims they didn't receive their payslip.

**Data Displayed per Log Row**

| Field | Details |
|---|---|
| `recipient_phone` | Which number the message went to |
| `notification_type` | `daily_brief`, `payslip`, `advance_receipt`, `access_code`, `deadline_alert` |
| `template_name` | Interakt template ID used |
| `status` | `sent` / `delivered` / `read` / `failed` |
| `sent_at` | Timestamp |
| `error_message` | Interakt error if status = `failed` |
| `payload_snapshot` | Full payload sent to Interakt (for debugging) |

**RLS**
Owner reads only their own org's logs. Service role (Edge Functions) writes all rows.

**Value Derived**
- Verifiable delivery trail for statutory payslip delivery
- Debug failed deliveries (wrong number, template rejection, Interakt downtime)

---

## PART M: Audit Trail (`/owner/settings/audit`)

The Audit Trail is the **immutable record of everything that has ever happened** in the factory's Weavly instance — who changed what, when, and whether an access code was used.

---

### Workflow M-1: View Audit Log

**What It Does**
Owner sees a paginated, reverse-chronological list of every consequential database action across the organization — insertions, updates, and deletions on all key tables.

**Why It Exists**
Accountability without surveillance cameras. The audit log answers: "Was that log entry edited?", "Who deleted that machine?", "When did the payroll settlement happen?"

**Who Can Perform**
Owner only. Supervisors have no access to the audit trail.

**Data Displayed per Audit Row**

| Column | Content |
|---|---|
| Timestamp | Date + time (IST display, UTC stored) |
| Action | `INSERT` / `UPDATE` / `DELETE` (colour-coded badge) |
| Category | `HR & Payroll` / `Production & Orders` / `Settings & Profiles` / `Estimator & Quotes` |
| Entity | Human-readable table name + truncated record ID |
| Actor | User's full name + role (owner/supervisor) |
| Auth | 🛡️ badge if an access code was consumed for this action |
| Changes | Field-by-field diff (old → new values) |

**Tables Covered by Audit Triggers**

| Category | Tables |
|---|---|
| HR & Payroll | `attendance`, `workers`, `fixed_workers`, `payroll_settlements`, `worker_advances`, `payroll_configs` |
| Production & Orders | `production_logs`, `machines`, `machine_assignments`, `orders` |
| Settings | `profiles` |
| Estimator | `factory_cost_profile`, `estimator_templates`, `estimator_quotes` |

**How It Functions**
- PostgreSQL triggers fire on INSERT/UPDATE/DELETE on every audited table
- Each trigger writes to `audit_log`: full JSONB `old_data` + `new_data`, `actor_id`, `event_type`, `table_name`, `record_id`, `access_code_used`
- `actor_id` = `auth.uid()` for regular client calls; for service-role calls (backdating, code-protected deletions), `set_actor_for_audit(p_actor_id)` is called first to preserve the real user's identity

---

### Workflow M-2: Filter Audit Log

**What It Does**
Owner applies filters to narrow the audit log to specific categories, action types, or dates.

**Filter Options**

| Filter | Values | How It Works |
|---|---|---|
| Category | All / HR & Payroll / Production & Orders / Settings / Estimator | Filters `table_name IN (category's tables)` |
| Action | All / INSERT / UPDATE / DELETE | Filters `action = value` |
| Date | Calendar date picker (up to today) | Filters `changed_at BETWEEN day_start AND day_end` |
| Clear All | Resets all filters | Returns to full log |

**UX Behaviour**
- Changing any filter resets page to 0 (prevents stale pagination)
- Date filter has a clear (×) button for single-click removal
- "Clear filters" button appears only when at least one filter is active

**Value Derived**
- "Show me all production log edits today" — catches potential fraud quickly
- "Show me all access-code-authorized actions this month" — oversight of approved exceptions
- "Show me everything for [date]" — full day reconstruction for dispute resolution

---

### Workflow M-3: Read Human-Readable Diff in Audit Entry

**What It Does**
Owner expands an audit entry to see exactly what changed — field by field, formatted by data type.

**Why It Exists**
Raw JSONB diffs are unreadable to an owner. The `AuditDiff` component transforms them into human sentences.

**How It Functions**
The `AuditDiff` component receives `old_data` and `new_data` JSONB objects and:
- Compares field by field: only shows changed fields
- Formats money fields as `₹XX.XX`
- Formats status fields as labelled badges (e.g., `active → inactive`)
- For DELETEs: renders a summary of the deleted record's key fields
- For INSERTs: renders the new record's key fields

**Examples**

| Change | Display |
|---|---|
| Rate updated | *"Changed default_worker_rate_per_m from ₹12.00 to ₹14.00"* |
| Machine deactivated | *"Status: active → inactive"* |
| Production log edited | *"meters: 245 → 280 (access code used ✓)"* |
| Worker deleted | *"Deleted: Ramesh Patel (ESI: 1234567890)"* |

**Value Derived**
- Owner can understand exactly what changed without any technical knowledge
- The `access_code_used` flag on the row makes owner-approved exceptions clearly distinguishable from routine operations

---

### Workflow M-4: Audit Log Pagination

**What It Does**
Navigates through the audit log 20 entries at a time.

**How It Functions**
- `PAGE_SIZE = 20`
- Supabase query: `.range(page * 20, (page + 1) * 20 - 1)`
- "Previous" and "Next" buttons disabled at boundaries
- Total count displayed: *"Showing 21–40 of 347 entries"*

**Value Derived**
- Prevents loading thousands of entries at once (performance)
- Pagination resets when filters are changed (always starts from most recent matching entries)

---


---

## Overview: The Supervisor's Daily Rhythm

A supervisor's day in Weavly follows a predictable loop:

```
Morning (Shift Start)
  → Set up shift assignments (who operates which machine, for which order, at what rate)
  → Link orders to machines if order routing changed

During the Day
  → Mark attendance for fixed (salaried) workers

End of Shift
  → Log meters produced on each machine (bulk production entry)
  → Take meter readings from machines for all workers in the current shift
  → Enter production logs into the system (Bulk Entry)
  → Handle access-code actions (delete machine/worker with owner approval)
```

---

## PART N: Shift Assignments (via Unified Dashboard)

Shift assignments are the foundation of accurate production attribution. Before any meters are logged, the supervisor must define: which worker operates which machine, for which order, at what rate — for this specific date and shift.

---

### Workflow N-1: Load Shift Setup Data

**What It Does**
Opens the assignment screen for a given date + shift and loads all the data the supervisor needs to configure the shift: active machines, active orders, active workers, and any assignments already saved for this date/shift.

**Inputs Required**
- `Date`: Defaults to Surat Today (Asia/Kolkata)
- `Shift`: Auto-detected from current Surat time (`07:00–19:00 = day`, otherwise `night`)

**Action Triggered**
`getShiftSetupData(date, shift)` (supervisor/actions.ts)

**Data Returned (4 parallel queries)**

| Dataset | Source | What It Contains |
|---|---|---|
| `machines` | `machines WHERE status = 'active'` | ID, name, default rate, current order |
| `orders` | `orders WHERE status = 'active'` | ID, quality label, party name, warp/weft instructions, deadline, worker_rate_per_m |
| `workers` | `workers WHERE is_active = true` | ID, name |
| `assignments` | `shift_assignments WHERE date = date AND shift = shift` | Existing machine→worker→order→rate links |

**How It Functions**
All 4 queries run in parallel via `Promise.all()` for speed. The UI merges assignments onto machine rows to show "pre-filled" state for machines that were already set up.

**Value Derived**
- Supervisor sees the full factory setup in one view before the shift starts
- Already-configured machines show their current assignment — reduces re-entry when setup carries over

---

### Workflow N-2: Set Up a Machine Assignment for the Shift

**What It Does**
For each active machine, the supervisor specifies:
- Which worker is operating it this shift
- Which order it is producing for
- What rate per meter the worker will earn

This assignment is what production logs reference when attributing wages and order progress.

**Inputs Required (per machine row)**

| Field | Required | Notes |
|---|---|---|
| `Worker` | Yes | Dropdown of active piece-rate workers |
| `Order` | Yes | Dropdown of active orders; shows warp/weft instruction + deadline |
| `Rate per Meter (₹)` | Yes | Auto-filled from order's `worker_rate_per_m` (from Estimator quote); editable |
| `Date` | Auto | Surat Today |
| `Shift` | Auto | Detected from Surat local time |

**Action Triggered**
`upsertShiftAssignment(data)` (supervisor/actions.ts)

**How It Functions**
```
INSERT INTO shift_assignments
  (org_id, date, shift, machine_id, worker_id, order_id, rate_per_m, created_by)
ON CONFLICT (org_id, date, shift, machine_id)
DO UPDATE SET worker_id, order_id, rate_per_m, created_by
```

The unique constraint `(org_id, date, shift, machine_id)` ensures each machine has exactly one assignment per shift — no duplicates. Saving a new assignment for an already-assigned machine replaces the old one cleanly.

**Revalidation**
`/supervisor/dashboard` — the page refreshes to show the saved state.

**Value Derived**
- Every meter logged later on this machine will be attributed to this worker, order, and rate — automatically
- Rate is inherited from the Estimator quote, so the weaver earns exactly what was costed into the order price

---

### Workflow N-3: Copy Previous Shift Assignments

**What It Does**
Supervisor copies all machine assignments from a previous shift (previous day's night shift, or same day's day shift) to the current date + shift. This avoids re-entering the same lineup when a full shift carries over.

**Why It Exists**
Many factories run the same workers on the same machines for weeks. Re-typing all assignments daily is wasteful and error-prone. Copy-from-previous makes the common case instant.

**Inputs Required**
- `Target Date + Shift`: Current date/shift (auto-filled)
- `Source Date + Shift`: Previous shift to copy from (picker with smart defaults)

**Action Triggered**
`copyPreviousShiftAction(targetDate, targetShift, sourceDate, sourceShift)` (supervisor/actions.ts)

**How It Functions**
Calls `copy_previous_shift` PostgreSQL RPC:
```sql
-- Deletes any existing assignments for target date/shift (clean slate)
DELETE FROM shift_assignments WHERE org_id = X AND date = targetDate AND shift = targetShift

-- Copies from source with current user as creator
INSERT INTO shift_assignments (org_id, date, shift, machine_id, worker_id, order_id, rate_per_m, created_by)
SELECT org_id, targetDate, targetShift, machine_id, worker_id, order_id, rate_per_m, auth.uid()
FROM shift_assignments WHERE org_id = X AND date = sourceDate AND shift = sourceShift
```

Returns number of assignments copied (displayed as a toast: *"Copied 8 assignments from previous shift"*).

**Value Derived**
- Single-tap shift setup for stable lineups
- Removes the #1 source of supervisor data entry errors (wrong worker on wrong machine)

---

## PART O: Production Logging (`/supervisor/production`)

Production logging is the most critical daily action in the system. This is where real-world output becomes data — meters woven become wages earned, order progress tracked, and machine utilization recorded.

---

### Workflow O-1: View Today's Production Entry Screen

**What It Does**
Loads the production entry interface showing all active machines with their current assigned worker (from today's shift assignment), current order, and any meters already logged for this shift.

**Inputs Required**
None — all data auto-loaded from today's shift assignments and active machine state.

**Data Displayed per Machine Row**

| Field | Source |
|---|---|
| Machine Name | `machines.name` |
| Worker Name | `shift_assignments.worker_id` → `workers.name` |
| Current Order | `shift_assignments.order_id` → `orders.quality_label + party_name` |
| Rate per Meter | `shift_assignments.rate_per_m` |
| Already Logged | `SUM(production_logs.meters)` for this machine, today, this shift |
| Meter Input | Number field for new entry |

**Value Derived**
- Supervisor sees the full context for each machine before entering numbers
- Already-logged meters prevent double-entry confusion

---

### Workflow O-2: Bulk Log Production (End-of-Shift Entry)

**What It Does**
Supervisor fills in meters produced on each machine for the current shift and submits all entries at once. Each entry is written as an immutable production log with a frozen rate snapshot.

**Why It Exists**
Production is logged at end-of-shift rather than in real-time on the floor. The bulk entry UI reduces the time to submit from 15 minutes (one-by-one) to under 2 minutes.

**Inputs Required (per machine row)**
- `Meters Produced`: Positive decimal (0 = machine didn't run, skipped in log)
- All other fields (worker, order, rate, date, shift) are auto-resolved from the shift assignment

**Action Triggered**
`bulkLogProduction(entries[])` (supervisor/actions.ts)

**How It Functions**
```
Supervisor fills in meters for each machine → taps "Submit All"

Server receives entries array. For each entry where meters > 0:
  INSERT INTO production_logs:
    org_id, machine_id, worker_id, order_id,
    meters,
    shift, date,
    worker_rate_snapshot = entry.rate_per_m
      (from shift_assignment.rate_per_m
       fallback: machine.default_rate_per_m
       fallback: 1.50)
    created_by = user.id

  Entries where meters = 0 are SKIPPED (no log row created)
```

**The `worker_rate_snapshot` Lock**
This is the most important field. At the moment of INSERT, the rate is frozen forever:
- Future quality or order rate changes do NOT affect this log
- Payroll calculations for this entry will always use this frozen rate
- The audit trigger records `old_data = NULL` + `new_data = full row` for every insertion

**Real-Time Broadcast**
After commit, Supabase Realtime broadcasts to channel `org-{org_id}`. The owner's dashboard receives the WebSocket event within ~1 second and repaints:
- KPI strip: Today's meters, Today's wages recalculate
- Order progress bars update
- Pace Index recalculates

**Revalidation**
`/supervisor/production` and `/owner/orders` are both revalidated.

**Value Derived**
- Meters on the floor become financial records instantly
- Owner sees production updates without being on the floor or refreshing
- Every log is permanently associated with the exact rate that was active at that moment

---

### Workflow O-3: Edit a Locked Production Log (Requires Access Code)

**What It Does**
Supervisor corrects a production log entry that was saved with incorrect meters. After submission, logs are read-only — editing requires an access code.

**Why It Exists**
Mistakes happen (misread a meter counter, entered wrong machine). But immutable-by-default prevents retroactive fraud. The access code creates an owner-approved exception.

**Inputs Required**
- `Log ID`: From the saved log row
- `Access Code`: From owner
- `Corrected Meters`: New meter value

**How It Functions**
1. Supervisor clicks the edit icon on a saved log → lock icon shown.
2. Supervisor taps "Request Code" → `requestAccessCode()`.
3. Owner receives WhatsApp with code.
4. Supervisor enters code → `verifyAccessCode()` is called (consumes the code).
5. Edit interface unlocks.
6. Supervisor enters corrected meters → saves.
7. `UPDATE production_logs SET meters = newValue WHERE id = logId AND org_id = profile.org_id`.
8. Audit trigger fires: logs UPDATE with `old_data = { meters: 245 }`, `new_data = { meters: 280 }`, `access_code_used = true`.

**Value Derived**
- Corrections are possible without destroying accountability
- The audit trail shows exactly what was changed, when, by whom, and with owner approval

---

### Workflow O-4: Backdate Production Entry (Past Date, Requires Access Code)

**What It Does**
Supervisor logs meters for a past date (e.g., yesterday's night shift was missed). Requires an access code to bypass the RLS date-lock.

**Why It Exists**
Supervisors sometimes miss a shift's logging. Backdating with an access code allows correction while maintaining accountability — the owner explicitly approved this exception.

**Inputs Required**
- `Past Date`: Date picker (any past date)
- `Access Code`: From owner
- `Meter entries`: Same form as current-day logging

**How It Functions**
1. Supervisor navigates to "Past Entry" UI path.
2. Selects the date → UI shows the shift assignment for that date.
3. Fills in meters → requests code → enters code → submits.
4. Server: validates code → uses `service_role` client to bypass RLS date-lock → `set_actor_for_audit(user.id)` before INSERT → logs created for the past date.
5. Audit trigger records `access_code_used = true` on all backdated entries.

**Value Derived**
- No production day is permanently lost due to a missed logging shift
- Owner-approved exceptions are permanently distinguishable from real-time entries

---

## PART P: Attendance Marking (`/supervisor/attendance`)

Attendance tracking applies only to **fixed (salaried) workers**. Piece-rate workers are implicitly "present" when they have production logs — no separate attendance tracking needed.

---

### Workflow P-1: Mark Today's Attendance

**What It Does**
Supervisor marks each fixed worker as Present or Absent for today. This directly affects their payroll (pro-rated salary = salary × present_days / cycle_days).

**Why It Exists**
A fixed worker who was absent should not receive their full salary. Daily attendance marking creates the authoritative record for payroll pro-ration.

**Who Can Perform**
Supervisor or Owner. No access code required for today's attendance.

**Inputs Required**
- `Fixed Worker List`: Auto-loaded (all `fixed_workers WHERE is_active = true`)
- `Present/Absent Toggle`: Per worker

**How It Functions**
```
UPSERT INTO attendance
  (org_id, fixed_worker_id, date = Surat Today, present, marked_by = user.id)
ON CONFLICT (fixed_worker_id, date) DO UPDATE SET present, marked_by
```

The upsert ensures re-marking a worker (e.g., correcting present → absent) replaces the previous entry cleanly.

**Downstream Effect on Payroll**
At payroll time, for daily-role fixed workers:
```
Days Present = COUNT(attendance WHERE present = true AND date BETWEEN cycle_start AND cycle_end)
Pro-Rated Salary = (monthly_salary / 30) × days_present
```

**Value Derived**
- Accurate pro-ration ensures fair pay — no overpaying absent workers
- Digital record eliminates paper attendance registers

---

### Workflow P-2: Backdate Attendance (Past Date, Requires Access Code)

**What It Does**
Supervisor or Owner records attendance for a past date — used when yesterday's attendance was forgotten.

**Why It Exists**
Payroll accuracy depends on complete attendance records. A missed day that defaults to "absent" (no record) unfairly reduces a worker's pay.

**Inputs Required**
- `Date`: Past date (date picker)
- `Records`: Present/Absent per fixed worker for that date
- `Access Code`: From owner

**Action Triggered**
`savePastAttendance(date, records[], accessCode)` (supervisor/actions.ts)

**How It Functions**
1. Validates schema (Zod `SavePastAttendanceSchema`): date format, record structure, code format.
2. Validates and consumes access code (full `validateAndConsumeAccessCode` flow with rate limiting).
3. Gets service role client (to bypass RLS date-guard on past records).
4. Calls `set_actor_for_audit(user.id)` so audit trigger records the real actor.
5. `UPSERT INTO attendance ... ON CONFLICT (fixed_worker_id, date)` for each record.
6. Audit trigger fires with `access_code_used = true` for all backdated rows.

**Value Derived**
- Corrects attendance records without permanent impact on worker pay
- Full audit trail: owner can see every backdated attendance entry and who approved it

---

## PART Q: Worker Management (`/supervisor/workers`)

Supervisors have full worker management capabilities — add, toggle active, and delete (with access code). This is intentional: supervisors are on the floor and know when a new worker joins or when someone leaves.

---

### Workflow Q-1: Add a New Piece-Rate Worker

*(Same as Workflow E-1 in PART E — available to both Owner and Supervisor)*

**Action Triggered**: `addMeterWorker(data)` (supervisor/actions.ts)

**Inputs**: Name, PF/ESI eligible, ESI number, PF number

---

### Workflow Q-2: Add a New Fixed (Salaried) Worker

*(Same as Workflow F-1 in PART F — available to both Owner and Supervisor)*

**Action Triggered**: `addFixedWorker(data)` (supervisor/actions.ts)

**Inputs**: Name, Role, Monthly Salary, PF/ESI eligible, ESI number, PF number

---

### Workflow Q-3: Toggle Worker Active / Inactive

*(Same as Workflow E-2 — available to both Owner and Supervisor)*

**Action Triggered**: `toggleWorkerActive(workerId, currentActive, table)` (supervisor/actions.ts)

Works for both `workers` (piece-rate) and `fixed_workers` (salaried) tables.

---

### Workflow Q-4: Delete a Piece-Rate Worker (Requires Access Code)

*(Same as Workflow E-3 — Supervisor initiates, Owner approves)*

**Action Triggered**: `deleteWorkerWithCode(workerId, accessCode)` (supervisor/actions.ts)

---

### Workflow Q-5: Check a Worker's Outstanding Advance Balance

**What It Does**
Supervisor views the current pending advance (Upaad) balance for a specific worker — how much they still owe from advances taken.

**Who Can Perform**
Supervisor or Owner.

**Action Triggered**
`getWorkerDebt(workerId, workerType)` (supervisor/actions.ts)

**Returns**: `{ balance: ₹X.XX }` — sum of all `pending` advances for this worker.

**Value Derived**
- Supervisor can inform a worker of their current debt status without accessing the payroll module
- Context before recording a new advance: is the worker already heavily indebted?

---

## PART R: Machine Management (`/supervisor/machines`)

The supervisor's machine view is a **floor-level operational interface** — not the administrative fleet panel (that's the owner's view). Focus is on linking orders, and managing shift assignments.

---



### Workflow R-2: Link an Order to a Machine (Supervisor)

**What It Does**
Supervisor assigns an order to a machine from the floor-level machine view — one machine, one order at a time.

**Inputs Required**
- `Order ID`: From active orders dropdown
- `Machine ID`: From machine card

**Action Triggered**
`linkOrderToMachine(orderId, machineId)` (supervisor/actions.ts)

**How It Functions**
Service role client → `set_actor_for_audit(user.id)` → `UPDATE machines SET current_order_id = orderId WHERE id = machineId AND org_id = profile.org_id`.

**Important Distinction from Owner Assignment**
- This is one machine at a time (supervisor perspective)
- Owner's `assignOrderToMachines()` does bulk multi-machine assignment and unlinks all previous machines from the order first
- Both ultimately write to `machines.current_order_id`

**Value Derived**
- Supervisor can update order routing from the floor without calling the owner
- Production meters from this point will count toward the newly assigned order

---

### Workflow R-3: Perform Shift Handover

**What It Does**
Supervisor clears the worker assignment from a machine's shift slot at the end of a shift. This signals that the previous worker's shift is over and the slot is ready for the next shift's worker.

**Why It Exists**
Machine assignments should reflect who is actually operating the machine *right now*. At shift change, the outgoing worker's assignment should be cleared before the incoming worker is assigned to avoid wage attribution errors.

**Inputs Required**
- `Machine ID`: From machine card
- `Shift`: `day` or `night` (auto-detected or selectable)

**Action Triggered**
`shiftHandover(machineId, shift)` (supervisor/actions.ts)

**How It Functions**
Service role client → `set_actor_for_audit` → `DELETE FROM machine_assignments WHERE org_id = X AND machine_id = machineId AND shift = shift`.

The machine slot is now empty — ready for the next shift's supervisor to assign a new worker.

**Value Derived**
- Prevents the previous shift's worker from being attributed meters logged in the next shift
- Creates a clean slate at every shift transition

---

### Workflow R-4: Delete a Machine (Requires Access Code)

*(Supervisor initiates — same access code flow as owner deletion)*

**Action Triggered**
`deleteMachineWithCode(machineId, accessCode)` (supervisor/actions.ts)

**Key Difference from Owner Flow**
- This action is restricted to `requireRole(['supervisor'])` — the owner uses a different path in their admin view
- Supervisor requests the code → owner sends → supervisor enters → machine deleted
- Audit trigger captures full machine record before deletion

---



## Summary: Supervisor vs Owner Action Comparison

| Action | Supervisor | Owner |
|---|---|---|
| View Dashboard / Analytics | ❌ | ✅ |
| Build Estimator Quote | ❌ | ✅ |
| Convert Quote to Order | ❌ | ✅ |
| View Orders | ✅ (via machine cards) | ✅ (full page) |
| Edit / Cancel Order | ❌ | ✅ |
| Add Machine | ❌ | ✅ |
| Rename Machine | ❌ | ✅ |
| Toggle Machine Active | ❌ | ✅ |
| Delete Machine | ✅ (with code) | ✅ (own code) |
| Set Up Shift Assignments | ✅ | ✅ |
| Copy Previous Shift | ✅ | ✅ |
| Log Production (Bulk) | ✅ | ✅ |
| Edit Locked Log | ✅ (with code) | ✅ (with code) |
| Backdate Production | ✅ (with code) | ✅ (with code) |
| Mark Today's Attendance | ✅ | ✅ |
| Backdate Attendance | ✅ (with code) | ✅ (with code) |
| Add Piece-Rate Worker | ✅ | ✅ |
| Add Fixed Worker | ✅ | ✅ |
| Toggle Worker Active | ✅ | ✅ |
| Delete Piece-Rate Worker | ✅ (with code) | ❌ (supervisor-only route) |
| Delete Fixed Worker | ❌ | ✅ (with own code) |
| Record Advance (Upaad) | ❌ | ✅ |
| View Worker Advance Balance | ✅ (read) | ✅ |
| Settle Payroll | ❌ | ✅ |
| View Audit Trail | ❌ | ✅ |
| Generate Access Code | ❌ (requests only) | ✅ |
| WhatsApp Opt-In | ❌ | ✅ |
| Save Worker WhatsApp | ❌ | ✅ |

---

---

## PART L: Admin & Compliance Dashboard (`/admin`)

The Admin Dashboard provides platform-wide oversight and tooling specifically for compliance, data privacy, and overarching system integrity, isolated from daily factory operations.

---

### Workflow L-1: Manage DPDP 2026 Notice Registry

**What It Does**
Admins maintain the Notice Registry outlining how user data is utilized, establishing compliance with the Digital Personal Data Protection Act 2026.

**Why It Exists**
Legal requirement. All workers and owners must have access to clear, auditable notices regarding data processing.

**How It Functions**
1. Admins log into `/admin/compliance`.
2. Can draft, publish, and version data privacy notices.
3. Users across all orgs are bound by the published active notices.

---

### Workflow L-2: Oversee Grievance Redressal Policy

**What It Does**
Admins manage and resolve reported data privacy or operational grievances submitted by users.

**Why It Exists**
Part of the mandated Grievance Redressal mechanism required for 2026 labor and data compliance.

**How It Functions**
1. Users submit grievances through their profile/settings.
2. Admins review tickets centrally and coordinate resolutions.
3. An immutable audit trail is maintained for each grievance resolution.

---

*This completes the 7-part Weavly User Workflows & Actions documentation series.*

