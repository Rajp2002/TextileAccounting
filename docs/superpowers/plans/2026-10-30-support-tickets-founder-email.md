# Support Tickets: Founder Email and Simple Founder Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers' support tickets reach Raj in the founder console and by email, and Raj answers from a screen that is just the conversation and a reply box.

**Architecture:** This reuses the AD05 ticket tables and RPCs unchanged, except for one `answered` queue added to `admin_support_read`. A new `server-only` module sends Resend emails, scheduled with `next/server` `after()` from `mutateSupport` for customer create/reply. The founder branch of `components/support/support-workspace.tsx` is simplified, and the founder DTOs gain factory name and plan.

**Tech Stack:** Next.js 16 route handlers, Supabase service-role RPC, Upstash Redis, Resend HTTP API (via `fetch`, no new dependency), `@sentry/nextjs`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-30-support-tickets-founder-email-design.md`

## Global Constraints

- Every heavy command (vitest, tsc, lint, test:db) runs through `heavyq run --est <t> --label <name> -- …`. macOS has no `timeout`.
- Run `node scripts/ensure-deps.mjs` once before the first vitest or tsc run in this worktree.
- Never run `supabase db push`, `npm run build` or `npm start`. The migration is a file only.
- `npm run lint` must stay at 0 warnings.
- Recipient is `LEGAL_OPERATOR.contactEmail` (`lib/legal-operator.ts`). Sender is `Weavly Support <onboarding@resend.dev>`. Env var `RESEND_API_KEY`.
- Subjects: `New ticket · {factory} ({Plan}): {subject}` and `Customer replied · {factory}: {subject}`, truncated to 150 characters. Message is truncated at 4,000 characters and HTML-escaped. Link: `${NEXT_PUBLIC_SITE_URL}/admin/support/{ticketId}`.
- Dedupe key `support-email:{requestId}`, `SET NX EX 86400`. If Redis is unavailable, send anyway.
- Founder reply constants: Send → `status:'in_progress'`, `nextAction:'Wait for the customer'`. Send and resolve → `status:'resolved'`, `nextAction:'Resolved'`, `resolutionCode:'explained_behavior'`, `resolutionSummary:<body>`. Both send null `nextUpdateDueAt`/`followUpDueAt`/`externalReference`, and `promiseFulfilled = ticket.nextUpdateDueAt !== null`.
- Customer screens, customer API and i18n strings are not changed.
- Don't commit unless Raj asks (CLAUDE.md). Where a task says "Commit", stage the files and commit only if Raj has approved commits for this run.

## Review Focus

1. **A customer double-taps Send, or a retry follows a lost response.** Raj should get one email, not two. Test in Task 2: `sends once for a repeated request id`.
2. **A customer message with HTML or `<script>`, or a 10,000-character message.** The email shows escaped text, cut at 4,000 characters. Test in Task 2: `escapes html and truncates long messages`.
3. **Resend is down, or the key is missing in a preview deploy.** The ticket still saves and the customer still gets 201. Tests in Task 2 (`does not throw when the key is missing`, `reports a non-2xx response to Sentry`) and Task 3 (`customer create succeeds when notification throws`).
4. **The founder replies with Send on a ticket that still carries an old promised-update date from AD05 use.** The RPC would reject the reply with `SUPPORT_PROMISE_REQUIRES_PUBLIC_UPDATE`. Test in Task 5: `marks the old promise fulfilled when the ticket has one`.
5. **The Answered tab before the migration is applied.** The tab shows the API error message, and the page doesn't crash. Test in Task 5: `shows the list error for an unavailable queue`.

---

### Task 1: `answered` queue

**Files:**
- Create: `supabase/migrations/20261030150000_support_answered_queue.sql`
- Modify: `lib/support/contracts.ts` (the `queues` tuple)
- Test: `__tests__/db/admin-support.dbtest.ts`, `__tests__/admin-support.test.ts`

**Interfaces:**
- Produces: queue value `'answered'` accepted by `listTicketSchema` and by `admin_support_read(... p_operation:='list', p_filters:={"queue":"answered"})`.

- [ ] **Step 1: Write failing tests.** In `admin-support.test.ts`, add `it('accepts the answered queue')`, asserting `listTicketSchema.parse({queue:'answered'}).queue==='answered'`. In the dbtest, add `answered queue holds tickets after a founder reply and drops them after a customer reply`, using the suite's existing create/reply helpers. After the founder reply, `list` with `queue:'answered'` contains the ticket id. After the customer reply it does not, and `queue:'needs_reply'` does.
- [ ] **Step 2: Run** `heavyq run --est 60s --label support-unit -- npx vitest run __tests__/admin-support.test.ts`. Expected: FAIL on the new case.
- [ ] **Step 3: Write the migration.** Copy `public.admin_support_read` verbatim from `20261004150500_founder_support_workflow.sql` as `CREATE OR REPLACE FUNCTION`. Add `'answered'` to the `v_queue NOT IN(...)` allowlist, and add `WHEN 'answered' THEN t.status<>'resolved' AND NOT t.needs_founder_reply` to the queue `CASE`. Repeat the `REVOKE ALL … FROM PUBLIC,anon,authenticated; GRANT EXECUTE … TO service_role;`. Add `'answered'` to `queues` in contracts.
- [ ] **Step 4: Run** the unit file again. Expected: PASS. The dbtest runs in CI (`npm run test:db`); run it locally only if a disposable cluster is already available: `heavyq run --est 5m --label support-db -- npm run test:db -- admin-support`.
- [ ] **Step 5: Commit** `feat(support): answered queue for the founder inbox`.

### Task 2: Founder email module

**Files:**
- Create: `lib/support/notify.ts`
- Modify: `lib/rate-limit.ts` (export the existing `getRedis`)
- Test: `__tests__/support-notify.test.ts`

**Interfaces:**
- Produces: `notifyFounderOfCustomerMessage(input: { kind: 'created' | 'customer_reply'; ticketId: string; requestId: string }): Promise<void>`. It never throws.
- Also produces (exported for tests): `buildFounderEmail(input: { kind: 'created' | 'customer_reply'; ticketId: string; subject: string; category: string; factory: string; plan: string; message: string; siteUrl: string }): { subject: string; text: string; html: string }`.

- [ ] **Step 1: Write failing tests.** Mock `server-only`, `@/lib/supabase/admin` (returns ticket `{subject, category, org_id}`, latest customer message body, org `{name}`), `@/lib/subscription` `getOrgPlanAccess` → `{effectiveTier:'lite'}`, `@/lib/rate-limit` `getRedis` → `{set: vi.fn()}`, `@sentry/nextjs` `captureException`, and global `fetch`. Cases:
  - `sends a new-ticket email to the founder`: one fetch to `https://api.resend.com/emails` with `Authorization: Bearer test-key` and JSON `to:['rajpatel86420@gmail.com']`, `from:'Weavly Support <onboarding@resend.dev>'`, `subject:'New ticket · Patel Textiles (Lite): Rate book not saving'`. The html contains `https://textile-accounting.vercel.app/admin/support/<ticketId>`.
  - `uses the customer-replied subject`: `subject:'Customer replied · Patel Textiles: Rate book not saving'`.
  - `sends once for a repeated request id`: `set` resolves `'OK'` then `null`, so two calls produce one fetch, and `set` was called with `('support-email:<requestId>','1',{nx:true,ex:86400})`.
  - `sends when redis is unavailable`: `getRedis` → `null` gives one fetch.
  - `escapes html and truncates long messages`: for message `'<script>x</script>'+'a'.repeat(5000)`, `buildFounderEmail(...).html` contains `&lt;script&gt;` and not `<script>`, and the message part is at most 4,000 characters before the ellipsis. A subject longer than 150 characters is truncated to 150.
  - `does not throw when the key is missing`: with `RESEND_API_KEY` unset, it resolves, fetch is not called, and `captureException` is called once.
  - `reports a non-2xx response to Sentry`: fetch → `{ok:false,status:500}` resolves, and `captureException` is called with tag `support_email`.
- [ ] **Step 2: Run** `heavyq run --est 45s --label support-notify -- npx vitest run __tests__/support-notify.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `lib/support/notify.ts` (`import 'server-only'`). Do the Redis `set` NX check first, then the reads with the service-role client, then `buildFounderEmail`, then `fetch`. Wrap the whole body in try/catch, ending in `console.error` plus `Sentry.captureException(error,{tags:{support_email:true}})`. Plan label is the capitalised `effectiveTier` (`free`→`Free`, `lite`→`Lite`, `base`→`Base`, otherwise `No plan`). Escape `& < > " '` and turn line breaks into `<br>`. Change `function getRedis` to `export function getRedis` in `lib/rate-limit.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(support): email the founder about new tickets and customer replies`.

### Task 3: Schedule the email from customer writes

**Files:**
- Modify: `lib/support/server.ts` (`mutateSupport`)
- Test: `__tests__/admin-support.test.ts`

**Interfaces:**
- Consumes: `notifyFounderOfCustomerMessage` (Task 2).

- [ ] **Step 1: Write failing tests.** Mock `next/server` `after` as `vi.fn((task)=>task())`, keeping `NextResponse` from the real module, and mock `@/lib/support/notify`. Cases:
  - `schedules a founder email for customer create`: called with `{kind:'created',ticketId:<rpc result id>,requestId:<clientRequestId>}`.
  - `schedules a founder email for customer reply`: `kind:'customer_reply'`, with `ticketId` from the route id.
  - `does not email for founder reply, note or patch`.
  - `customer create succeeds when notification throws`: notify rejects, and `mutateSupport` still resolves with the RPC data.
- [ ] **Step 2: Run** `heavyq run --est 60s --label support-unit -- npx vitest run __tests__/admin-support.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** After a successful RPC in `mutateSupport`, when `!founder && (operation==='create'||operation==='reply')`, call `after(()=>notifyFounderOfCustomerMessage({...}).catch(()=>{}))`. The ticket id is `data.id` for create and `id` for reply.
- [ ] **Step 4: Run** again. Expected: PASS.
- [ ] **Step 5: Commit** `feat(support): send founder email after customer tickets and replies`.

### Task 4: Factory name and plan on founder tickets

**Files:**
- Modify: `lib/support/contracts.ts` (`Ticket` type), `lib/support/server.ts` (`listSupportTickets`, `readSupportTicket`)
- Test: `__tests__/admin-support.test.ts`

**Interfaces:**
- Produces: founder `Ticket` objects carry optional `factoryName?: string | null` and `planLabel?: string | null`. Customer results never carry them.

- [ ] **Step 1: Write failing tests.**
  - `founder list adds factory name and plan`: the RPC list returns two tickets on one org, the admin client `from('organizations').select('id,name').in('id',[org])` returns the name, and `getOrgPlanAccess` is mocked to `lite`. Both items have `factoryName:'Patel Textiles'` and `planLabel:'Lite'`, and the org query ran once.
  - `customer list has no factory fields`.
  - `founder detail adds factory name and plan`.
  - `a failed name lookup leaves the fields null`: the list still resolves.
- [ ] **Step 2: Run** the unit file. Expected: FAIL.
- [ ] **Step 3: Implement** a private `withFactoryContext(tickets: Ticket[]): Promise<Ticket[]>` in `server.ts`. It reads names once per distinct org with `.in('id', ids)`, gets plans with `Promise.all(getOrgPlanAccess)` per distinct org, and catches each failure as null. Apply it only when `founder` is true. Reuse the plan-label mapping from Task 2 by exporting `planLabel(tier: string): string` from `notify.ts`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(support): show factory and plan on founder tickets`.

### Task 5: Simple founder screen and three-tab inbox

**Files:**
- Modify: `components/support/support-workspace.tsx` (founder branches of `SupportInbox` and `SupportThread` only)
- Modify: `__tests__/browser-support-fixture/support.spec.ts` (founder steps that use the removed controls)
- Test: `__tests__/support-founder-screen.test.tsx` (new, `renderToStaticMarkup`) plus a unit-tested pure helper

**Interfaces:**
- Consumes: `answered` queue (Task 1), `factoryName`/`planLabel` (Task 4).
- Produces: exported pure helper `founderReplyPayload(input: { body: string; resolve: boolean; ticket: { version: number; nextUpdateDueAt: string | null }; clientRequestId: string }): Record<string, unknown>`, matching `founderReplySchema`.

- [ ] **Step 1: Write failing tests.**
  - `founderReplyPayload` for Send equals `{body, expectedVersion, clientRequestId, status:'in_progress', nextAction:'Wait for the customer', nextUpdateDueAt:null, followUpDueAt:null, externalReference:null, promiseFulfilled:false}` and passes `founderReplySchema.parse`.
  - For resolve, it adds `status:'resolved'`, `nextAction:'Resolved'`, `resolutionCode:'explained_behavior'`, `resolutionSummary:body`, and passes the schema plus `validateTicketState(..., true, true) === null`.
  - `marks the old promise fulfilled when the ticket has one`: `promiseFulfilled:true` when `nextUpdateDueAt` is set.
  - Static markup of the founder thread (detail passed as a prop, or via the component's existing initial-data path; if neither exists, test the extracted presentational piece) contains `Send`, `Send and resolve`, a `<details` wrapping `Private founder notes`, the factory name, and the plan. It does not contain `Save ticket state`, `Founder’s next action`, `Promised customer update` or `fulfills the outstanding update promise`.
  - Founder inbox markup shows exactly the tabs `Needs reply`, `Answered`, `Resolved`, and `shows the list error for an unavailable queue` renders the error text from a rejected fetch.
- [ ] **Step 2: Run** `heavyq run --est 60s --label support-ui -- npx vitest run __tests__/support-founder-screen.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Founder tab mapping: Needs reply → `queue=needs_reply`, Answered → `queue=answered`, Resolved → `queue=all&status=resolved`. Default is Needs reply, and an incoming `?queue=needs_reply` still selects it.
  - Rows show subject, `factoryName · planLabel`, category label and updated time.
  - In the thread, delete the Next action panel and the promise checkbox, then add the two buttons. Both go through the existing `supportSendAttempt` flow with `founderReplyPayload`. Send is the primary (ink) style and Send and resolve is the secondary style.
  - Wrap the notes section in `<details>` with `<summary>Private founder notes</summary>`.
  - Leave the customer branches untouched.
- [ ] **Step 4: Update** `support.spec.ts` founder steps: replace the "Save ticket state" / waiting-on-fix steps with Send → Answered, customer reply → Needs reply, and Send and resolve → Resolved. That file is excluded from vitest, so there's nothing to run here. Note this in the commit.
- [ ] **Step 5: Run** the new test plus `__tests__/admin-support.test.ts` and `__tests__/admin-support-page-access.test.tsx`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(support): one reply box and three tabs for the founder`.

### Task 6: Today page trim

**Files:**
- Modify: `app/(admin-console)/admin/page.tsx` (lines 13–19 region)
- Test: `__tests__/admin-overview.test.ts`, or a new source-contract case in the same file

**Interfaces:** none.

- [ ] **Step 1: Write a failing source-contract test** `today keeps needs-reply and drops promise and follow-up tiles`. It reads `app/(admin-console)/admin/page.tsx`, expects `Needs our reply` and `/admin/support?queue=needs_reply`, and expects no `Promised updates overdue` and no `Internal customer follow-ups due`.
- [ ] **Step 2: Run** `heavyq run --est 45s --label admin-overview -- npx vitest run __tests__/admin-overview.test.ts`. Expected: FAIL.
- [ ] **Step 3: Remove** the two elements. `lib/admin/overview.ts` stays unchanged, and its existing tests keep passing.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): Today shows only the support reply count`.

### Task 7: Full checks and release notes

**Files:**
- Modify: `docs/admin-console/RELEASE_RUNBOOK.md` (add `RESEND_API_KEY`, the migration and the order: migration → env vars → deploy)

- [ ] **Step 1: Run** `heavyq run --est 2m --label tsc -- npx tsc --noEmit`. Expected: exit 0.
- [ ] **Step 2: Run** `heavyq run --est 2m --label lint -- npm run lint`. Expected: 0 errors, 0 warnings.
- [ ] **Step 3: Run** `heavyq run --est 3m --label support-tests -- npx vitest run __tests__/admin-support.test.ts __tests__/admin-support-page-access.test.tsx __tests__/admin-support-send-attempt.test.ts __tests__/support-notify.test.ts __tests__/support-founder-screen.test.tsx __tests__/admin-overview.test.ts __tests__/admin-release-gates.test.ts`. Expected: all pass. Then run `grep -rln "support-workspace\|lib/support\|admin/page.tsx" __tests__` and run any other hit.
- [ ] **Step 4: Update** the runbook with the release order and the post-deploy production check from the spec's Testing section.
- [ ] **Step 5: Commit** `docs(admin): support email release steps`.
