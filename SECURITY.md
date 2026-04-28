# Weavly Security Notes

This document summarizes the security controls that are actually present in the codebase today and the operational steps for rotating the main secrets.

## Current Controls

### Platform and app-layer controls
- Supabase Auth with role-aware redirects
- PostgreSQL RLS for org isolation
- auth-route rate limiting via Upstash Redis
- access-code rate limiting
- tracking-token rate limiting
- one-hour inactivity timeout in middleware
- revocation checks for forcibly logged-out users
- CSP and security headers in `next.config.ts`
- Sentry instrumentation for browser, server, and edge code

### Sensitive operation controls
- destructive and historical actions are protected by server actions and rate limiting
- owner-generated access codes gate protected edits and certain destructive flows
- export and delete flows live behind authenticated owner-only code paths

## Important Secrets In Use

### Web app
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PROJECT_ID`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_PLAN_ID_BASE`
- `RAZORPAY_PLAN_ID_PREMIUM`
- `RAZORPAY_WEBHOOK_SECRET`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

### Supabase edge functions
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_ACCESS_TOKEN`
- `META_PHONE_NUMBER_ID`
- `META_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_PROVIDER`

## Rotation Playbooks

### 1. Supabase JWT secret
Rotate this if token signing is suspected to be compromised.

1. Schedule a maintenance window.
2. Rotate the JWT secret in Supabase project settings.
3. Expect existing sessions to become invalid.
4. Verify fresh sign-in, role redirects, and owner/supervisor page access.

### 2. Supabase anon or service-role keys
Rotate this if keys are leaked or over-exposed.

1. Roll the compromised key in Supabase.
2. Update Vercel environment variables:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Redeploy the app.
4. Re-test auth, owner actions, supervisor actions, and any service-role-backed flows.

### 3. Upstash Redis token
Rotate this if rate-limiter credentials are exposed.

1. Roll the Upstash credential.
2. Update:
   - `UPSTASH_REDIS_REST_URL` if changed
   - `UPSTASH_REDIS_REST_TOKEN`
3. Redeploy.
4. Re-test login throttling, access-code throttling, and tracking rate limits.

### 4. Razorpay keys
Rotate on payment-key exposure.

1. Roll the Razorpay API key pair.
2. Update:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID`
3. If needed, re-check plan IDs and webhook signing secret.
4. Re-test checkout and webhook-driven subscription activation.

### 5. Razorpay webhook secret
Rotate if webhook authenticity is in doubt.

1. Create a new webhook secret in Razorpay.
2. Update `RAZORPAY_WEBHOOK_SECRET`.
3. Redeploy.
4. Re-test `/api/webhooks/razorpay`.

### 6. Meta WhatsApp credentials
Rotate if the WhatsApp business account is compromised or keys are leaked.

1. Rotate the Meta system-user or app token.
2. Update:
   - `META_ACCESS_TOKEN`
   - `META_PHONE_NUMBER_ID` if the sender number changes
   - `META_WEBHOOK_VERIFY_TOKEN` if webhook verification changes
3. Re-deploy the affected edge functions or refresh secrets in Supabase.
4. Re-test `send-access-code`, `send-daily-brief`, `send-payslip`, and `retry-failed-messages`.

## Verification Checklist After Any Rotation

- owner login works
- supervisor login works
- owner server actions still succeed
- supervisor dashboard saves still succeed
- WhatsApp logs continue to write to `whatsapp_delivery_log`
- billing callbacks still activate subscriptions
- audit and export pages still load
