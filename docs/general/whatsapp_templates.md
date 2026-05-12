# WhatsApp Templates

This document lists the WhatsApp templates used in Weavly and their consent requirements.

## Consent Rules

- **Automated WhatsApp messages require explicit opt-in.**
- Owners and supervisors use `profiles.whatsapp_opted_in`.
- Workers use the `notification_consents` table.
- Parties/customers are not wired yet unless an active Phase 1 flow needs them.
- Missing consent means the message is skipped (logged as `skipped_*`), not sent.
- Opt-out records are retained to respect user choice.
- WhatsApp failures or skips never block core business workflows (like payroll or advances).

## Active Templates

### 1. Worker Payslips
- **Template Name**: `worker_payslips`
- **Recipient**: Worker
- **Trigger**: Payroll settlement
- **Consent Check**: Required (`notification_consents`)

### 2. Advance Receipt
- **Template Name**: `weavly_advance_receipt`
- **Recipient**: Worker
- **Trigger**: Advance payment
- **Consent Check**: Required (`notification_consents`)

### 3. Daily Brief
- **Template Name**: `weavly_daily_brief_v2`
- **Recipient**: Owner
- **Trigger**: Daily cron job
- **Consent Check**: Required (`profiles.whatsapp_opted_in`)

### 4. Access Code
- **Template Name**: `weavly_floor_approval`
- **Recipient**: Owner
- **Trigger**: Supervisor requests correction
- **Consent Check**: Required (`profiles.whatsapp_opted_in`)

## Deferred / Unused Templates

- `weavly_deadline_risk`
- `weavly_monthly_brief`
- `weavly_tenant_lockdown`
