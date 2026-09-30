# Base manual production incentives

This is the second independently releasable increment of Phase 1 in the [Weavly plan](https://chatgpt.com/space/page_b2421647c6088191b33ebb43ba5fbdea), following fixed operators in PR #150.

## Contract

Owner payroll has a Production incentives action. Record the positive rupee amount, completed service start/end dates and a unique worksheet or agreement line reference for that worker. The owner then reviews and approves the draft. The supporting accountant calculation is retained externally by its reference; this increment does not upload or evaluate a formula. These are contractual production incentives, separate from statutory annual bonus.

The same source reference cannot produce two active entitlements. Request UUIDs make creation retries idempotent and reject changed payloads. Approved inputs are immutable. Void an unpaid record with a reason and create its replacement; both records retain the source reference and approval/cancellation provenance. Paid records require the existing controlled reversal, which confirms cash was not actually paid. This release does not adjust or recover a completed cash payment.

The service period must fit employment dates and the worker's unpaid window. A draft or partly covered service period blocks that worker's payment. Earlier unpaid piece incentives move the first payable start back to their source date. A component is paid whole once; it is neither prorated nor split across settlements. Payroll completion cannot skip an outstanding incentive through client-supplied resolved-worker IDs.

Salary and piece amounts retain their existing rules. Approved incentives add to gross before the existing 50% advance recovery calculation. Preview and SQL compare totals and exact incentive IDs, amounts and approval revisions. Same-total replacements invalidate the review. The loader derives consumption from active paid receipt lines, so reversal restores the entitlement without deleting its original receipt.

## Receipts and boundaries

Settlement lines freeze service dates, evidence, amount, approving owner/time, revision and manual-incentive-v1 calculation version, with INR/amount units. History, CSV and PDF keep incentives distinct from monthly salary and piece rates. Incentives have zero physical metres and are excluded from machine earnings/cost attribution. Payroll changes create no production or inventory quantities and do not update estimator cost sources or historical quotes.

All new mutations require authenticated owner, writable organization and Base access. RLS permits reads; direct authenticated table writes and service-role access are revoked. The org incentive advisory lock precedes worker payroll locks in create, approval, payment, completion and reversal. This serializes the small manual workflow; it does not add a background calculation engine.

Apply migration 20260930160000_base_manual_incentives.sql before deploying the application. The migration is written for review and disposable PostgreSQL replay. No hosted migration has been applied by this work.

## Verification and remaining work

Unit cases cover preview, review gates, carry-forward, paid/reversed totals and exported receipt semantics. Disposable database cases use real create/approval/settlement/reversal/completion RPCs, including duplicate source/request protection, stale reviews, frozen receipts, roles/tenants/locks and employment dates. CI and the Vercel preview provide execution evidence; results are recorded in the PR.

Mixed estimate labour inclusion, finer persisted rate precision, automatic excess-output formulas, attendance/time workflows and pay-type transitions remain separate work. No machine technology determines an incentive amount or pay basis.
