# Founder test factory cleanup review

This source review does not execute cleanup. Raj supplied confirmed founder Auth UUID `d0e56517-29f9-474f-b368-9e63e84da25a` for `rajpatel86420@gmail.com`, a missing profile and one owned organization. He authorized removal of that testing factory while preserving the Auth identity. His next result identifies organization `2420a5a8-d231-4ed2-b9ce-9db986e38879`, name `test`, with zero member profiles. We have not inspected a hosted database directly.

The new [FOUNDER_TEST_FACTORY_DEPENDENCIES.sql](./FOUNDER_TEST_FACTORY_DEPENDENCIES.sql) is one SELECT returning counts in the Results grid. It checks normalized confirmed UUID/email, exact organization/owner/name, missing founder profile and zero members before count queries. It reads no credentials, ticket bodies or business values, installs no helper and makes no provider call. Counts cap at 101, meaning more than 100; overlapping FK/canonical rows cannot be added together. Missing sources are unavailable. The older NOTICE-based [FOUNDER_TEST_FACTORY_INSPECT.sql](./FOUNDER_TEST_FACTORY_INSPECT.sql) remains a reference; SQL Editor notice visibility is not assumed.

## Results supplied by Raj on 4 October 2026

The exact-target assertion passed, with 233 catalogue slots within the maximum 500. Distinct source counts are:

| Source | Count | Required disposition |
| --- | ---: | --- |
| `audit_log` by org_id | 18 | Preserve/review evidence; one org record_id match overlaps this inventory. |
| `machines`, `machine_type_pay_defaults` | 5 each | Authorized test setup rows; inspect dependent paths before exact removal. |
| `org_subscriptions` | 4 | Check term/provider/payment history before financial disposition. |
| `cost_rate_book` | 3 | Authorized test setup; check history/other references. |
| `factory_cost_profile`, `payroll_configs`, `quality_stock_cutover` | 1 each | Authorized test defaults; serialize and recheck dependencies. |
| `referral_codes` | 1 | Preserve other organizations; inspect uses and indirect references. |
| `subscription_payments` | 1 | Mode/status/provider evidence unknown. A test factory label does not prove a test payment. |
| `workers` | 1 | Authorized testing row; no worker values were returned. |

Displayed production/payroll/stock, formal/legal/security, Free grants/shared-subject and referral-use counts were zero. These are measured source counts, not a certification that every indirect, JSON, provider or Storage reference is empty. New private admin/audit/reporting/formal/retention and support objects were unavailable. Founder migrations are therefore not established in this project; run the migration precheck and compare installed history before setup.

Next run [FOUNDER_TEST_FACTORY_BILLING_STORAGE.sql](./FOUNDER_TEST_FACTORY_BILLING_STORAGE.sql), a read-only exact-target report with allowlisted payment/term fields and bounded Storage owner/prefix counts. `mode = null` is unknown; recorded captured/refunded state alone is not live/test evidence. If a provider reference exists, verify it in the correct Razorpay Test/Live dashboard before deciding its disposition. Pending/live/ambiguous financial evidence must not be silently cascaded away.

Raj subsequently supplied that report: payment `f63d700b-53a0-4de9-ab07-4751ce18ce7b`, provider reference `pay_TBKE6J8xxIQLZO` / `order_TBKDj1hedLSQdK`, records `captured`, 1,770,000 paise (₹17,700), local capture timestamp `2026-07-09T07:41:32.355Z`, and NULL mode/currency. This remains recorded evidence with unknown Test/Live provenance. Terms comprise created Premium, active historical Premium, expired Trial and an active Base bridge ending July 2027; these legacy rows are not proof of additional cash receipts. Storage mapping has both owner and owner_id with zero owner/UUID-prefix matches, but noncanonical metadata/path/provider coverage is still incomplete. Requested the payment's Test/Live dashboard confirmation; no deletion has been run.

Do not use `public.delete_account_permanently`, `private.delete_account_pre_admin`, `scripts/create-admin.ts`, account-deletion UI, Auth deletion, signup or password reset for this cleanup. The desired identity already exists. Password, Auth UUID, provider factors, sessions and shared Free account history must be preserved.

| Source boundary | Evidence and consequence |
|---|---|
| Factory parent | `20240216123000_initial_schema.sql`: `organizations.owner_id` references `auth.users.id`. Removing a child organization does not remove its Auth parent. Ownership still exists when the profile is absent. |
| Membership | Same migration: `profiles.org_id` references organizations. Peer member rows must be identified; the user’s factory confirmation is not authority to delete peer Auth accounts. |
| Old erasure routine | `20260808115518_20260808064552_permanently_delete_account_data.sql`: removes cross-organization referral dependencies, sweeps org-scoped rows, deletes all member profiles and `auth.users` identities. It is unsuitable for factory-only separation. |
| Legacy boundaries | That routine separately handles `factory_cost_profile.factory_id`, nullable `machine_assignments.org_id` via machines, `referrer_org_id`, `referee_org_id`, and nullable profile/Auth foreign keys. A generic org_id delete misses these paths and can affect another factory through referrals. |
| Shared Free account | `20260908182417_free_tier_foundation.sql` and `20260908190537_free_tier_runtime.sql`: subjects/usage/receipts/funnel events are Auth-subject scoped; grants bind organizations. Do not remove the subject or its shared history merely to remove one factory. |
| Billing and formal records | `20261004153000_admin_data_rights_compatibility.sql`, `20261004170000_admin_retained_record_review.sql`, formal/retention migrations: preserve support, reporting, finance, legal/security evidence, case actors and holds for case review. A test label is not proof that provider references or another requester’s records are disposable. |
| Audit trigger | `20260705100000_batch_24g_security_audit_guardrails.sql` installs organization settings audit; `20260808115518_...` makes its suppression depend on the transaction-local account-deletion flag. A lone organization DELETE must account for this trigger and retain separate operator audit evidence. Do not copy the old routine or disable triggers globally. |

This factory is nonempty. An empty-only deletion prototype was tested locally and withdrawn after these actual results; no destructive draft is delivered for this target. Prepare the scoped factory removal only after the financial/Storage evidence, installed schema and recovery point determine its exact row dispositions. Preserve the Auth identity and shared account history. Rehearse the concrete transaction with rollback first; do not assume an `ON DELETE CASCADE` dependency is disposable.

If any dependency is nonzero, first prepare an exact row/table disposition. Preserve financial/formal evidence and shared Auth-subject history; do not silently cascade it or run the old sweep. Where a UUID boundary lacks an FK, an authoritative cleanup must also serialize the relevant writers during its recheck. This document deliberately supplies no broad recursive delete or ready-to-run destructive transaction while those facts are missing.

After factory separation, use the separately reviewed founder setup to create an admin profile with `org_id=NULL`, preserve the existing Auth UUID/password, and provision the approved founder grant/MFA path. Founder-only routing/tenant denial is independent work owned by the integration agent. Cleanup alone does not establish it.

Remaining evidence: payment/term mode and disposition; Storage/indirect-reference coverage; exact project binding and installed migration/schema history; operator recovery point and rollback evidence for the concrete cleanup. A future cleanup must serialize relevant writers (including Storage), verify delete-trigger definitions rather than OIDs alone, and preserve safe operator audit. Local synthetic tests are not proof of real cleanup. No live mutation, grants, credentials or provider operations were performed here.
