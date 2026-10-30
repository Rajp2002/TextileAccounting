# Support tickets: switch on, simple founder screen, founder email

Date: 2026-10-30. Status: design approved in chat, spec awaiting review.

## Goal

A customer on any plan sends Raj a message from Weavly. It opens a ticket that appears in the founder console, and Raj gets an email. Raj replies from the console and the customer reads the reply inside Weavly. Success means no customer message goes unseen, and replying takes one text box and one button.

## Starting point (verified 2026-10-30)

- The AD05 ticket system exists: migration `20261004150500_founder_support_workflow.sql` (applied to production), `lib/support/{contracts,server}.ts`, customer routes `/support` and `/api/support/*`, founder routes `/admin/support` and `/api/admin/support/*`, and the shared UI `components/support/support-workspace.tsx`. The owner sidebar shows Support for every tier (`lib/owner-navigation.ts`).
- In Vercel production, `WEAVLY_SUPPORT_ENABLED` and `WEAVLY_SUPPORT_PRODUCTION_APPROVED` are unset, so `/support` shows "Support is unavailable" and every write fails with `SUPPORT_DISABLED`.
- The app has no email-sending code and no provider configured. There is no custom domain: production is `textile-accounting.vercel.app`.
- The founder ticket screen asks for state, priority, category, next action, internal follow-up due, promised update, fix reference and priority-change reason before the reply box.

## Decisions

1. Finish the existing system rather than rebuild it. No changes to the customer screens or the customer API.
2. The founder ticket screen is the conversation, one reply box with **Send** and **Send and resolve**, and private notes collapsed. The founder inbox has three tabs: **Needs reply**, **Answered**, **Resolved**.
3. Only Raj gets email, on a customer's new ticket and on each customer reply. Customers are never emailed.
4. Email goes through Resend's free plan, sent from `onboarding@resend.dev` to the Resend account address (rajpatel86420@gmail.com). No domain verification is needed while the only recipient is the account owner.

## Design

### 1. Founder ticket screen (`components/support/support-workspace.tsx`, founder branch)

Order on the page:

1. Header: subject, factory name, plan, created time, status label, and "Open factory context" (existing link).
2. Conversation: existing public thread, unchanged.
3. Reply: one textarea, then **Send** (ink, primary) and **Send and resolve** (secondary). No Enter-to-send, as today.
4. Private notes: a closed `<details>` block holding the existing note list and "Add internal note" form.
5. Status history: unchanged, below the notes.

Removed from the screen: the "Next action" panel (state, priority, category, next action, both due dates, fix reference, priority reason, Save ticket state) and the "fulfils the promise" checkbox. The columns and RPC stay, so old data is kept and the database contract does not change.

What each button sends to the existing `POST /api/admin/support/[id]/messages` (`founderReplySchema`):

| Field | Send | Send and resolve |
| --- | --- | --- |
| `body` | reply text | reply text |
| `status` | `in_progress` | `resolved` |
| `nextAction` | `Wait for the customer` | `Resolved` |
| `resolutionCode` | omitted | `explained_behavior` |
| `resolutionSummary` | omitted | reply text (the RPC requires it to equal `body`) |
| `nextUpdateDueAt`, `followUpDueAt`, `externalReference` | null | null |
| `promiseFulfilled` | `true` if the ticket has a `nextUpdateDueAt`, otherwise `false` | same |

Sending a reply sets `needs_founder_reply=false` (existing RPC). A customer reply sets it back to `true` and reopens a resolved ticket (existing RPC). The immutable send-attempt and retry behaviour in `lib/support/send-attempt.ts` stays as it is.

Hardcoded values live as constants in the component file, not scattered through it. The founder `PATCH` route and the API's other fields stay in place for later use, but this screen never calls them.

### 2. Founder inbox tabs

- **Needs reply**: existing queue `needs_reply` (open and `needs_founder_reply`).
- **Answered**: new queue `answered`, meaning `status <> 'resolved' AND NOT needs_founder_reply`.
- **Resolved**: existing `status=resolved` filter (queue `all`).

The default tab is Needs reply. The other queue chips (unanswered, updates due, follow-ups, waiting on customer/fix, billing, reopened, critical) are removed from the founder UI. Each row shows subject, factory name, plan, category and last-updated time. The `?queue=` deep links from Today keep working for `needs_reply`.

New migration `supabase/migrations/20261030150000_support_answered_queue.sql`: `CREATE OR REPLACE FUNCTION public.admin_support_read` with `answered` added to the queue allowlist and the queue `CASE`, everything else byte-for-byte the same. It re-applies the same `REVOKE`/`GRANT`. `lib/support/contracts.ts` adds `answered` to `queues`. The file is written only: Raj applies it to production before deploying. Without it, the Answered tab returns `SUPPORT_INVALID`.

Factory name and plan in rows and the header need data the DTO does not carry. The founder list and detail loaders in `lib/support/server.ts` enrich founder results with `organizations.name` and the effective tier, read through the service-role client by `orgId` and batched for lists. Customer DTOs are unchanged.

### 3. Founder email (`lib/support/notify.ts`, new, `server-only`)

```ts
notifyFounderOfCustomerMessage({ kind: 'created' | 'customer_reply', ticketId, requestId }): Promise<void>
```

- Called from `mutateSupport` in `lib/support/server.ts` only when `founder === false` and the operation is `create` or `reply`, after the RPC succeeds. It is scheduled with `after()` from `next/server`, so the customer's response does not wait on it.
- It reads the ticket subject and category, the newest customer message, and the organization name and plan through the service-role client.
- It sends one HTTPS `POST https://api.resend.com/emails` with `fetch`, so no new dependency is needed.
  - Recipient: `LEGAL_OPERATOR.contactEmail`. Sender: `Weavly Support <onboarding@resend.dev>`.
  - Subject: `New ticket · {factory} ({Plan}): {subject}` or `Customer replied · {factory}: {subject}`, truncated to 150 characters.
  - Body: plain text plus simple HTML with the category, the message (HTML-escaped, line breaks kept, truncated at 4,000 characters), and an **Open ticket** link to `${NEXT_PUBLIC_SITE_URL}/admin/support/{ticketId}`.
- Duplicate guard: a retried request returns the stored RPC result, which would send a second email. Before sending, `SET support-email:{requestId} NX EX 86400` on Upstash Redis decides whether to send. If Redis is unavailable, it sends anyway (a duplicate beats a miss).
- Failure handling: a missing `RESEND_API_KEY`, a non-2xx response or a thrown error is logged with `console.error` and reported to Sentry (`Sentry.captureException`, tag `support_email`), and never rethrown. The ticket is already committed and visible in the console.
- No customer email, personal data beyond what the customer typed, or ticket content is put in URLs.

### 4. Today page (`app/(admin-console)/admin/page.tsx`)

Keep "Needs our reply" and its link. Remove the "Promised updates overdue" tile and the "Internal customer follow-ups due" row. `lib/admin/overview.ts` and the summary RPC are untouched, and the attention list keeps working.

### 5. Configuration (Raj, in Vercel production)

| Variable | Value |
| --- | --- |
| `WEAVLY_SUPPORT_ENABLED` | `true` |
| `WEAVLY_SUPPORT_PRODUCTION_APPROVED` | `true` |
| `RESEND_API_KEY` | key from the Resend account created with rajpatel86420@gmail.com |

Order of release: apply the migration, then add the variables, then deploy.

## Out of scope

- Customer email or WhatsApp notifications, and inbound email-to-ticket.
- A custom sending domain (needed only for customer email later).
- Attachments, reply templates, assignment, SLA tracking.
- Changes to customer screens, i18n strings, or the customer API.
- Removing the priority/promise/follow-up columns or RPC branches.

## Testing

- `__tests__/support-notify.test.ts` (new): with `fetch`, Redis and Sentry mocked, it checks that create and customer reply each send one email with the right subject, recipient and link; that a founder reply sends none; that a repeated request id sends once; that a missing key or a 500 response does not throw and reports to Sentry; and that HTML in the message is escaped.
- `__tests__/admin-support.test.ts`: `mutateSupport` schedules the notification only for customer create/reply.
- The source-contract tests that assert on the founder screen's removed copy (search `__tests__/` for "Save ticket state", "Founder’s next action", "Promised updates overdue", "fulfills the outstanding update promise") are updated deliberately.
- `__tests__/db/admin-support.dbtest.ts` (runs in CI): the `answered` queue returns open tickets after a founder reply and drops them after a customer reply.
- `npx tsc --noEmit`, `npm run lint`, and the touched vitest files, run through `heavyq`.
- After deploy, on production with a disposable test customer account: open a ticket, confirm the email arrives with a working link, reply with Send (ticket moves to Answered), reply as the customer (back to Needs reply, second email), then Send and resolve (Resolved tab).
