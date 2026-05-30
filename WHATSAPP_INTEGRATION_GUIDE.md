# Weavly WhatsApp Integration Guide

Last reviewed against the active documentation pass on May 31, 2026.

## Provider

Weavly currently sends operational WhatsApp messages through the direct Meta WhatsApp Cloud API using:

- `supabase/functions/_shared/whatsapp.ts`

The implementation has been hardened to use direct Meta API. Legacy references to Interakt have been cleaned up.

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
- `META_WHATSAPP_TOKEN` (Preferred) or `META_ACCESS_TOKEN` (Legacy)
- `META_WHATSAPP_PHONE_NUMBER_ID` (Preferred) or `META_PHONE_NUMBER_ID` (Legacy)
- `WHATSAPP_VERIFY_TOKEN` (Preferred) or `META_WEBHOOK_VERIFY_TOKEN` (Legacy)
- `META_APP_SECRET` (Optional, for webhook signature verification)
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

## Consent / Opt-in

> [!IMPORTANT]
> **Consent Model**: Automated WhatsApp messages require explicit opt-in.
> - **Owners/Supervisors**: Use `profiles.whatsapp_opted_in`.
> - **Workers**: Use `notification_consents` table.
> - **Parties/Customers**: Not wired yet unless active Phase 1 flow needs them.

Missing consent means the message is skipped (logged as `skipped_*`), not sent. Opt-out records are retained to respect user choice.

### notification_consents Schema

```sql
CREATE TABLE notification_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    person_type TEXT, -- 'owner', 'supervisor', 'worker', 'party'
    person_id TEXT, -- ID in respective table (cast to string)
    phone TEXT,
    channel TEXT DEFAULT 'whatsapp',
    consent_status TEXT CHECK (consent_status IN ('opted_in', 'opted_out')),
    consent_source TEXT, -- 'owner_worker_form', etc.
    consent_text_version TEXT,
    consented_at TIMESTAMPTZ DEFAULT now(),
    withdrawn_at TIMESTAMPTZ,
    captured_by_user_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (org_id, person_type, person_id, channel)
);
```

### Consent Check Helper

`supabase/functions/_shared/whatsapp.ts` provides `checkWhatsAppConsent`:

```typescript
export async function checkWhatsAppConsent(
  supabase: SupabaseClient,
  orgId: string,
  personType: 'owner' | 'supervisor' | 'worker' | 'party',
  personId: string,
  phone?: string | null
): Promise<ConsentCheckResult>
```

It returns `{ allowed: boolean, reason: ... }`. If not allowed, edge functions skip sending and log the specific reason (e.g., `skipped_opted_out`).


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

> [!NOTE]
> `source_type` and `source_id` are currently missing from `whatsapp_delivery_log`. It is recommended to add them in future hardening to link logs directly to business records (e.g., `source_type: 'advance'`, `source_id: <advance_id>`).

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
