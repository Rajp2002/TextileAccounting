# Loomi — Comprehensive Feature Analysis (Part 1 of 2)

> **Coverage**: Owner Dashboard & Analytics · Machine Management · Lean Beam Tracking · Orders
>
> **Part 2 covers**: Production Logging · Payroll & Advances · Access Code Guard · Audit Trail · Estimator · WhatsApp Notifications · i18n & Transliteration

---

## Feature 1: Owner Dashboard & Analytics (`/owner/analytics`)

### What It Does
The Owner Dashboard is the command center of the platform. It aggregates live production data, order progress, financial KPIs, and worker breakdown into a single real-time view — updated instantly whenever any supervisor logs production on the floor.

### Who Uses It
**Owner only.** Supervisors have no access to this route (enforced by middleware + RLS).

### Inputs
- No manual user inputs for the main view — it is a **read-only aggregate display**
- Optional: Owner can interact with Order cards to **assign/unassign machines** from this screen
- Optional: Inline salary editing for Fixed Workers from the analytics panel

### How Data Flows In
```
Supervisor logs meters on /supervisor/production
  → INSERT into production_logs (+ worker_rate_snapshot)
    → Supabase Realtime broadcasts on org-scoped channel
      → Owner's browser receives WS event
        → Analytics page re-queries and repaints without reload
```

### Key Outputs / What the Owner Sees

#### Live Orders Panel
- **Adaptive Layout**: If 1 order → full-width Hero card. 2–4 orders → 2-column grid. 5+ orders → horizontal carousel with navigation arrows.
- **Per-Order Card Contents**:
  - Party name + quality type
  - Progress bar: Meters Produced / Target Meters
  - **Pace Index**: `(actual meters/day) ÷ (required meters/day)`. Green ≥ 1.0 (on track), Amber 0.8–1.0 (at risk), Red < 0.8 (critical)
  - **Forecast date**: `get_order_forecast` RPC computes a rolling 7-day average production rate and extrapolates finish date
  - Machine assignment buttons — Owner can drag/assign machines to this order inline
  - Deadline indicator with days remaining

#### KPI Strip (below the orders)
| KPI | Calculation |
|---|---|
| **Today's Meters** | `SUM(production_logs.meters)` where date = Surat today |
| **Today's Piece-rate Wages** | `SUM(meters × worker_rate_snapshot)` for today |
| **Pro-rated Fixed Payroll** | `SUM(monthly_salary) ÷ days_in_month` for all active fixed workers |
| **Avg Yield Efficiency** | `SUM(actual_meters) ÷ SUM(expected_meters)` × 100 across active batches |

#### Yield Leakage Alert
- If avg efficiency < 95%, a red **Loss Alert** banner appears:
  - `Monetary Loss = (Expected m − Actual m) × avg_sale_price_per_m`
  - Displays total ₹ estimate of profit walking out the door
  - Clicking it navigates to Inventory for the batch-level breakdown

#### Worker Breakdown Accordion
- Each piece-rate worker has an expandable row showing:
  - Every machine they operated today
  - Meters logged per machine
  - The exact `worker_rate_snapshot` used (frozen at log time)
  - Row total in ₹
- Fixed Workers section shows: name, role, monthly salary, ESI/PF status

### UX Workflow
1. Owner opens `/owner/analytics`
2. Dashboard SSR-loads with today's data (Next.js Server Components)
3. Supabase Realtime subscription established client-side
4. As supervisors log production on the floor, the KPI strip and order cards update **live** with no page refresh
5. Owner sees Pace Index turn amber → clicks into order card → assigns an additional machine → card immediately reflects new assignment

### Connections to Other Features
| Connects To | How |
|---|---|
| **Machine Management** | Owner assigns machines to orders directly from dashboard cards |
| **Inventory** | Loss Alert links directly to the failing batch in Inventory |
| **Payroll** | Today's wages on the KPI strip are a preview of what the Payroll module will settle |
| **Orders** | Order cards display data from the `orders` table and `orders_with_progress` view |
| **Production Logs** | Every log entry made by supervisor is reflected here in real-time |
| **WhatsApp** | Daily brief sent to owner's WhatsApp at 20:00 IST contains the same KPIs |

---

## Feature 2: Machine Management (`/owner/machines` & `/supervisor/machines`)

### What It Does
Machines are the atomic unit of production. This feature lets both Owners and Supervisors manage the machine fleet — creating, renaming, toggling status, assigning workers per shift, linking yarn beams and orders, and deleting machines.

The **Owner view** is the administrative control panel. The **Supervisor view** is the floor-level operational interface.

### Who Uses It
- **Owner**: Full CRUD — add, rename, deactivate, delete (with access code), assign workers, link orders
- **Supervisor**: Read + operational actions — start beam, link order, perform shift handover, request deletion (requires owner access code)

### Inputs & Validation

| Action | Required Inputs | Validation |
|---|---|---|
| Add Machine | Name (string) | Non-empty after trim |
| Rename Machine | Machine ID (UUID), new name | UUID valid, name non-empty |
| Toggle Status | Machine ID | UUID valid |
| Assign Worker | Machine ID, Worker ID, Shift (day/night) | All fields required |
| Delete Machine | Machine ID, Access Code (6-char) | UUID valid, code consumed server-side |

### Optimistic Updates
Machine status toggles and worker assignments use **optimistic UI**: the UI reflects the change immediately without waiting for the server response. If the server call fails, the UI rolls back. This is critical for floor supervisors who need instant feedback.

### Machine State Machine
```
Created (active)
  ↓ [Owner deactivates]
inactive  ← → active  [Owner reactivates]
  ↓ [Owner deletes with access code]
(deleted from DB)
```

### Machine Data at Rest
Each machine record tracks:
- `name` — human label (e.g., "Machine 7")
- `status` — `active` | `inactive`
- `current_order_id` — FK to the order it is currently fulfilling
- (Derived) `current_batch` — via `yarn_batches.current_machine_id`
- `machine_assignments` — separate table: `{machine_id, worker_id, shift, org_id}`

### Beam Linking (Start Beam)
When a supervisor taps "Start Beam" on a machine:
1. Server action `startBeam(batchId, machineId)` is called
2. Any other batch currently on this machine has `current_machine_id` set to `null` first (safe unlink)
3. The new batch's `current_machine_id` is set to this machine
4. **Consequence**: All subsequent production logs for this machine are now associated to this batch and its quality's `worker_rate_snapshot`
5. If the batch was already loaded on another machine, the supervisor sees a **confirmation modal** ("This batch is already on Machine X — proceed?") before confirming the switch

### Batch Re-Assignment Confirmation Modal
- **Trigger**: Supervisor selects a batch that already has `current_machine_id` set (not null, and not this machine)
- **Copy**: Shows current machine name and asks for explicit confirmation
- **On Confirm**: `startBeam()` proceeds; old machine loses the batch
- **On Cancel**: Nothing changes
- **Purpose**: Prevents accidental production re-routes which would corrupt yield tracking

### Worker Assignment per Shift
- Each machine has **Day** and **Night** shift slots
- Supervisor assigns a worker to each slot from a dropdown of active workers
- `machine_assignments` table stores the current assignment (upsert logic: insert if new, update if existing)
- Shift Handover: Supervisor can "clear" the current shift assignment, triggering `shiftHandover()` which deletes the assignment record

### Inactive Machine Filtering
- Inactive machines are **hidden** from all production logging interfaces and the Supervisor floor view
- They still appear in the Owner's machine management list with a visual "Inactive" badge
- This prevents supervisors from accidentally logging production on a machine that is out of service

### Delete Machine (Access Code Required)
- Only supervisors can request deletion (Owner initiates the flow from Owner machines view too)
- Supervisor calls `deleteMachineWithCode(machineId, accessCode)`
- Server: validates code using `validateAndConsumeAccessCode()` with Upstash rate limiting (5 failures → 1-hour lockout)
- On success: machine is hard-deleted; audit trigger captures the `BEFORE` snapshot

### UX Workflow — Owner View
1. Owner navigates to `/owner/machines`
2. Sees full fleet with status badges, current beam name, current order, assigned workers per shift
3. Clicks "+ Add Machine" → inline form → saves → machine appears instantly (optimistic)
4. Clicks rename → inline editable field
5. Clicks "Deactivate" → machine greys out immediately (optimistic toggle)
6. To delete: clicks "Delete" → prompted for access code → code sent to WhatsApp → enters code → machine removed

### UX Workflow — Supervisor View
1. Supervisor navigates to `/supervisor/machines` (or the Unified Dashboard)
2. Sees all **active** machines with their current beam and order
3. Taps "Start Beam" on a machine → picks from available batch list → confirms (modal if re-assignment) → beam linked
4. Taps worker assignment slot → picks worker from list of active workers for this shift
5. End of shift: taps "Handover" → clears the slot for the next shift's worker

### Connections to Other Features
| Connects To | How |
|---|---|
| **Production Logging** | Machine is referenced in every log entry; must be active to appear in log UI |
| **Inventory** | Batch is linked to machine via `current_machine_id`; determines which batch meters are counted toward |
| **Orders** | `current_order_id` on machine determines which order the production meters are attributed to |
| **Payroll** | Worker assignment determines which worker gets paid for logs on this machine |
| **Access Code Guard** | Deletion requires a valid access code from the owner |
| **Audit Trail** | Machine add/rename/delete/status-change all trigger the `machines` audit PostgreSQL trigger |

---

## Feature 3: Lean Beam Tracking (Floor-Native)

### What It Does
Loomi uses a streamlined **Beam Tracking** system integrated directly into the factory floor. Supervisors manage yarn supply inline while logging production, ensuring real-time yield tracking without a complex separate inventory module.

### Who Uses It
- **Supervisor**: Primary user. Adds new beams as they arrive on the floor and links them to machines.
- **Owner**: Read-only oversight via the Audit Log.

### Inputs (Add Beam Modal)
Supervisors access this modal directly from the Production Entry screen.

| Field | Type | Validation |
|---|---|---|
| `name` | Text | Unique identifier for the beam/batch |
| `quality_id` | UUID | Must exist in org's qualities (auto-created via Estimator) |
| `total_weight_kg` | Decimal | Required for yield audit |

### The "Start Beam" Lifecycle
1. **Unlinked State**: A beam exists in the "active" pool but is not yet assigned to a machine.
2. **Linked State**: Supervisor calls `startBeam(batchId, machineId)`. This marks the beam as `current` on that specific loom.
3. **Consumption**: When the beam runs out, the supervisor clicks "Mark Consumed", enters the `leftover_weight_kg`, and the beam is archived to the `consumed` state.

### Yield Audit (Automated)
The system calculates real-time yield:
`Actual Yield = Total Meters Produced on Beam / (Total Weight - Leftover Weight)`
- This is audited against the **Target Yield** defined in the original Estimator Quote.
- Significant deviations are flagged in the Owner Dashboard and Audit Log.

### Connections to Other Features
| Connects To | How |
|---|---|
| **Machine Management** | Machines are linked to active yarn beams |
| **Production Logging** | Logs are tagged with the active `yarn_batch_id` for yield math |
| **Owner Dashboard** | Yield performance is tracked centrally |
| **Estimator** | Qualities used for beams are published from the Estimator |
| **WhatsApp** | Batch closure with leakage fires `send-yield-alert` Edge Function |

## Feature 4: Orders Management (`/owner/analytics` + order actions)

Orders represent customer commitments derived from profitable quotes. Every order in Loomi must originate from the Estimator to ensure mathematical profit protection. The orders system tracks production progress in real-time, calculates pace/forecast, and allows machine assignment directly from the dashboard.

### Who Uses It
- **Owner**: Management — publishes quotes to orders from the Estimator, edits deadlines, deletes orders, assigns machines
- **Supervisor**: Read-only awareness via machine assignment (sees "Linked Order" on machine card); can link order to machine via `linkOrderToMachine()`

### Inputs (Create / Edit Order Form)

| Field | Type | Validation |
|---|---|---|
| `party_name` | Text | Required, non-empty |
| `quality_id` | UUID | Must exist in org's qualities |
| `total_target_meters` | Decimal | Positive number |
| `start_date` | Date | Valid date string |
| `deadline` | Date | Must be ≥ start_date |
| `status` | Enum | `active` \| `completed` \| `cancelled` |

Validated via Zod `OrderSchema` server-side before upsert. All new orders are generated via the `convertToOrder` flow in the Estimator to ensure wage and yarn constraints are locked in correctly.

### Order Progress Calculation
The database maintains an `orders_with_progress` materialized view (or computed join) that tracks:
```sql
meters_produced = SUM(production_logs.meters)
  WHERE production_logs.current_order_id = orders.id

progress_pct = meters_produced / total_target_meters × 100
meters_remaining = total_target_meters − meters_produced
```

### Pace Index
```
Required Pace = meters_remaining / working_days_until_deadline
Actual Pace   = 7-day trailing average of meters/day (from production_logs)
Pace Index    = Actual Pace / Required Pace
```
- ≥ 1.0 → **On Track** (green)
- 0.8–0.99 → **At Risk** (amber)
- < 0.8 → **Critical** (red)

### Order Forecast (RPC)
The `get_order_forecast` RPC:
1. Computes trailing 7-day average daily production for this order
2. Divides `meters_remaining` by that rate
3. Returns `projected_finish_date`
4. If projected finish > deadline → displayed as "(X days late)"

### Machine Assignment to Orders
**Method 1 — Owner Dashboard**: Owner clicks the machine assignment block on an order card, selects machines from a dropdown of active machines → calls `assignOrderToMachines(orderId, machineIds[])`
- First unlinks all machines from this order
- Then bulk-updates all selected machines with `current_order_id = orderId`

**Method 2 — Supervisor Floor**: Supervisor calls `linkOrderToMachine(orderId, machineId)` (one machine at a time from the assignments screen)

### Order Status Lifecycle
```
active  →  [Owner marks complete]  →  completed
active  →  [Owner cancels]         →  cancelled
completed / cancelled               →  (no production logs can be added)
```

### Deadline Alert (WhatsApp)
When Pace Index drops below threshold:
- `send-deadline-alert` Edge Function is triggered (caller: automated check or manual trigger)
- `whatsapp_cooldowns` table checked: if `(org_id, 'deadline_risk', order_id)` sent within 24h → skip
- If not in cooldown: sends WhatsApp alert with order name, party, days remaining, current pace
- Cooldown record inserted with 24h TTL

### Order Card UI Layout
Each order card renders:
```
┌─────────────────────────────────────────────┐
│ Party Name          [Quality Badge]          │
│ ██████████████░░░░░░  67% (1,340/2,000 m)   │
│ Pace Index: 1.2 ✓   Forecast: Apr 12        │
│ Deadline: Apr 15  (3 days buffer)            │
│ Machines: [M3] [M7] [+ Assign]              │
└─────────────────────────────────────────────┘
```

### Connections to Other Features
| Connects To | How |
|---|---|
| **Machine Management** | Machines are assigned `current_order_id`; determines production attribution |
| **Production Logging** | Logs reference `current_order_id`; meters accumulate toward order progress |
| **Inventory** | Quality is shared — same `quality_id` used by order and yarn batches |
| **Owner Dashboard** | Orders are the primary content of the analytics dashboard |
| **WhatsApp** | Deadline risk triggers `send-deadline-alert` with cooldown protection |
| **Estimator** | Finalized estimates can convert to orders with one click |

---

## Feature 5: Worker Management (`/supervisor/workers` + `/owner/analytics`)

### What It Does
Loomi manages two types of workers:
- **Piece-rate (Meter) Workers** — paid per meter woven; the vast majority of the factory floor
- **Fixed (Salaried) Workers** — managers, security, admin; paid a monthly salary regardless of production

### Who Uses It
- **Supervisor**: Add workers (both types), toggle active/inactive, delete (with access code)
- **Owner**: Edit fixed worker salaries inline, set ESI/PF numbers, manage WhatsApp preferences per worker

### Sub-Feature 5A: Piece-Rate Workers

#### Add Worker (`addMeterWorker`)
**Inputs**:

| Field | Required | Notes |
|---|---|---|
| Name | Yes | Stored in English; transliterated on display |
| PF/ESI Eligible | Yes | Checkbox — affects payroll compliance display |
| ESI Number | If eligible | Text field |
| PF Number | If eligible | Text field |

**Workflow**: Supervisor opens "Add Worker" sheet → fills form → saves → worker appears in list immediately

#### Worker State
- `is_active = true` → Worker appears in machine assignment dropdowns, payroll summary, production attribution
- `is_active = false` → Hidden from all operational UIs; historical logs preserved

#### Toggle Active/Inactive (`toggleWorkerActive`)
- No access code required — low-risk operation
- Immediate effect on all machine assignment dropdowns

#### Delete Worker (`deleteWorkerWithCode`)
- Supervisor calls from worker list
- Requires valid access code (6-char, 15-min TTL)
- Rate-limited: 5 failures → 1-hour lockout via Upstash Redis
- Hard delete from `workers` table; RLS ensures org isolation
- `set_actor_for_audit()` called before deletion so audit trigger records the actor

### Sub-Feature 5B: Fixed (Salaried) Workers

#### Add Fixed Worker (`addFixedWorker`)
**Inputs**: Name · Role (text) · Monthly Salary (₹) · PF/ESI eligible · ESI/PF numbers

#### Edit Salary (`updateFixedWorkerSalary`)
- Owner can edit salary inline from the Analytics dashboard or Fixed Workers page
- Revalidates both `/owner/analytics` and `/owner/fixed-workers`

#### Attendance (linked feature)
Fixed workers have daily attendance tracked (present/absent). Salary is pro-rated based on attendance days when doing payroll settlement.

### WhatsApp Per Worker
Owner can assign a WhatsApp number and language preference (`en`/`hi`/`gu`) to any worker:
- Requires explicit `consentGiven: true` flag from owner (legal defensibility under DPDP Act)
- Validated: 10-digit Indian mobile number
- Phone number stored on `workers` or `fixed_workers` table
- Used by `send-payslip` and `send-advance-receipt` Edge Functions

### Worker Card UI
```
┌──────────────────────────────┐
│ 👷 Ramesh Patel     [Active] │
│ ESI: 1234567890              │
│ PF: AB/CD/1234               │
│ WhatsApp: 98XXXXXXXX  [Edit] │
│                  [Deactivate]│
│                   [Delete ▾] │
└──────────────────────────────┘
```

### Connections to Other Features
| Connects To | How |
|---|---|
| **Machine Management** | Active workers appear in machine assignment shift dropdowns |
| **Production Logging** | Worker ID is stored on every log entry; all meters attributed to them |
| **Payroll** | Worker's `rate_per_meter` used in gross pay calculation (via `worker_rate_snapshot`) |
| **Advances** | Each worker has a running advance balance shown on payroll card |
| **Attendance** | Fixed workers' payroll is attendance-weighted |
| **Audit Trail** | Worker add/delete triggers audit |
| **WhatsApp** | Worker phone + language enables payslip and advance receipt delivery |
| **Transliteration** | Worker name rendered in Hindi/Gujarati on supervisor-facing UIs |

---

*→ Continue in **FEATURE_ANALYSIS_PART2.md** for: Production Logging · Payroll & Advances · Access Code Guard · Audit Trail · Estimator · WhatsApp Pipeline · i18n*
