# Privacy and security case handling

This local slice adds founder-owned case handling to the existing Weavly privacy grievance and security registers. It does not deliver messages, release data, erase retained records, notify a regulator, change reportability, or perform lockdown. Production remains disabled.

## Approved scope and decisions

The user approved the three proposed defaults with “Yes” on 4 October 2026 at 12:34:42 UTC in the main conversation `Sentinel_14739587766c8191acc3c48a16f8ca4e`: privacy/grievance requests and security incidents with Raj as sole owner; case-by-case review before deleting retained support/legal/security records; policy configuration and review queues with automatic purge disabled until numeric periods are approved. DPA editing, worker disclosures and lockdown controls remain outside this slice. These approvals do not authorize production changes, actual disclosure/deletion, security setup or external delivery.

The source baseline was reconciled with freshly fetched main `39b5e15a78af02824453444ef04de1f0d24334b0` and merged locally as `af1b9055`. The complete original [plan](ADMIN_CONSOLE_PLAN.md) and [sprint](IMPLEMENTATION_SPRINT.md) remain preserved. The merge keeps main's complete paginated customer archive and Lite behavior, together with requester-only public support export.

## Founder workflow

1. Open `/admin/formal`, filter privacy or security cases, and investigate open, due or unmanaged records. Lists use bounded keyset pagination and explicit source errors.
2. Record an already received case at `/admin/formal/new`, with receipt time, original-channel reference, next action and internal follow-up. Optional factory/requester binding requires a current owner in the same verified organization; it is not proof of authority for disclosure.
3. Existing source records enter case handling through explicit adoption. Adoption preserves their source identity and historical evidence; there is no rebinding API or automatic historical import.
4. Record actual acknowledgement/authority-review evidence, progress and private notes. A save records work performed, and sends nothing. New acknowledgement dates require a safe delivery-evidence reference. Historical dates without evidence remain unverified.
5. Close with an outcome, summary and evidence reference. Privacy closure also requires the actual externally delivered response time; fulfilled or partly fulfilled requests require verified authority. Correcting a closed case preserves its original closure timestamp. Reopening clears current closure state and retains prior evidence.

The published source's internal targets remain visible: privacy acknowledgement within three business days and response within thirty calendar days; security acknowledgement within one business day. Business-day due dates need operator review. The implementation does not infer legal applicability, invent a holiday calendar or treat an internal target as a statutory deadline. New security cases leave reporting assessment pending, and preserve existing assessment fields on updates.

Separate private revisions retain selected previous/next operational values and evidence references. They exclude raw intake text, contacts and identity documents. Legacy proof URLs remain in the source register; the new history records only their SHA-256 fingerprint. Safe global audit contains operation, target, actor, request and result metadata rather than conversation/evidence content.

## Deletion and access review

`/admin/formal/review/:orgId` presents bounded counts for recurring-provider references, billing evidence, formal source records, legal evidence and formal/retention sidecars. It gives no deletion approval token and performs no mutation. Counts reach a documented limit of 1,000 and expose whether more records exist. Missing sources fail closed.

Owner account deletion no longer invokes Razorpay cancellation. Any legacy recurring reference or protected retained linkage routes the request to review, and the authoritative database transaction independently rechecks current records under existing locks. This removes the prior cross-provider cancellation-before-deletion failure. It does not implement a retained-record erasure or pseudonymization executor. Cases that need one require a concrete reviewed plan and the applicable explicit approval.

Factory downloads preserve complete main-line pagination and the requester's own public support history, while excluding Weavly operator privacy cases, security records, founder notes and audit. Those records require a scoped review through the published privacy contact. Owner unlock intake continues through a narrow current-owner RPC and never unlocks the organization itself.

## Retention review

`/admin/formal/retention` shows six record classes, policy approval/effective dates, active source-linked holds and linkage issues. There are no seeded retention periods, policy-editing UI, purge scheduler or purge command. An unconfigured policy is explicitly incomplete. A configured review-ready record still does not authorize deletion. See [retention contract](RETENTION_REVIEW.md).

The private versioned policy and hold tables accept only approved operator/database changes through a separately reviewed process. Applications receive no direct table-write privilege. Holds are linked to fixed supported source types, never arbitrary tables. Source evidence and approval references are required before numeric retention rules are introduced.

## Boundaries and migrations

Three additive migrations supplement the existing seven founder-console migrations:

- `20261004170000_admin_retained_record_review.sql`: protected retained-record checks and counts-only preview.
- `20261004180000_admin_formal_case_workflow.sql`: private case metadata, notes/events/revisions/idempotency and narrow audited read/write operations, plus compatible owner unlock intake.
- `20261004190000_admin_retention_review.sql`: private versioned policy/hold storage and bounded read-only review.

All founder reads and mutations independently require the current UUID grant, live provider-bound MFA/session principal and formal capability gate. SQL functions restrict execution to the server role and recheck founder session; private tables are unavailable to clients. Mutation transactions lock the source/case, enforce version and canonical request-key deduplication, append private history and required safe audit, then commit. A failed audit rolls back the mutation. Same-origin JSON defenses, bounded inputs, sanitized errors and private/no-store responses apply to the new APIs.

Drafts remain in component memory. An uncertain result retains the original payload and request key through transport failures or throttling. A definite validation/version rejection allows correction. Dirty drafts retain their original snapshot/version; after a confirmed save, new changes wait for the confirmed detail refresh. Existing sensitive-route logout, account-switch, back/offline and replay protections cover `/admin/formal` and `/api/admin/formal` through their parent path boundaries.

## Rollback and gates

Set `WEAVLY_ADMIN_FORMAL_ENABLED=false` to close all new formal, retained-record and retention reads/writes independently of the rest of the console. Production additionally requires `WEAVLY_ADMIN_FORMAL_PRODUCTION_APPROVED=true`; keep it unset until approved acceptance. These gates cannot replace authorization. Full console rollback also closes `WEAVLY_ADMIN_ENABLED`.

Retain additive case/support/audit/reporting data on rollback. Do not restore direct client grievance grants, permissive legacy admin access or provider cancellation in account deletion. Preserve owner unlock intake and the public privacy/security contact routes. Use a reviewed forward schema fix if data exists. No destructive down migration, record purge, payment reversal or automatic factor removal is provided.

The runnable checks and exact candidate are recorded in [local acceptance](DATA_RIGHTS_ACCEPTANCE.md). Remaining release gates include real isolated Supabase Auth acceptance, PostgreSQL 16 replay, staging recovery/rollback evidence, approved numeric retention policies and any concrete retained-record disposal/disclosure plan, founder security setup, and explicit production migration/deployment authorization.
