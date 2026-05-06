# Weavly WhatsApp Integration Guide

Last analyzed from the active codebase on May 6, 2026.

## Provider

Weavly currently sends operational WhatsApp messages through the Meta WhatsApp Cloud API using:

- `supabase/functions/_shared/whatsapp.ts`

Some legacy comments may still mention Interakt. The implemented send path is Meta.

## Role in Phase 1

WhatsApp supports the factory loop but should not block it. A production log, payroll settlement, advance record, or access-code action should not fail just because message delivery fails. Message failures should be logged and retried.

## Current Edge Functions

- `send-access-code`
- `send-daily-brief`
- `send-deadline-alert`
- `check-pace-index`
- `monthly-brief`
- `send-advance-receipt`
- `send-payslip`
- `retry-failed-messages`
- `send-lockdown-alert`
- `whatsapp-webhook`

## Required Supabase Edge Secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_ACCESS_TOKEN`
- `META_PHONE_NUMBER_ID`
- `META_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_PROVIDER`

`WHATSAPP_PROVIDER` defaults to `meta`. Use `simulate` for test runs that should log success without sending real messages.

## Templates Referenced in Code

- `weavly_daily_brief_v2`
- `weavly_deadline_risk`
- `weavly_floor_approval`
- `weavly_advance_receipt`
- `weavly_monthly_brief`
- `worker_payslips`
- `weavly_tenant_lockdown`

Template names must match approved templates in the WhatsApp Business setup.

## Message Types

Phase 1-relevant:

- owner/supervisor access codes
- daily production summaries
- deadline or pace risk alerts
- worker advance receipts
- worker payslips
- monthly production/finance briefs

Governance/deferred:

- tenant lockdown alerts
- compliance/admin notifications where enabled

## Message Logging

Every send attempt should write to `whatsapp_delivery_log`.

The log stores:

- organization
- recipient phone
- template name
- notification type
- status
- payload snapshot
- provider response/callback data
- Meta message ID where available

`/owner/system-health` contains owner-facing log/retry concepts but is archived from Phase 1 polish in the current route gate.

## Retry Flow

`retry-failed-messages` handles failed delivery rows. Keep retry behavior operational even if the full system-health UI is not part of Phase 1 polish.

## Payslip Special Case

`send-payslip` sends:

1. A top-level payslip summary template.
2. A follow-up freeform itemized breakdown from `payroll_settlements.itemization_payload`.

The itemization can include:

- machine/order rows
- gross pay
- bonuses
- fines
- advances recovered
- PF/ESI values
- net payout

## Webhook Notes

`whatsapp-webhook` verifies against `META_WEBHOOK_VERIFY_TOKEN` and correlates incoming delivery statuses using `meta_message_id`.

## Recommended Validation

1. Set `WHATSAPP_PROVIDER=simulate`.
2. Trigger access-code send.
3. Trigger advance receipt.
4. Trigger payslip send.
5. Confirm rows in `whatsapp_delivery_log`.
6. Switch to Meta credentials in a safe test org.
7. Confirm real delivery and webhook status updates.
