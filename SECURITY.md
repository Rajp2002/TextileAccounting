# Security Operations: Secret Rotation Workflow

This document outlines the standard operating procedures (SOPs) for safely rotating critical secrets in the Textile SaaS (Weavly) production environment without causing application downtime.

## 1. Supabase JWT Secret Rotation

The JWT Secret is used by Supabase to sign authentication tokens. If this secret is suspected to be compromised, anyone could forge a JWT with the `service_role` or `org_id` claims, leading to full data compromise.

**Rotation Steps:**
1. **Schedule Downtime**: Because rotating the JWT invalidates *all* currently active user sessions instantly, you should notify users and schedule a 5-minute maintenance window.
2. In the Supabase Dashboard, navigate to **Project Settings** -> **API**.
3. Under **JWT Secret**, click **Generate new secret**.
4. Confirm the rotation. This takes effect immediately on the database side.
5. Wait 2 minutes for edge caches to clear.
6. **No Vercel Update Required**: Standard Supabase implementations fetch the JWT secret natively on their backend. Vercel environment variables (`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`) do *not* contain the JWT secret itself, so they do not need to be rotated *unless* the API keys are explicitly rolled as well.

## 2. Supabase API Key Rotation (Anon / Service Role)

If the `SUPABASE_SERVICE_ROLE_KEY` is leaked (e.g., in a public GitHub repo), it grants full database access bypassing RLS.

**Rotation Steps (Zero Downtime for Web App):**
1. Wait until a low-traffic period.
2. In the Supabase Dashboard, go to **Project Settings** -> **API**.
3. Next to the compromised key, click **Roll**. You can choose to keep the old key active for up to 24 hours to prevent downtime. Choose **Keep old key active for 1 hour**.
4. Immediately go to your **Vercel Dashboard** -> **Settings** -> **Environment Variables**.
5. Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` and/or `SUPABASE_SERVICE_ROLE_KEY` with the new values.
6. Redeploy the production branch in Vercel to pick up the new variables.
7. Wait 5 minutes, then test the application manually.
8. Once verified, return to Supabase and manually delete the old key earlier than the 1-hour expiration.

## 3. Upstash Redis Token Rotation

The Upstash Redis token protects the rate-limiter and session revocation lists. If leaked, an attacker could wipe rate limits or lock out arbitrary users.

**Rotation Steps:**
1. Log into your Upstash Dashboard and navigate to your Redis database.
2. Go to the **Rest API** section.
3. Click **Roll Credential**. This renders the old token invalid immediately.
4. Rate Limiting Graceful Degradation: Because we built a "fail-open" rate limiter in `lib/rate-limit.ts`, the application will *not crash* during this brief window. It will simply allow requests through without throttling while it fails to connect to Redis.
5. In **Vercel Environment Variables**, update `UPSTASH_REDIS_REST_TOKEN` with the new token.
6. Redeploy the application.
7. Rate limiting and session revocation will silently resume working.

## 4. Edge Function CRON_SECRET Rotation

The `CRON_SECRET` protects your Supabase Edge Functions (daily briefs, whatsapp integrations) from being triggered arbitrarily.

**Rotation Steps:**
1. Generate a new secure 32-byte secret locally:
   ```bash
   openssl rand -base64 32
   ```
2. Update the `CRON_SECRET` environment variable in Vercel and **Redeploy**.
3. In your local terminal, navigate to your `/supabase` directory.
4. Update the secrets in your Supabase project using the Supabase CLI:
   ```bash
   supabase secrets set CRON_SECRET="<your_new_secret_here>"
   ```
5. If you are using an external CRON scheduler (like GitHub Actions or a cron service), update the `Authorization: Bearer <secret>` header in those tools to use the new secret.
