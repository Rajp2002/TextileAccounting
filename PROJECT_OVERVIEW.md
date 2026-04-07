# Vastra — In-Depth Project Overview

> **For new team members.** This document is your complete guide to understanding what we're building, why it matters, and exactly how every feature works. Read this top-to-bottom before your first commit.

---

## 1. The Problem We Solve — Invisible Profit Leakage

Small-to-mid-sized textile mills in India bleed money in ways that are almost impossible to see with manual processes:

- **Unprofitable Orders** — Negotiating rates blindly without factoring in exact warps, wefts, sizing, and dynamic overheads leads to accepting orders that lose money.
- **Production Stalls & Loose Machine Tracking** — Without a centralized view, factory owners lose track of which machine is idle or which worker is underperforming on an active order.



- **Payroll Over-payments** — Piece-rate pay is calculated by multiplying per-meter rates across workers and machines. The complexity leads to daily rounding errors and over-spending.
- **Advance (Upaad) Chaos** — Workers frequently take cash advances. Without centralized tracking, owners lose money to unrecovered advances.
- **Zero Real-Time Visibility** — Nothing stops a supervisor from retroactively inflating production unless the owner is physically present.

**Vastra is a profit-saving platform built around a lean "Quote-to-Production" loop.** Every feature exists to help factory owners quote accurately, track live production seamlessly, and ensure payroll is auditable.

---

## 2. Core Architecture & Multi-Tenancy

The app is a **multi-tenant SaaS** built with **Next.js** (App Router) and **Supabase**. Each factory is an isolated **Organization** (`org_id`).

### 2.1 Role-Based Access Control (RBAC)
Data is strictly partitioned via PostgreSQL Row Level Security (RLS).

| Role | Who they are | Primary Focus | Key Permissions |
|---|---|---|---|
| **Owner** | Factory proprietor | Strategy & Profits | All data, yield audits, payroll settlement, machine rates, access codes, analytics |
| **Supervisor** | Floor manager | Daily Operations | Production logging, worker management, machine tracking, incident reporting |

### 2.2 Standard Time Engine (Surat Standard)
To prevent server-client drift (e.g., UTC vs. IST), all date/time logic is centralized in `lib/time.ts` (Asia/Kolkata).

---

## 3. The Core Loop: Quote to Production

Vastra operates on a streamlined, output-driven architecture focused on getting factories up and running in minutes, bypassing legacy inventory bottlenecks.

### 3.1 Frictionless Onboarding
The onboarding flow is optimized for immediate value delivery:
1. **Join & Verify Phone**: Fast organization setup with mandatory phone verification.
2. **Minimal Setup**: To unlock the dashboard, a factory only needs to define at least one **Machine** and one **Worker**.
3. **No Heavy Inventory**: Legacy requirements (complex quality definitions, yarn batch definitions) have been entirely removed to facilitate a rapid "Create First Order" workflow.

### 3.2 The Estimator (Costing Engine)
A professional multi-layered costing engine (`/owner/estimator`) that allows owners to quote orders precisely before a single meter is produced:
- **Surat-Standard Formulas**: Accurately calculates warping, sizing, winding, processing, and finishing costs using PPI-based weave formulas.
- **Granular Overhead**: Replaces flat overheads with itemized fixed-salary and dynamic factory expense modeling.
- **Margin Simulation**: Real-time margin slider to protect per-meter order profit mathematically.
- **Template Persistence**: Costing recipes (JSON arrays) can be saved, edited, and instantly recalled.

### 3.3 Seamless Order Conversion
Once a quote looks profitable, it seamlessly translates into a **Live Order**:
- **One-Click Convert**: Cost snapshots and structural recipes from the Estimator directly populate new Orders.
- **Flat Order Architecture**: Direct mapping between an Order and its production output, skipping redundant inventory/beam abstractions.
- **Inline Order Creation**: Super-fast "New Order" sheet accessible directly from the dashboard.

### 3.4 Machine Assignment & Production Logging
Orders are then routed to the factory floor:
- **Slide-Out Sheet Assignment**: Owners or supervisors quickly link capable Machines to active Orders. Smart warnings prevent double-assignment.
- **Floor-Level Logging**: Supervisors log daily meters produced. The system captures the wage rate snapshot at time of entry, locking financial data forever.
- **Immediate Feedback Loop**: Logs instantly update the active order's meter progression and "Pace Index" (actual vs. required speed).

---

## 4. The Owner Dashboard — Real-Time Analytics

### 4.1 Order Intelligence & Historical Views
The dashboard provides an instant pulse on the factory via **Supabase Realtime**:
- **Live Orders Grid/Carousel**: Real-time meters produced vs target bounds.
- **Pace Forecasting**: PostgreSQL RPC predicting finish dates based on trailing daily averages.
- **Historical Insights**: A unified date picker allows the owner to instantly rewind the dashboard to previous production days, inspecting historical logs natively.

### 4.2 KPI & Audit Visibility
- **Daily Metrics**: Production totals, Piece-rate wages today, and Pro-rated fixed payroll.
- **Expandable Worker Breakdown**: Shows exactly what machines each worker operated, zero/null-production state clarity, and granular daily wage accrual.

---

## 5. The Payroll & Advances (Upaad) System

### 5.1 Settlement Engine (`lib/finance.ts`)
- **Decimal.js Hardened**: 20-digit precision arithmetic for all piece-rate and rate-snapshot operations.
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

A fully automated, zero-touch notification system powered by PostgreSQL crons and Supabase Edge Functions mapping to the Meta-approved **Interakt** WhatsApp API.

| Pipeline Element | Details |
|---|---|
| **Daily Brief Cron** | Pushes a daily production and payroll summary to Owners at 20:00 IST via `pg_cron`. |
| **Worker Payslips** | Pushes gross pay, deductions, and advance receipts to workers instantly. |
| **Pace Alerts** | Notifies the owner if active Orders risk missing delivery dates. |

---

## 8. Multi-Language (i18n)

- **Tri-Lingual Interface**: English, Hindi, and Gujarati (`t()` based translation).
- **Phonetic Transliteration**: Automatic translation of employee names to Devanagari/Gujarati for accurate payslip delivery.

---

## 9. Getting Started for Developers

1. **Environment**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `INTERAKT_API_KEY`.
2. **Setup**: `npm install && npm run dev`.
3. **Database**: The schema utilizes heavy Postgres RPCs (`supabase/migrations/`).
4. **Time & Math**: STRICTLY use `lib/time.ts` and `Decimal.js` (via `lib/finance.ts`). Never native JS dates/floats.
