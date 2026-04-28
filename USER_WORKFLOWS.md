# Weavly User Workflows

This is the current route and workflow reference for the implemented product.

## Owner Workflows

### `/owner/analytics`
- View live production KPIs, order health, worker breakdowns, and factory snapshots.
- Use this as the owner home screen after login.

### `/owner/estimator`
- Build cost estimates from factory baseline inputs.
- Save templates.
- Create quotes.

### `/owner/quotes`
- Review saved quotes by status.
- Open a quote to inspect or continue the quote-to-order flow.

### `/owner/orders`
- Review live orders and progress.
- Manage order state and downstream operational actions.

### `/owner/ledger`
- Track party invoices, receipts, claims, discounts, and other ledger adjustments.

### `/owner/dispatches`
- Review dispatch batches.
- Use public tracking links and tokenized tracking pages.

### `/owner/payroll`
- Navigate month-by-month payroll.
- Settle piece-rate and fixed workers.
- Apply final settlements.
- Send PDF and WhatsApp payslips.
- Review itemized bonuses, fines, advances recovered, and PF/ESI payloads.

### `/owner/advances`
- Record worker advances.
- View pending and deducted advances.
- Monitor debt against recent or expected pay.

### `/owner/fixed-workers`
- Manage the worker directory and fixed staff.
- Review worker status, WhatsApp details, and PF/ESI eligibility markers.

### `/owner/machines`
- Manage machine records and status.

### `/owner/stock`
- View grey fabric stock and stock movement outcomes.

### `/owner/inventory`
- Manage yarn and beam inventory flows.

### `/owner/system-health`
- Review WhatsApp delivery logs.
- Retry failed message sends.

### `/owner/billing`
- Start trial access.
- Subscribe to base or premium plans.
- Manage auto-renew and referral benefits.

### `/owner/settings`
- Update organization identity.
- Regenerate join code.
- Export or delete organization data.
- Generate access codes.
- Manage WhatsApp opt-in.
- Manage factory cost baseline and templates.
- Manage supervisor cash floats.
- Trigger or review emergency lockdown controls.

### `/owner/settings/audit`
- Search and inspect audit events and compliance records.

## Supervisor Workflows

### `/supervisor/dashboard`
- This is the main floor workspace.
- Assign workers to machines.
- Link machines to active orders.
- Update machine running / idle / maintenance state.
- Bulk-log production.
- Request access codes for protected edits.
- Copy previous shift setup when needed.

### `/supervisor/production`
- Redirect-only route.
- Sends the user to `/supervisor/dashboard`.

### `/supervisor/workers`
- Add and edit workers.
- Update active state and worker details.

### `/supervisor/attendance`
- Mark daily attendance for fixed workers.
- Save attendance for the selected date.
- Use access-code-backed flows for protected cases.

### `/supervisor/machines`
- View machine list in a supervisor-friendly layout.

## Admin Workflows

### `/admin`
- Review notices, grievances, DPA state, export logs, factory lockdown state, and breach reporting data.

## Public Workflow

### `/track/[token]`
- Public dispatch tracking page for buyers or counterparties.
- No login required.

## Authentication And Entry

- `/login` - standard sign-in
- `/signup` - owner signup
- `/join` - org join flow
- `/onboarding` - post-signup setup
- `/verify` and `/auth/*` - auth confirmation callbacks and supporting flows

Owners are redirected to `/owner/analytics` after authentication. Supervisors are redirected through `/supervisor/production`, which immediately forwards them to the unified dashboard.
