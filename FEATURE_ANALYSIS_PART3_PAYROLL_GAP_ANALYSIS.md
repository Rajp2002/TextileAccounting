# Weavly — Comprehensive Feature Analysis: Payroll & Advances (With Gap Analysis)

> **Context**: This document provides an exhaustive breakdown of the Payroll & Advances (Upaad) module. It deeply analyzes the current technical implementation and then compares it against the real-world expectations and operational realities of the target user: **a Surat-based weaving factory owner**.

---

## 1. Feature Breakdown: The Current Implementation

### 1.1 The Advances (Upaad) System
Advances represent micro-loans or early wage withdrawals given to workers.
- **Data Model**: The `worker_advances` table uses a polymorphic relation (`meter_worker_id` / `fixed_worker_id`) to attach advances to any worker type.
- **Constraints**: Enforces `amount > 0` (no negative advances).
- **Audit & Status Tracking**: Advances have `pending` and `deducted` states. When deducted during payroll, they are linked to the overarching `settlement_id`.
- **Instant WhatsApp Receipts**: Every new advance triggers an Interakt template message sent to the worker's WhatsApp in their preferred language (Hindi/Gujarati/English), enhancing transparency.

### 1.2 The Payroll Engine & Calculation Rules
Weavly operates on a "Snapshot & Settle" paradigm to protect historical accuracy.

- **Immutability via Snapshots**: Piece-rate gross pay is computed strictly off the `worker_rate_snapshot` embedded in every individual `production_logs` row. Changes to quality rates today never alter historical ledger entries.
- **Fixed Workers**: Gross pay is dynamically pro-rated based on `attendance` (days present / total days in cycle) multiplied by their `monthly_salary`.
- **Decimal.js Hardened**: Floating point math errors are natively eliminated using precision libraries (`finance.ts`).
- **Flexible Payroll Configurations**: The `payroll_configs` table allows owners to set a custom `cycle_start_day` (e.g., cycle runs 15th to 14th) rather than strict calendar months.

### 1.3 The Settlement Transaction (`settle_worker_payroll` RPC)
When an owner clicks "Settle", a sophisticated, single-transaction PostgreSQL RPC fires:
1. **Aggregates Pending Debt**: Sums all `pending` advances for the worker.
2. **Indian Labor Law Compliance (The 50% Cap)**: Gross earnings can legally only be deducted up to 50% for standard advances. The RPC calculates: `MAX_DEDUCTION = Gross * 0.5`.
3. **Carry-Forward Logic (Splitting)**: Advances are recovered oldest-first natively. If a specific advance cannot be fully recouped due to the 50% cap threshold, the RPC **splits the row**:
   - Updates the original row to `deducted` for the exact capped amount.
   - Inserts a fresh `pending` advance row for the remainder so it correctly rolls over to the next month's debt.
4. **Final Settlement Override**: Owners can toggle "Final Settlement" for exiting workers, which bypasses the 50% rule and allows 100% advance recovery.
   - *Architecture Note on Negative Payouts*: If a worker has ₹15,000 in debt but their final gross pay is only ₹8,000, the RPC does *not* error out or produce a negative net payout. `v_actual_deduction` calculates `LEAST(15000, 8000)`, resulting in exactly `₹0` net payout. The remaining `₹7,000` translates to `carried_forward_debt`, which acts as an off-system recovery balance for the owner.
5. **UI Flags**: The frontend surfaces a visual "50% Cap Applied" amber badge for owners.

### 1.4 Reversal & Unsettling (`unsettle_worker_payroll`)
Mistakes happen (e.g., missing production logs).
- Owners can reverse a settlement, which deletes the `payroll_settlements` record and reverts all linked advance fractions back to pure `pending` status.
- This action is strictly protected by the **WhatsApp Access Code Guard** to ensure supervisors or malicious actors cannot manipulate historical ledgers.

### 1.5 Payout Delivery
- **Instant Digital Payslips**: Generates comprehensive PDF payslips entirely client-side.
- **WhatsApp Push**: Payslips are sent immediately via the `send-payslip` Edge Function to workers, showcasing Gross, Recouped Advances, Net Payout, and remaining Carry-Forward Debt.

---

## 2. Target User Alignment & Gap Analysis

When comparing the current Weavly implementation against the unpolished realities of a typical Indian weaving factory owner, several gaps emerge — ranging from missing workflows to rigid automations. 

### 🛑 Critical Gap 1: Inability to Manually Control the Deduction Cap
**The Expectation**: While the 50% legal cap is legally correct, Indian labor dynamics are relationship-based. During festival months (like Diwali), an owner might *choose* to deduct 0% of the advance to let the worker take full cash home. Or, a worker might voluntarily ask to pay back 70% of their gross to clear debt faster.
**Current State**: The `settle_worker_payroll` RPC auto-deducts up to exactly 50% (or 100%).
**The Gap**: **No manual override.** The owner is captive to the automatic calculation and cannot selectively edit the "Advances Recovered" amount just before settlement.

### 🛑 Critical Gap 2: Ad-hoc Additions and Deductions (Inam & Kapaat)
**The Expectation**: Besides advances, owners frequently deal with:
- **Kapaat (Fines/Deductions)**: Penalties for damages, machine neglect, or excessive yarn wastage.
- **Inam/Bhatta (Bonuses)**: Festival bonuses, production milestone rewards, or over-production stipends.
**Current State**: Completely missing. Weavly only calculates "Meters × Snapshot = Gross" and deducts "Advances".
**The Gap**: If an owner wants to dock ₹500 for a broken reed, or add a ₹1000 Diwali bonus, there is natively no way to achieve this. You cannot add a negative advance (`amount > 0` DB constraint blocks this).

### 🛑 Critical Gap 3: Missing Statutory PF/ESIC Deductions
**The Expectation**: Provident Fund (12% employee + 12% employer contribution) and Employee State Insurance (ESIC) are mandatory compliance deductions for registered factories above specific worker count thresholds.
**Current State**: The payroll engine completely ignores PF/ESIC calculations.
**The Gap**: For a factory with 30+ workers, this represents a severe legal and financial exposure. Even if deferred to a later version, the absence of this compliance layer restricts Weavly's viability for larger, fully above-board mills.

### ⚠️ Moderate-to-High Gap 4: Ledger Itemization on Payslips
**The Expectation**: The WhatsApp payslip is the primary artifact a worker shows their family, uses to dispute deductions, or carries home. Itemization is an absolute requirement to build trust.
**Current State**: Weavly aggregates deductions, displaying only "Advances Deducted: ₹2,100" without breaking down the dates/reasons.
**The Gap**: The trust-building premise of the WhatsApp receipt partially collapses if the payslip doesn't explicitly state *"Advance from Oct 3rd: ₹800, Advance from Oct 12th: ₹700, Advance from Oct 19th: ₹600"*. Without this, the owner will still face arguments and have to manually pull up the app to prove the math.

### ⚠️ Moderate Gap 5: Mid-Cycle Partial Payouts
**The Expectation**: A worker might want ₹5,000 of their *already-earned wages* paid out mid-cycle. This is not a loan against future work; it's a drawdown of current-cycle earnings.
**Current State**: The system only models Advances (Upaad).
**The Gap**: A mid-cycle payout would have to be incorrectly recorded as an advance (distorting the true Upaad balance) or handled off-system, leading to reconciliation headaches at settlement.

### 🔵 Low Gap 6: Advance Interest (Vyaaj)
**The Expectation**: While small Upaad is often interest-free, some Surat factory owners informally charge 1–2% per month on large personal loans (e.g., ₹50,000 for a wedding/medical).
**Current State**: Upaad is treated strictly as interest-free principal balance.
**The Gap**: Missing an `interest_rate` dimension on `worker_advances` to automatically compound debt.

### 🔵 Low Gap 7: Shift Differentials
**The Expectation**: Some factories give night-shift piece-rate workers or fixed workers a minor bump or allowance.
**Current State**: `worker_rate_snapshot` does not distinguish between day and night shifts automatically. 
*(Note: In grey fabric weaving in Surat, meter workers are traditionally paid purely on production irrespective of shift. This is a low-priority gap mostly relevant to spinning/processing units.)*

### 🔵 Low Gap 8: Weekly 'Kharchi' vs. Major Advances
**The Expectation**: Surat workers usually get a weekly "Kharchi" (₹500 - ₹1000 for standard groceries) given directly on the floor by supervisors, which is separate from major "Upaad" personal loans.
**Current State**: Both are grouped into the `worker_advances` table indistinguishably. Supervisors cannot issue Kharchi, forcing the owner to manually input every ₹500 dispersal.

---

## 3. Sharpened Recommendations for V2 Refinement

1. **Dynamic Settlement Modal with Legal Guards**: 
   - Expose an editable field for the "Advances Recovered" amount prior to settlement.
   - **Legal Risk Split**: If the owner edits the deduction *downward*, no warning is needed. If they edit the deduction *upward* past the 50% statutory threshold, explicitly surface a warning lock: *"This exceeds the legal 50% deduction limit. The worker's consent should be documented to avoid compliance exposure."*
   
2. **Payroll Adjustments Engine (Inam & Kapaat)**: 
   - Implement a new `payroll_adjustments` table. 
   - **Calculation Ordering**: This architectural decision is crucial. Bonuses should likely be added to *Gross Pay* BEFORE the 50% statutory deduction cap is calculated (giving the owner a higher absolute deduction ceiling). Fines should reduce Net Pay AFTER the deduction logic.
   - **Audit Protection**: For Kapaat (fines), the UI must mandate an explicit "Reason" field utilizing a pre-defined taxonomy (e.g., *Machine Damage, Yarn Wastage, Unexcused Absence*). Employers cannot legally unilaterally fine workers without documented grounds.

3. **Supervisor Kharchi Wallet (Funded Float)**: 
   - Building a supervisor dispersal interface is not just an RBAC change; it's a new trust surface.
   - Implement a **Funding Model**: Owners must pre-load a weekly "float" (e.g., ₹10,000) for a supervisor. The supervisor can then only disperse Kharchi up to that float's limit.
   - Enable strict per-supervisor audit logs showing exactly who distributed Kharchi to whom, preventing petty cash discrepancies.

4. **Detailed Notification Ledger**: 
   - Refactor the `send-payslip` Edge Function and the PDF generation logic to perform a `JOIN` on `worker_advances` where `settlement_id = current_settlement`. 
   - Pass an itemized array of dates and descriptions to the Meta API so the WhatsApp message includes the line-by-line proof of deduction.
