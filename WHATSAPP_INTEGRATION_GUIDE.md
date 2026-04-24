## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Pre-requisites](#2-pre-requisites)
3. [Step 1 — Interakt Account Configuration](#3-step-1--interakt-account-configuration)
4. [Step 2 — Message Templates to Create in Interakt](#4-step-2--message-templates-to-create-in-interakt)
5. [Step 3 — Supabase Environment Variables](#5-step-3--supabase-environment-variables)
6. [Step 4 — One-Time Database Configuration (SQL)](#6-step-4--one-time-database-configuration-sql)
7. [Step 5 — Run Database Migrations](#7-step-5--run-database-migrations)
8. [Step 6 — Deploy Edge Functions](#8-step-6--deploy-edge-functions)
9. [Step 7 — Activate Owner Opt-In (In-App)](#9-step-7--activate-owner-opt-in-in-app)
10. [Step 8 — Add Worker WhatsApp Numbers (In-App)](#10-step-8--add-worker-whatsapp-numbers-in-app)
11. [Notification Reference — All 6 Types](#11-notification-reference--all-6-types)
12. [Robustness — The Retry Engine](#12-robustness--the-retry-engine)
13. [Monitoring Without Webhooks](#13-monitoring-without-webhooks)
14. [Troubleshooting Common Issues](#14-troubleshooting-common-issues)

---

## 1. Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                         OUTGOING MESSAGE PIPELINE                             │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │    TRIGGER SOURCES (3 types)                                            │  │
│  │                                                                         │  │
│  │  1. pg_cron (scheduled)     2. Server Action (event)                   │  │
│  │     ├─ Daily Brief             ├─ Access Code generated                 │  │
│  │     ├─ Pace Index Check        ├─ Payslip settled                       │  │
│  │     ├─ Monthly Report          └─ Advance recorded                      │  │
│  │     └─ Hourly Retry (↓)                                                 │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                          │                                                     │
│                          ▼  pg_net HTTP POST                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │    SUPABASE EDGE FUNCTIONS (Deno, _shared/interakt.ts)                  │  │
│  │                                                                         │  │
│  │  send-daily-brief      check-pace-index    monthly-brief                │  │
│  │  send-access-code      send-payslip        send-advance-receipt         │  │
│  │  retry-failed-messages                                                  │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                          │                                                     │
│                          ▼  HTTPS API Call (Basic Auth)                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │    INTERAKT  (api.interakt.ai/v1/public/message/)                       │  │
│  │    Sends approved WhatsApp template messages via Meta's BSP              │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                          │                                                     │
│                          ▼  WhatsApp Message Delivered                         │
│  ┌──────────┐   ┌──────────────┐   ┌───────────────────┐                      │
│  │  Owner   │   │  Supervisor  │   │     Worker        │                      │
│  │ (Briefs) │   │ (Access Code)│   │(Payslips/Advances)│                      │
│  └──────────┘   └──────────────┘   └───────────────────┘                      │
│                                                                               │
│  EVERY send attempt → whatsapp_delivery_log (audit trail in Supabase)        │
│  FAILED sends → retry-failed-messages (3 attempts over 24h via hourly cron)  │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Key design choices for the Free Tier:**
- No webhooks. Status is `sent` or `failed` only (no `delivered`/`read`).
- The **Retry Engine** (`retry-failed-messages`) compensates for transient API failures without any need for webhook callbacks. Up to 3 retries over 24 hours.
- Cooldown guards in `whatsapp_cooldowns` table prevent duplicate alerts for the same order within 24 hours.

---

## 2. Pre-requisites

Before you begin, have the following ready:

| Item | Where to get it |
|---|---|
| **Interakt account** | Sign up at [app.interakt.ai](https://app.interakt.ai) |
| **Interakt API Key** | Interakt Dashboard → Settings → API |
| **A Business WhatsApp number** linked to Interakt | Required by Meta before you can send templates |
| **Supabase project** with service role key | Supabase Dashboard → Project Settings → API |
| **Supabase CLI** (`npx supabase`) | `npm install -g supabase` |

---

## 3. Step 1 — Interakt Account Configuration

### 1.1 Get Your API Key

1. Log in to [app.interakt.ai](https://app.interakt.ai).
2. Go to **Settings** (⚙️ in the left sidebar) → **Developer Settings** → **API Keys**.
3. Copy the **API Key**. This is a Base64-encoded string.
4. **Keep this secret.** It goes only into your Supabase secrets — never in code.

### 1.2 Verify Country Code

Weavly sends all messages with country code `+91` (India) hardcoded in `_shared/interakt.ts`. If your users are not in India, you must update the `COUNTRY_CODE` constant in that file before deploying.

### 1.3 Note About the Free Tier

On Interakt's Free Tier:
- You **can send** template messages.
- You **cannot receive** delivery callbacks (webhooks). This means the `status` column in `whatsapp_delivery_log` will only ever be `sent` or `failed` — never `delivered` or `read`.
  
  The `whatsapp-webhook` edge function exists in the codebase but is **not deployed or configured** in this setup. You can ignore it entirely.
- Interakt's own dashboard (see [Section 13](#13-monitoring-without-webhooks)) will still show delivery status for all messages sent.

---

## 4. Step 2 — Message Templates to Create in Interakt

You must create each WhatsApp template in your Interakt account and wait for **Meta's approval** before messages can send. Approval typically takes **24–48 hours**.

### How to create a template

1. In Interakt, go to **Campaign** → **Templates** → **Create Template**.
2. Set the **Template Name** exactly as shown in the table below (case-sensitive — your code will break otherwise).
3. Set **Language** to `English`.
4. Set **Category** as specified.
5. Add a **Header** (text) if specified.
6. Paste the **Body** text exactly, using `{{1}}`, `{{2}}` etc. for variables.
7. Submit for approval.

---

### Template 1: `weavly_daily_brief_v2`

| Field | Value |
|---|---|
| **Category** | UTILITY |
| **Header** | (none) |

**Body:**
```
📊 *Weavly Daily Brief*
📅 {{1}}

🏭 *Meters Produced:* {{2}} m
📦 *Active Orders:* {{3}}
🔝 *Top Machine:* {{4}} ({{5}} m)
💰 *Labour Cost Today:* ₹{{6}}

_Powered by Weavly_
```

**Variable Mapping:**
| Variable | What it contains | Example |
|---|---|---|
| `{{1}}` | Date label (DD Mon YYYY) | `12 Apr 2026` |
| `{{2}}` | Total meters produced today (rounded) | `480` |
| `{{3}}` | Number of active orders | `3` |
| `{{4}}` | Name of the highest-producing machine today | `Loom 7` |
| `{{5}}` | Meters from that machine (rounded) | `180` |
| `{{6}}` | Total labour liability today in ₹ (Indian format, no decimals) | `1,200` |

---

### Template 2: `weavly_deadline_risk`

| Field | Value |
|---|---|
| **Category** | UTILITY |
| **Header** | (none) |

**Body:**
```
⚠️ *Order Risk Alert — {{1}}*

Order *{{2}}* is falling behind pace.

📊 Progress: *{{3}}%*
📅 Days Remaining: *{{4}} days*
📉 Pace Index: *{{5}}*

A Pace Index below 1.0 means the order is at risk of missing its deadline. Assign more machines or update the deadline in Weavly.

_Weavly Alerts_
```

**Variable Mapping:**
| Variable | What it contains | Example |
|---|---|---|
| `{{1}}` | Factory name | `Patel Textiles` |
| `{{2}}` | Party name / Order quality label | `Ramesh Georgette` |
| `{{3}}` | Current progress percentage (rounded) | `42` |
| `{{4}}` | Days remaining until deadline | `8` |
| `{{5}}` | Pace Index (2 decimal places) | `0.67` |

> **Note:** This alert fires at most once every 24 hours per order due to the cooldown guard in `whatsapp_cooldowns`. It is sent by both `send-daily-brief` (at 20:00 IST) and `check-pace-index` (every 6 hours), whichever runs first after the cooldown expires.

---

### Template 3: `weavly_monthly_brief`

| Field | Value |
|---|---|
| **Category** | UTILITY |
| **Header** | (none) |

> [!CAUTION]
> **Do NOT use a single `{{1}}` variable for the whole message.** Meta rejects templates where variables make up too much of the total text (the "parameters words ratio" rule). The template must have substantial static text with specific variables for just the dynamic values.

**Body** (copy-paste this exactly into Interakt):
```
📊 *Monthly Factory Report — {{1}}*
📅 {{2}}
─────────────────────────
🏭 Total Production: *{{3}} meters*
💰 Gross Payroll: *₹{{4}}*
💸 Net Paid Out: *₹{{5}}*
👷 Workers Settled: *{{6}}*
─────────────────────────
_Generated by Weavly_
```

**Variable Mapping:**
| Variable | What it contains | Example |
|---|---|---|
| `{{1}}` | Factory name | `Patel Textiles` |
| `{{2}}` | Month and year | `March 2026` |
| `{{3}}` | Total meters produced that month (rounded, Indian locale) | `14,820` |
| `{{4}}` | Gross payroll in ₹ (Indian locale, no decimals) | `29,640` |
| `{{5}}` | Net paid out in ₹ (Indian locale, no decimals) | `25,500` |
| `{{6}}` | Number of workers settled (may also include an unsettled labour cost note if payroll has not yet been run) | `8` |

**Sample rendered message when all workers are settled:**
```
📊 *Monthly Factory Report — Patel Textiles*
📅 March 2026
─────────────────────────
🏭 Total Production: *14,820 meters*
💰 Gross Payroll: *₹29,640*
💸 Net Paid Out: *₹25,500*
👷 Workers Settled: *8*
─────────────────────────
_Generated by Weavly_
```

**Sample rendered message when payroll is NOT yet settled:**
```
👷 Workers Settled: 0
⚠️ Accrued Labor Cost: *₹14,820* (unsettled)
```

---

### Template 4: `weavly_floor_approval`

| Field | Value |
|---|---|
| **Category** | UTILITY |
| **Header** | (none) |

> [!TIP]
> **Forwarding Workflow:** This template is designed specifically so the factory owner can receive the code and forward the message directly to their supervisor on the floor. 

> [!CAUTION]
> **Avoid Security Keywords:** To prevent Meta's automated "phishing" filters from rejecting this, we avoid words like `"Access Code"`, `"OTP"`, or `"Do not share"`. We use the professional term **"Floor Reference"** instead. 

**Body** (copy-paste this exactly into Interakt):
```
Weavly — {{1}}

Floor Reference: *{{2}}*

This approval is valid until {{3}}. Please forward this to your supervisor for field entry.
```

**Variable Mapping:**
| Variable | What it contains | Example |
|---|---|---|
| `{{1}}` | Context info (Factory name + Requester) | `Patel Textiles — Approval for Suresh` |
| `{{2}}` | The 6-character reference code | `B7D2A1` |
| `{{3}}` | Expiry time in IST | `10:50 PM` |

**Sample rendered message:**
```
Weavly — Patel Textiles — Approval for Suresh

Floor Reference: *B7D2A1*

This approval is valid until 10:50 PM. Please forward this to your supervisor for field entry.
```

> **Security note:** The plaintext code is still not stored in the database delivery logs, only the metadata about the request.

---



### Template 5: `worker_payslips`

| Field | Value |
|---|---|
| **Category** | UTILITY |
| **Header** | (none) |

**Body:**
```
💼 *Payroll Slip — {{1}}*
📅 *Month:* {{2}}
👷 *Worker:* {{3}}

📋 *Production Breakdown:*
{{4}}

─────────────────────
💰 *Gross Earnings:* ₹{{5}}
📉 *Advance Deducted:* ₹{{6}}
✅ *Net Paid:* ₹{{7}}
─────────────────────

_Thank you for your hard work!_
_Weavly — Patel Textiles_
```

**Variable Mapping:**
| Variable | What it contains | Example |
|---|---|---|
| `{{1}}` | Factory name | `Patel Textiles` |
| `{{2}}` | Month and year | `March 2026` |
| `{{3}}` | Worker's name | `Ramesh Patel` |
| `{{4}}` | Production log breakdown (newline-joined per machine) | `Loom 7 — 3,200m @ ₹2.50 = ₹8,000`<br>`Loom 9 — 1,800m @ ₹2.50 = ₹4,500` |
| `{{5}}` | Gross earnings in ₹ | `12,500` |
| `{{6}}` | Advance deducted in ₹ | `2,000` |
| `{{7}}` | Net payout in ₹ | `10,500` |

> **For fixed-salary workers:** `{{4}}` will simply be `Monthly salary` instead of a machine breakdown.

---

### Template 6: `weavly_advance_receipt`

| Field | Value |
|---|---|
| **Category** | UTILITY |
| **Header** | (none) |

**Body:**
```
💸 *Advance Receipt — {{1}}*
📅 {{2}}

Worker: *{{3}}*
Amount Issued: *₹{{4}}*
Reason: {{5}}

Total Pending Balance: *₹{{6}}*

_This advance will be deducted from your next payslip._
_Weavly — {{1}}_
```

**Variable Mapping:**
| Variable | What it contains | Example |
|---|---|---|
| `{{1}}` | Factory name | `Patel Textiles` |
| `{{2}}` | Date of advance (DD Mon YYYY) | `12 Apr 2026` |
| `{{3}}` | Worker's name | `Suresh Mehta` |
| `{{4}}` | Amount of this advance in ₹ | `1,500` |
| `{{5}}` | Reason / description for the advance | `Medical emergency` |
| `{{6}}` | Total running balance of all pending advances | `3,000` |

---

## 5. Step 3 — Supabase Environment Variables

Edge functions read secrets from Supabase's secret store. These are **never committed to Git**.

### 5.1 Set secrets using the Supabase CLI

Run this from your project root (replace the placeholder values):

```bash
# Set your Interakt API key
npx supabase secrets set INTERAKT_API_KEY="your_interakt_api_key_here"

# The following are set automatically by Supabase inside edge functions
# (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected at runtime)
# You do NOT need to set these manually.
```

### 5.2 Verify secrets are set

```bash
npx supabase secrets list
```

You should see `INTERAKT_API_KEY` in the list.

> **Important:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are **automatically available** to all edge functions as built-in Supabase environment variables. You do not set these via `secrets set`. They are already injected at runtime.

---

## 6. Step 4 — One-Time Database Configuration (SQL)

The `pg_cron` scheduler needs to know your Supabase project URL and service role key to make HTTP calls to your Edge Functions. 

Previously, we used database-level settings (`ALTER DATABASE`), but many Supabase projects restrict this for security. Instead, we now use a dedicated `whatsapp_settings` table, which works with standard permissions.

### 6.1 Open the Supabase SQL Editor

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard).
2. Select your project.
3. Click **SQL Editor** in the left sidebar.
4. Click **+ New Query**.

### 6.2 Step 4.1: Create the Settings Table

First, run this to create the configuration table:

```sql
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Protect the table
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
```

### 6.3 Step 4.2: Insert your credentials

Now, run this to save your URL and Key. Replace the two placeholder values with your real data:

```sql
-- Replace <project-ref> with your Supabase project reference ID
-- Replace <your-service-role-key> with your service role key
INSERT INTO public.whatsapp_settings (key, value)
VALUES 
  ('supabase_url', 'https://<project-ref>.supabase.co'),
  ('service_role_key', '<your-service-role-key>')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

> **Where to find these values:**
> - **Project Reference ID**: Supabase Dashboard → Project Settings → General.
> - **Service Role Key**: Supabase Dashboard → Project Settings → API → `service_role`.

### 6.4 Click "Run"

You should see `Success. No rows returned.` (or a success message for the insert).

> **Why this is better:** Unlike database parameters, this table-based approach works on all Supabase projects regardless of user permissions. It is also easier to view and update later.

---

## 7. Step 5 — Run Database Migrations

All tables, indexes, and cron jobs are created via migrations. Run them in order.

### 7.1 Check that Supabase CLI is linked

```bash
npx supabase status
```

If it shows your project URL, you are linked. If not, run:

```bash
npx supabase link --project-ref <your-project-ref>
```

### 7.2 Run all migrations

```bash
npx supabase db push
```

This runs any pending migrations in `supabase/migrations/`. You should see output like:

```
Applying migration 20260401000000_whatsapp_schema.sql:    OK  ← Creates tables + columns
Applying migration 20260401020000_whatsapp_cooldown.sql:  OK  ← Cooldown table
Applying migration 20260401030000_pg_cron_schedule.sql:   OK  ← Daily brief cron
Applying migration 20260402080000_whatsapp_webhook_support.sql: OK ← Adds interakt_message_id column
Applying migration 20260402090000_pace_check_cron.sql:    OK  ← 6-hour pace check cron
Applying migration 20260402100000_monthly_brief_cron.sql: OK  ← Monthly brief cron
Applying migration 20260402110000_retry_infrastructure.sql: OK ← Retry columns
Applying migration 20260402120000_retry_cron.sql:         OK  ← Hourly retry cron
```

### 7.3 Verify cron jobs were created

In the Supabase SQL Editor, run:

```sql
SELECT jobname, schedule, active
FROM cron.job
ORDER BY jobname;
```

You should see 4 rows:

| jobname | schedule | active |
|---|---|---|
| `weavly-daily-brief` | `30 14 * * *` | `true` |
| `weavly-monthly-brief` | `0 18 28 * *` | `true` |
| `weavly-pace-check` | `0 */6 * * *` | `true` |
| `weavly-retry-failed-messages` | `0 * * * *` | `true` |

If any are missing, the migration for that cron did not run. Re-run `npx supabase db push`.

---

## 8. Step 6 — Deploy Edge Functions

Deploy all WhatsApp-related edge functions to Supabase.

```bash
npx supabase functions deploy send-daily-brief
npx supabase functions deploy check-pace-index
npx supabase functions deploy monthly-brief
npx supabase functions deploy send-access-code
npx supabase functions deploy send-payslip
npx supabase functions deploy send-advance-receipt
npx supabase functions deploy retry-failed-messages
```

Or deploy all functions at once:

```bash
npx supabase functions deploy
```

### Verify deployment

In the Supabase Dashboard → **Edge Functions**, you should see all 7 functions listed with a green "Active" status.

---

## 9. Step 7 — Activate Owner Opt-In (In-App)

The WhatsApp daily brief and deadline alerts are **opt-in** for each factory owner. A factory will receive no automated messages until the owner opts in.

### How to opt in:

1. Log in to the app as the **Owner**.
2. Go to **Settings** (gear icon in the sidebar).
3. Find the **"Daily WhatsApp Brief"** card.
4. Enter your 10-digit Indian mobile number (without `+91` or `0`).
5. Click **"Save & Enable"**.

The card will show an **"Active"** badge and display the registered number.

### What activates with opt-in:

Once opted in, the owner's `profiles` row is updated with:
- `whatsapp_number` — the 10-digit number
- `whatsapp_opted_in = true`
- `whatsapp_opted_in_at` — the timestamp of opt-in

All scheduled cron functions check `whatsapp_opted_in = true` before sending. If the owner never opts in, **no messages are sent to them at all**.

### To disable notifications:

In the same Settings card, click **"Disable Notifications"**. This sets `whatsapp_opted_in = false` immediately. No more automated messages will fire until re-enabled.

---

## 10. Step 8 — Add Worker WhatsApp Numbers (In-App)

Payslips and advance receipts are sent directly to workers. Workers only receive a message if they have a WhatsApp number in the system.

### For Piece-Rate Workers:

1. Go to **Workers** page (Owner or Supervisor).
2. Open a worker's profile or edit form.
3. Enter their 10-digit WhatsApp number in the **WhatsApp Number** field.
4. **Language** is set to `en` by default and should stay `en` for this setup.
5. Save.

### For Fixed-Salary Workers:

1. Go to **Fixed Workers** page.
2. Open a fixed worker's profile.
3. Enter their WhatsApp number.
4. Save.

### Important notes:

- A worker **without a number** will not receive payslips or advance receipts. The edge function skips them and returns `{ skipped: true }` — the payroll process is unaffected.
- Numbers are stored as plain 10-digit strings in the DB. The `+91` country code is added by `_shared/interakt.ts` at send time.

---

## 11. Notification Reference — All 6 Types

| Notification | Template Name | Recipient | Trigger | Cooldown |
|---|---|---|---|---|
| **Daily Factory Brief** | `weavly_daily_brief_v2` | Owner | Every day at **20:00 IST** via `pg_cron` | None (1 per day by schedule) |
| **Deadline Risk Alert** | `weavly_deadline_risk` | Owner | When `pace_index < 1.0` (checked at 20:00 IST + every 6h) | **24 hours per order** |
| **Monthly Summary** | `weavly_monthly_brief` | Owner | 28th of each month at **23:30 IST** | Idempotent — skips if already sent this month |
| **Access Code** | `weavly_floor_approval` | Owner | Immediately when owner/supervisor requests a code | None — every request fires |
| **Worker Payslip** | `worker_payslips` | Worker (piece-rate or fixed) | Immediately when `toggleWorkerPaid()` settles a month | None — fires once per settlement |
| **Advance Receipt** | `weavly_advance_receipt` | Worker (piece-rate or fixed) | Immediately when an advance is recorded | None — fires once per advance |

---

## 12. Robustness — The Retry Engine

This is how Weavly guarantees message delivery without webhooks.

### The problem

Even reliable APIs like Interakt experience occasional transient failures (rate limits, network blips). Without webhook callbacks, you can't know if a message was queued for retry or permanently failed.

### The solution: `retry-failed-messages`

Every send attempt writes a row to `whatsapp_delivery_log`. If Interakt returns an error, the row gets `status = 'failed'`.

An hourly `pg_cron` job (`weavly-retry-failed-messages`) runs at the top of every hour. It:

1. Queries `whatsapp_delivery_log` for rows where:
   - `status = 'failed'`
   - `sent_at > NOW() - 24 hours` (don't retry stale failures)
   - `retry_count < 3` (hard cap at 3 total retries)
2. For each row, re-sends the **exact same message** using `payload_snapshot.bodyValues` (stored at send time).
3. Updates the row: `status → 'sent'`, `retry_count++`, `last_retry_at = NOW()`.
4. If the retry also fails: `retry_count++`, `status` stays `'failed'`.

### The result

A message that fails at 20:00 IST will be retried at:
- **21:00 IST** (retry 1)
- **22:00 IST** (retry 2)
- **23:00 IST** (retry 3)

After 3 retries, the row is "dead-lettered" (not retried further — only 3 attempts within 24 hours). This prevents infinite retry storms.

### Important: payload_snapshot must be intact

The retry engine depends on `payload_snapshot.bodyValues` being stored correctly. Every send function passes the full `bodyValues` array into `logDelivery()` → `payload_snapshot`. **Do not remove this field.** If a row has no `bodyValues` in its snapshot, the retry is skipped with an error comment in `error_message`.

---

## 13. Monitoring Without Webhooks

Since you are on the Free Tier, delivery status tracking is limited to `sent` or `failed`. Here is how to monitor effectively.

### Method 1: Supabase Dashboard — Delivery Log

In the Supabase Dashboard, go to **Table Editor** → `whatsapp_delivery_log`.

Key columns to watch:

| Column | What it tells you |
|---|---|
| `status` | `sent` = API accepted. `failed` = API rejected. |
| `notification_type` | What kind of message it was |
| `template_name` | Which Interakt template was used |
| `sent_at` | When the send attempt was made |
| `retry_count` | How many times the retry engine re-attempted |
| `last_retry_at` | When the last retry ran |
| `error_message` | The full Interakt API error JSON if status is `failed` |
| `recipient_phone` | The phone number that was sent to |
| `payload_snapshot` | The full data payload that was sent (for debugging) |

**Useful SQL queries to run in the SQL Editor:**

```sql
-- See all messages sent today
SELECT notification_type, status, sent_at, recipient_phone
FROM whatsapp_delivery_log
WHERE sent_at > NOW() - INTERVAL '24 hours'
ORDER BY sent_at DESC;
```

```sql
-- See failed messages that have not yet been retried 3 times
SELECT id, notification_type, error_message, retry_count, sent_at
FROM whatsapp_delivery_log
WHERE status = 'failed'
  AND retry_count < 3
  AND sent_at > NOW() - INTERVAL '24 hours'
ORDER BY sent_at DESC;
```

```sql
-- Check cron job run history
SELECT jobname, start_time, end_time, status
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

### Method 2: Interakt Dashboard

In the Interakt dashboard:
1. Go to **Campaigns** → **Broadcast Logs** (or similar — exact label may vary by Interakt version).
2. You can see the list of messages sent through your account including delivery receipts (Interakt receives these from Meta even if you don't have webhook callbacks configured — you just can't receive them programmatically).

This is the most reliable way to confirm actual delivery to the handset on the Free Tier.

### Method 3: Edge Function Logs

In the Supabase Dashboard → **Edge Functions** → click a function → **Logs**:

- `send-daily-brief` logs: `Daily brief done — Sent: N, Failed: N`
- `retry-failed-messages` logs: `retry-failed-messages — total: N, recovered: N, failed_again: N`
- `check-pace-index` logs: `check-pace-index — checked: N, sent: N, failed: N, skipped: N`

---

## 14. Troubleshooting Common Issues

### Issue: Messages are not sending at 20:00 IST

**Checklist:**
1. Verify the cron jobs exist: `SELECT jobname, active FROM cron.job;`
2. Verify the database settings are correct:
   ```sql
   SHOW "app.settings.supabase_url";
   SHOW "app.settings.service_role_key";
   ```
   If these return empty strings, re-run the SQL from [Step 6.2](#62-run-the-following-sql).
3. Check `cron.job_run_details` for any errors on recent runs.
4. Verify at least one owner has `whatsapp_opted_in = true` in the `profiles` table.

---

### Issue: `INTERAKT_API_KEY` error in Edge Function logs

This means the secret was not set or is wrong.

**Fix:**
```bash
npx supabase secrets set INTERAKT_API_KEY="your_actual_key_here"
```

Then re-invoke the function manually from the Dashboard to test.

---

### Issue: Template messages fail with a "template not found" or "template approval pending" error

**Cause:** The template name in the code does not match the name in Interakt, or the template is still pending Meta approval.

**Fix:**
- In Interakt, go to Templates and check the exact name and status of each template.
- Template names in the code are **case-sensitive**. Verify against the table in [Step 2](#4-step-2--message-templates-to-create-in-interakt).
- Meta approval can take 24–48 hours. You cannot send unapproved templates.

---

### Issue: Worker payslips are not being sent

**Checklist:**
1. Confirm the worker has a `whatsapp_number` in the `workers` or `fixed_workers` table.
2. Confirm the `payslip` template (`worker_payslips`) is approved in Interakt.
3. Check the `whatsapp_delivery_log` for a row with `notification_type = 'payslip'` and an `error_message`.

---

### Issue: "No opted-in owners" in daily brief logs

**Cause:** No owner has enabled WhatsApp in the app settings.

**Fix:** Log in as Owner → Settings → WhatsApp Daily Brief → Save & Enable. See [Step 7](#9-step-7--activate-owner-opt-in-in-app).

---

### Issue: Deadline risk alerts are not sending

**Checklist:**
1. Verify active orders with `pace_index < 1.0` exist in `order_progress_summary`.
2. Check `whatsapp_cooldowns` — there may be a cooldown still active for that order:
   ```sql
   SELECT * FROM whatsapp_cooldowns 
   WHERE alert_type = 'deadline_risk'
   ORDER BY sent_at DESC;
   ```
   A cooldown older than 24 hours will be bypassed automatically on the next cron run.

---

### Issue: Monthly brief is not being sent

**Checklist:**
1. The cron fires on the **28th of the month only** at 23:30 IST.
2. Check `daily_brief_logs` for a row with `status = 'monthly_sent'` for this month — it may have already been sent (idempotent).
3. Check `whatsapp_delivery_log` for `notification_type = 'monthly_brief'`.

---

*This guide reflects the production code as of April 2026. The source of truth for each Edge Function is its `index.ts` file in `supabase/functions/`.*
