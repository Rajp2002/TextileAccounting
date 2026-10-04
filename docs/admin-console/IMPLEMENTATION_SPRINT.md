Build a fresh founder-only operating console for the current Weavly product. It should answer five practical questions: which factories use each plan, who needs help, what customers have actually paid, where access or onboarding is failing, and what needs the founder’s attention today.

The old admin console is legacy reference material. Its tabs, information architecture, and previous-version assumptions are not the product specification. Reuse an existing service only after verifying that it still serves the current product. Retire obsolete UI deliberately without silently deleting records or breaking a live safety, privacy, billing, or support workflow.

This is a complete implementation brief, not an implementation or deployment. The repository [Rajp2002/TextileAccounting](https://github.com/Rajp2002/TextileAccounting) was inspected at main commit `36e6e4edac8de76052dc8247d99a74b90ef3772d`, tree `5b76d45680a64ab14595b64f297f0f12d513f1fb`, on 3 October 2026. Production configuration, applied migrations, account identities, and actual financial balances have not been verified. All new behavior below is proposed unless explicitly described as an existing code fact.

## Implementation instructions

Implement AD00 through AD11 in dependency order. Start by reading the checkout instructions, inspecting the current branch, and comparing current main with the pinned baseline. Reconcile changed assumptions before editing. Work in an isolated development branch and non-production database. Keep changes reviewable by ticket. Do not deploy, bootstrap a production founder, change authentication/security settings, create credentials, enable live payments, send customer messages, run a production backfill, or mutate customer financial records merely because this brief exists.

Use the contracts in this document rather than inventing business rules during implementation. Each ticket must finish with changed files and migrations, tests run and results, screenshots where applicable, unresolved gaps, and rollback notes. Do not describe a mock, seeded fixture, or skipped integration test as verified production behavior. A data-source gap must produce an explicit unavailable or incomplete state, never a plausible-looking zero.

## Outcome and scope

### First release

- A separate `/admin/login` screen using email and password through existing Supabase Auth, with founder-only authorization and MFA before privileged data

- A fresh `/admin` home centered on actionable queues and trustworthy summary counts

- Factory search, plan counts, account and entitlement state, and a minimal support-safe detail page

- A complete text-based support loop: customer intake, customer-visible replies, private founder notes, priorities, next-update commitments, resolution, and reopening

- A read-only Payments view showing confirmed collections, confirmed refunds, net collections, source coverage, payment/access exceptions, and billing readiness

- A small System view using real existing signals, plus founder audit history

- Clear data freshness, unknown-data states, pagination, permission denial, and a tested rollback

### Explicitly outside this sprint

No second password database, public admin signup, multi-admin role-management product, impersonation, arbitrary SQL/query console, manual “mark paid,” payment capture/refunds, plan or price editing, customer deletion, new account-suspension control, bulk exports, bank feeds, accounting engine, automated email/WhatsApp intake or outbound replies, AI support replies, opaque churn scores, NPS, or a broad CRM. File attachments are a separate later slice: text support must work without adding an unreviewed upload/scanning system. Existing high-impact controls are neither copied into the new UI by default nor silently removed; AD00 determines their current operational owner and disposition.

## Verified starting point

These facts constrain implementation; they are not a request to preserve the old experience.

1. **Existing admin and auth:** `app/(dashboard)/admin/{layout.tsx,page.tsx,admin-ui.tsx}` implements a legacy compliance-oriented console. Its layout uses `requireRole(['admin'])`, and server compliance actions perform their own authorization. `lib/auth.ts` validates the Supabase user, revocation, and a current database profile. It also requires an `org_id`. `scripts/create-admin.ts` creates an admin profile without an `org_id`. Fix this mismatch through a distinct platform identity boundary, not a fake customer organization or weakened customer guard.

2. **Authorization is already server-managed:** migration `20260625195248_harden_profile_authorization_boundary.sql` protects profile identity, role, and organization fields from ordinary client modification. Preserve these protections. `lib/supabase/admin.ts` is already server-only. A privileged client still bypasses RLS and requires explicit authorization before every query.

3. **Routing:** `proxy.ts` does not currently treat `/admin/login` as a public login route. Route groups do not themselves provide security. Putting the new login beneath an existing protected layout can create a redirect loop or run customer-plan logic before login.

4. **Plans:** current purchasable tiers in `lib/billing-constants.ts` are Lite and Base. Source prices including GST are Lite ₹2,999 first year and ₹1,499 renewal; Base ₹9,999 and ₹4,999. The code model is upfront first year plus manual annual renewal, with 365-day access; same-plan renewal is offered in the last 30 days of a current term and after expiry. This sprint does not change those terms.

5. **Entitlements:** `lib/subscription-access.ts` resolves all eligible subscription rows, with the highest current entitlement winning. A later failed checkout must not hide earlier valid access. Expired paid Base history can retain effective Lite access. `lib/subscription.ts` also checks explicit Free grants. No subscription is not equivalent to Free. Referral credits may extend access without a new cash receipt. Effective Lite access is not proof of a current paid Lite term.

6. **Finance:** `subscription_payments`, `billing_checkout_attempts`, `billing_payment_refunds`, `billing_invoices`, and `org_subscriptions` serve different purposes. The inspected ledgers do not establish live/test provenance for every historical payment. The refund ledger is one row per payment and its `issued` value follows a successful provider-create response; inspected code does not establish completed refund time or complete partial/out-of-band refund coverage. Current `BILLING_DOCUMENT_POLICY.state` is `not_supported`, describing payment receipts rather than GST tax invoices. The live-readiness code requires document-policy approval and supplier configuration before live checkout. Do not bypass that gate or infer that live revenue exists.

7. **Support and privacy:** inspected routes provide a public privacy-request mailto flow and admin-managed grievance records; no dedicated end-to-end ordinary ticket system was found in the inspected inventory. A formal privacy grievance’s internal target is not a general customer-support SLA.

8. **Telemetry:** paid-plan usage events and Free funnel events are separate. The repo has service-role-only Free support/cohort views; current Free quota support uses India monthly boundaries. Free commercial subjects and their quotas can span multiple organization bindings; Free funnel events are subject-scoped and do not themselves identify a factory. A Free retention function deletes raw funnel events older than 90 days, but its production schedule was not verified. Browser events are not a complete authoritative record of business outcomes. Historical usage/retention cannot be reconstructed simply by counting whatever events remain. Do not fan one subject event out to every linked factory.

9. **Caches and telemetry need inspection:** the manifest includes PWA, persisted React Query, Dexie, and Sentry replay dependencies. Their presence is a reason to test caching/replay boundaries, not evidence that the current app leaks data.

## Default decisions

These defaults remove unnecessary implementation ambiguity. Confirm identity and sensitive operational changes at the named release gates.

- One active founder grant keyed to a verified Supabase Auth user UUID. Email is used to sign in, never to confer privilege. Do not guess the founder’s email or UUID.

- Reuse Supabase Auth and existing cookie/session mechanisms. A separate login experience does not imply a second identity provider or a fully separate browser session. Document that signing out may also end the same-origin customer session.

- Founder access needs a current active grant, non-revoked identity/profile, verified MFA assurance, and a live server-side admin session. Keep the founder’s server-managed profile role `admin` for compatibility with current role routing, but also require the founder grant; the role alone is insufficient. Do not convert a customer owner account to admin automatically. If separate founder credentials are wanted, provision the approved dedicated identity through the secure setup flow.

- Proposed founder session limits: 15 minutes of interactive inactivity and 8 hours absolute duration. Implement in server state rather than assuming provider refresh behavior enforces them. Automatic polling must not extend inactivity. MFA enrollment/recovery and production enforcement require explicit approval; until verified, the new console remains disabled in production.

- In the inspected model, use `organizations.id` as the factory counting key. Confirm this one-organization-to-factory mapping in AD00 before labelling totals “factories.” Count users and subscription rows separately.

- Store instants in UTC. Proposed business-reporting zone is `Asia/Kolkata`, consistent with existing Free monthly boundaries; show it visibly. API period bounds are explicit half-open UTC instants. Founder preference may change presentation, not historical event instants.

- Default support visibility is requester plus founder, not everyone in the organization. First release intake is for authenticated owners, including Free, expired, or payment-blocked accounts, without a paid-plan requirement. A business-locked organization may use the dedicated support-only path if identity remains valid; support does not unlock business writes. A revoked/unverifiable account uses an existing published contact/recovery route, not a bypass around revocation.

- The founder is the sole support owner. No assignment/team system is necessary. Every unresolved ticket has a next action; waiting-on-fix also needs a next-update time and reference, and waiting-on-customer needs an internal follow-up due time.

- Support is in-app and text-only. Founder manual capture of phone/email/WhatsApp context is allowed by the product, but it neither imports those channels nor sends anything to them automatically.

- Revenue means a clearly labelled view of payment collections. Do not label net collections as recognized revenue or bank settlement. No MRR or ARR in this release because the current code establishes manually renewed annual terms, not an automatically recurring subscription metric.

- Reporting cohorts are `production`, `test`, `demo`, `internal`, or `unclassified`. Unknown historical records remain unclassified until evidenced. Never infer a production/test classification from an email domain, payment-ID shape, or the gateway’s current configuration.

## New navigation and route layout

Build a clean founder shell with five primary destinations: Today, Factories, Support, Payments, and System. Put Audit and authentication/session information in secondary navigation or the account menu. Do not recreate seven legacy tabs or add a generic Settings screen full of dangerous controls.

Public-to-authenticated routes:

- `/admin/login`: email/password, generic error, recovery link, then MFA challenge; no signup

- `/admin/verify`: authenticated founder-identity candidate may complete MFA; no customer or admin data

- `/admin`: Today needs-attention overview

- `/admin/factories` and `/admin/factories/[orgId]`

- `/admin/support` and `/admin/support/[ticketId]`

- `/admin/payments`: Payments

- `/admin/system`: System

- `/admin/audit`: secondary Audit access

- `/support` and `/support/[ticketId]`: requester’s own support outside the paid customer layout; final route collision check in AD00

Recommended file organization is sibling route groups `app/(admin-auth)/admin/...` and `app/(admin-console)/admin/...`, with protection only in the latter group’s layout. At the pinned tree there is no `app/(dashboard)/layout.tsx` or `app/(auth)/layout.tsx`; the existing admin layout is the role-checking ancestor, while root layout includes global providers and telemetry. Recheck current ancestors so no tenant dashboard guard wraps either the login or founder shell. There must be exactly one page for each URL. Share visual components without sharing tenant gating. Keep normal owner login, signup, callback, Free routing, and entitlement checks unchanged. Precisely classify `/admin/login` and `/admin/verify`; never mark the `/admin*` prefix public. Existing proxy role hints must not reject a valid freshly authorized founder because of stale JWT metadata: use authenticated coarse routing and let the current server founder guard decide, or refresh the verified routing state. Test both `/login`→founder and owner→`/admin/login` paths.

Legacy deep links and server contracts get an explicit disposition in AD00. Preserve or redirect only links with a current justified use, maintain a documented fallback for any retained live operation, and test query/tab parameters that remain supported. A fresh `/admin` may replace the old landing page; that does not authorize deleting the old database records.

## Security and data access contract

Create a server-only founder data-access layer. `requireFounder()` is called inside every loader, action, API handler, and download path before privileged queries, not only in a layout. It returns a minimal principal with `userId`, verified session identifier, and fixed release-one capabilities. Do not accept role, actor, organization authorization, assurance level, or capabilities from request bodies.

Separate the shared verified-identity/revocation primitive from the tenant guard. Tenant owners still need a valid organization. Platform founder authorization must work without tenant `org_id`. Preserve existing current-profile and revocation checks. Check the active founder grant on every request, with at most request-local memoization. Wrong-role/wrong-founder responses are denied before records load. Pages may redirect to login; APIs return 401 or 403 rather than HTML redirects.

Use fresh verified auth plus the authoritative founder-session record to enforce sign-out, revocation, idle and absolute expiry. Validate the verified token’s session ID against a live provider session or an equivalently authoritative server session mechanism; a decoded JWT or provider `getSession().user` is insufficient. Founder grant revocation must block the next request even if an access token remains cryptographically valid.

New cross-factory queries are narrow server methods with allowlisted filters and selected columns. There is no client-side aggregate over full tenant records. The privileged client stays server-only. Do not broaden business-table RLS merely to make an admin query convenient. Any retained legacy global-admin RLS/RPC path must either require the approved founder capability, be explicitly justified for another authorized role, or be retired from exposure. A UI guard cannot protect a directly callable old RPC.

For SQL functions that truly need elevated privilege: use fixed search paths, schema-qualified objects, caller checks, restricted EXECUTE grants, bounded outputs, and no arbitrary table/filter arguments. Prefer invoker semantics when sufficient. Keep private grant/session tables outside exposed schemas; never expose the Auth schema to the Data API to simplify a session lookup.

Cookie-authenticated mutations require same-origin/CSRF defenses compatible with the existing framework. Validate redirect targets against relative internal allowlists. Use generic sign-in/reset failures and the project’s existing rate limiter plus verified provider limits. Neither an error page nor a monitoring event may expose passwords, tokens, raw tickets, gateway secrets, or full customer records.

## Schema contract

Use additive, versioned migrations. Verify names against the live migration history in AD00; the names below are new proposed objects, not existing claims. Keep foreign keys and indexes explicit. If an equivalent trusted object already exists, extend it once rather than maintaining competing authorities.

### Founder and reporting metadata

- `private.platform_founder_grants`: `user_id uuid PK REFERENCES auth.users(id)`, `enabled boolean`, `granted_at timestamptz`, `revoked_at timestamptz NULL`, `grant_reason text`, `created_by uuid NULL`. Enforce at most one enabled founder in this release. No customer/client grants or self-service write endpoint. Provision only after founder identity verification.

- `private.platform_admin_sessions`: `session_id uuid PK`, `user_id uuid`, `created_at`, `last_interactive_at`, `absolute_expires_at`, `revoked_at NULL`, `aal_verified_at`. Bind to a verified provider session; no caller-provided arbitrary session creation. The access layer checks it on every privileged call.

- `private.admin_org_reporting`: `org_id uuid PK REFERENCES organizations(id)`, `cohort text CHECK IN (production,test,demo,internal,unclassified)`, `classification_reason text`, `classified_at`, `classified_by uuid NULL`. Missing rows mean unclassified. Classification does not change customer access or billing.

- `private.admin_audit_events`: immutable `id uuid`, `occurred_at`, `actor_id uuid NULL`, `session_hash text NULL`, `action text`, `target_type`, `target_id`, `outcome`, `reason_code NULL`, `before_safe jsonb NULL`, `after_safe jsonb NULL`, `request_id`. Define allowlisted JSON fields; no ticket bodies, passwords, raw requests, or payment credentials. No application update/delete grants.

Treat private schema access through the existing server database mechanism or narrow reviewed functions. Do not put these tables in `public` with permissive grants because a client library cannot see a private schema.

### Support

- `support_tickets`: `id uuid PK`; immutable `org_id uuid`; `requester_user_id uuid NULL`; `created_by_user_id uuid NULL`; `source` in `in_app,manual_email,manual_phone,manual_whatsapp`; `subject` trimmed 3–160 characters; `category` in `onboarding,costing,production,inventory,payroll,billing_access,bug,other`; `priority` in `critical,high,normal,low`; `status` in `new,in_progress,waiting_on_customer,waiting_on_fix,resolved`; `next_action` up to 500 characters; `follow_up_due_at NULL` for internal customer-chase work; `next_update_due_at NULL` for customer-facing promises; `related_incident_id NULL` and `related_grievance_id NULL` only where verified target tables exist; `external_reference NULL` restricted to safe text/validated HTTPS link; `created_at`, `updated_at`, `last_customer_message_at NULL`, `last_public_founder_reply_at NULL`, `first_public_founder_reply_at NULL`, `last_customer_message_seq bigint NULL`, `last_public_founder_reply_seq bigint NULL`, `needs_founder_reply boolean`, `update_promise_set_at NULL`, `update_promise_fulfilled_at NULL`, `resolved_at NULL`, `resolution_code NULL`, `resolution_summary NULL`; `version integer` for optimistic concurrency; `client_request_id uuid`, non-null `idempotency_actor_key`, and `request_payload_hash` for create deduplication. Enforce database uniqueness on `(idempotency_actor_key, client_request_id)`; hashes represent canonical validated payloads, not raw transport bytes.

- `support_messages`: `id uuid PK`, `ticket_id uuid FK`, `author_user_id uuid NULL`, `author_kind` in `customer,founder`, `message_kind` in `initial_intake,public_reply`, `body text` trimmed 1–10,000 characters, `created_at`, `message_seq bigint` unique per ticket, `client_request_id uuid`, non-null `idempotency_actor_key`, and `request_payload_hash`. These are public-to-the-requester messages only. No edit/delete feature in v1. Enforce database uniqueness on `(ticket_id, idempotency_actor_key, client_request_id)`. The actor key remains stable independently of nullable profile references so later profile removal cannot defeat deduplication. Serialize messages and state transitions with a locked ticket row; timestamp ties do not decide who owes the next reply.

- `private.support_internal_notes`: `id uuid PK`, `ticket_id uuid FK`, `author_user_id uuid`, `body text` 1–10,000 characters, `created_at`, `client_request_id uuid`, non-null `idempotency_actor_key`, and `request_payload_hash`; unique `(ticket_id, idempotency_actor_key, client_request_id)`. Separate storage and DTOs from public messages.

- `support_ticket_events`: append-only timeline fields `id`, `ticket_id`, `actor_user_id NULL`, `event_type`, allowlisted before/after values, `created_at`, and request ID. Customer DTOs expose only safe status/public events, never internal note contents or private references.

Use database indexes for `(org_id, requester_user_id, updated_at DESC, id)`, `(status, priority, next_update_due_at, updated_at, id)`, and message/event `(ticket_id, created_at, id)`. Apply RLS to exposed tables. Customer access requires current authenticated owner identity, active/non-revoked membership in the same organization, and `requester_user_id = auth.uid()`. A peer in the same organization is denied. Customer mutations go through narrow server operations; revoke direct arbitrary table updates/inserts. Founder access also follows its current grant and MFA rules, or stays behind the guarded server layer with no broad public founder policy.

Do not add operational hard-delete or cascade changes to existing customer records. Nullable actor/requester foreign keys and pseudonymization must integrate with the current data-rights process. Production rollout requires an approved retention/deletion integration; do not invent a legal retention period or install an automatic purge as part of this sprint.

### Financial reporting provenance

Keep existing ledgers as the source of economic actions. Add a read-only-to-users reporting projection only where source columns cannot represent provenance without ambiguity:

`private.admin_billing_facts`: `id uuid`, `kind` in `capture,refund`, `provider`, non-secret `provider_account_id`, `provider_object_id`, `source_record_type`, `source_record_id`, `org_id uuid`, `payment_reference`, `currency`, `amount_minor bigint CHECK >= 0`, `tax_minor bigint NULL`, `occurred_at timestamptz NULL`, `recorded_at`, `time_basis` in `provider_verified,local_recorded,unknown`, `mode` in `live,test,unknown`, `verification_state` in `verified,unverified,conflict`, `verified_at NULL`, `evidence_ref`, `plan_at_sale NULL`, `purchase_type NULL`. Unique `(provider, provider_account_id, mode, kind, provider_object_id)`; each partial refund has its own provider refund identity. A capture and its later refund remain separate facts.

Store reconciliation coverage separately in `private.admin_billing_coverage`: `id`, provider account reference (non-secret), mode, currency, period start/end, capture/refund coverage state (`complete,partial,unknown`), checked-at, evidence reference, and conflicts count. Missing coverage means unknown, not complete. A range report must be covered by complete evidence for every interval it claims.

This projection must be rebuildable from trusted records/provider evidence, not a second payment authority. It cannot activate plans or mark payments paid. Do not infer capture evidence solely from the current `refunded` status, infer tax from today’s price, or assign a capture date to a legacy row from a guessed timestamp. Unknowns remain visible and excluded from claims they cannot support. Idempotent population and any approved historical reconciliation are AD07 work. No provider payload dumps or financial credentials belong in the projection.

## Shared API and state contracts

Use Zod input schemas, fixed DTOs, and a common error shape: `{ code, message, requestId, fieldErrors? }`. Use 400 validation, 401 unauthenticated, 403 unauthorized, 404 unknown or unauthorized customer object, 409 stale version/idempotency mismatch, 429 throttled, and 503 unavailable source. Do not return a stack trace or raw database error. Bound list `limit` to 1–100, default 25; use stable cursor pagination and allowlisted sorts. Searches have length limits and parameterized queries. Response timestamps are ISO strings; money is integer minor units as decimal strings in JSON to avoid overflow/rounding.

Read contracts:

- `GET /api/admin/overview`: summaries plus attention groups, `asOf`, source freshness, metric version, reporting zone, and coverage/exclusions

- `GET /api/admin/factories`: search/plan/cohort/lifecycle filters and cursor; `items`, `nextCursor`, `totalMatching`, `asOf`

- `GET /api/admin/factories/:orgId`: safe identity, effective access, current paid entitlement, dates, known milestones, support summary, and payment references; no payroll values, worker identities, costing inputs, stock valuations, or complete customer ledgers

- `GET /api/admin/support` and `GET /api/admin/support/:id`: founder list/detail with distinct public thread and internal note sections

- `GET /api/support` and `GET /api/support/:id`: requester’s own public ticket DTOs only

- `GET /api/admin/payments?from&to&timezone&currency`: confirmed summary, coverage and exceptions; default trailing 30 days, maximum 366 days, no future end bound, INR only while it is the supported source currency; no mixing currencies

- `GET /api/admin/system` and `GET /api/admin/audit`: bounded operational signals and paginated audit records

Mutations:

- `POST /api/support`: customer supplies subject/category/body/clientRequestId only; server derives org/requester, normal priority, new status, and source

- `POST /api/admin/support`: founder manual capture supplies a verified target org, source, optional verified requester from that org, subject/body and clientRequestId. No guessed requester binding; unbound manual tickets are internal-only and cannot send public replies; no automatic external delivery

- `POST /api/support/:id/messages`: customer public reply; server derives identity and reopens as specified below

- `POST /api/admin/support/:id/messages`: explicit public reply, expectedVersion, clientRequestId, intended next status and explicit promise-fulfilled/new-due-date fields; visibly labelled “Send to customer”

- `POST /api/admin/support/:id/notes`: internal note, expectedVersion, clientRequestId; never customer-visible

- `PATCH /api/admin/support/:id`: allowlisted priority/category/status/next action/due date/resolution/reference fields, expectedVersion, reason for sensitive priority/escalation change

Every mutation is transactionally consistent with ticket events and required admin audit. Idempotency returns the original successful result when the same request is retried; the same key with different content returns 409. Prevent double replies and lost updates. Ticket creation deduplicates by immutable actor key plus clientRequestId, and message deduplication uses ticket plus actor key plus clientRequestId. In a transaction, lock the ticket, validate expectedVersion, append the next monotonic message sequence, update status/reply responsibility and audit, then commit. If a customer reply races founder resolution, either the reply reopens the newly resolved ticket or the stale resolution returns 409; it can never swallow the reply. The UI retains a failed draft in memory only, clearly reports whether sending succeeded, and does not silently retry a public send with a new key.

### Support state machine

- Create → `new`

- Founder triage → `in_progress`

- Founder public question → `waiting_on_customer`; require the actual public question plus a next-action/follow-up date. Label this as the founder’s internal follow-up due date, not a promise that the customer will reply. A customer-facing next-update promise, if made, is tracked separately

- Waiting for an engineering/provider fix → `waiting_on_fix`; require next action, reference, and next-update due time

- Resolve → `resolved`; require resolution code and public resolution summary for a requester-bound ticket, with `resolved_at` set. Internal-only manual tickets instead require a private outcome, explicitly not delivered

- Any new customer reply to a waiting or resolved ticket → `in_progress`, clear `resolved_at`, retain prior resolution/reopen history, update last-customer timestamp

- Customer reply to `new` stays `new`; reply to `in_progress` stays there

- Internal note → no automatic status or customer-response-time change

- First human founder `public_reply` sets first-response time once; `initial_intake` never counts; automatic acknowledgements and internal notes never count

- Every customer message sets `needs_founder_reply = true`; a committed human public founder reply clears it only after replying to the latest customer message under the ticket lock. Internal notes and status-only updates never clear it

- A customer-update promise is fulfilled only by a committed human public update explicitly recorded as fulfilling it, or replaced by an explicit new due date with timeline history. Internal notes, merely changing status, and silent resolution do not make an overdue promise disappear

Resolution codes: `explained_behavior,setup_corrected,bug_fixed,billing_access_corrected,duplicate,cannot_reproduce,feature_request_recorded`. Resolving a request is not a promise to implement it. “Critical” triggers a visible incident-escalation path; it does not claim a 24/7 service guarantee. No automatic expiry of waiting tickets in v1.

## Metric dictionary

All metrics carry `definitionVersion`, `asOf`, timezone, inclusion criteria, source coverage, and drill-down filters. Any percentage uses the same eligible cohort, attribution scope, exclusions and observation window in numerator and denominator; show both counts. Do not mix factory and Free-subject denominators or treat immature/unobserved entities as failures. Customer-production totals include only evidenced production organizations and verified live facts where appropriate. Show unclassified, excluded test/demo/internal, and unresolved provenance counts beside the relevant view.

### Factory and plan counts

- **Total production factories:** distinct production-classified `organizations.id` at the snapshot. Do not count users, checkout attempts, or subscription rows.

- **Effective Free, Lite, Base, no access:** mutually exclusive effective access resolved using the same current application entitlement resolver, explicit Free grant rules, and one shared `asOf`. When every entitlement resolves, these sum to the included factory total. On source/resolver failure, use a reporting-only `unknown` bucket and coverage warning, so known buckets plus unknown equal the total; never map errors to no access. If the organization population itself is unavailable, the aggregate is unavailable. Do not add `unknown` to the product entitlement enum or change customer access because reporting failed.

- **Current paid Lite and Base terms:** distinct factories with a qualifying current paid entitlement, separately from effective access. Retained Lite after Base expiry and complimentary/unknown-history access must not inflate paid-plan counts.

- **Expiring paid terms:** current paid entitlements ending in the next 30 days using existing renewal/grace semantics. Count each organization once per selected current term; show term dates and manual-renewal wording.

- **Locked/revoked:** separate flags, never silently folded into a different plan. Plan ownership and ability to perform a business write are different facts.

### Usage and activation

Use server-confirmed successful business outcomes for new instrumentation. Browser navigation is not activity. First persisted original costing is the comparable estimator-activation milestone; a Free same-entry recalculation is not a new costing, new credit, or second activation. Reuse the actual Free quota/reset contract. Free subjects may bind to multiple organizations and share quota. Show subject/account-level quota and activity with that scope label unless a receipt or event supplies verified organization attribution. Never join a subject event to every grant and count multiple factory activations. New server events should capture immutable operation and organization IDs where the operation genuinely belongs to one organization; historical unknown attribution stays unknown. Keep subject and factory denominators distinct. Track recalculation and successful review/export separately where supported.

Base operational activation is a separate milestone: actual required setup followed by the first valid production record. Verify prerequisites rather than requiring every module or payroll adoption. Weekly activity is distinct factories with a qualifying successful event in the trailing 7×24 hours, with module breakdowns. If attribution or collection coverage is incomplete, label it observed active factories with coverage, not the complete active-factory count. Mark historical activity as “coverage begins DATE” or unavailable where trustworthy events do not exist. No historical zero-fill. Mature activation/retention/conversion cohort charts are deferred until full observation windows and event coverage exist.

### Support

Never answered means unresolved with no human public founder reply. Needs our reply is the current `needs_founder_reply` flag derived atomically from message sequence, including a later customer reply after an earlier response; this is the queue that prevents an already-answered customer from being forgotten. First response is first public founder reply minus creation. Overdue promises are unresolved tickets past their next-update time without the promised public update. Show counts and ages before averages; if response summaries are shown, use median/p90 plus sample count and cohort/window. Reopened tickets are visible separately. Waiting-on-customer time is not silently treated as founder response delay.

### Money

- **Confirmed gross collections:** sum unique verified live capture facts in the selected currency with verified capture time in `[from,to)`. Label that amounts include tax where that is supported by source evidence.

- **Confirmed refunds:** sum verified live processed refund facts by refund event time in `[from,to)`. Pending/failed refund requests are separate exceptions, not refunds paid.

- **Net collections:** gross collections minus confirmed refunds in that reporting period/currency. A refund may concern a capture in an earlier period, so a period can be negative.

- **Tax-exclusive collections:** show only for a reconciled subset with evidenced tax amounts for captures and refunds. State the subset and excluded amount; no whole-history divide-by-1.18 shortcut.

- **Unverified amount:** show separately for unknown mode, ambiguous time, unmatched capture/refund, or conflicting evidence; do not blend it into confirmed totals. Local refund `issued` currently means the provider creation call returned an ID, not proven processed cash. Refund `created_at`/`updated_at` are not verified processing times. Known payment/refund facts alone cannot prove complete period coverage: totals require independently recorded reconciliation coverage for the whole provider account/mode/period, including provider-originated and partial refunds. If refund or capture coverage is incomplete, display the known subtotal as partial and mark full-period net collections unavailable. A missing refund feed is never a trusted zero.

- **Bank settlement, recognized revenue, receivables, MRR and ARR:** unavailable/not included in this release unless a later approved source and definition are added. An issued receipt is not proof of an outstanding receivable.

Example fixture: verified live captures of 299,900 and 999,900 paise plus a confirmed 100,000-paise refund yield ₹12,998 gross, ₹1,000 refunds and ₹11,998 net. A duplicate event adds nothing; a test capture adds nothing; a pending refund changes the exception queue only. A full refund must not erase the original capture from its original reporting period.

## Ordered implementation tickets

### AD00 Reconcile current product and legacy contracts

**Dependencies:** none. **Purpose:** establish the source baseline and avoid carrying obsolete product assumptions into the build.

- Inspect current main versus the pin, ancestor layouts/proxy auth behavior, current schema/applied migration inventory in the authorized non-production environment, auth/revocation helpers, payment lifecycle, Free support views, telemetry, caches, and test commands.

- Produce a compact checked-in admin contract map: existing path/service/table/RPC, present callers, current business purpose, disposition (`reuse service`, `rebuild`, `redirect`, `retire UI`, `needs decision`), replacement, and regression test.

- Independently identify still-used privacy intake, grievance, export/deletion, incident, lockdown, DPA/notice, and payment workflows. Do not preserve a legacy module solely because it exists. Do not delete it solely because its UI is obsolete.

- Confirm organization-to-factory mapping, support owner role, Free reset/recalculation semantics, current billing policy, actual test/live evidence, and existing count/index behavior. Establish staging fixtures and a data-provenance worksheet.

**Tests and acceptance:** route inventory has no ambiguous URL ownership; all legacy live callers have a safe disposition; founder org-id mismatch has a specific fix; no claims of production verification without production evidence. Unresolved legal/security operational ownership is a release blocker for retiring that capability, not for building unrelated new views.

**Rollback:** documentation only; no schema or production changes. This ticket is the gate before implementation details are finalized.

### AD01 Build founder identity and session enforcement

**Dependencies:** AD00. **Scope:** founder grant/session/audit foundations and server authorization.

- Introduce separate verified identity, tenant-role and founder-principal guards. Preserve all owner tenancy/revocation protections.

- Add protected grant/session storage and narrow server methods. Bind the single enabled grant to an explicitly verified UUID; no email-based promotion, default seed account, fake org, or client role edit.

- Implement live grant revocation, verified session binding, idle/absolute limits, logout invalidation, and fixed release-one capabilities. Define the approved recovery and emergency-revoke runbook.

- Inventory direct legacy admin RLS/RPC access. Restrict newly exposed paths and any retained founder-only paths at the database boundary without accidentally granting global access to all generic admins.

**Tests:** founder without org can authorize only through founder guard; owner without org cannot; owner/supervisor/generic-admin/non-founder/AAL1/revoked/wrong-project/malformed token all denied. Email change preserves UUID grant; deleting/recreating an email does not. Grant revoke and session logout block replay; 15-minute inactivity and 8-hour expiry use server time; polling does not extend idle time. Direct RPC/table attempts remain denied.

**Acceptance:** every founder DAL function has a tested guard; no browser service credential; no broad tenant-RLS bypass. Production grant creation and MFA/security changes remain explicitly gated.

**Rollback:** disable new admin capability server-side and revoke the new grant/session. Leave additive records for audit; do not relax tenant auth to recover access.

### AD02 Build separate login and fresh founder shell

**Dependencies:** AD01. **Scope:** login route, MFA flow, route grouping, navigation and states.

- Implement the sibling route-group layout above; update proxy public/auth route handling deliberately. Only login and challenge shells may render before the protected guard succeeds.

- Add accessible email/password login, generic errors, throttled retries, safe return paths, MFA challenge and approved enrollment/recovery entry. Reuse Supabase Auth; do not store passwords elsewhere.

- Build fresh navigation and a responsive shell. Loading states contain no customer data. Wrong-founder access gives a clear generic denial and sign-out path.

- Handle same-origin session behavior, back/forward, refresh, interrupted MFA, account switch, double submit, and direct deep links. Keep existing customer login/Free routes working.

**Tests and acceptance:** anonymous `/admin/login` is reachable without redirect loop; successful founder password alone cannot fetch protected data; AAL2 founder can navigate; open redirects blocked; all pages have keyboard/focus/error states; customer authentication regression suite passes. MFA production setup is approved and verified before enabling the shell.

**Rollback:** server flag disables new shell/data endpoints; use the approved AD00 fallback for retained live functions, not a less secure old login path.

### AD03 Establish trustworthy metrics and reporting cohorts

**Dependencies:** AD00 and AD01. **Scope:** metric definitions, reporting metadata and reusable read models.

- Implement versioned definitions and stable DTOs for factory totals, effective plan, current paid term, lock/revocation, known activation, activity and source coverage.

- Batch entitlement inputs and reuse the shared pure resolver; do not issue one subscription query per factory or implement a second set of plan rules in SQL without parity tests.

- Add reporting cohort metadata with unclassified default. Implement a dry-run classification report for founder review; no heuristic bulk production classification.

- Reuse trustworthy Free support/quota views where current; add allowlisted server-confirmed business events only where needed. Preserve original costing identity and quota accounting.

- Use explicit snapshot time and half-open period bounds. Define query limits and indexes; validate counts against fixture SQL independently of UI.

**Tests:** duplicate subscription rows, failed newest checkout, Base retained Lite, explicit Free grant, expired paid history, missing subscription, current/grace boundary, lock/revocation, unclassified/test/demo organizations, timezone month rollover, retry/recalculation dedup, missing telemetry, and all-zero-but-healthy source. Known effective-plan buckets plus reporting-unknown equal the included factory count; complete population-source failure makes the aggregate unavailable. Test partial entitlement failures explicitly.

**Acceptance:** count definitions and drill-down filters agree; unknown does not become zero or Free; historical coverage is visible; production totals cannot silently include demo/test/unclassified data.

**Rollback:** disable new reporting reads; additive classification/event metadata cannot alter entitlements or business writes. Preserve evidence for correction.

### AD04 Build factory directory and support-safe detail

**Dependencies:** AD02 and AD03. **Scope:** read-only customer context.

- Implement paginated factory search by verified supported identifiers and filters for effective plan, paid-term state, cohort, locked/revoked, support and activation coverage.

- Show factory name/ID, plan/access distinction, join date, known activity, open-ticket count and term end. Do not display cross-factory worker/payroll or commercial business-record details.

- Detail page shows minimal contacts only when needed, current entitlement explanation, relevant plan/history dates, Free quota support, observed milestones, safe event/error references, support links and billing links.

- Keep filters/sort in the URL, cancel obsolete searches, provide empty/error/stale states and a visible snapshot timestamp. Count-card links reproduce the matching filter exactly.

**Tests and acceptance:** all direct endpoints require founder authorization; search cannot inject SQL/sort fields or request unbounded results; pagination is stable under equal timestamps; zero/missing data distinguished; no N+1 loading; fixture totals/drill-downs agree; narrow-mobile and keyboard use work.

**Rollback:** remove navigation/disable read routes independently without modifying customer records.

### AD05 Implement support persistence and state machine

**Dependencies:** AD01; verify support role choices from AD00. **Scope:** schemas, RLS, transactions and API contracts.

- Add ticket/message/private-note/event tables, indexes, grants and policies from the schema contract. Customer identity/organization and author are always server-derived.

- Implement create, reply, internal-note and patch transactions, idempotency, optimistic version checks and the explicit state machine.

- Build separate founder/customer DTOs. Never return a full record and rely on UI hiding for internal notes.

- Support owner access regardless of paid entitlement, while retaining identity, revocation and organization validation. Founder manual capture requires a verified same-organization requester for any public/in-app communication. An unbound ticket stays internal-only in v1: intake body is a private note, public reply and waiting-on-customer are disabled, and resolution is a private recorded outcome, never labelled delivered. No rebinding API is included. A bound manual-intake description is explicitly `initial_intake`, not a founder public reply and not first-response evidence. It must not bind another organization’s user.

- Add structured incident/grievance links only after verifying current target workflows. Priority does not authorize a new incident mutation or external message.

**Tests:** tenant A versus tenant B, same-organization peer, altered requester/org/author IDs, direct Data API writes, internal-note leakage, Free/Lite/Base/expired-none customer intake, locked support-only behavior, revoked-account fallback, duplicate submission/reply, conflicting versions, simultaneous customer reply/founder resolution, customer reopen after resolution, internal note not setting first response, failed transaction/audit rollback, stored-XSS payload as text, and same-origin mutation enforcement.

**Acceptance:** support mutations and history are atomic; no duplicate tickets/messages/notes on concurrent retries; same-key/different-payload races return 409 from database-backed enforcement; no unauthorized read/write through API or RLS; unavailable backend never shows “sent.”

**Rollback:** disable new ticket creation/replies if required, preserve tickets and events, and expose a safe fallback contact already approved in the current product. Do not drop populated tables.

### AD06 Build complete customer and founder support workflows

**Dependencies:** AD02, AD04 and AD05. **Scope:** usable inbox and requester thread.

- Founder queue views: new, waiting for our reply, promised updates due, waiting on customer, waiting on fix, payment/access and reopened. Default ordering exposes critical/overdue work before cosmetic requests.

- Ticket detail combines minimal factory context, public conversation, unmistakable internal notes, state/priority, next action/date and safe linked references. Use separate buttons/composers for “Send to customer” and “Add internal note.”

- Customer can submit, list their own tickets and reply from `/support`, even when a payment/plan issue blocks business features. Explicitly state that replies are delivered in-app.

- Resolve requires a public summary and outcome code for requester-bound tickets, or a clearly private outcome for internal-only tickets; both waiting states need a due date with the appropriate follow-up versus public-promise label. Customer replies reopen. No deletion, automatic external notifications, or automatic closing on silence.

- Keep drafts in component memory only; clear on sign-out/account switch. Warn about unsent changes where necessary; do not persist sensitive drafts to browser storage.

**Tests and acceptance:** end-to-end create → triage → public question → customer reply → fix wait → resolve → reopen succeeds; private note never appears to customer; no accidental public send on Enter/keyboard shortcuts without expected UI behavior; duplicate clicks safe; interrupted navigation and stale edits handled; mobile/keyboard/screen-reader states verified.

**Rollback:** gate UI separately from persistence; preserve threads and make the user-visible fallback clear. Never re-route private notes into a public channel.

### AD07 Build read-only revenue and payment exception views

**Dependencies:** AD01 and AD03; link factories after AD04. **Scope:** trustworthy money reporting, not payment operations.

- Implement a source adapter over existing payment/attempt/refund/entitlement records. Populate the optional reporting projection only from evidenced capture/refund identities; do not create a new economic authority.

- Add a bounded dry-run provenance/reconciliation report: total source records, verified live/test, unknown mode/time, orphaned links, duplicate IDs, pending/failed refunds, amount/tax conflicts, and missing entitlement. Historical provider queries/backfills require explicit authorized access and reviewed bounds.

- Reuse existing webhook signature verification, idempotent event handling and canonical-provider reconciliation at their existing authorized write boundaries. `reconcileBillingOrder` can activate access and issue duplicate refunds: never call it, a mutating owner billing-status endpoint, or any repair routine during rendering or a reporting GET. Reporting provider reads must be narrowly read-only and separate. Do not rewrite payment activation merely to feed a chart. Reporting failure must not change payment/entitlement results; expose missing coverage for retry/reconciliation.

- Build gross/refunds/net cards, a filtered ledger and exception queue with safe payment/order references. Show current billing readiness as test/live/blocked and a sanitized reason; do not expose config values or enable live checkout.

- Explain missing source data, unknown tax, local-recorded versus verified provider timestamps and unsupported financial concepts. Retain original captures when refunded. Do not assume the current one-row refund source captures all partial/out-of-band refunds.

**Tests:** monetary fixture above, multiple partial refunds, full refund across periods, unknown mode, pending/failed refund, duplicate/out-of-order webhooks, late failure after capture, mismatched organization/amount, unknown tax, legacy missing timestamp, INR-only/currency mismatch, period boundaries, and captured-without-access. Row sums equal cards and filter exports are absent in v1.

**Acceptance:** no source uncertainty is silently converted into live money; net collections are not labelled accounting revenue; new dashboard cannot capture/refund/mark paid/change access; live-readiness gate remains unchanged. Historical coverage gaps are shown beside totals.

**Rollback:** disable reporting projection/UI; existing payment checkout, activation, reconciliation and webhooks remain behaviorally unchanged. Never delete or overwrite financial source rows to roll back a report.

### AD08 Build founder overview and operational queues

**Dependencies:** AD04, AD06 and AD07. **Scope:** useful extra functions without scope explosion.

- Home combines effective plan counts, unresolved/unanswered support, verified collections for a selected period, and attention queues that drill into underlying records.

- Queue money/access mismatches, customer commitments overdue, unresolved critical incidents from an evidenced source, failed/unprocessed billing events, and activation gaps only when observable.

- System shows available current signals such as webhook failures/age, billing readiness, relevant job/export failures and telemetry freshness. Add a backup/restore status only if a real authorized source exists; otherwise say not connected/unknown. Do not claim green health from no traffic.

- Keep module activity and coverage small. Do not ship churn prediction, background unsolicited customer outreach, fake backup badges or charts of unsupported history.

- Every attention item has a stable ID, target, reason, observed time/age, severity and next navigation action. No automatic privileged “fix” or “retry payment” button.

**Tests and acceptance:** source failure creates a visible stale/unknown state; no fake healthy zero; repeated events deduplicate; cards and queue drill-downs reconcile; thresholds have documented reasons and fixture tests; unavailable optional signals do not prevent support access.

**Rollback:** disable one signal or overview widget without disabling support or core billing. Default operational failure state is unknown.

### AD09 Harden audit, caching, privacy and observability

**Dependencies:** AD02 through AD08 for complete coverage; begin alongside earlier tickets. **Scope:** cross-cutting release blockers.

- Record founder data access and privileged attempts at sensible operation granularity; include actor, safe target, time, result and request ID. Write support mutations and required audit atomically. Do not log every keystroke or ticket body.

- Add private/no-store behavior to sensitive page/data responses. Exclude `/admin`, `/api/admin`, `/support`, `/api/support` and future protected files from service-worker runtime caching, offline persistence, query persistence, CDN sharing and replay capture. Inspect actual config rather than assuming dependencies are active.

- Clear sensitive in-memory/query data on sign-out, session invalidation, account switch and bfcache restoration. Revalidate on focus/back before revealing cached sensitive content.

- Sanitize errors/telemetry, disable replay on these routes unless comprehensive safe redaction is proven, redact URL query values and request bodies, and scan bundles/source maps for secrets.

- Define approved retention/access for support, audit and reporting records and connect to existing data-rights handling. Do not auto-purge financial/security records under an invented retention rule.

**Tests and acceptance:** browser storage/cache inspection, offline refresh, logout/back, account switch, two concurrent identities, route/RPC bypass, CSRF, XSS, redaction, denied-request logging and unaudited-mutation failure tests all pass. Audit is readable only by the verified founder and cannot be edited by ordinary app users.

**Rollback:** shut off new admin routes or specific capture instrumentation without weakening auth, retaining unsafe caches, or dropping evidence. If sensitive data entered a cache, follow the incident path and verify targeted cache invalidation before reopening.

### AD10 Run independent security and end-to-end acceptance

**Dependencies:** AD01 through AD09. **Scope:** demonstrated correctness against the final commit.

- Run repository-prescribed checks and the existing auth-boundary, billing, Free, privacy and tenant-isolation regressions. The inspected CI uses Node 24, `npm ci`, then `node scripts/performance/isolated-command.mjs node node_modules/typescript/bin/tsc --noEmit --incremental false`, `node scripts/performance/isolated-command.mjs npx vitest run`, and `node scripts/performance/isolated-command.mjs npm run lint`. The DB job uses PostgreSQL 16 and `node scripts/performance/isolated-command.mjs npm run test:db`. Run an appropriately isolated `npm run build` in a configured QA environment too; it runs prebuild tests and Next webpack, but is not currently part of the inspected CI. Reconfirm current checkout instructions. Never point a reset/fixture suite at production.

- Add named admin unit/integration/database suites for authorization, sessions, support, metrics and billing provenance. Add executable browser end-to-end coverage using the repo’s existing harness; if no harness exists, add one deliberately and document its command rather than claiming manual smoke checks are automation.

- Use distinct anonymous, founder AAL1, founder AAL2, unrelated admin, tenant-A owner, same-org peer, tenant-B owner, revoked user and malformed-token fixtures. Test each capability by direct endpoint/action/RPC, not only by clicking through a UI.

- Independently inspect every privileged query and new exposed function. Review fresh network/storage/replay traces and all supported legacy redirects/contracts.

- Seed at least 1,000 synthetic organizations and 5,000 tickets in staging for pagination/query profiling. Set and record an agreed staging performance budget; recommended starting targets are p95 under 1 second for indexed lists and under 2 seconds for aggregates at that fixture size, without treating these as production guarantees.

**Acceptance:** final-commit lint/test/build pass; DB and browser evidence are recorded as passed, failed or blocked explicitly; no P0/P1 authorization, privacy, financial-correctness or data-loss issue remains; all important metric cases reconcile independently. A skipped gate is not a pass.

**Rollback:** development-only corrections; keep release disabled until blockers are resolved.

### AD11 Release in controlled stages and verify rollback

**Dependencies:** AD10 and founder approvals below. **Scope:** rollout plan and operational evidence; deployment itself needs authorization.

1. Review schema migrations, grants and production data implications. Take/verify the approved recovery point before any production schema change. No destructive migration is included.

2. Deploy additive database changes and dark code with server-enforced feature gates. Gates must apply to data endpoints/actions as well as navigation and fail closed.

3. Verify the exact founder Auth UUID and approved grant, MFA enrollment, factor recovery and emergency revocation in staging; obtain explicit approval before production setup changes. Confirm session policy and support visibility.

4. Enable read-only directory/overview/revenue for the founder only after negative-access tests and reporting coverage checks. Enable support writes after the end-to-end ticket/audit/notification-expectation tests.

5. On the deployed exact commit, verify founder access, non-founder denial, customer login/Free/billing behavior, source freshness and one authorized synthetic support round trip. Observe the release’s configured error/authorization signals until all release checks have a determinate result.

6. Retire legacy UI only according to AD00’s approved dispositions and compatibility tests. Preserve retained data/services and explicit fallback access for any active obligation.

7. Record verified version, gates, migration versions, remaining data-coverage limitations, operation owner, and runbooks. Declare completion only after acceptance and rollback evidence are complete.

**Rollback procedure:** disable affected new server capabilities first; revoke compromised founder sessions/grant if applicable; roll application code back to the last safe version; retain additive support/audit/reporting data; use the approved fallback for retained active operations. Do not restore an old permissive admin route, drop populated tables, reverse payments, or discard customer tickets as rollback. Correct schema through a reviewed forward fix if data has been written.

**Acceptance:** rollback has been rehearsed in staging, founder recovery works, no customer access/payment regression exists, all new sensitive routes fail closed when disabled, and the deployed version is verified. Any production finance/MFA/account setup action requiring founder participation remains a specific unresolved gate, not silently bypassed.

## Dependency and delivery sequence

AD00 → AD01 → AD02. After AD01, AD03 and AD05 can proceed independently. AD04 needs AD02 and AD03. AD06 needs AD02, AD04 and AD05. AD07 needs AD01 and AD03, with factory linking after AD04. AD08 joins AD04, AD06 and AD07. AD09 begins early and closes after all features. AD10 verifies the integrated result; AD11 controls release.

Deliver in three reviewable slices: founder boundary and read-only factory view; complete support loop; financial/operational reporting plus hardening. Feature flags may separate rollout, but none may turn authorization off. Do not promise a calendar duration before AD00 establishes database, test-harness and financial-history condition.

## Decisions and approval gates

Only ask for decisions that evidence cannot resolve. Safe development can proceed around a blocked production action.

1. **Required identity:** founder confirms which existing Supabase Auth UUID should receive the single founder grant. Email alone is insufficient proof; do not create or modify credentials automatically.

2. **Required security setup:** approve and perform founder MFA enrollment/recovery, proposed session timing, and production grant changes through the supported secure flow. No production console before this is verified.

3. **Confirm support policy:** requester-only tickets, owner intake, in-app delivery and no promised SLA unless staffed hours/targets are supplied. Suggested defaults above are implementable without inventing customer commitments.

4. **Confirm reporting policy:** organization-to-factory mapping, production/test/demo classification evidence and reporting timezone. Unclassified records remain visible outside confirmed business totals until resolved.

5. **Required data operations:** approve any production migration, historical provider reconciliation/backfill, retention/deletion behavior and deployment separately. Source review is not proof of permission to change production.

6. **Legacy operational decision:** retain/rebuild/retire each currently used safety or legal operation based on AD00 evidence; no automatic preservation of the old console and no blind deletion.

## Final definition of done

The verified founder can sign in at `/admin/login`, complete MFA, see correct Free/Lite/Base/access counts, investigate a factory, handle a support request end to end, and view honestly labelled payment collections and exceptions. Another account cannot reach any privileged data by UI, API, action, RPC or cached response. Customer support works without a paid plan and never exposes private notes or another requester’s data. The current product’s customer access/payment rules still work. Legacy UI decisions are deliberate. Unknown history is visible. Tests, release evidence, data limitations, owner runbooks and rollback are documented against the final commit.

## Source references

Repository evidence is pinned to [main commit 36e6e4e](https://github.com/Rajp2002/TextileAccounting/commit/36e6e4edac8de76052dc8247d99a74b90ef3772d). Key sources are [auth guard](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/lib/auth.ts), [entitlement resolver](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/lib/subscription-access.ts), [billing constants](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/lib/billing-constants.ts), [billing readiness](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/lib/billing-readiness.ts), and [billing reconciliation](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/lib/billing-reconciliation.ts). The exact paths above locate the remaining constraints in the checkout. Public references inform recommended patterns rather than proving Weavly behavior:

- [Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication) and [data security](https://nextjs.org/docs/app/guides/data-security)

- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa), [sessions](https://supabase.com/docs/guides/auth/sessions), [user management](https://supabase.com/docs/guides/auth/managing-user-data), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [server-side clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

- [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) and [logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

- [Razorpay webhook behavior](https://razorpay.com/docs/webhooks/best-practices/), [refund states](https://razorpay.com/docs/api/refunds/entity/), and [payment reports](https://razorpay.com/docs/payments/dashboard/reports/)

- [Support status patterns](https://support.zendesk.com/hc/en-us/articles/4408843029658-About-open-vs-pending-and-on-hold-tickets) and [support metric definitions](https://support.zendesk.com/hc/en-us/articles/4408827693594-Metrics-and-attributes-for-Zendesk-Support)

- [PostHog retention definitions](https://posthog.com/docs/product-analytics/retention) and [Google SRE monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)
