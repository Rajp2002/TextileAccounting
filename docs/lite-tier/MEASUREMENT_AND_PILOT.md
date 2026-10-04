# Lite measurement inventory and pilot protocol (LT08)

What the existing paid-plan measurement records, what each count can and cannot show, and a pilot protocol that is ready but **not started**. This sprint enabled **no new collection, cohort admission, retention change, recruitment or outreach**. Any addition needs decision D12 (purpose, payload, access, dedupe, retention, deletion); any pilot needs D13 and the correctness gates in `REFINEMENT_SPRINT.md`.

Source as of the LT08 commit. Nothing here was read from a live project. Free measurement is separate and documented in `docs/free-tier/MEASUREMENT_INVENTORY.md`.

## Path from emitter to report

| Stage | What exists | Evidence |
| --- | --- | --- |
| Emitter | `trackPlanEvent(name, properties)` in the browser, fire-and-forget | `lib/plan-analytics.ts` |
| Free exclusion | Returns early on `/free` and `/free/*`, including the paid estimator Free becomes in place | same |
| Payload rule | Journey events accept only the categorical properties listed in `journeyRules` (no names, rates, money, quote text or margins); other events accept short scalar values | same |
| Transport | `POST /api/analytics/plan-events`: signed-in owner only, validates name and properties, 2,000-byte cap | `app/api/analytics/plan-events/route.ts` |
| Storage | `public.plan_usage_events` (org, actor, event, `plan_tier`, properties, time). Service role only. The name list is a check constraint | `20260831150000_lite_base_plan_restructure.sql`, `20260901110001_lite_telemetry_contract.sql`, `20260902135923_monthly_overhead_analytics_events.sql` |
| Dedupe | **None at storage.** Every request inserts a row; the browser suppresses some repeats in page memory | — |
| Retention | **None.** No pruning job or policy for this table | — |
| Report | **None.** No view, script or page reads the table | `grep plan_usage_events` over `app`, `lib`, `scripts` |
| Owner archive | Not in the owner JSON archive catalog | `app/(dashboard)/owner/settings/data-export.ts` |

`plan_tier` is the **subscription** tier, not the effective tier, so a retained-Lite owner (paid Base history) is recorded as `none`.

## Journey events

| Event | Emitter | When | What it shows | What it does not show |
| --- | --- | --- | --- | --- |
| `estimator_opened` | `EstimatorClient` | Paid estimator mounted | A paid estimator page loaded | Intent or a costing |
| `blank_start`, `saved_quality_start` | `EstimatorClient` | Journey start | How the session began | Whether it finished |
| `saved_quality_selected` (`has_rates`) | `EstimatorClient` | A saved quality applied | Reuse started | That it was the right quality, or time to find it |
| `rate_review_requested` | `EstimatorClient` | Quality rate dialog opened | Rate review began | That rates were reviewed or changed |
| `current_rate_applied` (`rate_source`) | `EstimatorClient` (two sites) | Rates applied as saved or after a confirmed update | Which rates were applied | Rate correctness or freshness. An LT03 reconciled "matches" also emits this |
| `valid_result_reached` (`has_quantity`, `journey_source`) | `EstimatorClient` | First complete estimate per journey | An estimate was ready | That it was saved, used or accurate |
| `save_attempted` (`record_kind`, `is_new_version`) | `EstimatorClient` | Save sent | An attempt | Its outcome |
| `save_succeeded`, `new_version_created` | `EstimatorClient` | Confirmed save, once per request id per page | A confirmed costing save | A replay after reload may report again; no-change saves are not distinguished |
| `save_failed` | `EstimatorClient` (two sites) | Known rejection | A failed save | Cause |
| `save_outcome_unknown` | `EstimatorClient` | Save timed out or lost its answer | An uncertain save | How it was resolved; no event records resolution |
| `export_preview_opened`, `export_completed`, `export_failed` (`mode`) | `CostingExportDialog` | Preview, download/print/share handoff | A document was prepared or handed off | Delivery, receipt or buyer acceptance (share opened is not sent) |
| `draft_detected`, `draft_restored`, `draft_discarded` | `EstimatorClient` | Device draft found and chosen | Local recovery use | Cross-device recovery (not supported) |

Other names in the list (production, upgrade, overhead, rate book) are Base, billing or older events and are not part of the Lite repeat-costing journey.

## Gaps that would need D12 (not built)

- No event records an LT03 unresolved rate update or its reconciliation, an LT02 offline save that stayed on the page only, an export source (saved vs working inputs), a comparison opened, or a quality search with no match. Absence in the table is therefore not absence of the behavior.
- No retention or deletion policy for `plan_usage_events`, and it is not in the owner's archive.
- No storage dedupe; a report would need to collapse repeats by actor, event and time window and say so.
- Effective tier is not recorded, so retained-Lite cohorts cannot be separated.

Any addition keeps the existing rule: categories only, never names, rates, quote text, margins or money.

## Pilot protocol (prepared, not started)

Purpose: compare the same supported repeat-costing job done in Lite and in the owner's best current method, on equal inputs, over three occasions. Not a demand, accuracy or willingness-to-pay study.

**Start conditions (all required):** owner authorization for recruitment and any outreach (D13); the LT09 critical gates passed for the exact candidate in use; the participant's construction inside the supported scope (single weft until D01's fix ships; own-account yarn); written agreement on what evidence is kept.

**Cohort (purposive, small):** owners or costing staff who repeat costings for known qualities, including at least one strong spreadsheet user and one larger costing desk. Record for each: operator role, device, language, connection, current method, material ownership, constructions used. Occasional users who are well served by Free stay Free; record them as such rather than as failures.

**Three equivalent occasions:**

1. First familiar costing: a quality they already cost in their current method.
2. A later independent revision: a rate or specification change on that quality, without assistance.
3. A return to an earlier offer: retrieve and explain a previous version and produce the right document.

**Record per occasion:** start and end times split into setup/learning, lookup, entry, correction and export; assistance given and why; wrong quality chosen; scope predicted before saving (version only vs update quality) and what was saved; whether the reopened earlier version matched its original economics; document source named correctly; support minutes by cause (defect, training, consulting). Match assumptions with the participant's method before comparing time; record differences instead of forcing them.

**Set before observing results:** task-success and time targets per occasion (from the participant's own baseline, not a universal number), eligible denominators, observation window, support and cash budget, and the named stop authority. A correct result that is no better than a good workbook is a valid outcome and can narrow the segment.

**Evidence handling:** minimal and private. No customer names, yarn rates, quote text or margins in notes or telemetry; synthetic data until real artifacts are authorized; no case-study use without permission; no test files sent to real buyers.

**Value framing:** freed time is capacity unless a cash cost actually falls; avoided loss and added margin are not added together; published service-economics figures in the research are modeled inputs, not measured costs.
