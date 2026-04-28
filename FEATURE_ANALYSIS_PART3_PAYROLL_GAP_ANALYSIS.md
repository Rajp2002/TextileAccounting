# Payroll Gap Analysis

This document used to describe payroll gaps from an earlier stage of the product. Several of those gaps are now closed, so this version focuses on the current state.

## Gaps That Are No Longer Open

The following are implemented in the current codebase:

- bonus and fine adjustments in payroll settlement
- PF/ESI calculations for eligible workers
- itemized payslip follow-up messaging from `itemization_payload`
- supervisor float management in settings
- kharchi recording from supervisor actions

## Payroll Capabilities Present Today

- immutable piece-rate settlements using snapshot rates
- fixed-worker monthly settlement from attendance
- 50% deduction-cap logic for advances
- final settlements
- carried-forward debt handling
- PDF payslip generation
- WhatsApp summary plus itemized breakdown

## Gaps Still Worth Tracking

### 1. Time normalization is not perfect
Some payroll-adjacent screens still rely on browser-local date helpers instead of routing everything through `lib/time.ts`. That can matter near day boundaries.

### 2. Test coverage is still light for payroll end-to-end behavior
Finance math has a maintained Vitest suite, but settlement flows, itemization, WhatsApp delivery, and reversal edge cases still depend heavily on manual verification.

### 3. Documentation drift can still obscure business rules
Several migrations and code paths are more current than older prose. Anyone changing payroll should review the latest payroll migrations and action files first.

## Practical Recommendation

If payroll work is being changed again, treat these as the primary source files:

- `app/(dashboard)/owner/payroll/page.tsx`
- `app/(dashboard)/owner/payroll/actions.ts`
- `lib/finance.ts`
- `lib/generate-payslip.ts`
- `supabase/migrations/20260418190300_payroll_v2_settle_rpc.sql`
- `supabase/migrations/20260426163000_itemize_advances_rpc.sql`
