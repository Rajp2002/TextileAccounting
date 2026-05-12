# Weavly WhatsApp Templates Registry

This document lists the WhatsApp templates used in Weavly Phase 1. All templates use the direct Meta WhatsApp Cloud API.

## Templates

### 1. `worker_payslips`
- **Purpose**: Sends a monthly payslip summary to a worker.
- **Message Category**: Utility
- **Variables**:
  - `{{1}}`: Factory name
  - `{{2}}`: Month
  - `{{3}}`: Gross earnings
  - `{{4}}`: Advances deducted
  - `{{5}}`: Net payout
  - `{{6}}`: Carry-forward debt or "Advance Clear!"
- **Source Flow**: `toggleWorkerPaid` server action -> `send-payslip` edge function.
- **Example Content**:
  "*PAYROLL SLIP - Weavly Factory*
  ------------------------------
  *Worker:* Raj Patel
  *Month:* April 2026
  ------------------------------
  *Gross Earnings:* ₹15,000
  *Advances Deducted:* -₹2,000
  *Net Payout:* ₹13,000
  ------------------------------
  *Advance Clear!*"
- **Approval Status**: Assumed approved (in active use).
- **Implementation File**: `supabase/functions/send-payslip/index.ts`
- **Notes**: Followed by a freeform message with itemized breakdown.

### 2. `weavly_daily_brief_v2`
- **Purpose**: Sends a daily production summary to factory owners.
- **Message Category**: Utility
- **Variables**:
  - `{{1}}`: Factory name
  - `{{2}}`: Date
  - `{{3}}`: Total production (meters or weight)
  - `{{4}}`: Active machines count
  - `{{5}}`: Efficiency percentage
- **Source Flow**: Cron job -> `send-daily-brief` edge function.
- **Example Content**:
  "Daily Brief for Weavly Factory
  Date: 12 May 2026
  Total Production: 1,200 meters
  Active Machines: 10/12
  Efficiency: 85%"
- **Approval Status**: Assumed approved.
- **Implementation File**: `supabase/functions/send-daily-brief/index.ts`
- **Notes**: Scheduled daily at 20:00 IST.

### 3. `weavly_deadline_risk`
- **Purpose**: Alerts owners about orders at risk of missing deadlines.
- **Message Category**: Utility
- **Variables**:
  - `{{1}}`: Factory name
  - `{{2}}`: Order ID/Name
  - `{{3}}`: Current pace index
  - `{{4}}`: Deadline date
- **Source Flow**: Cron job -> `check-pace-index` / `send-daily-brief` edge function.
- **Example Content**:
  "Deadline Risk Alert
  Order #101 is falling behind.
  Current Pace: 0.8 (Target: >1.0)
  Deadline: 15 May 2026"
- **Approval Status**: Assumed approved.
- **Implementation File**: `supabase/functions/send-daily-brief/index.ts`
- **Notes**: Sent along with the daily brief if risks are detected.

### 4. `weavly_advance_receipt`
- **Purpose**: Sends a receipt to a worker when an advance is recorded.
- **Message Category**: Utility
- **Variables**:
  - `{{1}}`: Factory name
  - `{{2}}`: Date
  - `{{3}}`: Worker name
  - `{{4}}`: Amount issued
  - `{{5}}`: Reason
  - `{{6}}`: Running balance
- **Source Flow**: `createAdvance` server action -> `send-advance-receipt` edge function.
- **Example Content**:
  "Advance recorded for Raj Patel
  Amount: ₹2,000
  Date: 12 May 2026
  Reason: Medical
  Balance after advance: ₹5,000
  - Weavly Factory"
- **Approval Status**: Assumed approved.
- **Implementation File**: `supabase/functions/send-advance-receipt/index.ts`
- **Notes**: Manual fallback available if delivery fails.

### 5. `dispatch_update` (Planned)
- **Purpose**: Sends dispatch updates to customers or owners.
- **Message Category**: Utility
- **Variables**: TBD
- **Source Flow**: Dispatch creation/update.
- **Example Content**: TBD
- **Approval Status**: Pending
- **Implementation File**: Not yet implemented for direct Meta.
- **Notes**: Part of future scope or pilot if required.
