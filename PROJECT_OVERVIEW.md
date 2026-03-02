# Textile SaaS — In-Depth Product Overview

> **For new team members.** This document is your complete guide to understanding what we're building, why it matters, and exactly how every feature works. Read this top-to-bottom before your first commit.

---

## 1. The Problem We Solve

Textile mills and weaving factories are surprisingly manual places. Walk into most small-to-mid-sized factories in India and you'll find:

- **Paper ledgers** to track how many meters each worker produced on each machine today.
- **A calculator (or mental math)** to work out what each worker earned — since piece-rate pay (pay-per-meter produced) involves dozens of small multiplication steps across multiple machines.
- **No oversight layer** — the factory owner is often off-site, with zero visibility into what's actually happening on the floor until end-of-day.
- **Rounding errors and disputes** — small floating-point miscalculations on per-meter wages accumulate into real financial discrepancies workers notice on payday.
- **No accountability** — nothing stops a dishonest employee from retroactively changing a production number to inflate their payout.

**Textile SaaS** is a purpose-built platform that digitizes and secures all of this. It gives factory owners real-time visibility and gives supervisors a fast, reliable tool they can actually use on the factory floor — even without internet.

---

## 2. How the Platform is Organized

The app is a **multi-tenant SaaS**. Each factory that signs up becomes its own isolated **Organization**. All user data — workers, machines, production records, payroll — is completely ring-fenced to that organization. One factory can never see another's data.

Within an organization, there are two distinct roles:

| Role | Who they are | What they can do |
|---|---|---|
| **Owner** | Factory proprietor / manager | Full control: payroll, analytics, settings, all data |
| **Supervisor** | Floor manager | Operational tasks: log production, manage workers, mark attendance |

---

## 3. The Onboarding & Join Flow

When a new factory signs up, the **Owner** creates their organization and receives a unique **Factory Join Code** — a short alphanumeric code visible in Settings. This code is shared out-of-band (WhatsApp, in person) with supervisors who want to join. When a supervisor signs up, they enter this code to link themselves to the correct organization.

This means the Owner never needs to import a CSV or manually invite people via email. Any supervisor with the code can self-onboard.

---

## 4. The Owner Dashboard — Command Center

The owner's primary screen is their **analytics dashboard**. It's a date-scoped view, defaulting to today, that the owner can navigate to any past date to review.

### 4.1 The Three KPI Cards

At the top are three always-visible summary cards:

1. **Daily Production** — The total meters produced across all machines and workers for the selected date. A single number that tells the owner at a glance how much the factory made today.

2. **Production Payroll** — The total rupee cost of all piece-rate wages for that day. Calculated by multiplying each worker's logged meters by the rate-per-meter set for the machine they worked on, summed across all workers.

3. **Fixed Payroll** — What the salaried staff are costing this month, pro-rated to the current date for daily workers. Shows a count of "3 salaried + 2 daily" so the owner knows immediately how many of each type are active.

### 4.2 Worker Breakdown Table

Below the KPIs is a detailed, expandable table showing every piece-rate worker who produced this date. Each row shows the worker's name, total meters produced, and their calculated day-pay. Tapping a row expands it to show a **per-machine breakdown**: which machine, how many meters on that machine, the rate, and the resulting pay. This is the transparency layer — owners can verify exactly how every rupee was calculated.

### 4.3 Fixed Workers Panel

Below the worker breakdown is a list of all salaried/fixed staff. Each person is shown with a color-coded role badge (Master, Helper, Mender, Sanitation, Day-to-Day, Supervisor). The owner can **inline-edit any salary** directly from this panel — click the pencil icon, type the new value, press Enter. No separate settings screen needed.

For **Day-to-Day workers** (those paid per day present), the panel shows how many days they've worked so far this month and what they've earned so far, giving a running mid-month view of the payroll obligation.

### 4.4 Adding Workers (from the Owner Dashboard)

The owner has an **"Add Worker"** button on the analytics page with a dialog that distinguishes between:
- **Piece-Rate Workers** — added to the `workers` table, they get logged in production.
- **Fixed Salary Workers** — added to `fixed_workers` with a role and monthly salary.

---

## 5. The Payroll Module — Month-by-Month Settlement

The payroll page is where the owner **actually settles wages** at the end of each month. It's separate from the analytics view, which shows daily snapshots.

### 5.1 Month Navigation

The page opens on the current month. Chevron arrows navigate backward to previous months, allowing the owner to review and settle past periods. Future months are disabled.

### 5.2 Piece-Rate Workers Tab

Every active piece-rate worker who logged any production in the selected month appears here, **sorted by total payout descending** (highest earners first). Each card shows:
- Total meters produced across the entire month
- How many machines they worked
- Total calculated pay
- A **Paid / Pending** badge

Tapping a card **expands a full calculation breakdown**, showing the formula: `Machine Name | X meters × ₹Y/m = ₹Z` for every machine, with a grand total. This is the worker's equivalent of a payslip — transparent, auditable, verifiable.

The owner clicks **"Mark Paid"** when they hand over the cash. The card turns green. Clicking it again (now showing "Unmark") reverses it if there was a mistake. The paid timestamp is recorded.

### 5.3 Fixed Workers Tab

All salaried staff for the month appear here with the same Mark Paid / Unmark mechanic.

For **Day-to-Day workers**, the payout is calculated live from attendance: `(Monthly Salary ÷ 30) × Days Present`. The calculation breakdown shows the formula explicitly so there's no ambiguity.

For **standard salaried workers** (Master, Helper, etc.), the full monthly salary is shown as-is.

### 5.4 Summary Bar

Three summary cards at the top of the payroll page always show:
- **Total Owed** (everyone's pay this month)
- **Paid** (sum of those marked paid)
- **Outstanding** (what's left to hand out)

This gives the owner a running total of their payroll liability without manual arithmetic.

---

## 6. The Machine Management Module

Machines are first-class entities in our system — they're not just metadata. Each machine has:
- A **name** (e.g., "Loom A", "Rapier 3")
- A **rate per meter** — the rupee amount paid per meter produced on that machine
- An **active/inactive status**

The rate-per-meter varies by machine because different looms produce different fabric types at different commercial values. Setting this correctly is critical — every payroll calculation flows from it.

The **Owner** can add, rename, set rates, and mark machines inactive. **Supervisors** see the same machine list but cannot change rates or add new machines — they only see names and can assign workers to them.

---

## 7. The Supervisor Dashboard — The Floor Tool

Supervisors have a dedicated, streamlined dashboard with four core modules. The UI is designed for speed — large tap targets, mobile-first, minimal steps to accomplish each action.

### 7.1 Worker Assignments — Who Runs Which Machine

Before logging production, a supervisor sets up **machine assignments**: for a given shift (Day or Night), which worker is on which machine. This is persistent state — once set, it carries forward to the production logging screen automatically.

Assignments are shift-aware. A day shift assignment is separate from a night shift one. The same machine may have different workers across shifts.

Supervisors cannot edit machine rates from this screen — that's strictly the owner's privilege.

### 7.2 Production Logging — The Core Daily Task

This is the most-used screen in the entire app. Its job is simple: record how many meters each machine produced this shift.

**How it works:**
- The page loads with all machines for the organization.
- For each machine card, it auto-fills in the assigned worker's name (from the assignment set earlier).
- The supervisor enters the meter count — either by typing, or using the **+10 / –10 quick-increment buttons** which make it fast to enter values without a keyboard.
- A real-time **estimated pay** is shown as meters are typed, so the supervisor can spot wildly off numbers immediately.
- Clicking **Save All Entries** submits all machines at once in a batch.

**Shift Toggle:** The header has a prominent Day Shift / Night Shift toggle. Switching shifts changes which assignments are loaded — so the right worker appears for each shift automatically. The app even auto-detects the correct shift (7AM–7PM = Day, 7PM–7AM = Night) on load.

**Date Picker:** The supervisor can navigate to any past date to log or review entries. Future dates are blocked.

**Offline Mode:** If the factory has bad Wi-Fi or no signal, the app detects this and **queues the entries locally** using an offline-first database (IndexedDB). When connectivity returns, they sync automatically in the background. The supervisor sees a clear toast notification telling them their entries are "queued (offline)" rather than "saved." Nothing is lost.

**The Lock System (Tamper Prevention):** Once a shift's production entries are saved, they go **read-only** — the input fields grey out and a yellow banner appears: *"Some entries are already saved and locked."* This prevents retroactive changes to numbers after the fact.

To edit a saved entry, the supervisor must click **"Unlock to Edit"** and enter a **6-character single-use access code** generated by the Owner from their Settings page. The code is consumed after one use, so the owner must explicitly authorize every edit, creating a clear accountability trail.

### 7.3 Attendance — Tracking Day-to-Day Workers

This module tracks daily presence for workers on a per-diem / day-rate pay structure (called "Day-to-Day" workers).

The screen shows a list of all active Day-to-Day workers, each with a green ✓ or red ✗ indicator. Tapping a name toggles their attendance. The header shows a live "Present / Total" counter (e.g., "4 / 5").

At the bottom is a **Save Attendance** button that submits the entire day's record.

**Past Date Security:** If a supervisor tries to save attendance for a *previous* date, the app intercepts with the same access code verification flow — preventing backdated attendance manipulation (which would inflate a worker's day-count and therefore their salary).

### 7.4 Worker Management — Adding and Removing Workers

Supervisors can add new piece-rate workers directly from this screen without needing to bother the owner. They enter the worker's name and the screen automatically adds them to the organization's worker pool.

Removing a worker, however, requires an **access code**, since deleting a worker also deletes their historical production data — an irreversible action the owner needs to authorize.

---

## 8. The Access Code System — Owner Authorization Layer

The access code system is one of the most important security features of the app. It solves a fundamental problem: supervisors need *some* ability to correct mistakes, but owners need to remain in control of data integrity.

The **Owner generates a single-use 6-character code** from their Settings page at any time. They share it verbally or via message with the supervisor. The supervisor enters it in the app to unlock the one action it was generated for. The code is then marked as spent and cannot be reused.

This system is used for:
- Editing a locked (saved) production entry
- Saving attendance for a past date
- Deleting a worker record

This means there's always a human approval step before any retroactive or destructive operation — the owner *knows* they authorized it.

---

## 9. Settings — Factory Configuration

The Owner's settings page is clean and focused:

- **Factory Name** — the organization's display name.
- **Factory Join Code** — the code supervisors use to self-onboard. Displayed prominently for easy sharing.
- **Access Code Generator** — generates single-use authorization codes on demand.
- **Personal Info** — owner's name and phone number on file.
- **Log Out** button.

---

## 10. Data Security & Multi-Tenancy

Every single database operation in this app enforces at least one of these layers:

1. **Authentication** — you must be logged in, period.
2. **Row Level Security (RLS)** — PostgreSQL-level policies ensure every query is automatically scoped to the user's `org_id`. It's impossible, even with a crafted request, to read or write another organization's data.
3. **Role Policies** — Some operations are additionally restricted by `role` (e.g., only `owner` can delete workers, edit machine rates, etc.)
4. **JWT Claims** — The user's `org_id` and `role` are embedded directly in their session token and verified on every request, avoiding expensive subqueries.
5. **Access Codes** — Single-use codes add a human approval gate on top of technical authorization for sensitive mutations.

---

## 11. The Worker Model in Full

Workers in this system come in two types, tracked in separate database tables:

### Piece-Rate Workers (`workers` table)
- Paid per meter of fabric produced.
- Their pay is calculated as: `Σ (meters on machine X × rate for machine X)` across all machines they worked.
- Can be set active/inactive (inactive workers still appear in historical logs but don't show in active assignment lists).
- Logged via production entries every shift.

### Fixed / Salaried Workers (`fixed_workers` table)
- Have a fixed `monthly_salary`.
- Come in several roles: **Master, Supervisor, Helper, Mender, Sanitation** (full monthly salary) and **Day-to-Day** (pro-rated by attendance).
- Day-to-Day pay formula: `(monthly_salary / 30) × days_present_this_month`.
- Tracked via the Attendance module.

---

## 12. Where Things Stand & What You'll Be Working On

Here's recent work that has shaped the codebase:

- **Security hardening:** Closed a privilege escalation vulnerability in the supervisor invite flow. Optimized all RLS policies to use JWT claims instead of subquery lookups — both more secure and faster.
- **Payroll precision:** Rebuilt payroll calculations using decimal-safe arithmetic to prevent floating-point rounding errors that were causing small but real discrepancies in worker payouts.
- **Offline-first production logging:** The supervisor production page now queues mutations in IndexedDB when offline and syncs on reconnect. This was a factory-floor reliability requirement.
- **Access code system:** Implemented the full single-use code flow for tamper-proof retrospective edits across production logs, attendance, and worker deletion.
- **PWA:** The app is installable as a Progressive Web App — supervisors can add it to their phone's home screen and use it like a native app.

---

## 13. Getting Started

1. Get the Supabase credentials for the local dev environment from the project lead.
2. Clone the repo, run `npm install`, then `npm run dev`.
3. Sign up as a new Owner to create your own test organization, or ask to be added to the dev org.
4. Spend time going through each supervisor module manually — log some production, mark attendance, try the access code unlock flow. Understanding the UX as a user is essential before touching the code.
5. Read through `supabase/migrations/` in order — the schema tells you exactly what data exists and what the constraints are.

Welcome to the team. The goal is to build something factory owners and workers can genuinely rely on, every day.
