# AD09–AD11 — privacy, release and recovery

This checkout is a local implementation, not a deployed release. All new capabilities default off. No production migration, founder grant, MFA enrollment, credential provisioning, provider reconciliation, customer communication or deployment has been performed.

## Server gates

| Gate | Effect |
| --- | --- |
| `WEAVLY_ADMIN_ENABLED=true` | Allows founder authorization to proceed. Every privileged loader/API/action still requires verified identity, active UUID grant, AAL2 and a live provider-bound server session. |
| `WEAVLY_ADMIN_PRODUCTION_APPROVED=true` | Additional production prerequisite. An enabled console without this approval fails closed. |
| `WEAVLY_SUPPORT_ENABLED=true` | Enables requester support reads/intake/replies and founder support writes. Founder read-only access to retained tickets independently requires the admin boundary. |
| `WEAVLY_SUPPORT_PRODUCTION_APPROVED=true` | Additional production prerequisite for the support capability. |
| `WEAVLY_ADMIN_MFA_ENROLLMENT_ENABLED=true` | Guarded first-TOTP setup after password, confirmed approved email, current UUID grant and provider-bound AAL1 candidate. Never removes a factor. |
| `WEAVLY_ADMIN_MFA_SETUP_APPROVED=true` | Additional production prerequisite for enrollment, separate from console approval. Recovery and actual provider tests are required first. |
| `WEAVLY_ADMIN_LEGACY_READS_ENABLED=true` | Bounded read-only formal registers/details. Checked independently inside every DAL read. |
| `WEAVLY_ADMIN_LEGACY_REFERENCE_ACTIONS_ENABLED=true` | Separately exposes old unbounded reference actions; keep off. Bounded reads do not enable these actions. |
| `WEAVLY_ADMIN_LEGACY_OPERATIONS_ENABLED=true` | Separately approved retained writes/exports/controls. Not a release-one UI capability. No interactive legacy operation UI is mounted. |

Flags never grant identity or disable authorization. They are server configuration, not request/query parameters. Keep all production gates off until the exact deployed version and operational prerequisites are approved and verified.

## Privacy implementation

Sensitive `/admin`, `/api/admin`, `/support` and `/api/support` responses use private/no-store behavior. A NetworkOnly service-worker rule precedes static extension matching. Sensitive queries and all mutations are excluded from persisted React Query state. Support drafts live in component memory only. No attachment system or export endpoint was added.

Sentry replay is disabled globally in this release because a replay started on a previous customer page can cross an SPA transition. Sensitive request/transaction telemetry is discarded, including HTTP-method-prefixed transaction names. Ordinary diagnostic URLs lose query and fragment values; existing body/cookie/credential redaction remains. Backend errors use safe codes/messages/request IDs. Founder audit JSON is allowlisted and excludes ticket/note bodies and provider credentials.

The sensitive surface starts concealed, verifies the current principal before revealing a mounted/restored subtree, and rechecks focus, visibility, online and history/bfcache restoration. Logout/account changes unmount old data/drafts even if navigation stalls. Periodic checks do not extend founder idle time. Only trusted interactive pointer/keyboard activity invokes the same-origin touch endpoint. No claim is made that a mock session endpoint proves real Supabase MFA.

## Required staging acceptance

1. Provision an explicitly isolated Supabase Auth/database environment through an approved setup process. The disposable PostgreSQL harness verifies migrations/RLS/transactions, but its Auth tables are synthetic stubs.
2. Confirm the founder's immutable Auth UUID, dedicated identity choice, current protected admin profile, active single grant, factor enrollment, recovery and emergency revocation. Do not promote an email or create a fake tenant organization. Approve the 15-minute interactive idle/8-hour absolute policy.
3. Run genuine anonymous/AAL1/AAL2/non-founder/generic-admin/requester/peer/cross-tenant/revoked/token-replay browser checks against the exact candidate. Verify refresh, interrupted MFA, logout/back/account switch, offline/cache/storage/replay and direct API/RPC behavior. Synthetic component screenshots are presentation/transport evidence only.
4. Approve support visibility (requester plus founder), owner intake and in-app delivery. No staffed-hours SLA or external notifications are implied.
5. Approve retention/deletion/pseudonymization integration for tickets, messages, notes, idempotency records, reporting and audit. Current owner export/deletion is preserved in source, but new populated support/reporting foreign keys can prevent organization deletion; the new records are not automatically included in customer export. This is a release blocker requiring a reviewed integration, not an automatic purge or guessed legal period. Do not enable production support before this is resolved.
6. Verify classifications, organization-to-factory business mapping and the reporting zone. Missing classification remains unclassified. Approve bounded evidence imports/provider reconciliation separately; projections are not payment authorities.
7. Confirm formal/security operation owners and requirements. `/admin/legacy` now has bounded read-only grievance/security/DPA/notice lists and details. Resolution, incident commands, notifications, signing, proof exports and lockdown still need validated replacements with atomic outcome audit after scope decisions. Preserved services do not establish their readiness.
8. Review migration effects/security grants, obtain a verified recovery point, deploy additive schema and dark code only with explicit authorization, then repeat acceptance on the deployed exact commit. Monitoring, backup and restore remain unavailable unless independently connected.

## Controlled rollout

After staging acceptance and explicit deployment/migration approval, deploy the complete seven-migration additive set before opening reads: factory paid-term reads depend on the billing projection. Keep gates closed during migration. Enable founder reads after negative access and provenance checks, support writes after transactional/audit and delivery-expectation checks, and first MFA setup only after its separate approval. Verify customer login, Free quota/recalculation, billing gates and entitlement fallback. Coverage gaps permit partial subtotals, never a complete net or guessed live total.

Record exact application commit, migration history, gates, verified founder UUID/setup evidence (without credentials), operation owners, classification/financial limitations, observation results and recovery evidence. No production launch is authorized by this document.

## Critical support escalation

Review whether the reported impact involves suspected data loss, unauthorized access or widespread core-work failure. Record a safe diagnostic/incident reference, the founder's next action and the next promised in-app update. Use the existing published `/security-incident` guidance and the separately approved incident operation/owner where relevant; the ticket UI links that guidance. Critical priority does not trigger lockdown, external delivery or a 24/7 guarantee. Retained formal controls remain gated until their operational replacement/fallback is verified.

## Rollback and emergency recovery

Disable the affected server gate first. For a full console rollback set `WEAVLY_ADMIN_ENABLED` false; for support intake/reply rollback set `WEAVLY_SUPPORT_ENABLED` false. Keep separate legacy gates closed. Verify direct endpoints/actions reject the disabled capability; navigation hiding is insufficient. Local endpoint gate tests cover all founder reads/writes/touch and requester support paths.

If the founder identity/session is compromised, use the approved database/operator flow to disable the exact UUID grant and revoke its platform sessions; invalidate provider sessions through the supported Auth process. Grant and provider/server-session revocation must reject the next request even with an old access token. The app logout independently attempts verified platform revocation and provider sign-out and reports unavailable if neither can be confirmed. It remains usable with the console gate off.

Roll application code back to the last reviewed safe version, without restoring the old role-only privilege path. Preserve populated additive tables and source payment records. Do not drop tickets/audit data, reverse payments/refunds, broaden tenant RLS or invent cascade deletion to recover service. Use a reviewed forward schema fix when necessary. Recheck customer access/billing and the approved formal-operation fallback before reopening.

Local tests rehearse gate denial, grant/session revocation, idle/absolute expiry and atomic rollback on failed audit. Deployment rollback, real MFA recovery and a staging recovery point have not been rehearsed in a full Auth environment and remain blocked release gates.
