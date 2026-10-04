Build a fresh founder console for current Weavly around five daily questions: which factories need help, where onboarding stops, whether payments match access, whether customers return, and whether the product is working. The first version should answer these clearly and let you act without opening customer production or payroll records unnecessarily.

Updated 4 October 2026. Repository facts below come from source inspection at [commit 36e6e4e](https://github.com/Rajp2002/TextileAccounting/commit/36e6e4edac8de76052dc8247d99a74b90ef3772d), with primary-source product/security research checked on 3–4 October. This was not a deployed-system or production-data audit. Proposed features and metric definitions are recommendations.

The old admin console is reference material for discovering records and integrations. Its seven-tab layout should not shape this build. Any legacy capability should earn its place through a current operational need, with a deliberate migration or retirement decision.

The [implementation sprint](https://chatgpt.com/space/page_622f81e08eb481919054bcc8e5e88554) turns this plan into scoped build tasks and acceptance checks. This page explains the product choices and where to stop.

## Recommended first version

Start with five destinations: Today, Factories, Support, Payments, and System. Put access settings and any independently required formal data-request controls in a secondary area. Keep product usage inside factory details and a small weekly summary until there is enough trustworthy history for a dedicated analytics view.

| Destination | Main question | First useful screen |
|---|---|---|
| Today | What needs my attention? | Ranked issues with age, owner, reason, and next action |
| Factories | What is happening with this customer? | Searchable directory and a safe factory detail view |
| Support | Who is waiting for us? | Tickets, conversation, status, owner, and promised update |
| Payments | Does money match access? | Payments and entitlements with an exception queue |
| System | Is a customer workflow failing? | Relevant failures, data freshness, and incident links |

Every headline count should open the records behind it. Missing data should say “unavailable” or “not yet measured.” A zero must mean a measured zero.

## Current Weavly facts that shape the design

Free is an explicit entitlement; missing subscription data must not automatically mean Free. [Free entitlement resolution](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/lib/subscription.ts#L39-L70)

The current Free product contract is two new costings per month, saved history, and export. The same entry can be explicitly recalculated within 30 minutes of its original creation without another credit. These distinctions determine the quota and activation design below.

Lite covers the estimator, saved costings, and rate book. Base adds machines, workers, production, inventory, and payroll. An expired paid Base account retains Lite access in current source, so expiry and product access need separate labels. Reuse the canonical resolver, including its grace-period and paid-history rules; do not infer access from one raw subscription status. [Current access resolver](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/lib/subscription-access.ts#L96-L175)

The current billing implementation uses one-time Razorpay orders, 365-day access, and manual annual renewal. Source prices are Lite ₹2,999 initially and ₹1,499 on renewal; Base ₹9,999 initially and ₹4,999 on renewal, including GST. These are source-level observations to verify against the intended commercial policy and deployment. [Billing contract](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/lib/billing-constants.ts#L1-L82)

A billing-document gate currently blocks live checkout in source; the deployed state was not verified. The console should expose that readiness state without changing it. [Document policy](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/lib/billing-document-policy.ts#L12-L28), [checkout enforcement](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/app/api/billing/create-order/route.ts#L35-L80)

This makes confirmed collections, access terms, and renewal dates useful. Headline MRR and ARR would be misleading for the current model. Stripe’s own MRR definition applies to monthly-normalized subscriptions, including annual subscriptions; it does not turn a manually renewed one-time sale into a subscription. [Stripe metric definitions](https://docs.stripe.com/billing/subscriptions/analytics)

The organization is the present tenant boundary. Count factories using the organization ID and keep people, factories, payments, and entitlements distinct. Free quota and funnel events are owner-subject scoped, and one subject can have several organization grants. Show that shared quota and Free activity at account level unless a particular event has verified organization attribution. Never join one owner's event to every factory and count all of them active. [Free account and grant model](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/supabase/migrations/20260908182417_free_tier_foundation.sql#L19-L47), [Free event schema](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/supabase/migrations/20260908190537_free_tier_runtime.sql#L15-L27)

## Today should be an action queue

Order the queue by customer impact and urgency:

1. A service failure, suspected data problem, or security incident

2. Confirmed payment without the right access, or another unresolved money/access mismatch

3. A customer waiting for a reply or a promised update

4. A new factory stuck before its first useful result

5. A previously active factory worth checking after an unexplained usage lapse

Each item needs a plain explanation, age, owner, next action, and direct link. “Base factory has no production entry after setup” is more useful than a red health score with no explanation.

Add only a few supporting numbers: active factories, new factories reaching first value, unanswered tickets, and confirmed collections for the selected period. Keep module and tier filters available, and show when the data last refreshed.

Usage-lapse suggestions must account for Free’s two-costing limit and for factory closures or seasonal work. Reviewing a saved costing or exporting it can be real value even when no new costing is created. Call the signal “worth checking,” not “churned.”

## Factory details should explain the whole relationship

The directory should support search by factory name, organization ID, verified contact, and payment reference. Default columns should be compact: plan, access state, joined date, last meaningful activity, activation milestone, unresolved tickets, and next attention reason.

A detail page should bring together:

- Factory identity and the minimum contact information needed to help

- Plan, actual entitlements, term dates, and change history

- Activation steps with observed timestamps and missing prerequisites

- Relevant module activity and telemetry coverage

- Open and recent support tickets, last contact, and next promised action

- Payment, refund, invoice, and renewal references

- Administrative changes with actor, time, reason, and outcome

Separate commercial status from effective access. “Annual Base term expired; Lite access remains” is precise. A single “inactive” badge is not.

Do not make this a cross-customer ERP. The normal view should not expose worker identities, salaries, complete costing inputs, stock valuations, or customer ledgers. A founder usually needs to know that a workflow failed, when it failed, and which diagnostic reference to inspect.

## Activation should match value in each tier

Use separate estimator and Base operations milestones. Do not require a Base customer to adopt every module before the console recognizes useful progress.

| Tier or workflow | Recommended first value | Useful next milestone |
|---|---|---|
| Free | First successful persisted original costing | Return to the result, export it, or make a second distinct costing |
| Lite | First successful persisted costing | Set up and reuse a saved rate |
| Base operations | Minimum required setup followed by the first valid production record | Continued production use; inventory or payroll adoption when relevant |

The Base prerequisite chain should follow the current application schema. Machine setup, required worker references, and first production entry are candidates to validate, not invented mandatory fields.

Free recalculation needs careful counting. A same-entry revision is continued work on one costing. It must not become a second new costing, another activation, or another credit. Show credits used and the actual reset period, label quota as shared across the owner's factory grants, and calculate recalculation eligibility from original creation time.

Start by recording reliable events and showing coverage. Do not backfill confident-looking historic funnels from incomplete data. PostHog’s retention model supports company-level cohorts with explicitly chosen start and return events; that pattern fits a factory product better than counting every login as value. [PostHog retention documentation](https://posthog.com/docs/product-analytics/retention)

## Support should close the loop

The inspected grievance tracker and mailto privacy intake do not provide a general customer-support conversation. Build a focused ticket workflow for day-to-day product help and keep formal complaints or data-rights requests under their appropriate process. [Current grievance schema](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/supabase/migrations/20260425173000_compliance_v3_hardened.sql#L88-L120), [privacy intake](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/lib/privacy-request.ts#L3-L31)

### Ticket intake

Include the full minimum customer flow in the first release: submit a ticket, see a list of their own tickets, open a ticket and its public conversation/status, and reply. Default visibility should be the requester and founder only; another person in the same factory should not automatically see private support conversations.

Also let the founder record an issue received by phone, WhatsApp, or email. Automatic channel integrations can wait. Link each ticket to the correct factory and requester, with a subject, description, source, category, impact, owner, and next update date. Start with text-only intake unless protected attachment handling is ready. A rich help center is not required for this customer flow.

Useful categories are onboarding, costing and rates, production, inventory, payroll, payment and access, suspected bug, and other. Keep the category list short enough to use consistently.

### Five clear states

1. New: the issue needs triage

2. In progress: Weavly owes the next action

3. Waiting on customer: a specific question or input is outstanding

4. Waiting on fix or third party: Weavly still owns the customer update

5. Resolved: the outcome and resolution have been recorded

A customer reply should return a waiting or resolved ticket to active work while that ticket remains retained. Every unresolved ticket needs an owner and a next action. Waiting states need a due date so they do not disappear from attention.

This follows the useful distinction in Zendesk’s status guidance: whether the support team, customer, or another party needs to act. It does not require an enterprise help desk. [Zendesk ticket status guidance](https://support.zendesk.com/hc/en-us/articles/4408843029658-About-open-vs-pending-and-on-hold-tickets)

### Priority and resolution

Prioritize data loss, unauthorized access, and widespread core-work failures first. A factory blocked from production, a payroll correctness issue, or a paid customer without access is high priority. How-to questions, non-blocking bugs, and suggestions follow according to impact. Do not invent paid-tier service promises or 24-hour coverage.

Keep customer replies and private notes visibly separate. Give the founder safe context such as plan, app version, error reference, and relevant workflow state. Record a resolution summary, linked fix or incident when relevant, and customer confirmation when available. Silence should not be recorded as confirmation.

The first support views should be “Needs our reply,” “Unassigned,” “Updates due,” “Waiting on customer,” “Payment and access,” and “Reopened.” Start with unanswered count, queue age, first-response time, and reopened tickets. Customer satisfaction campaigns and AI auto-replies can wait.

## Payments should show evidence and exceptions

The core record chain is purchase or invoice → confirmed payment → entitlement → refund or adjustment where applicable. Settlement-to-bank is a separate reconciliation layer once reliable data exists. Razorpay exposes payment and settlement details separately, which is why a successful customer payment should not automatically be labelled bank cash. [Razorpay payment details](https://razorpay.com/docs/payments/payments/dashboard/), [reporting](https://razorpay.com/docs/payments/dashboard/reports/)

The first screen should show the billing customer, affected factory, plan/term, amount and currency, provider reference, payment state, entitlement state, and reason for any mismatch. Open the provider record for evidence where appropriate.

Prioritize these exceptions:

- Confirmed payment but missing or incorrect access

- Access that exceeds the recorded purchase without an explained manual grant

- A refund whose entitlement consequence still needs review

- An event that arrived but was never applied

- Duplicate or conflicting payment state

- A paid term approaching its manual renewal date

Keep one-time purchases, renewals, complimentary access, referral extensions, refunds, and any verified offline receipts distinct. An internal note or “mark paid” action must not masquerade as provider confirmation. Preserve original records and add corrections with provenance. Use recorded transaction amounts in integer paise rather than recomputing old purchases with today's prices.

Webhook processing must handle duplicates and out-of-order events without granting access twice or reverting a newer state. Razorpay explicitly documents both behaviors. The console should surface failed processing; reconciliation provides a second check for missing events. [Razorpay webhook guidance](https://razorpay.com/docs/webhooks/best-practices/)

The audit found important coverage gaps: test/live provenance is not explicit in inspected ledger definitions, no settlement/fee/dispute ledger was found, and the refund path focuses on duplicate-refund attempts rather than a proven complete feed of provider/manual/partial refunds. Show verified rows and coverage warnings first. Do not label totals “live revenue,” “net collections,” or “bank settled” until their required evidence is complete. [Inspected payment schema](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/supabase/migrations/20260416200000_subscription_schema.sql#L16-L112), [billing ledgers](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/supabase/migrations/20260801162646_20260801143840_sprint4_billing_trust_boundaries.sql#L7-L200)

The existing billing reconciler can change entitlements and may initiate duplicate refunds. Do not call it while rendering a page or fetching a supposedly read-only summary. Keep reporting reads separate from explicit, authorized repair commands. [Reconciliation side effects](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/lib/billing-reconciliation.ts#L90-L291)

Local refund status also needs a careful label: the current reconciler can mark a refund “issued” when an API response contains a refund ID. That does not establish completed processing. Razorpay distinguishes pending, processed, and failed, and its refund creation timestamp is not a completion timestamp. Require verified status and timing before subtracting completed refunds in financial totals. [Refund state definitions](https://razorpay.com/docs/api/refunds/entity/)

Defer bank-settlement totals and receivables until source mappings are proved. Avoid automatic refunds, accounting rules, and subscription dunning in the first build. The current checkout gate should remain visible as a blocker; building an admin screen must not silently enable live payments.

## A small metric dictionary

These are proposed Weavly definitions. Each needs a version, time window, source, and documented exclusions. Show the numerator and denominator beside percentages.

| Metric | Definition |
|---|---|
| New factories | Distinct production organization IDs created in the period, excluding verified demo, test, and internal records |
| Estimator activation within 7 days | Members of the same fully observed signup cohort whose first valid persisted original costing occurs in [signup, signup + 7 days) ÷ all eligible members of that cohort; keep Free owner-subject cohorts separate from verified factory cohorts |
| Base operations activation within 14 days | Members of the same fully observed Base-start cohort whose first valid production record occurs in [Base entitlement start, start + 14 days) ÷ all eligible factories in that cohort |
| Weekly active factories | Distinct factories with a successfully completed, organization-attributed business event during the trailing 7 days; Free subject-only activity appears as a separate active-owner measure |
| Week 1 estimator retention | Activated members of the same fully observed cohort with a qualifying estimator return event in [activation + 7 days, activation + 14 days) ÷ all eligible activated members of that cohort; retain the same explicitly labelled unit as activation |
| Unanswered tickets | Unresolved customer tickets without a first human public reply; automated acknowledgements do not count |
| First response time | Time from creation to the first human public reply; show median, p90, sample size, and whether hours are calendar or staffed |
| Overdue support updates | Unresolved tickets whose promised update time has passed without the required customer update |
| Gross collections | Sum of confirmed capture facts in the period by capture timestamp, deduplicated by provider account and payment ID, including payments later refunded; separate currencies and state tax treatment |
| Net collections | Gross collections minus confirmed refunds in the same period and currency; withhold the total until refund coverage is verified |
| Renewals due | Renewable paid terms ending in the selected window, with effective fallback access shown separately |

Use identical cohort eligibility, exclusions, and identity units in each numerator and denominator. Include only members with the full stated observation window and sufficient source coverage, and disclose excluded or unmeasured members. A zero eligible denominator is “not yet observed” or “no eligible cohort,” never 0%.

Qualifying activity should be an observed successful business outcome. New costing, same-entry revision, production entry, inventory movement, payroll completion, saved-costing review, and export should remain distinguishable. Exclude logins, page refreshes, background polling, failed requests, support access, and duplicate retries.

Incomplete cohorts should show “not yet observed.” Unknown record mode should remain unknown rather than be guessed as live. Net collections are a cash-flow measure, not recognized accounting revenue. A factory can retain access without being recently active, and it can use Lite after a Base term expires; those states must remain separate.

## System health should be small and actionable

Show failures that affect real work: unsuccessful costing or production writes, payment events awaiting processing, failing jobs/exports, stale reporting, and current incidents. Add a representative synthetic login/read/write check when the operational setup supports it.

Where monitoring exists, show success rate, request volume, and p95 latency for important workflows. Low sample sizes need counts as well as percentages. Show last successful backup separately from last successful restore test. “Backup completed” does not prove restoration works.

Google SRE’s monitoring guidance emphasizes user-visible behavior and carefully defined signals. Apply the principle at Weavly’s scale: a few failures with clear owners and diagnostic links, rather than a new infrastructure dashboard. [Google SRE monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)

## Privacy and access safeguards

The console deliberately crosses factory boundaries, so server-side authorization is essential. Provide a distinct founder login backed by the existing authentication provider, a protected grant keyed to the founder's immutable user ID, and MFA before any founder data. Generic legacy admin status or an email match should not be enough. Each page, action, API, database function, and download must check authorization independently.

The audit found an admin-bootstrap mismatch: authentication expects an organization ID while the creation script omits it. Give founder sessions an explicit platform-level path while preserving organization requirements for customer sessions. Resolve and test this before treating admin access as ready. [Current session guard](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/lib/auth.ts#L107-L201), [legacy provisioning script](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/scripts/create-admin.ts#L3-L65)

Keep factory business and payment diagnostics read-only. Allow narrowly authorized, audited support replies, status changes, and ownership updates. Separately guard any retained entitlement changes, exports, role changes, incident controls, and destructive actions. Record the actor, factory, reason, timestamp, and safe before/after values. Avoid unrestricted impersonation and direct production/payroll editing in the MVP.

Collect minimal event metadata and protected diagnostic references. Do not copy complete customer forms, payroll details, credentials, access tokens, or payment credentials into logs. OWASP recommends auditing administrative use while excluding or sanitizing sensitive data. [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

Support attachments, when added, need authenticated access, sensible type/size limits, scanning/quarantine, and a defined retention policy. Internal notes must never appear in customer replies. Use minimal-field exports with an audit trail.

Exclude admin/support responses and attachment URLs from offline stores, persisted queries, service-worker caches, shared caches, and session replay. Clear sensitive state on logout and account switch, and test browser back and offline behavior. Audit ordinary application actions separately from authentication events. The source includes PWA, local persistence, and replay dependencies, so these checks belong in the release gate rather than a later cleanup. [Current dependencies](https://github.com/Rajp2002/TextileAccounting/blob/36e6e4edac8de76052dc8247d99a74b90ef3772d/package.json#L5-L80)

Inventory legacy records and integrations before changing routes or deleting data. Move or rebuild any current security, incident, grievance, or data-request capability that is independently needed. Retire obsolete screens deliberately. Existing code is neither proof of current legal necessity nor proof of compliance.

## A typical founder day

This is the intended workflow, not an additional daily reporting obligation:

1. Open Today and deal with incidents, payment/access mismatches, and customers waiting for a reply

2. Open a factory directly from the queue, understand its plan, progress, and recent issue, and take the next support action

3. Review promised updates due that day, including tickets waiting for a fix

4. Check renewals and unexplained access exceptions before contacting the relevant customer

5. Once a week, review activation blockers and repeat support causes; use mature retention data only when enough history exists

The console succeeds when a problem can be understood and assigned from one connected view, and when the next customer commitment remains visible until it is fulfilled.

## Build order and stopping point

### First release

1. Correct founder access, fresh navigation, a legacy dependency inventory, and audit foundations

2. Read-only factory directory and detail with actual entitlements, activity coverage, and observed activation

3. Customer submission, own-ticket list/detail/reply, and founder intake/conversation with five states, owner, next update, reopening, and resolution history

4. Payment/entitlement evidence and an exception queue using verified existing sources

5. Small Today and System summaries with reliable freshness and clear unavailable states

### Add after the first release earns its place

Add mature cohort charts after consistent events accumulate. Add bank reconciliation when a reliable settlement/bank mapping exists. Add channel integrations, knowledge-base articles, and reply templates when repeated support work justifies them. Add finer staff roles as the team grows.

### Leave out for now

Skip opaque churn scoring, a marketing CRM, per-worker surveillance, broad payroll visibility, NPS campaigns, speculative LTV, enterprise SLA machinery, automated refunds, accounting software, and subscription automation. None is needed to answer the founder’s first five questions.

## Decisions to confirm before implementation

- Intended current prices, manual renewal terms, and the expiry-to-Lite behavior, checked against deployment

- Whether any offline payments exist and which evidence confirms them

- The required setup before Base production use and the exact Free quota-reset semantics

- Support hours, contact channels, and supported languages

- Which legacy records and integrations are still live, and which current formal/security workflows require a replacement

These are bounded implementation decisions. They should not turn the first release into a redesign of billing, support policy, compliance, or the customer product itself.
