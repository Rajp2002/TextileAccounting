# Weavly Lite + Weavly Base feature audit

Updated: August 30, 2026

## Audit basis

The former Base plan was reconstructed from the repository rather than from the
new pricing page. The primary evidence is:

- `docs/base-estimator-refinement-sprint-plan.md`, which defines the original
  Base costing desk and explicitly treats production, orders, inventory, and
  broader factory management as non-goals.
- The estimator, saved-costing, quality, Rate Book, export, settings, and
  account routes that existed before commit `6d2523f` (`feat(base): add owner
  production core`).
- `docs/base-production-core-scope.md` and the migrations beginning with
  `20260829090000_base_production_core.sql`, which define the production scope
  now assigned to Weavly Base.
- Existing route guards, server actions, RLS policies, tests, and billing
  lifecycle code.

The migration is additive. It preserves records and payment history, maps old
Base costing subscriptions to Lite by default, and maps an organization to
Base when it has an explicit Base workspace marker or Base Production Core
records.

## Feature matrix

| Feature | Previous Base | Lite | Base | Future |
| --- | --- | --- | --- | --- |
| Textile estimator / costing engine | Yes | Yes | Yes (inherited) | — |
| Warp and weft inputs, construction, PPI, crimp, waste, and yarn assumptions | Yes | Yes | Yes (inherited) | — |
| Live costing calculations and validation | Yes | Yes | Yes (same engine) | — |
| Factory costs, GST assumptions, transport, commission, landed cost, break-even, and margin | Yes | Yes | Yes (inherited) | — |
| Costing breakdowns and costing accuracy behavior | Yes | Yes | Yes (inherited) | — |
| Saved costing records and metadata | Yes | Yes | Yes (inherited) | — |
| Costing history, search/filter, reopen, edit/recalculate, duplicate/reuse, archive/favourite behavior | Yes where implemented | Yes | Yes (inherited) | — |
| Saved Quality library | Yes | Yes | Yes (inherited) | — |
| Reuse, edit, rename, archive, restore, and costing linkage for Qualities | Yes where implemented | Yes | Yes (inherited) | — |
| Rate Book current values and historical/review activity | Yes | Yes | Yes (inherited) | — |
| Rate Book references in estimator and saved-quality workflows | Yes | Yes | Yes (inherited) | — |
| Costing defaults / factory cost profile | Yes | Yes | Yes (inherited) | — |
| Cost Sheet and organization data export | Yes where implemented | Yes | Yes (inherited) | — |
| Account access, hosted records, settings, logout/login persistence, and tenant isolation | Yes | Yes | Yes (inherited) | — |
| Billing history, receipts, privacy controls, and account deletion | Yes | Yes | Yes (inherited) | — |
| Create a production job from an active saved costing | No (new production scope) | No; CTA explains Base | Yes | — |
| Costing/quality snapshot retained on a production job | No | No | Yes | — |
| Planned, produced, and remaining production metres | No | No | Yes | — |
| Production status and completion history | No | No | Yes | — |
| Owner-entered production entries with idempotent requests | No | No | Yes | — |
| Base Production Core worker roster and rate snapshots | No | No | Yes | — |
| Base Production Core advances and capped settlement records | No | No | Yes | — |
| Base Production Core machines, assignments, job context, batches, and daily sheets | No | No | Yes | — |
| Production-linked activity and upgrade-intent analytics | No | No | Yes where applicable; Lite records upgrade intent | — |
| Formal party orders and quotation lifecycle | No; separate legacy module | No | No | Future scope |
| Supervisor/floor accounts and supervisor production | No | No | No | Future scope |
| Inventory, godown/stock, dispatch, and commercial workflows | No | No | No | Future scope |
| Fixed-worker master, fixed salary, statutory payroll, and broader HR | No | No | No | Future scope |
| Factory-wide analytics, alerts, WhatsApp operations, and broader ERP controls | No | No | No | Future scope |
| Admin/security/compliance tooling | Internal/admin | Internal/admin | Internal/admin | — |
| Retained legacy operational entitlement and workspace compatibility | Internal migration compatibility | Not customer-facing | Not customer-facing | — |

## Entitlement boundary

`lib/subscription-access.ts` is the central capability map. Lite owns the
complete costing set (`estimator`, `saved_costings`, `qualities`, `rate_book`,
`existing_costing_tools`, and `account_data`). Base inherits that set and adds
`production`, `production_management`, `production_tracking`, and
`production_linked`.

The old `base` database requirement remains the costing minimum so established
estimator, saved-costing, quality, and Rate Book policies continue to work for
Lite. Base Production Core RLS uses the explicit `base_production` requirement,
which only accepts Base (plus retained legacy/trial compatibility rows). The
same boundary is checked by the production server actions before every
mutation.

## Pricing and migration decisions

- Weavly Lite: ₹2,999 first year; ₹1,499 annual renewal.
- Weavly Base: ₹9,999 first year; ₹4,999 annual renewal.
- Totals are GST-inclusive at the current catalog rate and are represented in
  paise in `lib/billing-constants.ts` and the activation RPC.
- New self-serve checkout exposes only Lite and Base. The retained `premium`
  value exists only to reconcile historical operational records and is not
  shown as a purchasable plan.
- Expiry or downgrade never deletes production records. It removes Base-only
  creation/mutation access until Base is renewed while preserving Lite and
  export behavior.

## Flagged ambiguities

1. The repository contains a legacy `premium` workspace and broader routes.
   They are retained for existing-account compatibility and internal/admin
   operations, but are not part of the new customer-facing catalog.
2. Historical trial and premium rows may still exist in production data. They
   are not new commercial plans; the migration keeps them readable and the
   server derives current access from subscription rows rather than client
   claims.
3. The referral implementation is intentionally Base-only because its reward
   is a Base renewal credit. This is a commercial rule, not a Lite feature
   restriction; it can be changed independently later.
4. Existing production records are the migration signal for accounts that
   have already been promised or given production access. Accounts without
   that evidence are mapped from former Base to Lite.
