# Textile SaaS — Comprehensive Bulk Testing Guide

> **For the QA tester / intern.** Work through every section top-to-bottom. For each test case, record ✅ (Pass), ❌ (Fail), or ⚠️ (Partial / Needs Discussion) in the checkbox. Add notes for anything unexpected.

---

## How to Use This Guide

1. **Environment**: Run the app locally (`npm run dev`) or use the staging deployment.
2. **Browsers**: Test primarily in Chrome (desktop + mobile emulation). Cross-check Safari for PWA install.
3. **Accounts needed**: You'll need to create at least **two Owner accounts** (for cross-tenant checks) and **one Supervisor account**.
4. **Convention**: Where a test says "Verify X," take a screenshot if the result is unexpected.
5. **Time estimate**: Full run-through ≈ 3–4 hours.

---

## 1. Authentication & Onboarding

### 1.1 Landing Page
- [ ] Navigate to `/`. Verify the landing page loads without errors.
- [ ] Verify "Sign in" and "Create an account" links are visible and functional.
- [ ] If already logged in, verify you are **automatically redirected** to the correct dashboard (Owner → `/owner/analytics`, Supervisor → `/supervisor/production`).

### 1.2 Owner Signup Flow
- [ ] Navigate to `/signup`. Verify the page renders correctly with Factory name, Your name, Email, Phone Number, and Password fields.
- [ ] **Phone validation**: Enter an invalid phone number (e.g. 5 digits, or letters). Verify inline validation enforces exactly 10 numeric digits.
- [ ] Verify the **role selector** shows "Factory Owner" and "Supervisor" options. Select "Factory Owner."
- [ ] Verify a **"Factory / Organization Name"** field appears when Owner is selected.
- [ ] **Password validation**: Try submitting with a password shorter than 6 characters. Verify a validation error appears.
- [ ] **Password mismatch**: Enter mismatched passwords. Verify the "Passwords do not match" error appears inline in red below the confirm field.
- [ ] **Show/hide password**: Click the eye icon on the password field. Verify it toggles visibility.
- [ ] **Successful signup**: Fill all fields correctly and submit. Verify:
  - A loading modal ("Creating your account...") appears.
  - A success toast ("Account created!") appears.
  - You are redirected to `/owner/analytics`.
- [ ] **Factory Join Code shown**: If the signup routes through the `/onboarding` flow, verify the Join Code success screen shows the code in large mono font. Verify the "Copy ID" button copies to clipboard. Verify "Go to Dashboard" navigates correctly.

### 1.3 Supervisor Signup Flow
- [ ] Open an **incognito/private window** (to avoid session conflicts).
- [ ] Navigate to `/signup`. Select the "Supervisor" role.
- [ ] Verify the Join Code input is **uppercase, monospace, centered, with tracking/spacing**, max 8 characters.
- [ ] **Invalid Join Code**: Type exactly 8 invalid characters (e.g., `12345678`). Verify it automatically validates and shows an invalid code error inline.
- [ ] **Valid Join Code**: Type exactly the 8 characters of the Owner's real Join Code. Verify it automatically slides open the details form (Name, Email, Phone, Password) without pressing Enter.
- [ ] **Submit with Phone**: Complete the remaining details, including a valid 10-digit phone number. Submit. Verify:
  - Success toast appears.
  - Redirect to `/supervisor/production`.

### 1.4 Login Flow
- [ ] Navigate to `/login`. Verify the page renders with Email and Password fields.
- [ ] **Wrong credentials**: Enter an incorrect email/password. Verify an error toast appears ("Invalid login credentials").
- [ ] **Correct credentials (Owner)**: Login with the Owner account. Verify redirect to `/owner/analytics`.
- [ ] **Correct credentials (Supervisor)**: Login with the Supervisor account. Verify redirect to `/supervisor/production`.
- [ ] Verify the "Don't have an account? Create an account" link navigates to `/signup`.
- [ ] Verify the "Already have an account? Log in" link on the signup page navigates to `/login`.

### 1.5 Logout
- [ ] As Owner: click the logout button. Verify a "Signing out securely..." loading modal appears. Verify redirect to `/login`.
- [ ] As Supervisor: click the logout button in the header. Same verification.

### 1.6 Session Timeout (Inactivity)
- [ ] Login as any user. Note the time.
- [ ] Leave the app idle for over **1 hour** (or manually delete/expire the `last_activity` cookie in DevTools → Application → Cookies).
- [ ] Refresh the page. Verify you are **automatically logged out** and redirected to `/login`.

---

## 2. Navigation & Layout

### 2.1 Owner Sidebar (Desktop)
- [ ] On a desktop-width screen, verify the **left sidebar** is visible with:
  - Factory name at the top
  - Owner's name displayed
  - Navigation links: Dashboard, Machines, Fixed Workers, Payroll, Advances, Inventory, System Health, Settings
- [ ] Click each navigation link. Verify the correct page loads.
- [ ] Verify the active page is visually highlighted in the sidebar.

### 2.2 Owner Navigation (Mobile)
- [ ] Resize the browser to mobile width (< 768px). Verify the sidebar collapses.
- [ ] Verify a **bottom navigation bar** appears for mobile.
- [ ] Tap each item in the bottom nav. Verify correct page loads.

### 2.3 Supervisor Header & Navigation
- [ ] Login as Supervisor. Verify the **sticky header** shows:
  - Factory name (or "Vastra" fallback)
  - "Supervisor" badge in uppercase teal text
  - Language switcher dropdown
  - Logout button
- [ ] Verify the **tab navigation bar** below the header has: Production, Assignments, Workers, Machines, Attendance.
- [ ] Click each tab. Verify the correct page loads.
- [ ] On mobile, verify a **hamburger menu** appears with navigation options.

---

## 3. Machine Management

### 3.1 Owner — Add Machine
- [ ] Navigate to the **Machines** page as Owner.
- [ ] Click **"Add Machine"**. Verify the dialog appears with "Machine Name" and "Rate per Meter (₹)" fields.
- [ ] Enter a name (e.g., "Loom Test-A") and a rate (e.g., `2.50`). Click Save.
- [ ] Verify a success toast ("Machine added successfully") and the new machine appears in the list.
- [ ] Verify the rate is displayed correctly (₹2.50).

### 3.2 Owner — Edit Machine Rate
- [ ] On an existing machine, click to edit the rate. Change it (e.g., from ₹2.50 to ₹3.00).
- [ ] Verify a success toast ("Rate updated") and the new rate persists after page refresh.

### 3.3 Owner — Rename Machine
- [ ] Rename an existing machine. Verify the new name persists.

### 3.4 Owner — Deactivate Machine
- [ ] Mark a machine as **inactive**. Verify it no longer appears in active assignment lists on the Supervisor dashboard.
- [ ] Verify it still appears in historical production logs if it was used before.

### 3.5 Owner — Delete Machine (Access Code Required)
- [ ] Attempt to delete a machine. Verify the system prompts for a **6-character access code**.
- [ ] Enter an **invalid code**. Verify it is rejected.
- [ ] Generate a valid code from Settings. Enter it. Verify the machine is deleted with a success toast.

### 3.6 Supervisor — View-Only Restrictions
- [ ] Login as Supervisor. Navigate to the Machines page.
- [ ] Verify you can **see** machines and their names.
- [ ] Verify there is **no** "Add Machine" button visible.
- [ ] Verify there is **no** option to edit rates or delete machines.
- [ ] Verify worker-to-shift assignment dropdowns **are** visible and functional.

---

## 4. Worker Management

### 4.1 Owner — Add Piece-Rate Worker
- [ ] On the Owner dashboard, click **"Add Worker"**.
- [ ] Select "Meter Worker" type. Enter a name (e.g., "Test Worker A").
- [ ] Submit. Verify success toast and the worker appears in the piece-rate workers list.

### 4.2 Owner — Add Fixed Salary Worker
- [ ] Click **"Add Worker"** again. Select "Fixed Salary" type.
- [ ] Select a role (e.g., "Master"). Enter name and monthly salary (e.g., ₹15,000).
- [ ] Submit. Verify the worker appears in the Staff Payroll / Fixed Workers section on the dashboard.
- [ ] Verify the role badge color is correct.

### 4.3 Owner — Add Day-to-Day Worker
- [ ] Add another Fixed worker with role **"Day-to-Day"** and a monthly salary.
- [ ] Verify it appears with the "Attendance-based" badge on the fixed workers page.

### 4.4 Owner — Inline Edit Salary
- [ ] On the Owner dashboard's **Staff Payroll** panel, locate a fixed worker.
- [ ] Click the **pencil icon** to edit their salary inline.
- [ ] Change the salary value and press Enter (or click away).
- [ ] Verify a success toast ("Salary updated") and the new value is displayed without page reload.

### 4.5 Owner — Fixed Workers Page
- [ ] Navigate to `/owner/fixed-workers`. Verify the full list of fixed workers appears.
- [ ] Verify the total **Monthly Fixed Payroll** summary card is accurate.
- [ ] Click **"Edit Worker"** on a worker. Verify you can change name, role, and salary.
- [ ] Try to delete a fixed worker. Verify:
  - The access code dialog appears with the warning text.
  - If the worker has an outstanding advance, verify the **"Outstanding Advance Detected"** warning with their balance.

### 4.6 Supervisor — Add Worker
- [ ] As Supervisor on the Workers page, click **"Add Worker"**.
- [ ] Add a new piece-rate worker. Verify success.

### 4.7 Supervisor — Delete Worker (Access Code Required)
- [ ] Attempt to delete a worker. Verify the access code prompt appears.
- [ ] Enter an **invalid code**. Verify rejection.
- [ ] Generate a valid code from the Owner's Settings. Enter it as Supervisor.
- [ ] Verify the worker is successfully deleted and removed from the list.

### 4.8 Supervisor — Worker Tabs
- [ ] Verify the Workers page has two tabs: **"Meter Workers"** and **"Fixed Staff"**.
- [ ] Verify active/inactive counts are displayed correctly.
- [ ] Toggle a worker's active status. Verify the lists update.

---

## 5. Worker Assignments (Supervisor)

### 5.1 Shift Toggle
- [ ] Navigate to the **Assignments** page as Supervisor.
- [ ] Verify the **Day Shift / Night Shift** toggle is visible.
- [ ] Select "Day Shift" and assign workers to machines.
- [ ] Switch to "Night Shift". Verify the assignments are **independent** (either empty or different workers).

### 5.2 Assigning Workers
- [ ] For each machine, use the dropdown to assign a specific worker to that machine for the current shift.
- [ ] Verify a success toast ("Worker assigned to shift") appears after each assignment.

### 5.3 Persistence
- [ ] After assigning workers, refresh the page.
- [ ] Verify the assignments persist for the correct shift.
- [ ] Switch shifts and verify each shift's assignments are independently saved.

---

## 6. Production Logging (Supervisor) — The Core Loop

### 6.1 Page Load & Auto-Detection
- [ ] Navigate to **Production** as Supervisor. Verify the page loads with all machines from the organization.
- [ ] Verify the **shift is auto-detected** based on current time (7AM–7PM = Day, 7PM–7AM = Night).
- [ ] Verify the correct shift's assigned workers auto-fill into each machine card.

### 6.2 Date Picker
- [ ] Verify the default date is **today**.
- [ ] Use the date picker to navigate to yesterday. Verify all data updates for that date.
- [ ] Try selecting a **future date**. Verify it is blocked/disabled.

### 6.3 Meter Input & Real-Time Estimate
- [ ] On a machine card, enter a meter value (e.g., `150`).
- [ ] Verify the **estimated pay** calculates in real-time: `meters × rate_per_meter`.
- [ ] Example: If rate = ₹2.50 and meters = 150, verify the estimate shows ₹375.

### 6.4 Quick Increment Buttons
- [ ] Use the **+10** button. Verify the meter value increases by 10.
- [ ] Use the **-10** button. Verify the meter value decreases by 10.
- [ ] Verify the estimated pay updates instantly with each increment.
- [ ] Verify the value cannot go below 0 with the -10 button.

### 6.5 Save All Entries
- [ ] Enter production values for multiple machines.
- [ ] Click **"Save All Entries"**. Verify:
  - A success toast appears.
  - The button shows a loading state during save.

### 6.6 Locking Mechanism (Tamper Prevention)
- [ ] After saving, verify:
  - All saved entries become **read-only** (input fields are greyed out).
  - A **yellow banner** appears: "Some entries are already saved and locked."
  - The +10 / -10 buttons are disabled for locked entries.

### 6.7 Unlock to Edit (Access Code Challenge)
- [ ] Click **"Unlock to Edit"** on a locked entry.
- [ ] Verify the **access code dialog** appears, explaining that an Owner code is required.
- [ ] Enter an **invalid code**. Verify it is rejected.
- [ ] Generate a valid code from the Owner's Settings.
- [ ] Enter the valid code. Verify the entries unlock and become editable again.
- [ ] Edit a value and save.

### 6.8 Single-Use Code Verification
- [ ] Try using the **same code again** to unlock another action.
- [ ] Verify the code is rejected as **spent/expired** ("Invalid or expired code" or similar).

### 6.9 Machine Setup Requirements (Beam / Order Linking)
- [ ] If the production page shows **"Setup Required"** badges:
  - Verify the three setup indicators: Worker Assigned ✓, Beam Loaded ✓/✗, Order Linked ✓/✗.
  - Click **"Start Beam"** — verify the beam selector dialog opens with active yarn batches from inventory.
  - Click **"Link Order"** — verify the order selector dialog opens with active orders.
  - Verify production input is disabled until all setup steps are completed.

---

## 7. Offline Mode (Production Page)

### 7.1 Going Offline
- [ ] Open Chrome DevTools → Network tab → check **"Offline"** (or turn off Wi-Fi/Ethernet).
- [ ] Verify the app is still usable — the page doesn't crash.

### 7.2 Logging Production Offline
- [ ] Enter production values for machines while offline.
- [ ] Click **"Save All Entries"**.
- [ ] Verify a toast notification says **"Queued (offline)"** instead of "Saved."

### 7.3 Background Sync
- [ ] Re-enable network connectivity.
- [ ] Verify the queued entries **sync automatically** to the server in the background.
- [ ] Verify the entries then appear as locked (same as normal online saves).
- [ ] Verify no data was lost during the offline period.

---

## 8. Attendance Tracking (Supervisor)

### 8.1 Mark Present/Absent
- [ ] Navigate to the **Attendance** page. Verify all active Day-to-Day workers are listed.
- [ ] Verify each worker shows a **green ✓** (present) or **red ✗** (absent) toggle.
- [ ] Tap a worker's name/toggle. Verify it switches between present and absent.
- [ ] Verify the header counter updates live (e.g., "3 / 5 Present").

### 8.2 Save Attendance
- [ ] Set attendance for today. Click **"Save Attendance"**.
- [ ] Verify a success toast and the data persists on page refresh.

### 8.3 Attendance Locking
- [ ] After saving, verify the entries become **read-only** with the locked banner.
- [ ] Verify the "Unlock to Edit" button appears.
- [ ] Verify editing requires an access code.

### 8.4 Backdated Attendance Protection
- [ ] Change the date picker to **yesterday** (or any past date).
- [ ] Try to save attendance. Verify the system **intercepts** with the access code dialog.
- [ ] Verify the dialog explains that saving past attendance requires an Owner authorization code.
- [ ] Enter a valid code. Verify the save proceeds.
- [ ] Verify the per-day rate is shown next to each worker.

### 8.5 Already-Saved Entry Warning
- [ ] Try saving attendance for a date that already has data.
- [ ] Verify an appropriate warning message about the entry already being saved.

---

## 9. Owner Dashboard & Analytics

### 9.1 Greeting & Date
- [ ] Login as Owner. Verify the greeting changes based on time of day:
  - Before 12 PM: "Good morning"
  - 12 PM – 6 PM: "Good afternoon"
  - After 6 PM: "Good evening"
- [ ] Verify the Owner's name appears in the greeting.
- [ ] Verify "Today" label with today's date is displayed.

### 9.2 Three KPI Cards
- [ ] **Daily Output**: Verify the total meters figure matches what was logged in production for today.
- [ ] **Wages Today**: Verify the total ₹ amount matches `Σ(meters × rate)` across all piece-rate workers logged today.
- [ ] **Fixed Payroll**: Verify the card shows the count of salaried and daily workers (e.g., "3 salaried + 2 daily") and a pro-rated monthly cost.

### 9.3 Live Orders Section
- [ ] If orders are active, verify:
  - The **"Live Orders"** section appears with the count of active orders.
  - Order cards display: party name, quality, progress bar, health index, pace indicator, deadline, estimated finish.
  - Each card has a "View Details" and "Link Machines" option.
- [ ] **Single order**: Verify it displays in a **hero/wide** layout.
- [ ] **2–3 orders**: Verify they display in a **grid** layout.
- [ ] **4+ orders**: Verify the display switches to a **carousel** with scroll-snapping and navigation affordances.

### 9.4 Create / Edit / Delete Order
- [ ] Click **"Create New Order"**. Verify the dialog asks for: Party Name, Quality, Target (meters), Start Date, Deadline.
- [ ] Fill in details and click **"Launch Order"**. Verify success toast and the new order appears.
- [ ] Click **"Edit Order"** on an existing order. Modify values. Click **"Update Order"**. Verify changes persist.
- [ ] Click **"Delete Order"**. Verify the confirmation dialog appears. Confirm deletion. Verify the order is removed.

### 9.5 Order Machine Linking
- [ ] On an order card, click **"Link Machines"**.
- [ ] Verify a dialog opens listing all machines. Select one or more machines.
- [ ] Click **"Save Assignment"**. Verify success toast ("Machines assigned successfully").
- [ ] Verify the order card now shows the linked machine count.

### 9.6 Worker Breakdown Table
- [ ] Below the KPI cards, verify all piece-rate workers who produced today are listed.
- [ ] Verify each row shows: worker name, total meters, total pay.
- [ ] **Expand a row**: Tap/click a worker's name. Verify the per-machine breakdown appears:
  - Machine name | meters × rate = ₹ amount
  - Total matches the row summary.

### 9.7 Staff Payroll Panel
- [ ] Verify all fixed/salaried workers are listed below the worker breakdown.
- [ ] Each worker shows: name, role badge (color-coded), and salary.
- [ ] **Day-to-Day workers**: Verify the display shows days worked so far this month and earnings to date.
- [ ] **Inline salary edit**: Click the pencil icon on a fixed worker, change the salary. Verify it updates.

### 9.8 Past-Date Navigation
- [ ] Use the date picker to navigate to **yesterday** or an earlier date.
- [ ] Verify all KPIs, worker breakdowns, and staff panels update to reflect that date's data.
- [ ] Verify future dates are disabled/blocked.

### 9.9 Efficiency & Leakage Alerts
- [ ] If inventory batches are active, verify the **Efficiency** section shows variance data.
- [ ] If any batch has high leakage (> 5% negative variance), verify the **"Leakage Alerts"** section appears with the batch flagged as "High Leakage."

---

## 10. Monthly Payroll Settlement

### 10.1 Page Load & Month Navigation
- [ ] Navigate to **Payroll** as Owner. Verify it opens on the **current month**.
- [ ] Click the **left chevron** to go to the previous month. Verify data updates.
- [ ] Click the **right chevron** to go forward. Verify the **future month is disabled**.

### 10.2 Summary Bar (Three Cards)
- [ ] Verify **"Total Owed"** shows the sum of all worker pay for the selected month.
- [ ] Verify **"Paid"** shows zero initially (or the sum of those already marked paid).
- [ ] Verify **"Outstanding"** = Total Owed − Paid − Deductions.
- [ ] Verify a **"Deductions"** card shows the total advance deductions.

### 10.3 Piece-Rate Workers Tab
- [ ] Verify the **"Meter Workers"** tab is active by default.
- [ ] Verify workers are sorted **descending by total payout** (highest earners first).
- [ ] Verify each card shows: worker name, total meters, machine count, total pay, Paid/Pending badge.
- [ ] Verify the **"pending"** count badge on the tab header is accurate.

### 10.4 Calculation Breakdown (Piece-Rate)
- [ ] Expand a worker's card by tapping/clicking it.
- [ ] Verify the breakdown shows: `Machine X | Y meters × ₹Z/m = ₹Amount` for each machine.
- [ ] Verify the **Grand Total** at the bottom matches the card's summary.
- [ ] If the worker has an advance, verify:
  - "Gross Pay" is shown.
  - "Advance Deduction" line item is subtracted.
  - "Net Pagar" shows the final amount.
  - "Remaining Debt (carry-over)" is shown if the advance exceeds the pay.
  - A **"High Debt"** or **"Debt Risk"** badge appears if applicable.

### 10.5 Mark Paid / Unmark
- [ ] Click **"Mark Paid"** on a worker. Verify:
  - The card UI updates (green color / "Paid" badge).
  - The Summary Bar recalculates ("Paid" increases, "Outstanding" decreases).
- [ ] Click **"Unmark"** on the same paid worker. Verify:
  - The card reverts to "Pending" state.
  - The Summary Bar recalculates back correctly.

### 10.6 Fixed Workers Tab
- [ ] Switch to the **"Fixed Workers"** tab. Verify all salaried workers appear.
- [ ] **Standard salary roles** (Master, Helper, Mender, Sanitation, Supervisor): Verify the full monthly salary is displayed.
- [ ] **Day-to-Day workers**: Expand their card. Verify the formula: `(Monthly Salary ÷ 30) × Days Present`. Verify the days count matches their actual attendance logs for the month.
- [ ] Verify Mark Paid / Unmark works identically to piece-rate workers.

### 10.7 Cross-Check Math
- [ ] For at least 2 piece-rate workers, manually calculate: `Σ(meters on each machine × that machine's rate)` and compare with the app. They must match exactly.
- [ ] For at least 1 Day-to-Day worker, manually calculate `(salary / 30) × actual days present this month` and compare. They must match.

---

## 11. Advances (Upaad) — Owner

### 11.1 Page Load
- [ ] Navigate to **Advances** as Owner. Verify the page loads with a title "Advances (Upaad)" and a worker selector.

### 11.2 Worker Selection
- [ ] Verify the worker list shows **both** piece-rate and fixed workers sorted alphabetically.
- [ ] Verify each worker shows a badge: "Piece-Rate" (indigo) or their role name (orange) for fixed workers.
- [ ] Use the **search bar**. Type a partial name. Verify the list filters in real-time.
- [ ] Select a worker. Verify their advances section loads below.

### 11.3 Summary Cards
- [ ] Verify three summary cards appear: **Pending** (amber), **Deducted** (green), **Total Debt** (gray).
- [ ] Verify the values are correct based on the worker's advance history.

### 11.4 Debt-to-Income Indicator
- [ ] For a worker with pending advances ≥ 50% of their monthly earnings: Verify a **"Moderate Debt"** amber warning appears with the percentage.
- [ ] For a worker with pending advances ≥ 100% of monthly earnings: Verify a **"High Debt Risk"** red warning appears.
- [ ] For a worker with low/no advances: Verify no warning appears.

### 11.5 Give Advance
- [ ] Click **"Give Advance"**. Verify the dialog appears with Amount and Reason fields.
- [ ] Try entering **0 or negative amount**. Verify the submit button is disabled.
- [ ] Enter a valid amount (e.g., ₹500) and an optional reason. Click **"Record Advance"**.
- [ ] Verify success toast ("Advance recorded") and the new advance appears in the **Pending** section.
- [ ] Verify the Summary Cards update immediately.

### 11.6 Delete Advance
- [ ] Click the **trash icon** on a pending advance. Verify a **"Sure?"** confirmation appears (the icon text changes to "Sure?").
- [ ] Click again within 3 seconds to confirm. Verify the advance is deleted and summary cards update.
- [ ] Click the trash icon but wait > 3 seconds without clicking again. Verify the confirmation resets (reverts to trash icon).

### 11.7 Deducted Advances
- [ ] After a payroll settlement where an advance has been deducted, verify the advance moves to the **"Deducted"** section with:
  - Amount shown with a strikethrough.
  - Green "Deducted" badge.
  - "Settled in [month]" text.

---

## 12. Inventory — Yarn & Qualities

### 12.1 Page Load & Tabs
- [ ] Navigate to **Inventory** as Owner. Verify two tabs: **"Batches (Beams)"** and **"Qualities"**.

### 12.2 Qualities — Add Quality
- [ ] Switch to the **Qualities** tab. If empty, verify the empty state with "No Qualities Defined" and a "Load Surat Presets" button.
- [ ] Click **"Load Surat Presets (Templates)"**. Verify preset qualities are loaded with a success toast.
- [ ] Click **"Add Quality"**. Verify the form has: Fabric Name, Target Yield (m/kg), Avg Sale Price (₹/m), Worker Rate (₹/m).
- [ ] Fill in details and save. Verify the new quality appears in the list.
- [ ] Verify each quality card shows: name, target yield, estimated sale value, worker rate.

### 12.3 Qualities — Validation
- [ ] Try to save a quality without a name or target yield. Verify the save button is disabled.

### 12.4 Yarn Batches — Add Batch
- [ ] Switch to the **Batches** tab. Click **"Add Batch"**.
- [ ] Verify the form requires: Batch Name, Quality (dropdown from defined qualities), Total Weight (kg).
- [ ] If no qualities exist, verify the warning message: "Please add Qualities first."
- [ ] Fill in details and save. Verify:
  - Success toast ("Batch added successfully").
  - The batch card appears with name, quality, weight, expected production (`weight × target_yield`), and status "active".

### 12.5 Batch Cards — Detail Verification
- [ ] Verify each batch card shows:
  - Status badge (active = teal, consumed = gray).
  - Quality name in indigo.
  - Weight (kg) and Expected Production (meters).
  - Current Machine Location (machine name or "Storage / Unassigned").
- [ ] For **active** batches: Verify a "Mark Consumed (Audit)" button is visible.
- [ ] For **consumed** batches: Verify a "View Final Audit" button is visible.

### 12.6 Batch Audit Report
- [ ] Click **"Mark Consumed (Audit)"** on an active batch with production data.
- [ ] Verify the **Audit Report** modal opens with:
  - Quality, Input Weight, Target Yield, Actual Yield.
  - **Production vs Expected** progress bar comparison.
  - **Efficiency Variance** percentage.
- [ ] If variance < −5%: Verify the **"Significant Leakage Detected"** red alert appears with Estimated Monetary Loss.
- [ ] If variance > +10%: Verify the **"Abnormal Over-Production"** amber alert appears.
- [ ] If the batch is still active: Verify the **"Leftover Yarn? (Tali)"** input is shown for leftover weight.

### 12.7 Close Batch
- [ ] Enter a leftover yarn weight (e.g., `2.5` kg) in the Tali field.
- [ ] Click **"Mark as Consumed (Close Batch)"**. Verify:
  - Success toast ("Batch successfully closed and audited.").
  - The batch card status changes from "active" to "consumed."
  - The "Mark Consumed" button is replaced by "View Final Audit."

### 12.8 Real-Time Updates
- [ ] While on the Inventory page, have a Supervisor log production on a machine linked to a batch.
- [ ] Verify the batch data updates automatically (real-time listener) without needing a page refresh.

---

## 13. Settings (Owner)

### 13.1 Page Load
- [ ] Navigate to **Settings**. Verify three sections: Factory Information, Access Code Generator, Personal Information.
- [ ] Verify a loading skeleton appears while data loads.

### 13.2 Factory Information
- [ ] Verify the **Factory Name** is displayed (read-only).
- [ ] Verify the **Factory Join Code** is displayed in a prominent, large, monospace font with blue styling.
- [ ] Verify the share instructions text is visible.

### 13.3 Access Code Generator
- [ ] Click **"Generate New Code"**. Verify:
  - The button shows a loading state ("Generating...").
  - A success toast ("New access code generated") appears.
  - The generated code is displayed in a large, bold format.
  - The warning "⚠️ Copy this now. It won't be shown again." is visible.
- [ ] Click the **copy icon**. Verify "Code copied to clipboard" toast.
- [ ] Refresh the page. Verify the code is **no longer displayed** (confirming the one-time display).

### 13.4 Personal Information
- [ ] Verify **Full Name** and **Phone Number** fields are displayed (read-only).
- [ ] Verify the **Role** badge shows "owner".

---

## 14. Access Code System — Cross-Cutting Verification

This section tests that the access code system works consistently across all protected actions.

### 14.1 Code Generation
- [ ] Generate a code from Owner Settings. Record it.

### 14.2 Protected Actions (Test each with invalid, then valid code)

| # | Action | Location | Invalid Code Rejected? | Valid Code Works? | Code Consumed After Use? |
|---|--------|----------|----------------------|------------------|-------------------------|
| 1 | Unlock locked production entry | Supervisor → Production | [ ] | [ ] | [ ] |
| 2 | Save past-date attendance | Supervisor → Attendance | [ ] | [ ] | [ ] |
| 3 | Delete piece-rate worker | Supervisor → Workers | [ ] | [ ] | [ ] |
| 4 | Delete fixed worker | Owner → Fixed Workers | [ ] | [ ] | [ ] |
| 5 | Delete machine | Owner/Supervisor → Machines | [ ] | [ ] | [ ] |

### 14.3 Single-Use Enforcement
- [ ] After using a code for one action (e.g., unlocking production), try using the **exact same code** for a different action (e.g., deleting a worker). Verify it is **rejected**.

### 14.4 Code Forgery
- [ ] Try using a random 6-character string as an access code. Verify it is rejected for all protected actions.

---

## 15. Internationalization (i18n) — Language Switching

### 15.1 Supervisor Dashboard — Language Switcher
- [ ] On the Supervisor header, locate the **language switcher** dropdown.
- [ ] Verify the available languages (e.g., English, हिन्दी / Hindi, ગુજરાતી / Gujarati).

### 15.2 Switch to Hindi (हिन्दी)
- [ ] Switch language to Hindi. Verify:
  - All navigation labels change to Hindi.
  - Page titles, button labels, and form labels switch.
  - Toast messages remain functional (even if still in English).
  - No text shows raw translation keys (e.g., `production.log_production` should not be visible).

### 15.3 Switch to Gujarati (ગુજરાતી)
- [ ] Switch to Gujarati. Same verification as Hindi above.
- [ ] Navigate through multiple pages (Production, Workers, Attendance, Machines) and verify translations are consistent.

### 15.4 Switch Back to English
- [ ] Switch back to English. Verify everything reverts cleanly with no leftover Gujarati/Hindi text.

### 15.5 Persistence
- [ ] Set language to Hindi. Refresh the page. Verify language preference is **remembered**.

### 15.6 Comprehensive Label Audit
For **each page** listed below, switch through all languages and check: no raw keys are displayed, no placeholder text like "undefined" appears.

| Page | EN ✓ | HI ✓ | GU ✓ |
|------|------|------|------|
| Supervisor → Production | [ ] | [ ] | [ ] |
| Supervisor → Assignments | [ ] | [ ] | [ ] |
| Supervisor → Workers | [ ] | [ ] | [ ] |
| Supervisor → Machines | [ ] | [ ] | [ ] |
| Supervisor → Attendance | [ ] | [ ] | [ ] |
| Owner → Dashboard/Analytics | [ ] | [ ] | [ ] |
| Owner → Machines | [ ] | [ ] | [ ] |
| Owner → Fixed Workers | [ ] | [ ] | [ ] |
| Owner → Payroll | [ ] | [ ] | [ ] |
| Owner → Advances | [ ] | [ ] | [ ] |
| Owner → Inventory | [ ] | [ ] | [ ] |
| Owner → System Health | [ ] | [ ] | [ ] |
| Owner → Settings | [ ] | [ ] | [ ] |

---

## 16. PWA (Progressive Web App) Testing

### 16.1 Install Prompt
- [ ] On Chrome desktop, verify the **install app** icon appears in the address bar (or the browser prompts to install).
- [ ] On mobile Chrome/Safari, verify "Add to Home Screen" is available.

### 16.2 Installed App Behavior
- [ ] Install the PWA. Launch it from the home screen / app launcher.
- [ ] Verify it opens in a **standalone window** (no browser chrome / address bar).
- [ ] Verify the app icon and splash screen look correct.
- [ ] Verify all features work identically in PWA mode.

### 16.3 Manifest Validation
- [ ] Open DevTools → Application → Manifest. Verify:
  - App name is set.
  - Icons are defined and load correctly.
  - Theme and background colors are set.
  - Display mode is `standalone`.

---

## 17. Data Isolation & Security (Cross-Tenant)

### 17.1 Organization Fence (RLS) — Setup
- [ ] Create a **second Owner account** with a new organization (e.g., "Test Factory B").
- [ ] As this second Owner, add a machine named **"Secret Loom B"** and a worker named **"Ghost Worker B"**.

### 17.2 Cross-Org Invisibility
- [ ] Log into the **first Owner account**.
- [ ] Navigate to Machines → Verify "Secret Loom B" is **NOT visible**.
- [ ] Navigate to Dashboard → Verify "Ghost Worker B" is **NOT visible**.
- [ ] Navigate to Payroll → Verify no data from Organization B appears.
- [ ] Navigate to Inventory → Verify no qualities or batches from Organization B appear.
- [ ] Navigate to Advances → Verify the worker list does not include Organization B workers.

### 17.3 Role-Based Route Protection
- [ ] As a **Supervisor**, try navigating directly (via URL bar) to:
  - `/owner/analytics` → Verify redirect to `/supervisor/production`.
  - `/owner/settings` → Verify redirect.
  - `/owner/payroll` → Verify redirect.
  - `/owner/advances` → Verify redirect.
  - `/owner/inventory` → Verify redirect.
- [ ] As an **Owner**, try navigating to supervisor pages → They should load (since owners have access to supervisor features per the layout code).

### 17.4 Unauthenticated Access
- [ ] Log out completely. Try navigating directly to:
  - `/owner/analytics` → Verify redirect to `/login`.
  - `/supervisor/production` → Verify redirect to `/login`.
  - `/owner/settings` → Verify redirect to `/login`.

---

## 18. System Health (Owner)

### 18.1 Page Load
- [ ] Navigate to **System Health**. Verify the page shows a table of daily brief logs (last 30 entries).
- [ ] If no logs exist, verify the empty state: "No job logs found" with guidance about cron jobs.

### 18.2 Log Table Columns
- [ ] Verify columns: **Timestamp**, **Target Date**, **Status**, **Details**.
- [ ] Verify status badges:
  - **Success** → green badge with checkmark.
  - **Skipped** → yellow badge with clock icon.
  - **Failed** → red badge with X icon.

### 18.3 Log Details
- [ ] For a **Failed** entry: Verify the error message is displayed in red in the Details column.
- [ ] For a **Skipped** entry: Verify it shows "No owner phone found or already sent" in yellow.
- [ ] For a **Success** entry: Verify it shows "Message prepared/sent" in green.

---

## 19. UI/UX Quality Checks

### 19.1 Responsive Design
- [ ] Test each page at three breakpoints:
  - **Mobile** (375px): Verify nav collapses, cards stack vertically, no horizontal overflow.
  - **Tablet** (768px): Verify layout adapts with appropriate grid changes.
  - **Desktop** (1280px+): Verify full sidebar, multi-column layouts render correctly.

### 19.2 Loading States
- [ ] On each major page, verify **skeleton loaders** or **spinner animations** appear while data loads (not a blank screen).
- [ ] Verify all loading states resolve within a reasonable time (< 3 seconds on normal connection).

### 19.3 Empty States
- [ ] For each entity type, verify the empty state message is helpful (not just a blank page):
  - No machines → "No machines found"
  - No workers → "No meter workers yet"
  - No production logs → "No production logs"
  - No payroll data → "No production logged this month"
  - No advances → "No advances recorded"
  - No batches → "No Yarn Batches"
  - No qualities → "No Qualities Defined"
  - No system logs → "No job logs found"

### 19.4 Error Handling
- [ ] Turn off the API (stop the dev server or block Supabase requests via DevTools). Verify:
  - Error toasts appear for failed operations (not unhandled exceptions or white screens).
  - The app degrades gracefully.

### 19.5 Toast Notifications
- [ ] Verify toasts appear for: successes (green), errors (red), and informational messages.
- [ ] Verify toasts auto-dismiss after a few seconds.
- [ ] Verify toasts don't stack excessively.

### 19.6 Financial Formatting
- [ ] Verify all rupee amounts are displayed with the **₹** symbol and proper Indian number formatting (e.g., ₹1,50,000 not ₹150,000).
- [ ] Verify **decimal precision** — production payroll should not show floating-point errors (e.g., ₹374.99999 instead of ₹375.00).

---

## 20. Edge Cases & Boundary Conditions

### 20.1 Zero-Production Day
- [ ] Navigate to the Owner Dashboard for a date with **no production logged**.
- [ ] Verify KPI cards show ₹0 / 0 meters gracefully (not "NaN" or blank).

### 20.2 Worker with No Machines
- [ ] Add a worker but don't assign them to any machine.
- [ ] Verify they don't appear in production logging but do appear in the Workers list.

### 20.3 Machine with No Worker Assigned
- [ ] On the Production page, verify a machine with no assigned worker shows **"No assigned worker"** text.
- [ ] Verify production can still be logged (meters entry should still work).

### 20.4 Very Large Numbers
- [ ] Enter a very large meter value (e.g., `99,999`). Verify:
  - The estimated pay calculates correctly.
  - The value displays without overflow in the UI.

### 20.5 Rapid Actions
- [ ] Click "Mark Paid" rapidly multiple times on the same worker. Verify:
  - No duplicate API calls.
  - The state doesn't get stuck between Paid/Pending.

### 20.6 Concurrent Users
- [ ] Open two browser windows — one as Owner, one as Supervisor.
- [ ] Have the Supervisor log production. Verify the Owner's dashboard updates (after refresh or via real-time sync).

### 20.7 Special Characters
- [ ] Add a worker with special characters in their name (e.g., "O'Brien", "María García").
- [ ] Verify the name displays correctly everywhere: Worker list, Production, Payroll, Advances.

---

## Test Results Summary

| Section | Pass | Fail | Partial | Notes |
|---------|------|------|---------|-------|
| 1. Authentication & Onboarding | | | | |
| 2. Navigation & Layout | | | | |
| 3. Machine Management | | | | |
| 4. Worker Management | | | | |
| 5. Worker Assignments | | | | |
| 6. Production Logging | | | | |
| 7. Offline Mode | | | | |
| 8. Attendance Tracking | | | | |
| 9. Owner Dashboard & Analytics | | | | |
| 10. Monthly Payroll Settlement | | | | |
| 11. Advances (Upaad) | | | | |
| 12. Inventory — Yarn & Qualities | | | | |
| 13. Settings | | | | |
| 14. Access Code System | | | | |
| 15. Internationalization (i18n) | | | | |
| 16. PWA Testing | | | | |
| 17. Data Isolation & Security | | | | |
| 18. System Health | | | | |
| 19. UI/UX Quality Checks | | | | |
| 20. Edge Cases | | | | |

**Tester Name:** ____________________
**Date Tested:** ____________________
**Build / Commit:** ____________________
**Overall Result:** ____________________
