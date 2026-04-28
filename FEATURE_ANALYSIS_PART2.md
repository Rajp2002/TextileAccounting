# Feature Analysis Part 2

This file captures the current state of the platform systems that support operations: payroll, notifications, compliance, and integration layers.

## Payroll And Wage Logic

Current implementation includes:

- piece-rate payroll from production logs
- fixed-worker payroll from attendance
- advance deduction with legal-cap logic
- final settlement support
- payroll adjustments for bonuses and fines
- PF/ESI calculations for eligible workers
- PDF payslip generation
- WhatsApp payslip delivery with itemized follow-up messaging

## Notification Layer

Current implementation includes:

- owner daily brief
- owner deadline risk alerts
- monthly brief
- owner access-code delivery
- advance receipts
- payslip delivery
- lockdown alerts
- failed-message retries
- owner-facing delivery-log inspection and manual resend

## Compliance Layer

Current implementation includes:

- admin compliance dashboard
- grievance workflows
- notice registry
- DPA management: template versioning, active-state control, and factory signature tracking with proof storage
- export logging
- lockdown state and related alerting
- owner audit view

## Billing Layer

Current implementation includes:

- free trial support
- base and premium plan states
- Razorpay checkout and webhook processing
- auto-renew toggles
- referral-aware billing UI

## Main Technical Risks Still Visible

- comments and older documents still lag behind some live integrations
- complex payroll behavior relies on migrations and RPCs, so schema drift must be watched carefully
- operational breadth is strong, but end-to-end automated verification is still limited
