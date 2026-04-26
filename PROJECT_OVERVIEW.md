# Weavly — In-Depth Project Overview

> **For new team members.** This document is your complete guide to understanding what we're building, why it matters, and exactly how every feature works. Read this top-to-bottom before your first commit.

---

## 1. The Problem We Solve — Invisible Profit Leakage

Small-to-mid-sized textile mills in India bleed money in ways that are almost impossible to see with manual processes:

- **Unprofitable Orders** — Negotiating rates blindly without factoring in exact warps, wefts, sizing, and dynamic overheads leads to accepting orders that lose money.
- **Production Stalls & Loose Machine Tracking** — Without a centralized view, factory owners lose track of which machine is idle or which worker is underperforming on an active order.
- **Payroll Over-payments** — Piece-rate pay is calculated by multiplying per-meter rates across workers and machines. The complexity leads to daily rounding errors and over-spending.
- **Advance (Upaad) Chaos** — Workers frequently take cash advances. Without centralized tracking, owners lose money to unrecovered advances.
- **Zero Real-Time Visibility** — Nothing stops a supervisor from retroactively inflating production unless the owner is physically present.

**Weavly is a profit-saving platform built around a strict "Estimator-First" workflow.** Every feature exists to ensure that every meter produced is mathematically profitable from the moment it is quoted.

---

## 2. Core Architecture & Multi-Tenancy

The app is a **multi-tenant SaaS** built with **Next.js** (App Router) and **Supabase**. Each factory is an isolated **Organization** (`org_id`).

### 2.1 Role-Based Access Control (RBAC)
Data is strictly partitioned via PostgreSQL Row Level Security (RLS).

| Role | Who they are | Primary Focus | Key Permissions |
|---|---|---|---|
| **Owner** | Factory proprietor | Strategy & Profits | All data, payroll settlement, access codes, analytics |
| **Admin** | System Compliance & Ops | Global Compliance | DPDP policies, Grievance redressal, platform-wide audit access |
| **Supervisor** | Floor manager | Daily Operations | Production logging, worker management, machine tracking |

### 2.2 Standard Time Engine (Surat Standard)
To prevent server-client drift (e.g., UTC vs. IST), all date/time logic is centralized in `lib/time.ts` (Asia/Kolkata).

---

## 3. The Core Loop: Estimator to Production

Weavly operates on a mandatory estimation-first architecture designed to protect factory margins by ensuring no production starts without a precise costing blueprint.

### 3.1 Frictionless Onboarding
The onboarding flow is optimized for immediate value delivery:
1. **Join & Verify Phone**: Fast organization setup with mandatory phone verification.
3. **Data-Driven Onboarding**: To unlock the dashboard, a factory only needs to define at least one **Machine** and one **Worker**. All production is driven by the Estimator to ensure financial discipline.

### 3.2 The Estimator (The Gateway)
A professional multi-layered costing engine (`/owner/estimator`) that serves as the entry point for all organizational activity:
- **Surat-Standard Formulas**: Accurately calculates warping, sizing, winding, processing, and finishing costs using PPI-based weave formulas.
- **Granular Overhead**: Replaces flat overheads with itemized fixed-salary and dynamic factory expense modeling.
- **Margin Simulation**: Real-time margin slider to protect per-meter order profit mathematically.
- **Template & Quote Persistence**: Costing recipes can be saved and pushed into a strict Quote Lifecycle (Draft, Sent, Accepted, Rejected), completely replacing offline estimates. Quotes are persisted to a central Quotes History dashboard.

### 3.3 Precise Order Conversion
Once a quote is Accepted, it translates into a **Live Order**:
- **Strict Lineage**: Every Order is "Published" from a finalized Estimator Quote, inheriting its cost snapshots and structural recipes.
- **Profit Guardrails**: Direct mapping between an Order and its quote ensures that actual yield and wage costs are audited against the original projection.
- **Rapid Launch**: One-click conversion from the Estimator dashboard bypasses manual order entry errors.

### 3.4 Machine Assignment & Production Logging
Orders are then routed to the factory floor:
- **Slide-Out Sheet Assignment**: Owners or supervisors quickly link capable Machines to active Orders. Smart warnings prevent double-assignment.
- **Floor-Level Logging**: Supervisors log daily meters produced. The system captures the wage rate snapshot at time of entry, locking financial data forever.
- **Immediate Feedback Loop**: Logs instantly update the active order's meter progression and "Pace Index" (actual vs. required speed).

### 3.5 Dispatch & Delivery Management
Once production completes, rolls are batched for dispatch:
- **Batch Tracking & Grouping**: Dispatches are grouped by order to track progress (dispatched vs. remaining capacity).
- **Public Tracking Portals**: Secure, public-facing tracking links (`/track/[token]`) and auto-generated QR codes are generated per dispatch batch.
- **Strict RLS Data Isolation**: Data is securely partitioned per organization.

---

## 4. The Owner Dashboard — Real-Time Analytics

### 4.1 Order Intelligence & Historical Views
The dashboard provides an instant pulse on the factory via **Supabase Realtime**:
- **Live Orders Grid/Carousel**: Real-time meters produced vs target bounds.
- **Production Trends**: Modern scaling bar graphs showing the last 7 days of production, synchronized across all KPI metrics.
- **Branded Visuals**: High-contrast icons and color-coded health indicators (Order Health Index) for instant floor awareness.
- **Pace Forecasting**: PostgreSQL RPC predicting finish dates based on trailing daily averages.
- **Historical Insights**: A unified date picker allows the owner to instantly rewind the dashboard to previous production days, inspecting historical logs natively.

### 4.2 KPI & Audit Visibility
- **Daily Metrics**: Production totals, Piece-rate wages today, and Pro-rated fixed payroll.
- **Expandable Worker Breakdown**: Shows exactly what machines each worker operated, zero/null-production state clarity, and granular daily wage accrual.

### 4.3 Real-Time Sync & Resilience
The system is built for the factory floor's connectivity challenges:
- **Resilient Realtime**: Supabase WebSocket connections automatically reconnect with "Syncing..." status indicators to ensure data integrity during spotty internet.
- **Offline-First Logging**: Supervisors can log production without a connection; data is cached and pushed the moment the device reconnects.
- **Fast Cold-Boots**: Optimized authentication flow for instant access on return to the app, bypassing legacy restrictive session guards.

---

## 5. The Payroll & Advances (Upaad) System

### 5.1 Settlement Engine (`lib/finance.ts`)
- **Decimal.js Hardened**: 20-digit precision arithmetic for all piece-rate and rate-snapshot operations.
- **Smart Currency Display**: Professional Indian Rupee (₹) formatting via `formatINR`. It hides unnecessary ".00" for whole numbers and uses a smaller font size for non-zero decimals to maximize professional appearance.
- **Immutable Wage Snapshots**: Every production log freezes its applicable `worker_rate_snapshot`. Modifications to order rates impact only future production.
- **Double-Lock Safety**: Settled months are locked via RLS policies and `payroll_settlements` history.

### 5.2 Upaad (Advance) Management
- Compliant with the 50% legal cap deduction on gross pay (Indian Code on Wages).
- Excess debts automatically carry forward as pending balances to the next payroll cycle.

---

## 6. The Access Code Guard & Security

High-stakes actions (editing locked logs, editing payroll) require a **single-use 6-character Access Code** generated by the Owner.
- Pushed directly to the Owner's registered WhatsApp (`send-access-code`).
- 15-minute TTL, single-use, linked strictly to immutable entries in the global `audit_log`.

---

## 7. WhatsApp Notification Suite

A fully automated, zero-touch notification system powered by **PostgreSQL crons** and **Supabase Edge Functions**, dispatching messages via the Meta-approved **Interakt** WhatsApp API.

| Notification Type | Recipient | Trigger |
|---|---|---|
| **Daily Factory Brief** | Owner | Every day at 20:00 IST via `pg_cron` |
| **Deadline Risk Alert** | Owner | Every 6 hours when any active order has `pace_index < 1.0`, with a 24h cooldown per order |
| **Monthly Summary** | Owner | 28th of each month at 23:30 IST |
| **Access Code** | Owner | Immediately on every access code generation |
| **Worker Payslip** | Worker | Immediately on payroll settlement |
| **Advance Receipt** | Worker | Immediately on every advance record |

Failed sends are automatically retried up to **3 times over 24 hours** by the `retry-failed-messages` cron, making the system robust against transient API failures without requiring webhook callbacks.

> **Full setup and configuration guide:** [WHATSAPP_INTEGRATION_GUIDE.md](./WHATSAPP_INTEGRATION_GUIDE.md)

---

## 8. Multi-Language (i18n)

- **Tri-Lingual Interface**: English, Hindi, and Gujarati (`t()` based translation).
- **Phonetic Transliteration**: Automatic translation of employee names to Devanagari/Gujarati for accurate payslip delivery.

---

## 9. Factory Customization & Settings

Owners have full control over their organizational profile:
- **Factory Personalization**: Owners can customize their factory name at any time. Updates propagate instantly to all supervisors and worker payslips.
- **Join Code Management**: Secure regeneration of worker/supervisor join codes to maintain floor security.

---

## 10. Compliance & Data Privacy (2026 Standards)

Weavly rigorously complies with upcoming Indian legal frameworks:
- **Indian Code on Wages 2019**: Advanced payroll audits and exact tracking of 50% legal cap deduction on gross pay advances.
- **DPDP 2026 (Digital Personal Data Protection)**: Notice Registry for data usage, built-in Grievance Redressal Policy, and active breach detection logging.
- **Admin Dashboard**: Dedicated compliance dashboard (`/admin`) for system administrators to oversee and audit DPDP adherence and privacy logs across the platform.

---

## 11. Getting Started for Developers

1. **Environment**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `INTERAKT_API_KEY`.
2. **Setup**: `npm install && npm run dev`.
3. **Database**: The schema utilizes heavy Postgres RPCs (`supabase/migrations/`).
4. **Time & Math**: STRICTLY use `lib/time.ts` and `Decimal.js` (via `lib/finance.ts`). Never native JS dates/floats.
