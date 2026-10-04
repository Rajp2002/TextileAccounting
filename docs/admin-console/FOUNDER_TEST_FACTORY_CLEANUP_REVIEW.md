# Founder account reset scope and evidence

On 4 October 2026 Raj changed the instruction from preserving the existing Auth identity to deleting the abandoned account and its selected local factory data, including payment/subscription history, then recreating a dedicated founder identity. This supersedes the earlier preserve-UUID/payment-provenance decision. The operator flow is [FOUNDER_RESET_AND_RECREATE.md](FOUNDER_RESET_AND_RECREATE.md); the complete destructive transaction is [FOUNDER_ACCOUNT_RESET.sql](FOUNDER_ACCOUNT_RESET.sql).

User-supplied results confirm old Auth UUID `d0e56517-29f9-474f-b368-9e63e84da25a`, confirmed email `rajpatel86420@gmail.com`, no profile, and one owned organization: `2420a5a8-d231-4ed2-b9ce-9db986e38879`, name `test`, with zero member profiles. No agent hosted query or mutation was performed.

| Reviewed local source | Count |
| --- | ---: |
| `audit_log` by org_id | 18 |
| `machines`, `machine_type_pay_defaults` | 5 each |
| `org_subscriptions` | 4 |
| `cost_rate_book` | 3 |
| `factory_cost_profile`, `payroll_configs`, `quality_stock_cutover`, `referral_codes`, `subscription_payments`, `workers` | 1 each |

Other displayed production/payroll/stock, legal/formal/security, Free-subject/grant and referral-use boundaries were measured zero. FK/canonical counts overlap and are not summed. New private admin/support tables were unavailable. Payment `f63d700b-53a0-4de9-ab07-4751ce18ce7b`, `pay_TBKE6J8xxIQLZO` / `order_TBKDj1hedLSQdK`, records capture of 1,770,000 paise with unknown mode/currency. Latest authorization permits deleting this local row without guessing its provenance or changing the provider transaction. Four term rows include historical Premium/Trial and a Base bridge; these do not imply four receipts. Storage owner/owner_id and UUID-prefix matches were zero; noncanonical metadata/provider traces are outside the SQL's erasure claim.

## Reset constraints

The transaction asserts exact old UUID/email/confirmation, exact factory/owner/name, single ownership, missing profiles and every reviewed count. It deletes only a fixed twelve-source allowlist, payments before subscriptions and all factory rows before the organization. It does not invoke the old account-erasure sweep, invent a customer organization, reset the database, weaken RLS, disable triggers or delete peer identities.

Quoted catalogue queries handle compound/type-independent FK edges. Every unselected child of machines/workers/rates/referrals/payments/subscriptions/organization must remain absent, including NULL-org and cross-factory records. Additional canonical UUID, consent/refund and projection references cause rollback. Application/provider/Storage writer locks serialize rechecks; timeouts fail safely. Known DELETE functions are checked by exact definition SHA256, not stable OIDs. Unknown rules/inheritance/trigger bodies are refused. No concurrent schema changes are assumed during the operator window.

Auth removal is last. All external direct/deep FK references must be gone. The managed Auth graph is locked and bounded; unknown cascade triggers/rules/inheritance and matched detach/default paths are refused. Non-FK provider UUID or typed text runtime ownership left after deletion rolls the transaction back. This is safe refusal on unsupported shapes, not automatic editing of unknown provider records. Session/factor cascade tests explicitly model hosted behavior in local stubs and do not establish hosted compatibility.

Mandatory minimal global audit is atomic with deletion: unexpected INSERT behavior is refused; audit count/contents are verified. Audit failure rolls back factory, payment and Auth removal together. One operation tombstone remains with no customer payload. A recreated same-email account gets no inherited privileges: provision only its new UUID.

Hosted permission correction: the first operator attempt was denied while locking `auth.schema_migrations`, before deletes. The script now excludes only this provider ledger when it has no identity fields or foreign-key edges; unexpected related shapes still require the lock and fail closed. A non-superuser synthetic operator proves successful removal without SELECT/LOCK access to that ledger, unchanged provider metadata and preservation of another tenant. No permission grants or provider schema changes are proposed for the hosted project.

The transaction does not erase Razorpay records, provider audit JSON, backups, monitoring or browser state, and cannot retroactively revoke an issued stateless JWT. Sign out/close old tabs, use a fresh browser session and preserve current-identity/session checks. Recreation does not install missing founder migrations or enable production gates. Production schema/security/deployment operations remain separately gated.

## Verification and rollback

Named disposable suite: `__tests__/db/admin-founder-account-reset.dbtest.ts`. Fixtures substitute synthetic UUID/email/provider references/amounts and invented worker data. Cases cover success/another tenant, rollback rehearsal, identity/membership/count drift, NULL/cross-org children, compound/text/external Auth edges, deeper sessions/trigger drift, legacy runtime leftovers, managed detach refusal, Storage and suppressed/missing operator audit. See [FOUNDER_ONLY_ACCEPTANCE.md](FOUNDER_ONLY_ACCEPTANCE.md) for final results and independent review.

Before COMMIT, any exception rolls all changes back. After a successful live COMMIT, this is intentional hard deletion: reverting code does not restore records. No automatic restoration or provider reversal is included. Raj explicitly abandoned the old data; next create the fresh Auth identity privately, then apply founder setup to its new UUID. Nothing was deleted by the agent.
