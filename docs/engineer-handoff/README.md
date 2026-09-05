# Weavly engineer handoff

This folder is a product and codebase orientation pack for an engineer who is new to textile manufacturing.

The documents describe the repository as it existed on **10 August 2026**. The 29 August 2026 scope decision adds a deliberately small owner-only Production Core to Base. The most important current distinction is:

- **Base Plan / Weavly Estimator:** the standalone costing desk plus costing-linked jobs, owner-entered metres, piece-rate workers, advances, and basic settlement.
- **Full Suite:** the wider factory operating loop around production, orders, stock, dispatch, payroll, and analytics.

The full decision is recorded in [Base Production Core scope](../base-production-core-scope.md). Older workflow notes that say Base has no production or payroll should be read as pre-29-August planning context.

Read them in this order:

1. [Technical specification](./01-technical-specification.md) — stack, architecture, tenancy, persistence, security, and extension points.
2. [Textile domain primer](./02-textile-domain-primer.md) — weaving concepts, factory vocabulary, units, and the exact costing formulas used by the app.
3. [Base-plan workflows](./03-base-plan-user-workflows.md) — the owner journey from subscription and setup through costing, versioning, export, and data portability.
4. [Base-plan persona](./04-base-plan-user-persona.md) — who buys Base, what they are trying to accomplish, and what “trust” means to them.

## Source-of-truth rule

When these documents disagree with an implementation detail, use this order:

1. Current route/server-action code and tests.
2. Latest Supabase migrations.
3. Current product/feature documentation under `docs/`.
4. Older design or planning documents.

The repository has a large migration history and a broader product surface than the current Base launch. A route or table existing in the repository does not necessarily mean that it is active in Base.

## Known current realities

The documents intentionally call out two live-QA issues recorded on 9 August 2026:

- The Base Settings page rendered the “Estimator Defaults” and “Saved Fabric Qualities” headings, but the corresponding controls did not render in that QA run.
- A standalone Base costing could expose a misleading “Mark as sent” action even though standalone costings do not support quotation status transitions.

These are documentation-relevant product defects, not intended workflow guarantees.
