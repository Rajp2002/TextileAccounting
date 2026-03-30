# Vastra — In-Depth Product Overview

> **For new team members.** This document is your complete guide to understanding what we're building, why it matters, and exactly how every feature works. Read this top-to-bottom before your first commit.

---

## 1. The Problem We Solve — Invisible Profit Leakage

Small-to-mid-sized textile mills in India bleed money in ways that are almost impossible to see with manual processes:

- **Yarn-to-fabric conversion waste** — The #1 source of unchecked loss. A dishonest employee or underperforming machine can silently produce fewer meters from a batch of yarn than expected. Without expected-vs-actual tracking, the owner has no idea money is walking out the door.
- **Payroll over-payments** — Piece-rate pay is calculated by multiplying dozens of small per-meter rates across workers and machines. Rounding errors, mental math slips, and unchecked production numbers lead to real overspend every month.
- **No order deadline visibility** — Many factories run customer orders without tracking whether production pace will meet the deadline. Late deliveries mean penalties or lost future business.
- **Advance (Upaad) chaos** — Workers frequently take cash advances against future wages. Without centralized tracking, owners lose money to unrecovered advances.
- **No accountability** — Nothing stops a supervisor from retroactively inflating a production number, backdating attendance, or covering up waste.

**Vastra is a profit-saving platform.** Every feature exists to make money leakage visible, payroll accurate, and operations auditable — so factory owners keep more of what they earn.

---

## 2. How the Platform is Organized

The app is a **multi-tenant SaaS** built with **Next.js** and **Supabase**. Each factory is an isolated **Organization**. All data — workers, machines, orders, batches, production logs, payroll — is completely ring-fenced.

Within an organization, there are two roles:

| Role | Who they are | What they can do |
|---|---|---|
| **Owner** | Factory proprietor / manager | Full control: orders, inventory, payroll, analytics, yield audits, settings, all data |
| **Supervisor** | Floor manager | Operational tasks: log production, manage workers, mark attendance, link beams and orders to machines |

---

## 3. The Onboarding & Join Flow

The **Owner** creates their organization and receives a unique **Factory Join Code** (visible in Settings). This code is shared out-of-band (WhatsApp, in person) with supervisors who use it to self-onboard. No CSV uploads or email invites needed.

---

## 4. The Owner Dashboard — Command Center

The Owner's primary view is the **analytics dashboard** — a date-scoped, real-time overview of factory performance.

### 4.1 Live Orders (Top of Dashboard)

The dashboard leads with **Live Orders** — a prominent section showing all active customer orders. The layout adapts smartly:
- **1 order** → full-width hero card
- **2–3 orders** → responsive grid
- **4+ orders** → horizontal carousel with navigation arrows and pagination dots

Each **Order Card** shows:
- **Party name** and **fabric quality**
- **Progress bar** (meters produced vs. target) with percentage
- **Health / Pace Index** — a ratio of production pace to required pace (≥1.0 = on track, <1.0 = behind)
- **Deadline** date
- **Predicted finish date** — a forecast calculated from average daily production, with a "theoretical" label during the warm-up period when data is sparse
- **Status badges** — color-coded: Active (green), At Risk (amber, <48h to deadline at <90%), Overdue (red, past deadline and incomplete), Finished (green, 100%)
- **Machine linking** — the owner can assign/reassign machines to an order directly from the card

The owner can **create, edit, and delete orders** via a dialog. Each order has a party name, fabric quality, target meters, start date, and deadline.

### 4.2 The Three KPI Cards

Below the orders are three always-visible summary cards:

1. **Daily Production** — Total meters produced across all machines for the selected date.
2. **Wages Today** — Total rupee cost of all piece-rate wages for that day.
3. **Fixed Payroll** — What salaried staff cost for the current month, pro-rated for daily workers.

### 4.3 Efficiency & Loss Alerts

Two cards powered by the **Yarn-to-Fabric Yield Engine**:
- **Efficiency** — Average variance across all active yarn batches. Positive = over-producing, negative = leaking.
- **Loss Alerts** — Count of batches with >5% leakage and the total estimated monetary loss in ₹. This is the profit-saving centerpiece — it turns an invisible problem into a concrete number.

### 4.4 Worker Breakdown Table

A detailed, expandable table showing every piece-rate worker who produced on the selected date. Each row shows name, total meters, calculated day-pay. Tapping a row expands a **per-machine breakdown**: machine name, meters, rate, and resulting pay. Owners verify exactly how every rupee was calculated.

### 4.5 Fixed Workers Panel

A list of all salaried/fixed staff with color-coded role badges (Master, Helper, Mender, Sanitation, Day-to-Day, Supervisor). The owner can **inline-edit any salary** directly — click the pencil icon, type the new value, press Enter. 

Key features:
- **ESI & PF Tracking** — The owner can record ESI (Employee State Insurance) and PF (Provident Fund) numbers and toggle eligibility for compliance tracking.
- **Attendance-Linked Pay** — For **Day-to-Day workers**, the panel shows days worked this month and auto-calculates earnings.

---

## 5. The Order Management System

Orders are first-class entities representing customer fabric commitments with deadlines.

### 5.1 Order Lifecycle
1. **Owner creates** an order: party name, quality, target meters, start date, deadline.
2. **Machines are linked** to the order.
3. Production logged against linked machines **automatically accumulates** toward the order's target.
4. The system calculates **pace index**, **progress %**, and a **forecasted completion date** using actual daily production averages.
5. When the order reaches 100%, it's marked **Finished**.

### 5.2 Forecasting Engine
The backend RPC `get_order_forecast` calculates:
- **Average daily production** across assigned machines
- **Remaining meters**
- **Predicted finish date** — extrapolated from the daily average
- **Theoretical flag** — set during the first few days when data is insufficient for reliable forecasting

### 5.3 Order Progress Summary (Database View)
A materialized view `order_progress_summary` provides pre-calculated metrics: `total_meters_produced`, `progress_percent`, `time_elapsed_percent`, `pace_index`, `assigned_machines_count`.

---

## 6. The Inventory Module — Yarn & Quality Management

The inventory system tracks raw materials (yarn batches/beams) and fabric quality definitions. This is the foundation for the yield analytics that detect profit leakage.

### 6.1 Qualities Tab
Defines the types of fabric the factory produces. Each quality has:
- **Name** (e.g., "60g Georgette", "Cotton 40s")
- **Target Yield** (meters per kg) — the expected production efficiency
- **Estimated Sale Price** (₹/meter) — used for monetary loss calculations
- **Worker Rate** (₹/meter) — **The Single Source of Truth** for production pay. This rate is auto-applied to any machine producing this quality, ensuring consistency across the factory floor.

Factories in the Surat region can auto-load default qualities for common fabric types.

### 6.2 Batches (Beams) Tab
Tracks individual yarn batches as they enter the factory:
- **Batch name/ID** — factory's internal identification
- **Quality** — which fabric type this yarn produces
- **Weight (kg)** — input weight that determines expected output
- **Status** — Active (on a machine) or Consumed (batch audit completed)
- **Machine assignment** — which machine the beam is loaded on

### 6.3 Batch Audit & Yield Report
When a beam is consumed, the system generates a **full audit report** that compares:
- **Expected meters** = Weight × Target Yield
- **Actual meters** = Sum of all production logged on that machine during the beam's lifespan
- **Efficiency Variance** = `((Actual - Expected) / Expected) × 100`

The audit flags three scenarios:
- **Leakage (Variance < -5%)** — Real loss: yarn was wasted, stolen, or production was under-reported. Shows estimated **monetary loss** = `(Expected Yield - Actual Yield) × Weight × Sale Price/m`
- **Padding (Variance > +10%)** — Over-reporting: a supervisor may have inflated meter counts, or the quality's target yield is misconfigured.
- **Healthy** — Within tolerance.

If leftover yarn remains on the beam (called *tali*), it can be recorded to adjust the audit.

---

## 7. The Payroll Module — Month-by-Month Settlement

The payroll page is where the owner **settles wages** at month end.

### 7.1 Piece-Rate Workers Tab
All active piece-rate workers who logged production in the month, **sorted by total payout descending**. Each card shows:
- Total meters, machines worked, total calculated pay
- **Advance (Upaad) deduction** — pending advances are auto-deducted from gross pay
- **Net Pagar** — the actual amount to hand over: `Gross Pay - Advances`
- If advances exceed earnings: shows **remaining debt** (carried forward)
- **Paid / Pending** badge with Mark Paid / Unmark Paid toggle

Tapping a card expands the **full calculation breakdown**: `Machine Name | X meters × ₹Y/m = ₹Z` across all machines, then the advance deduction, arriving at the net payout.

### 7.2 Fixed Workers Tab
All salaried staff for the month with the same Mark Paid / Unmark mechanic. Day-to-Day workers show: `(Monthly Salary ÷ 30) × Days Present`.

### 7.3 Summary Bar
Four summary cards:
- **Total Owed** — everyone's pay this month
- **Paid** — sum of those marked paid
- **Deductions** — total advances deducted
- **Outstanding** — what's left to hand out

### 7.4 Robust Settlement Engine ("The Engine Room")
The payroll system uses a specialized settlement engine to handle complex financial transactions:
- **The 50% Legal Cap** — In compliance with Indian labor laws, the system automatically caps advance deductions at 50% of gross pay for active workers, ensuring they always take home a living wage. This cap is only lifted for *Final Settlements* (termination).
- **Snapshot Math** — Every payment creates a permanent snapshot in `payroll_settlements`, locking in the gross pay, deductions, and net payout regardless of future rate changes.
- **Custom Pay Cycles** — Factories can configure their own cycle start days (e.g., settling on the 10th of every month) via `payroll_configs`.
- **Advance Splitting** — If a worker's total debt exceeds the 50% cap, the system automatically settles what it can and carries the remaining debt forward to the next month.

---

## 8. The Advances (Upaad) Module

A dedicated page for managing mid-month cash advances to workers.

### 8.1 Worker Selection & Risk Assessment
The owner selects a worker and immediately sees:
- **All pending advances** — amount, date given, reason, settlement status
- **Debt risk level** — High (heavy debt relative to typical earnings), Moderate, or safe — with a warning if more advances should be avoided

### 8.2 Recording an Advance
A dialog captures the amount and optional reason (e.g., "medicine", "rent"). Once saved, the advance is automatically queued for deduction from the next payroll settlement.

### 8.3 Auto-Settlement
When payroll is run, the system calculates `Net Pay = Gross Pay - Pending Advances`. If advances exceed earnings, the remainder carries forward as debt. This prevents owners from losing track of outstanding advances.

---

## 9. The Supervisor Dashboard — The Floor Tool

Supervisors have a dedicated, streamlined dashboard with five core modules. The UI is designed for speed — large tap targets, mobile-first, minimal steps.

### 9.1 Production Logging — The Core Daily Task

The most-used screen in the app. For each machine card:
- Auto-fills the **assigned worker** (from assignments)
- Shows **active beam** (from inventory) and **linked order** (if any)
- Displays a **setup checklist**: worker assigned ✓, beam loaded ✓, order linked ✓
- Supervisor enters meter count via keyboard or **+10 / –10 quick-increment buttons**
- Real-time **estimated pay** shown as meters are typed
- **Save All Entries** submits all machines at once

**Shift Toggle:** Day/Night shift toggle auto-detects the correct shift (7AM–7PM = Day, 7PM–7AM = Night).

**Beam & Order Linking:** Supervisors can link yarn batches and orders directly to machines from the production page via modals, streamlining the floor workflow.

**Offline Mode:** The app queues entries in IndexedDB when offline and syncs on reconnect. A toast tells the supervisor entries are "queued (offline)."

**The Lock System:** Saved entries go **read-only**. To edit, the supervisor must enter a **single-use access code** from the Owner.

### 9.2 Worker Assignments — Who Runs Which Machine

Shift-aware persistent assignments (Day/Night). A day shift assignment is separate from a night shift one.

### 9.3 Attendance — Tracking Day-to-Day Workers

Green ✓ / red ✗ toggle per worker, with a live "Present / Total" counter. **Past date security**: requires an access code to prevent backdated attendance manipulation.

### 9.4 Worker Management

Tabbed interface (Piece-Rate / Fixed Staff, Active / Inactive).
- Add new piece-rate or fixed workers
- Toggle active/inactive status
- Delete requires an **access code** (irreversible action)
- Workers with outstanding advances show a warning and must be settled before deletion

### 9.5 Machine Viewing

Supervisors see the machine list with current assignments but **cannot change rates, rename, or modify machines** — read-only access. This is strictly the owner's privilege.

### 9.6 Safety Incidents (OSHWC)

Supervisors can report workplace accidents and safety incidents directly from the dashboard. This ensures real-time reporting of floor-level incidents as required for OSHWC regulatory compliance.

---

## 10. The Machine Management Module (Owner)

Machines are first-class entities:
- **Name** (e.g., "Loom A", "Rapier 3")
- **Dynamic Rate** — The ₹ amount paid per meter is resolved dynamically from the **Fabric Quality** currently assigned to the machine's active beam.
- **Active/Inactive status**
- **Current order assignment** — which order the machine is producing for
- **Current beam** — which yarn batch is loaded

The **Owner** can add, rename, toggle active/inactive, and delete machines (with access code). 

## 11. Compliance & Auditing — Trust through Transparency

Vastra is built to meet the rigorous compliance standards required by modern Indian industrial law.

### 11.1 The Audit Trail System
Required for **Indian Labour record retention (3 years)** and **DPDP Act accountability**. Every sensitive change in the system is automatically logged:
- **Triggers** — PostgreSQL triggers on `production_logs`, `payroll_payments`, and `worker_advances` capture the 'Before' and 'After' state of every record.
- **Owner Visibility** — Owners can view a complete history of who changed what and when, ensuring supervisors cannot retroactively manipulate production numbers without detection.

### 11.2 Safety Incidents (OSHWC Code)
A dedicated module for tracking workplace accidents and safety incidents. This allows factories to maintain a digital register of health and safety events, fulfilling their legal obligations under the Occupational Safety, Health and Working Conditions Code.

### 11.3 The Access Code System — Owner Authorization Layer
Single-use 6-character codes generated by the Owner from Settings. The code expires after 15 minutes and is consumed on use. Used for:
- Editing locked (saved) production entries
- Saving attendance for a past date
- Deleting a worker or machine record
- Any other retrospective or destructive operation

---

## 12. The Vastra Estimator — Negotiation & Costing Tool

A professional-grade costing engine designed for Surat factory owners to calculate fabric landed costs and negotiate with parties in real-time.

### 12.1 Technical "Surat Logic" Engine
The estimator (`lib/estimator.ts`) handles complex textile math:
- **Grey Cost**: Calculated from GSM, Yarn Rate, and standard wastage.
- **Job-Work with Shrinkage**: Sums multiple job-work processes (dyeing, printing, etc.), each with its own ₹ rate and % shrinkage.
- **Overhead Allocation**: Pro-rates fixed factory rent and admin salaries based on machine efficiency and PPI (Picks Per Inch).
- **GST Logic**: Toggle between GST-inclusive and GST-exclusive pricing to protect profit margins.

### 12.2 Negotiation Dashboard
A mobile-first interface (`app/owner/estimator`) that allows owners to:
- **Live Profit Simulation**: Move a margin slider to see how quote prices affect net profit per meter and total order profit.
- **Style Templates**: Quick-load specs for common fabrics (e.g., Japan Satin, Georgette) from the **Template Manager**.
- **Stress Testing**: A risk heatmap visualizing how external shocks (e.g., +5% yarn price hike or -15% machine efficiency) impact the bottom line.

### 12.3 "Convert to Order" Workflow
Bridges the gap between estimation and production:
- **Auto-Quality Mapping**: When a quote is accepted, the system checks for an existing fabric quality by name. If not found, it automatically creates a new one, calculating the **Target Yield** based on GSM.
- **Order Launch**: Creates a live production order linked to the quote snapshot, ensuring zero data entry errors when moving from negotiation to the factory floor.

---

## 13. Internationalization (i18n) & Transliteration

The app supports **three languages**: English, Hindi, and Gujarati. A language switcher is available in both the Owner sidebar and Supervisor navigation.

### 13.1 Full Translation Coverage
Every string in the app is translated: navigation labels, form labels, toast messages, error messages, dialog content, role names, KPI labels, audit report text. Translations are organized by module (`nav`, `production`, `attendance`, `payroll`, `inventory`, etc.).

### 13.2 Phonetic Transliteration Engine
Worker names stored in English in the database are **dynamically transliterated** into Devanagari (Hindi) or Gujarati script based on the active language. This uses a custom phonetic mapping engine (`lib/transliterate.ts`) with a `useTransliterate` hook, ensuring a fully localized experience without requiring data migration.

---

## 14. WhatsApp Daily Brief & System Health

### 14.1 Automated WhatsApp Briefs
A scheduled background job (cron) sends a **daily production summary** to the Owner's WhatsApp at 8:00 PM. The owner gets a reliable overview of output without opening the app. This is a Premium-tier feature.

### 14.2 System Health Page
The Owner can view the last 30 days of daily brief delivery logs: timestamp, target date, status (Success / Skipped / Failed), and details. This ensures the automated reporting pipeline is working.

---

## 15. The Landing Page & Pricing

The public-facing landing page positions Vastra as a **profit-saving tool**, not a generic utility:

### 15.1 Hero
Headline: *"Optimize your textile production in real-time"*. CTA: Start Free Trial. Includes a product preview video.

### 15.2 Features Section
Six feature cards:
1. **Seamless Daily Production Tracking** — automated monthly pay calculation
2. **Built for the Factory Floor** — offline-first operation
3. **Pinpoint Accurate Payroll** — high-precision Decimal.js calculations
4. **Automated WhatsApp Briefs** — daily summary to WhatsApp
5. **Instant Access on Any Device** — PWA, no app store needed
6. **Flexible Team Sizing** — scales from 15 workers to unlimited

### 15.3 Pricing Tiers
| Tier | Price | Highlights |
|---|---|---|
| **Free Trial** | ₹0 for 7 days | All features, unlimited workers, no credit card |
| **Base** | ₹600/month | Up to 15 workers, basic support |
| **Premium** | ₹1,700/month | Unlimited workers, WhatsApp briefs, priority support, advanced analytics |

**Setup & Training Add-on:** ₹4,999 one-time — includes account configuration, data import, and virtual training session with a dedicated onboarding manager.

---

## 16. The Financial Engine

All monetary calculations use **Decimal.js** (`lib/finance.ts`) with 20-digit precision and ROUND_HALF_UP to eliminate floating-point errors. Key functions:

- `calculateDailyPay(meters, rate)` — single machine pay
- `calculateTotalPay(items[])` — multi-machine aggregation
- `sumMeters(logs[])` — safe decimal summation
- `sumAdvances(advances[])` — total pending advances
- `calculateNetPay(gross, advances)` — net payout (floored at ₹0)
- `calculateRemainingDebt(gross, advances)` — carry-forward debt
- `calculateActualYield(meters, weightKg)` — meters per kg
- `calculateEfficiencyVariance(actual, expected)` — % variance
- `calculateMonetaryLoss(actual, expected, weight, price)` — ₹ loss when leakage detected
- `formatINR(amount)` — Indian rupee formatting

---

## 17. Data Security & Multi-Tenancy

Every database operation enforces:

1. **Authentication** — you must be logged in.
2. **Row Level Security (RLS)** — PostgreSQL policies scope every query to the user's `org_id`. Cross-organization data access is impossible.
3. **Role Policies** — operations restricted by `role` (e.g., only `owner` can delete workers, edit rates).
4. **JWT Claims** — `org_id` and `role` embedded in the session token and verified on every request.
5. **Access Codes** — single-use codes add human approval gates on sensitive mutations.

---

## 18. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), React, TypeScript |
| **State** | TanStack Query (React Query) for server state, real-time Supabase subscriptions for live dashboards |
| **Styling** | Tailwind CSS, shadcn/ui components, Framer Motion for animations |
| **Backend** | Supabase (PostgreSQL, Auth, Row Level Security, Edge Functions, RPCs, Realtime) |
| **Financial Math** | Decimal.js |
| **i18n** | Custom context-based system with Hindi & Gujarati translations + phonetic transliteration engine |
| **Offline** | IndexedDB via custom hooks, Service Worker (PWA) |
| **Notifications** | WhatsApp via scheduled cron jobs |

---

## 19. Project Structure

```
app/
├── (auth)/           # Login, signup, onboarding, verification
├── (dashboard)/
│   ├── owner/        # Owner pages
│   │   ├── analytics/    # Main dashboard (orders, KPIs, efficiency, workers)
│   │   ├── advances/     # Advance tracking & management
│   │   ├── estimator/    # Vastra Estimator & Quote history
│   │   ├── fixed-workers/ # Fixed salary staff management
│   │   ├── incidents/    # OSHWC Safety Incidents (Owner view)
│   │   ├── inventory/    # Yarn batches, qualities, yield audits
│   │   ├── machines/     # Machine CRUD
│   │   ├── payroll/      # Monthly settlement
│   │   ├── settings/     # Factory config, access codes, Estimator setup
│   │   └── system-health/ # WhatsApp brief delivery logs
│   └── supervisor/   # Supervisor pages
│       ├── production/   # Daily production logging
│       ├── assignments/  # Worker-machine shift assignments
│       ├── attendance/   # Day-to-day worker attendance
│       ├── incidents/    # OSHWC Safety Incidents (Supervisor report)
│       ├── workers/      # Worker management (tabbed)
│       └── machines/     # Machine viewing (read-only)
components/
├── landing/          # Hero, features, pricing (public page)
├── navigation/       # Owner sidebar, supervisor nav bar
├── settings/         # EstimatorSettings, TemplateManager
├── OrderCard.tsx     # Order progress card
├── LiveOrdersLayout.tsx  # Adaptive order grid/carousel
├── MachineManagement.tsx # Shared machine component
├── AddWorkerDialog.tsx   # Worker creation dialog
└── ui/               # shadcn/ui primitives
hooks/
├── use-offline-sync.ts   # IndexedDB offline queue
├── use-online-status.ts  # Connectivity detection
├── use-transliterate.ts  # Name transliteration hook
└── use-user-profile.ts   # Current user session
lib/
├── finance.ts        # Decimal-safe financial calculations
├── estimator.ts      # Vastra Estimator core technical logic
├── transliterate.ts  # Phonetic transliteration engine
├── i18n/             # Language context & locale files (en, hi, gu)
└── supabase/         # Supabase client & server helpers
```

---

## 20. Getting Started

1. Get the Supabase credentials for the dev environment from the project lead.
2. Clone the repo, run `npm install`, then `npm run dev`.
3. Sign up as a new Owner to create your own test organization, or ask to be added to the dev org.
4. Spend time going through each module manually — create an order, add inventory, log production, run a batch audit, try the payroll settlement, run an estimation. Understanding the UX as a user is essential before touching the code.
5. Read through `supabase/migrations/` in order — the schema tells you exactly what data exists and what the constraints are.

Welcome to the team. The goal is to build something that **saves factory owners real money** — by making waste visible, payroll precise, and operations auditable.
