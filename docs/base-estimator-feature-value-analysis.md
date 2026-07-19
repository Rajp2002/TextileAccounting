# Base Estimator Feature Value Gate

Date: 2026-07-19
Decision owner: Weavly product
Audience: A paying Base-plan owner who uses Weavly only to create reliable textile costings

## Decision rule

A Base feature earns its place only when it materially improves at least one of these recurring jobs:

1. reach a reliable cost faster;
2. reduce the chance of using a wrong assumption;
3. understand why a cost changed;
4. reuse a prior costing without re-entry; or
5. send a professional quotation without exposing internal economics.

The feature must create more recurring value than the clicks, fields, navigation, maintenance, and learning it introduces. This is a qualitative product review because the repository currently contains no Base-plan usage telemetry, interview corpus, or task-completion measurements.

## Current workflow evidence

- The estimator already has one authoritative detailed calculation path, server validation, autosave, reusable saved qualities, and Base-specific setup.
- Saved Costings already supports search, filtering, reopening, duplication, immutable versions, two-costing comparison, archive, favourites, and export.
- Rates & Qualities already keeps current defaults, review dates, sources, and history without changing old costings.
- Customer quotation export already supports optional customer name, validity, notes, and GST wording while hiding cost and margin.

This means Sprint 3 should remove repetition and improve context inside those existing surfaces. It should not introduce another destination or parallel calculation model.

## Feature decisions

| Proposal | Decision | Buyer value | Friction and risk | Product treatment |
| --- | --- | --- | --- | --- |
| Separate Quick Costing mode | Cut | It appears faster for a first estimate. | It creates two calculation paths, a mode decision, hidden assumptions, support complexity, and risk that a buyer distrusts the quick result. | Keep one estimator. Make reuse faster through existing saved costings and defaults. |
| Costing trend dashboard | Cut | It can look useful for reviewing historical movement. | A chart without normalized quality, construction, quantity, and rate context can imply a false trend. It adds a dashboard the buyer must interpret. | Show cost movement only beside versions of the same costing, with the prior version as the explicit baseline. |
| Contextual version movement | Keep | Immediately answers “did this version become more or less expensive?” during reuse. | No new setup and negligible screen weight. | Add a short production-cost movement label against the previous version in the same costing group. Keep detailed comparison on demand. |
| “Use as starting point” action | Keep by refinement | Reusing a close costing is one of the fastest safe ways to produce another estimate. | The capability already exists, but “Duplicate” is system language and does not explain the buyer outcome. | Rename the Base action and copy to “Use as Starting Point”; preserve Full Suite terminology. |
| Customer database or CRM | Cut | Repeat customer details could save typing. | It introduces records, deduplication, edit screens, privacy concerns, and CRM expectations unrelated to costing. | Keep customer fields optional and quotation-scoped. Do not add a Base customer destination. |
| Business-name memory for exports | Keep | Removes repeated typing on every internal sheet and customer quotation. | No new screen or required field. | Prefill the organization name automatically; leave the field editable for trading-name exceptions. |
| Excel/CSV import for rates and qualities | Defer | It could speed onboarding for users with large existing sheets. | Column mapping, validation errors, units, duplicates, and support burden are disproportionate for a typical small rate book. | Reconsider only if onboarding evidence shows repeated manual entry is a material barrier. Existing organization data export covers portability. |
| Monthly costing activity summary | Cut | Shows how often the tool was used. | It is a vanity measure for a buyer trying to calculate cost, not an operational decision. | Do not add it to Base. Instrument usage internally instead. |
| Customer phone, GSTIN, and reusable terms | Defer | May improve formal quotations for some buyers. | Extra fields increase export friction and can make a quotation feel like an invoice/CRM workflow. | Validate through quotation feedback first; keep current customer, validity, notes, and GST note fields. |

## Approved refinement scope

1. Add contextual production-cost movement against the previous version in Saved Costings.
2. Rename the Base duplicate action to “Use as Starting Point” and avoid automatically appending “Copy” to the quality name.
3. Prefill export business name from the organization record while keeping it editable.
4. Remove Quick Costing, trend dashboards, CRM, bulk import, and activity summaries from the committed Base roadmap.

## Measurement gap

The recommendation should be revisited after real Base usage exists. The minimum useful evidence is median time from opening the estimator to a valid save, share of costings started from a prior costing, export completion rate, repeated edits to business name, and customer-support requests for spreadsheet import. Until then, simplicity is the safer product decision.

## Report delivery notes

- Visual question: how much of the proposed scope survives the buyer-value gate?
- Visual family: categorical bar chart using counts of the eight reviewed proposals.
- Fields: decision and proposal count; no impact, demand, or confidence score is inferred.
- Supported claim: most proposed expansion is cut or deferred.
- Palette: one restrained root with direct axis labels; no legend or redundant category-color encoding.
