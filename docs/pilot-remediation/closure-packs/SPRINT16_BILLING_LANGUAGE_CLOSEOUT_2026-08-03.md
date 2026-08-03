# Sprint 16 — Billing trust and usable local language closeout

**Date:** 2026-08-03 IST  
**Scope:** Base Plan billing, language, dates, terminology, and archive policy

## Disposition

The code-level Sprint 16 controls are implemented. The paid pilot must still
complete a short owner/staff walkthrough with a Surat reviewer before this
pack is treated as final runtime sign-off. No human reviewer evidence is
claimed by this document.

## 16.1 GST document decision

**Recorded state: `Not-Supported`.**

The product-owner decision for this pilot is that Weavly issues a **payment
receipt (PDF) only**. The receipt is not a GST tax invoice. GST tax-invoice
support will be reviewed after Weavly is incorporated; the pilot checkout does
not ask a customer to provide supplier details in order to receive a document
that is not currently available.

The limitation is visible in the Billing page, each plan card, the checkout
area, the payment success outcome, payment history, and the receipt download
area. The future GST-invoice route and issuance helper are guarded by the same
policy so an environment flag cannot silently turn the pilot promise into an
invoice promise.

This is a product limitation record, not a claim that a payment receipt meets
any particular tax or accounting requirement. Product owner/compliance review
must confirm the pilot wording before paid launch.

## 16.2 Base Plan language decision

The Base Plan promise is **English, Hindi, and Gujarati**. The implementation
covers the navigation, estimator, Saved Costings, quotations, Rate Book,
Settings, billing, organization export, validation, and status/toast surfaces.
The selected language is persisted under `weavly_language`, so reloads and
navigation retain it; draft restore and quotation opening stay inside the same
language context.

Factory terms are deliberately retained where changing the term could change
meaning: warp, weft, PPI, crimp, waste, pick rate, costing, quotation, trader,
margin, and GST. The estimator exposes a one-line glossary explanation for
each term. A Surat reviewer must still confirm that the Hindi/Gujarati wording
is understood by the intended owner and staff users.

## 16.3 Dates and archive policy

- Business dates are formatted in `Asia/Kolkata`; audit timestamps use an
  explicit `IST` suffix.
- Archive notices and archive confirmations explain that archiving removes a
  record from active lists, preserves it for restore, and does not provide a
  permanent-delete action in this workflow.
- The notices state that archived data remains stored under the organisation's
  retention/privacy controls and can be included in organization export.

## Verification

The implementation passed the repository verification gates on 2026-08-03:

- `npm run test`: 137 test files passed; 875 tests passed and 1 test was skipped.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed; the production build also completed its TypeScript check.
- `npm run build`: passed, including the pre-build test run, production compilation,
  static-page generation, and route finalization.
- `git diff --check`: passed.

The build emitted only the existing Browserslist database-age advisory; it did
not block compilation or the production build.

## Evidence still required before paid-pilot sign-off

1. A Rajesh-like owner completes one Base Plan costing and payment walkthrough
   and can name the exact document received.
2. A staff user switches to Hindi or Gujarati, identifies the primary save and
   archive/restore actions, and explains a validation/status message.
3. The owner and staff reviewer record the language, browser, date/time in
   IST, observed wording, and pass/fail result in the pilot evidence folder.

Until those checks are recorded, this is **code complete / runtime evidence
pending**, not a blanket paid-adoption approval.
