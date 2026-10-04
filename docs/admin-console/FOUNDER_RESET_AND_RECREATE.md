# Reset the abandoned account and recreate founder access

Raj explicitly authorized this change on 4 October 2026: delete the old Weavly account and its factory information, including local payment/subscription history, and create a fresh founder-only identity. This replaces the previous preserve-UUID approach. No further Razorpay Test/Live lookup is required for the approved local removal. Nothing has been run against the hosted project by the agent.

**Current operator result:** Raj supplied a successful SQL Editor screenshot with `old_auth_exists=false` and `old_factory_exists=false` after the final transaction. The reset step is complete on that operator-supplied evidence. Do not rerun it; continue at step 2 to create the new Auth identity. This verifies the two reported postconditions, not a separate agent audit of the hosted project or its historical backups/provider records.

## 1. Run one targeted reset

Sign out of Weavly and close its other tabs. In the same Supabase project used for the supplied identity/factory queries, open **SQL Editor → New query**, use the **postgres** role, and paste the complete [FOUNDER_ACCOUNT_RESET.sql](FOUNDER_ACCOUNT_RESET.sql). There are no placeholders to replace. Run the whole file once.

This is destructive: it removes old Auth UUID `d0e56517-29f9-474f-b368-9e63e84da25a` (`rajpatel86420@gmail.com`), factory `2420a5a8-d231-4ed2-b9ce-9db986e38879` (`test`), and the exact reviewed factory rows. It includes the recorded local ₹17,700 payment, four subscription rows, machines/worker/defaults/rates/referral code and old factory audit rows. It preserves other accounts and unrelated factories. One minimal global operation audit remains, containing the completed result and counts, without old customer payloads.

The final result must read:

| old_auth_exists | old_factory_exists |
| --- | --- |
| false | false |

If it reports an error, the transaction rolls back. Paste the error text so the exact difference can be handled; do not remove checks or run only part of the file. The script refuses changed counts, membership, unexpected foreign-key children or Auth references, new Storage ownership, changed trigger definitions, unaudited writes and unsupported provider runtime shapes. It is tested locally, not verified against the hosted Auth schema. Run during a quiet schema/deployment window; it uses short lock and statement timeouts.

Raj's first hosted attempt stopped at `LOCK TABLE auth.schema_migrations` with permission denied, before any deletion. The corrected file leaves that provider migration ledger alone when catalogue evidence shows no identity fields or foreign-key edges. No permission, ownership or provider migration change is needed. Open the updated file again and replace the entire SQL Editor query before rerunning; the previous copied version still contains the failing lock.

The next attempt found a surviving `auth.flow_state` reference and also rolled back the entire transaction. The current file explicitly removes this exact old user's known `flow_state` and legacy `refresh_tokens` rows in the same transaction. It first verifies column types, record bounds, token/session/linking ownership and every reachable FK/trigger; cross-account or unknown runtime records remain blockers. There is no standalone token-cleanup query to run and no token/secret output to share. Copy the complete current file again rather than reusing either earlier query.

This removes the selected current database account/factory state, not every historical trace: Razorpay records, provider audit JSON, backups, monitoring history and browser caches are outside this SQL. It makes no refund/capture/provider request, alters no price or checkout gate, and installs no functions, schema, credentials or grants. Existing issued JWTs may survive until expiry; app guards still need fresh identity/current membership/session checks. The new UUID never inherits the old identity's privileges.

## 2. Create the fresh Auth user

In that Supabase project, go to **Authentication → Users → Add user → Create new user**. Use:

- Email: `Rajpatel86420@gmail.com`
- Password: choose a new strong password privately in the dashboard.
- Auto Confirm User: select it for your own verified email if offered; verify that the created user is email-confirmed.

Copy the new **User UID / UUID** and send only that UUID to the agent. Do not reuse the deleted UUID, send the password, enter passwords in SQL, or use Weavly customer signup. Do not create a factory or a customer-owner profile. Open subsequent Weavly login in a fresh private window to avoid old browser state.

## 3. Bind the new UUID to the founder console

The supplied database results show that the new founder/support tables are missing. Account recreation alone cannot install them. Their reviewed migrations and the founder-only follow-up deployment remain separate setup/release operations; see [PRODUCTION_FOUNDER_SETUP.md](PRODUCTION_FOUNDER_SETUP.md).

Once required migrations are verified, use [FOUNDER_SELF_SETUP.sql](FOUNDER_SELF_SETUP.sql) with the **new** UUID. It establishes `role=admin`, `org_id=NULL`, the approved email-bound UUID grant and safe audit. It creates no credentials or fake factory. Keep gates closed until real provider/security acceptance and the approved enrollment window are ready.

Then `/admin/login` uses email/password, first-time private authenticator QR enrollment plus code, and code-only MFA challenge after password on later logins. Normal customer login/signup and tenant APIs reject the reserved founder identity once the reviewed follow-up is deployed. Missing profile/grant, AAL1 or disabled gates must not be bypassed just to make login work.

No extra payment provenance work is needed for this reset. Remaining inputs are the reset result/new UUID and the exact environment/migration/security release setup. Factor recovery and production rollout still require their own verified approval.

Sources: [Supabase user deletion/management](https://supabase.com/docs/guides/auth/managing-user-data), [existing reviewed setup guide](PRODUCTION_FOUNDER_SETUP.md), [reset acceptance evidence](FOUNDER_ONLY_ACCEPTANCE.md).
