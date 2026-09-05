# Base Plan Settings refinement

**Review date:** 10 August 2026  
**Persona:** owner/proprietor of a small or mid-sized weaving unit using Weavly as a costing desk  
**Scope:** Base / Estimator Plan settings and the linked data-export surface

## Persona lens

This owner comes to Settings for four jobs:

1. Set the assumptions that should pre-fill the next Cost Estimate.
2. Keep repeat fabric qualities reusable without changing old costing snapshots.
3. Keep the business name correct on internal and customer-facing documents.
4. Occasionally reset account access, export the business data, or close the workspace.

They are not trying to configure a production system from this workspace. Team access, supervisors, production mode, factory-floor messaging, payroll, stock, dispatch, and audit operations belong to Full Suite or support workflows.

The owner’s mental model is simple: **“What affects my next costing?”** Settings should answer that question immediately and keep everything else quiet until it is needed.

## Section-by-section decision

| Current surface | Decision | Base treatment | Reason |
|---|---|---|---|
| Recommended Defaults | Keep, rename | **Cost Estimate Setup** | This is the heart of the Base product. |
| Estimator Defaults / Factory Cost Profile | Keep the data model; simplify the presentation | Core costing defaults open for first setup and collapsed after a saved profile; capacity and optional inputs behind disclosures | The owner needs warping, sizing, overhead, monthly output/expenses, and target margin. The factory-type selector and every optional input at once create setup fatigue. |
| Factory setup presets | Remove from Base presentation | Grey Weaver is the fixed Base setup; retain the underlying preset model for future/full-suite use | Base currently targets grey-fabric weavers. Asking them to choose among unsupported operating models adds friction and implies product coverage that is not yet part of the Base promise. |
| Factory expenses | Keep | Core defaults | Monthly expenses divided by actual output is one of the most defensible Base calculations. Direct ₹/m remains available for owners who already trust that number. |
| Active looms, working days, average output | Keep for monthly-baseline validation, warnings, and capacity context | **Capacity reference** disclosure; it opens automatically when a first monthly baseline still needs a loom count | These are useful when reviewing a warning but should not dominate the returning owner’s settings view. |
| Post-weaving rates, commission, transport | Keep | **Optional charges and reminders** disclosure | They are valid Base features, but only for units that use them. Hidden inactive sections also avoid the “non-zero value but switched off” confusion. |
| Yarn rate review cadence | Keep | Same optional disclosure | It supports rate trust, but it is not a daily settings task. The Yarn Rate Book remains the operational surface. |
| Saved Fabric Qualities | Keep and prioritize | Active qualities shown by default; archived qualities revealed by “Show archived” | Archived records are for recovery/audit, not the owner’s normal working list. |
| Business & Profile | Keep, narrow | **Business name** | This directly affects document identity and is the only business identity input Base needs. |
| Personal Information | Keep for support context, demote | Read-only owner profile inside **Account & data** | Name, phone, and role do not change a costing and do not need a full top-level category. |
| Workspace Experience | Conditional | Only show for an entitled Full Suite owner deliberately using the Base experience | A normal Base owner cannot switch products and should not see rollout controls. |
| Supervisors & Access | Remove from Base presentation | Full Suite only | There are no supervisor workflows in Base. |
| Production Mode | Remove from Base presentation | Full Suite only | It changes factory workflows that Base does not expose. |
| Account Security & Team / access-code generator | Remove from Base presentation | Full Suite only | Generating a supervisor access code is an operational team action, not a costing setting. |
| Communications & Automation / WhatsApp | Remove from Base presentation | Full Suite only | Daily factory briefs reference production, yield, and wage totals that are outside Base. |
| Privacy & Data / organization export | Keep, demote | Inside **Account & data** disclosure; link to export history | It is an important owner right, but a low-frequency action. The export remains owner-only and complete. |
| Delete account permanently | Keep, isolate | Bottom of **Account & data**, visibly destructive | It must remain discoverable and safe, but should not compete with costing setup. |
| Base right rail / repeated billing, saved-costing, password links | Remove from Base page | Use the existing navigation and one password link in Account & data | The rail duplicates primary navigation and makes Settings feel like a dashboard. |
| `/owner/data-export` | Keep as a dedicated deep page | Reach from the export action/history link | History and download status deserve their own focused surface. |
| `/owner/settings/audit` | Do not surface in Base | Remains archived/support-only | Production/payroll/profile audit browsing is outside the Base owner’s core job. |
| `/owner/billing` | Keep separate | Existing sidebar/billing route | Subscription state is important, but it is not a costing default. |

## Changes applied

- Base now has its own focused settings presentation instead of inheriting the long Full Suite category flow.
- The page leads with **Cost Estimate Setup**, then **Business identity**, then a collapsed **Account & data** area.
- The factory profile keeps all existing persistence and validation behavior but removes an unnecessary Base decision:
  - Base uses the grey-weaver setup without showing a factory-type selector;
  - Full Suite retains the factory setup selector for future operating models;
  - core costing defaults grouped into a disclosure;
  - capacity reference grouped inside monthly expenses;
  - optional charges and review cadence grouped into a disclosure;
  - an always-available save/status footer remains at the bottom.
- Saved qualities now show active records first. Archived records remain recoverable through an explicit toggle.
- The Full Suite settings presentation and its operational controls are unchanged.

## Acceptance criteria

- A new Base owner can set monthly output, monthly expenses, warping, sizing, and target margin without opening an advanced area.
- A returning Base owner sees the saved profile summarized rather than a wall of inputs.
- Changing an optional section exposes its matching rate field; disabled optional sections do not visually compete with core inputs.
- Existing saved costings remain immutable and the “new Cost Estimates only” scope stays explicit.
- Active saved qualities are immediately visible; archived qualities can be restored without being mixed into the default list.
- Base does not expose supervisor, production-mode, access-code, WhatsApp, or audit controls.
- Export, password reset, and permanent deletion remain reachable without occupying the primary setup path.
- The page remains usable at mobile widths and keeps the existing owner-only/export/deletion guardrails.

## Deliberately not changed

The calculation engine, rate book, saved-costing versioning, comparison, customer-safe export, organization-export redaction, billing gate, and Full Suite workflow settings are outside this refinement. They are core trust or entitlement behavior and should not be changed as part of an information-architecture cleanup.
