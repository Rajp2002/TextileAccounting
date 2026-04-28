# Weavly WhatsApp Integration Guide

This guide reflects the implementation in the repo today.

## Provider

Weavly currently sends operational WhatsApp messages through the Meta WhatsApp Cloud API, using the shared utility in `supabase/functions/_shared/whatsapp.ts`.

The code still contains a few legacy comments mentioning Interakt, but the send path in use is Meta.

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

## Required Secrets

Set these in Supabase edge-function secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_ACCESS_TOKEN`
- `META_PHONE_NUMBER_ID`
- `META_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_PROVIDER`

`WHATSAPP_PROVIDER` defaults to `meta`. Set it to `simulate` when you want the edge functions to succeed without sending real messages.

## Templates Referenced In Code

- `weavly_daily_brief_v2`
- `weavly_deadline_risk`
- `weavly_floor_approval`
- `weavly_advance_receipt`
- `weavly_monthly_brief`
- `worker_payslips`
- `weavly_tenant_lockdown`

These names must stay aligned with the approved templates in your WhatsApp Business setup.

## Message Logging

Every send attempt writes to `whatsapp_delivery_log` through the shared helper.

The log stores:
- org
- recipient phone
- template name
- notification type
- status
- payload snapshot
- Meta callback data
- Meta message ID when available

Owner-facing visibility for recent logs lives at `/owner/system-health`.

## Retry Flow

Failed rows in `whatsapp_delivery_log` are retried by `retry-failed-messages`.

The owner UI also exposes a manual retry action from `/owner/system-health`.

## Payslip Special Case

`send-payslip` does two things:

1. Sends the top-level summary template.
2. Sends a follow-up freeform message with itemized breakdown data from `payroll_settlements.itemization_payload`.

That breakdown can include:
- bonuses
- fines
- advances recovered
- PF and ESI values

## Webhook Notes

`whatsapp-webhook` is present for delivery-status updates. It uses `META_WEBHOOK_VERIFY_TOKEN` and correlates incoming statuses against `meta_message_id` in `whatsapp_delivery_log`.

## Recommended Validation

After configuration:

1. Set `WHATSAPP_PROVIDER=simulate` and invoke one or two edge flows to confirm logging.
2. Switch to real Meta credentials.
3. Test:
   - access code delivery
   - daily brief
   - advance receipt
   - payslip summary plus itemized follow-up
4. Confirm owner logs are visible in `/owner/system-health`.
