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

## 2. Core Architecture & Multi-Tenancy

The app is a **multi-tenant SaaS** built with **Next.js 14** and **Supabase**. Each factory is an isolated **Organization** (`org_id`).

### 2.1 Role-Based Access Control (RBAC)
Data is strictly partitioned via PostgreSQL Row Level Security (RLS).

| Role | Who they are | Primary Focus | Key Permissions |
|---|---|---|---|
| **Owner** | Factory proprietor | Strategy & Profits | All data, yield audits, payroll settlement, machine rates, access code generation |
| **Supervisor** | Floor manager | Daily Operations | Production logging, worker management, attendance, incident reporting, machine linking |

### 2.2 Standard Time Engine (Surat Standard)
To prevent server-client drift (e.g., UTC vs. IST), all date/time logic is centralized in `lib/time.ts`. 
- **Timezone**: `Asia/Kolkata` (Surat)
- **Primary Helper**: `getSuratDate()` and `getSuratTodayString()`. 
- **Critical Logic**: Attendance and production logs are strictly bound to Surat "Today" to ensure mid-night shifts are logged to the correct business day.

---

## 3. Operations: Onboarding & Workflow

### 3.1 Seamless Onboarding
The **Owner** creates the organization and receives a unique **Factory Join Code**. Supervisors use this code to join, avoiding the friction of manual email invites or CSV uploads.

### 3.2 Machine Lifecycle
Machines are the primary production units. They track:
- **Active Beam**: The specific yarn batch currently loaded.
- **Linked Order**: The customer commitment this machine is currently fulfilling.
- **Dynamic Rate**: The ₹/meter paid to workers, resolved from the **Quality** currently assigned to the machine's beam.

---

## 4. The Owner Dashboard — Real-Time Analytics

### 4.1 Order Intelligence
The dashboard leads with **Live Orders**, using an adaptive layout (Hero, Grid, or Carousel) based on order volume.
- **Progress Tracking**: Real-time meters produced vs. target.
- **Pace Index**: A ratio of actual production speed to required speed (`≥1.0` is healthy).
- **Forecasting**: Powered by the PostgreSQL RPC `get_order_forecast`, predicting finish dates based on trailing daily averages.
- **Machine Linking**: Owners can reassign machines to orders directly from the dashboard cards.

### 4.2 KPI & Profit Center
- **Daily Metrics**: Production totals, Piece-rate wages today, and Pro-rated fixed payroll.
- **Yield Leakage Engine**: Average efficiency across all batches. If leakage exceeds 5%, a **Loss Alert** displays the estimated monetary loss in ₹, highlighting direct profit drainage.

### 4.3 Detailed Audit Visibility
- **Worker Breakdown**: Expandable table shows exactly which machines a worker operated, their meter count, and the exact rate applied.
- **Fixed Workers**: Salaried staff management with inline salary editing and ESI/PF tracking.

---

## 5. Inventory & Yield Management

### 5.1 Quality Definitions
Qualities (e.g., "60g Georgette") define the technical specs:
- **Target Yield**: Meters expected per kg of yarn.
- **Sale Price**: Expected revenue per meter.
- **Worker Rate**: The standard piece-rate for this quality across the factory.

### 5.2 Beam (Batch) Management
- **Workflows**: Supervisors can **Start Beam** (link to machine) and **Mark as Consumed** directly from the floor.
- **The Audit Report**: Comparing `Expected Meters (Weight * Target Yield)` vs `Actual Meters (Sum of Logs)`.
- **Variance Analysis**:
    - **Leakage (<-5%)**: Triggers monetary loss calculation.
    - **Padding (>+10%)**: Flags potential reporting fraud or misconfiguration.

---

## 6. The Payroll & Advances (Upaad) System

### 6.1 Settlement Engine (`lib/finance.ts`)
Financial arithmetic is hardened using **Decimal.js** for 20-digit precision, preventing floating-point errors common in piece-rate math.
- **Snapshot Math**: Settlements are "locked" in `payroll_settlements` to prevent historical changes from affecting past records.
- **NaN Hardening**: Input sanitization ensures `meters * rate` never results in corrupted financial records.

### 6.2 The 50% Legal Cap
In compliance with Indian labor laws, the system auto-caps advance deductions at 50% of gross pay for active workers. Excess debt is automatically carried forward to the next month's "Opening Balance."

### 6.3 Advance Lifecycle
Advances are recorded with reasons (medical, school fees, etc.) and instantly reflected as "Pending Debt" on the worker's payroll card. The system handles partial settlements and carry-forward balances automatically.

---

## 7. The Supervisor Floor Tool

### 7.1 Real-Time Production Logging
- **Shift Aware**: Auto-detects Day/Night shifts based on Surat time.
- **Floor Controls**: One-tap linking of Beams and Orders. Production entries go read-only once saved.
- **Audit Hardening**: Captures "Before" and "After" snapshots for EVERY log entry.
- **Real-Time Sync**: Production logs created by supervisors instantly update the Owner's Analytics view via Supabase Realtime.

### 7.2 The Access Code Guard
High-stakes actions (editing locked logs, backdating attendance, deleting records) require a **single-use 6-character Access Code** generated by the Owner. This creates a "digital signature" of owner approval for sensitive mutations.

---

## 8. Compliance & Risk Management

### 8.1 Enhanced Audit Trail
A dedicated module for owners to track every system mutation.
- **Human-Readable Diffs**: Instead of raw JSON, the UI shows "Changed Rate from ₹2.50 to ₹2.60".
- **Access Code Linking**: Every modification requiring a code is linked to that specific code usage in the audit log.
- **Retention**: Designed for 3-year record retention under Indian Labour laws.

### 8.2 OSHWC Safety Incidents
A specialized module for tracking workplace accidents and safety incidents.
- **Compliance**: Meets register requirements for the Occupational Safety, Health and Working Conditions Code.
- **Severity Triage**: Minor, Major, and Critical categories with mandatory "Worker Involved" and "Action Taken" fields.

---

## 9. Vastra Estimator — The Negotiation Tool

A professional costing engine for real-time negotiation with parties.
- **Surat Logic**: Handles grey cost, job-work shrinkage, fixed overhead allocation, and GST-inclusive pricing.
- **Profit Simulation**: A margin slider calculates total order profit vs. per-meter profit instantly.
- **Convert to Order**: Finalized quotes can be converted into live Production Orders with one click, auto-creating "Qualities" and "Target Yields" from the quote specs.

---

## 10. Multi-Language (i18n) & Transliteration

Vastra is fully usable in **English, Hindi, and Gujarati**.
- **Standardized Keys**: Navigation and UI strings use a unified translation schema across all three locales.
- **Phonetic Transliteration**: Worker names stored in English are dynamically rendered in Devanagari or Gujarati scripts, ensuring workers see their own names correctly without manual data entry.

---

## 11. Technical Infrastructure

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router) |
| **Database** | Supabase (PostgreSQL + RLS + Realtime) |
| **Logic Engine** | TypeScript + Decimal.js + date-fns-tz |
| **UI Components** | shadcn/ui + Tailwind CSS + Framer Motion |
| **Background Jobs** | Edge Functions / Cron for WhatsApp Daily Briefs |
| **Reporting** | PDF Generation for Payslips and Yield Audits |

---

## 12. Getting Started for Developers

1. **Environment**: Obtain `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. **Setup**: `npm install && npm run dev`.
3. **Database**: Review `supabase/migrations/` in chronological order to understand the schema evolutions.
4. **Time Zone**: Always use `lib/time.ts` helpers. Never use `new Date()` for "Today" logic.
5. **Precision**: Always use `lib/finance.ts` for monetary sums. Avoid native floating point `+`.

**Mission**: We build tools that save factory owners real money by making waste visible, payroll precise, and operations auditable.
