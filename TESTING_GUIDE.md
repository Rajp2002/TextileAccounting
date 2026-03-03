# Textile SaaS — Comprehensive Testing Guide

This guide is designed to help you methodically test all core workflows, edge cases, and security rules in the Textile SaaS platform. Use this as a reference checklist before a major release or when verifying new features.

---

## 1. Onboarding & Authentication Workflow

### Owner Registration & Organization Creation
- [ ] **Sign Up:** Register as a new user selecting the "Owner" role.
- [ ] **Org Creation:** Verify that a new Organization is successfully created upon signup.
- [ ] **Join Code:** Navigate to Settings and verify a unique "Factory Join Code" is prominently visible.

### Supervisor Registration
- [ ] **Sign Up via Code:** In an incognito window, register a new user as a "Supervisor".
- [ ] **Code Validation:** Enter an invalid Join Code and verify it is rejected with an appropriate error.
- [ ] **Successful Join:** Enter the Owner's valid Join Code. Verify the Supervisor is successfully linked to the correct Organization and drops into the Supervisor Dashboard.

---

## 2. Machine Management (Owner vs. Supervisor)

### Owner Capabilities
- [ ] **Add Machine:** As the Owner, add a new machine (e.g., "Loom A") and set its rate per meter (e.g., ₹2.50).
- [ ] **Edit Machine:** Rename the machine and change the rate. Verify the changes persist.
- [ ] **Deactivate:** Mark a machine as inactive and verify it no longer appears in active assignment lists.

### Supervisor Restrictions
- [ ] **Visibility:** Log in as Supervisor. Verify you can see the machines in necessary dropdowns/lists.
- [ ] **Permissions:** Verify the Supervisor *cannot* add new machines, edit rates, or delete machines (UI should not display these options, and API should reject forced requests).

---

## 3. Worker Management Workflow

### Owner Actions
- [ ] **Add Piece-Rate Worker:** Add a new worker on the Owner Dashboard. Verify they appear in the piece-rate list.
- [ ] **Add Fixed Worker:** Add a salaried worker (e.g., "Master" or "Helper") with a specific monthly salary.
- [ ] **Add Day-to-Day Worker:** Add a Day-to-Day worker and set their monthly salary. 
- [ ] **Inline Edit Salary:** On the Owner Dashboard's Fixed Workers panel, use the inline edit (pencil icon) to change a Fixed Worker's salary. Verify it updates properly without page reload.

### Supervisor Actions
- [ ] **Add Worker:** As a Supervisor on the Floor Dashboard, add a new piece-rate worker. Verify success.
- [ ] **Delete Worker (Blocked):** Attempt to delete a worker. Verify the system prompts for a 6-character Access Code.
- [ ] **Delete Worker (Success):** Generate an Access Code as the Owner (via Settings). Enter it as the Supervisor and verify the worker is successfully deleted. Provide an invalid code first to ensure it fails securely.

---

## 4. Supervisor Floor Operations (The Primary Loop)

### Machine Assignments
- [ ] **Shift Toggle:** Switch to "Day Shift" in the header. Assign workers to specific machines.
- [ ] **Night Shift Isolation:** Switch to "Night Shift". Verify the assignments are empty or distinct from the Day Shift. Assign different workers.
- [ ] **Persistence:** Refresh the page or change routes. Verify assignments for the correct shift automatically persist.

### Production Logging
- [ ] **Auto-Fill:** Go to Production Logging. Verify the machines auto-fill with the correct workers per the active shift.
- [ ] **Input & Estimate:** Enter meters (e.g., 100). Verify the real-time estimated pay calculates correctly (`meters × machine_rate`) as you type.
- [ ] **Quick Increment:** Test the `+10` and `-10` quick-increment buttons for fast data entry.
- [ ] **Save Batch:** Click "Save All Entries".
- [ ] **Locking Mechanism:** Verify the saved entries immediately go read-only and the yellow banner ("Some entries are already saved and locked") appears.

### Offline Mode
- [ ] **Network Disconnect:** Turn off Wi-Fi/Internet (or use Chrome DevTools Network -> Offline).
- [ ] **Log Offline:** Enter production numbers and click save. Verify a toast shows "Queued (offline)".
- [ ] **Background Sync:** Turn Wi-Fi back on. Verify the entries sync to the server in the background and become locked.

### Tamper Prevention (Retrospective Edits)
- [ ] **Unlock Request:** On a previously saved/locked production entry, click "Unlock to Edit".
- [ ] **Access Code Challenge:** Ensure the app prompts for an Owner Access Code.
- [ ] **Single-Use Verification:** Generate an Access Code as Owner. Use it to unlock the entry. Edit the value and save. Then, attempt to use the exact same code again to unlock another entry. Verify the code is rejected as spent/expired.

### Attendance Tracking
- [ ] **Mark Present/Absent:** Navigate to Attendance. Toggle the ✓ and ✗ for Day-to-Day workers. Save attendance.
- [ ] **Backdated Protection:** Change the date picker to *yesterday* or prior. Attempt to save attendance. Verify it intercepts and requires an Owner Access Code to proceed. 

---

## 5. Owner Dashboard & Analytics

### Daily Snapshot Dashboard
- [ ] **Daily Production KPI:** Check the header card. Verify the total meters logged matches the sum of all production entries for today.
- [ ] **Production Payroll KPI:** Verify the total rupee cost matches the calculated sum of `meters × rate` across all piece-rate workers today.
- [ ] **Fixed Payroll KPI:** Verify the count and pro-rated cost of salaried staff is accurate for the current date.
- [ ] **Worker Breakdown:** Expand a worker's row in the table. Verify the per-machine breakdown matches the exact logs submitted by the Supervisor on the floor.
- [ ] **Past Date Navigation:** Use the date picker to look at yesterday's dashboard. Verify the KPIs and lists update correctly to reflect historical data.

---

## 6. Monthly Payroll Settlement

### Piece-Rate Workers
- [ ] **Month Navigation:** Open Payroll for the current month. Attempt to navigate to a future month (chevron should be disabled).
- [ ] **Sorting:** Verify workers are sorted descending by total payout (highest earners first).
- [ ] **Pay Calculation Breakdown:** Expand a worker's card. Manually verify the formula shown: `(Machine X meters × ₹Y/m) + ...` matches the grand total.
- [ ] **Mark Paid:** Click "Mark Paid". Verify the card UI updates (e.g., turns green) and the "Paid" timestamp/status is set.
- [ ] **Summary Totals:** Check the top Summary Bar. Verify "Total Owed", "Paid", and "Outstanding" all recalculate correctly when a worker is marked paid.
- [ ] **Unmark:** Click "Unmark" on a paid worker. Verify the Summary totals revert correctly.

### Fixed Workers
- [ ] **Standard Salary Payout:** Verify standard salaried roles (Master, Supervisor, Helper, Mender, Sanitation) accurately display their full monthly salary.
- [ ] **Day-to-Day Payout Calculation:** Expand a Day-to-Day worker card. Verify the formula shown: `(Monthly Salary ÷ 30) × Days Present` correctly reflects their tracked attendance logs for the month.

---

## 7. Data Isolation & Security (Cross-Tenant Checks)

These checks ensure the multi-tenant SaaS foundation is secure.

- [ ] **Organization Fence Check (RLS):** Create a second distinct Owner account spanning a new Organization. Add a unique machine "Loom B". Log back into the *first* Owner account. Verify "Loom B" is completely invisible. This proves Row Level Security is functioning perfectly.
- [ ] **Role Access List:** Try navigating directly to `/owner/settings` or `/owner/payroll` via the browser URL bar using a Supervisor account. Verify the app correctly rejects access and redirects away.
- [ ] **Code Forgery Resistance:** As a Supervisor, try using random 6-character strings to unlock data edits. Verify the DB properly rejects all failed attempts.
