# Weavly Security Notes

Last analyzed from the active codebase on May 6, 2026.

## Security Model

Weavly is a multi-tenant SaaS. The primary security boundary is organization-level isolation through `org_id`.

Protection layers:

- Supabase Auth.
- Custom JWT claims for role and org.
- Server-side `requireRole()` checks.
- Supabase RLS policies.
- Middleware redirects and protected API behavior.
- One-time owner access codes for protected supervisor/correction actions.
- Rate limiting and lockout where configured.
- Audit logging for sensitive writes.

## Roles

- `owner`: commercial, workforce, payroll, settings, billing, and factory-control user.
- `supervisor`: floor production, worker, attendance, and machine-status user.
- `admin`: platform/compliance governance user.

Role homes:

- owner: `/owner/analytics`
- supervisor: `/supervisor/dashboard` or `/supervisor/production` redirect
- admin: `/admin`

## Route Protection

`middleware.ts` handles:

- public route allowlist
- auth route rate limiting
- API JSON 401 responses for protected APIs
- session refresh
- revoked-session checks
- one-hour inactivity timeout
- auth-page redirects for already signed-in users
- onboarding gate for owners
- role mismatch redirects
- Phase 1 archived route redirects

## Access Codes

Owner access codes protect sensitive operations such as destructive actions, correction flows, and past-date changes.

Important behaviors:

- Codes are org-scoped.
- Codes are hashed server-side.
- Codes expire.
- Codes are one-time use and consumed after success.
- Format is validated before DB lookup.
- Failed attempts are recorded.
- Repeated failures can lock out code attempts temporarily.
- Successful code use clears failure history.
- Audit context records code-authorized changes where implemented.

## Tenant Isolation

Server actions should derive `org_id` from the authenticated profile, never from client input.

Tables should be queried with:

- authenticated user context where RLS applies, or
- service role only after explicit role validation and actor context setup.

When using service role:

- verify role first
- scope by `org_id`
- set audit actor when writing sensitive data

## WhatsApp Security

WhatsApp uses Meta Cloud API secrets in Supabase Edge Functions:

- `META_ACCESS_TOKEN`
- `META_PHONE_NUMBER_ID`
- `META_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_PROVIDER`

Webhook verification must use `META_WEBHOOK_VERIFY_TOKEN`. Delivery callbacks should correlate with `meta_message_id`.

Core workflow writes should not depend on WhatsApp success.

## Billing Security

Razorpay routes require:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- plan IDs
- `RAZORPAY_WEBHOOK_SECRET`

Webhook verification should be treated as mandatory before mutating subscription or payment state.

## Archived Routes

The current Phase 1 archive gate redirects:

- `/admin`
- `/owner/inventory`
- `/owner/ledger`
- `/owner/settings/audit`
- `/owner/system-health`

`/owner/stock` is active and should not be treated as archived unless `lib/phase1-scope.ts` changes.

## Sensitive Product Areas

Highest-risk writes:

- payroll settlement/unsettlement
- worker advance deletion/write-off/recovery
- production log overwrite/correction
- past attendance changes
- machine/worker destructive operations
- subscription webhook updates
- data export/delete
- tenant lockdown/unlock

## Operational Checklist

- Ensure Supabase RLS is enabled on tenant tables.
- Ensure service-role keys are never exposed to client bundles.
- Rotate WhatsApp and Razorpay secrets after suspected exposure.
- Keep archived route list aligned with navigation.
- Confirm access-code failure lockout works.
- Confirm public `/track/[token]` exposes only intended tracking data.
- Confirm owner/supervisor role mismatch redirects cannot reveal data.
- Confirm audit logging captures actor identity for service-role writes.
