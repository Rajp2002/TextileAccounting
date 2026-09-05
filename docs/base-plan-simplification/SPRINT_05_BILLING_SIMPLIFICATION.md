# Sprint 5 — Billing Simplification Fixes

**Surface:** Subscription & Billing  
**Route:** /owner/billing  
**Priority:** P1  
**Status:** Proposed

## Outcome

Let a Base user understand what workspace they are using, what subscription is paid for, when it renews, and where the latest receipt is—without making payment history feel like an operational workflow.

## Persona job

“I occasionally need to know whether my costing desk is active, when payment is due, and how to retrieve a receipt.”

## Observed friction

The Base workspace should identify itself as the Base Plan workspace, while Billing separately explains the paid subscription and any Full Suite entitlement. The page also exposes a long history containing multiple successful-looking and incomplete payment attempts, repeated receipt language, and a GST caveat in the first-level experience.

The underlying distinction may be valid—workspace experience versus paid subscription—but the UI does not make that distinction quickly enough.

## Design decision

Separate the two concepts explicitly:

- **Workspace:** the product experience currently enabled, such as Base Plan / Estimator.
- **Subscription:** the paid commercial plan and its entitlement, renewal, and receipts.

Do not change entitlement logic as part of this UX sprint.

## Work items

### BL-01 — Make workspace and subscription distinct

- Show a compact workspace card: **Base Plan / Estimator workspace**.
- Show a separate subscription card with plan name, active status, billing period, renewal date, and next action.
- If a Full Suite subscription funds a Base workspace, say so plainly rather than calling Full Suite the current workspace.

### BL-02 — Prioritize the next useful billing action

- Show latest renewal/expiry state first.
- Show the latest successful receipt as the primary document action.
- Keep export organization data separate from billing documents.
- Do not expose paused checkout actions as if they are available.

### BL-03 — Collapse payment history

- Show a compact latest-payment row by default.
- Put older successful, failed, and incomplete attempts under Payment history.
- Normalize statuses so “Captured,” “Failed,” “Incomplete,” and “Receipt available” are visually distinct.
- Keep every receipt and transaction recoverable.

### BL-04 — Reduce tax explanation noise

- Keep the payment-receipt versus GST-tax-invoice distinction.
- Move the longer legal/tax explanation into a collapsible Billing documents note.
- Use plain language and avoid making a tax limitation look like a billing failure.

### BL-05 — Verify language and entitlement boundaries

- Use Base language when describing the workspace.
- Use subscription language when describing paid access.
- Confirm that a Base workspace cannot reach Full Suite operational actions from Billing.
- Keep renewal and payment behavior server-authoritative.

## Acceptance criteria

- The first view answers: “Which workspace am I using?”, “Is it active?”, “When does it renew?”, and “Where is my receipt?”
- Base workspace and paid subscription are never represented as the same label.
- Older payment attempts do not dominate the default view.
- Receipt availability and payment status are clear.
- GST receipt/invoice wording remains accurate and readable.
- No unavailable checkout or Full Suite workflow action is presented as actionable.
- No billing data or entitlement behavior is changed by the simplification.

## Verification scenarios

1. Base workspace with an active Full Suite subscription.
2. Active subscription with a future renewal date.
3. Successful payment with a downloadable receipt.
4. Failed/incomplete attempts alongside one successful payment.
5. Pilot state where checkout is paused.
6. User opens Billing on mobile and can still find plan status and receipt.
7. User switches workspace in Settings and Billing language remains coherent.

## Non-goals

- Payment provider changes.
- Entitlement, renewal, or receipt schema changes.
- New checkout flows.
- GST invoicing implementation.
- Customer-facing billing or CRM.
