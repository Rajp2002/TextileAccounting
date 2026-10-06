# Lite mobile redesign

The user approved publishing/merging Free and starting Lite on 6 October 2026. Free [PR #189](https://github.com/Rajp2002/TextileAccounting/pull/189) merged as `34f37ce223ecd321c1c046901384175ca118b04a`, after GitHub Types/tests/lint, disposable database CI and Vercel preview checks passed. Branch `codex/lite-mobile-redesign` starts at that merged main. Its app tree matches the completed Free checkpoint. Base is not authorized. Lite changes will remain local for its own review checkpoint; the publication request applied to the completed Free phase.

## Research and scope

All seven authoritative published pages and original estimator image were read in Free. The planning, estimator, navigation/costing, supporting and validation pages were read again for Lite; complete published Markdown is retained in session-local `/tmp/weavly-lite-research/` for implementation/review, with original Page URLs in [FREE.md](FREE.md). Review corrections take precedence over scratch work.

M00–M03 and M07–M08 now cover Lite: its direct Estimate/Saved/Rates bottom navigation, live estimator and entitled qualities, immutable saved costing/version comparison/export, Rate Book, Lite settings/billing/audit/export/support and expiry/archive access. Necessary shared foundations are allowed only with Free/Base/desktop regression. M04–M06 and Base-specific navigation/six-stage onboarding remain deferred. Marketing and privileged founder admin remain excluded.

## Route inventory

| Route | Lite disposition |
| --- | --- |
| `/owner/estimator` and recipe/saved-version query inputs | Compact title/Help, Quick–Detailed, entitled Saved qualities, loaded/version identity, inputs and measured live review action; preserve paid local drafts/save/reconciliation |
| `/owner/quotes` | Search/records first, filters/selection/comparison, version details, archive and export source |
| `/owner/rates` | Search/rates and due-review task first; preserve edit/proposal/conflict/source/history/bulk review |
| `/owner/settings` | Lite personal/factory/defaults/security/device/data summaries with mounted editors and consequential feedback |
| `/owner/billing`, paid-origin `/plans` | Payment attention, plan/expiry/manual renewal/receipt; retain all prices/terms/recovery/provider behavior |
| `/owner/settings/audit`, `/owner/data-export`, `/owner/settings/dpa` | Audit/export mobile review; DPA redirect retained; preserve paid archive access and generation/download truth |
| `/support`, `/support/[id]` | Verified-Lite customer compact presentation; requester privacy and original send/retry truth |
| `/login`, `/signup`, recovery/auth routes, `/install`, `/offline`, policy/contact routes | Existing Free-phase shared entry/public presentation and safeguards retained; regression only unless needed for Lite |
| `/free/**` | Free phase regression, including metered save/correction/upgrade retention; no paid controls in Free |
| Base production/stock/workforce/onboarding and domain section navigation | Deferred to separately approved Base phase |
| `/`, `/admin/**` | Excluded |

[FREE-routes.json](FREE-routes.json) retains all 67 UI entrypoints; no routes or entitlements are added.

## Boundaries and validation plan

Presentation is explicitly Lite-scoped and mobile-only. Desktop and Base layouts keep their existing composition. Paid updates stay live; no Free Calculate sequence is imposed. Reuse real component/state trees and existing safe-area, visual viewport, native mobile inputs and keyboard accessory. Measure action clearance rather than introduce a competing fixed offset. Preserve units, required errors, unusual-value acknowledgement, saved/version/recipe identity, working versus immutable export source, original request IDs/payloads, uncertain mutation editing locks and paid org+user draft recovery. Mounted Free upgrades continue memory-only with autosave disabled.

Baseline/after component captures will use synthetic localhost transport, no remote auth/provider/data writes. Test320/390/430/1440, landscape where practical, EN/HI/GU computed-text200%, direct bounds/units/native input clearance and44px targets. Cover loaded/dirty qualities, cancel/replace/undo, mode switch, invalid/warning/repeated/version save, uncertainty/exact retry, draft restore/storage failures, Back/Forward/dismissal/focus and keyboard emulation. Records/supporting suites own their corresponding interrupted states. Final required type/lint/unit/disposableDB/build aggregates run on isolated final source, followed by fresh review and paid/Free/desktop controls. Installed iOS/Android PWA/provider/native-speaker checks are labeled separately and never inferred from Chromium fixtures.

No production migrations, direct deployment or live data changes. At Lite completion, return implementation/routes/commits/screenshots/results/issues/proposed Base scope, then stop for explicit Base approval.

## Completed checkpoint

Lite implementation and final verification are complete. [LITE-validation.md](LITE-validation.md) records the final aggregates, independent reviews, browser limits, before/after screenshots and remaining QA. [LITE-records.md](LITE-records.md) and [LITE-supporting.md](LITE-supporting.md) detail their route/state coverage. Application commits are `d3423013` and `edc8571e`; `4201e9be` strengthens retained desktop, sample-data and verified-tier contract tests. Lite remains local.

The proposed Base phase covers compact Base navigation/costing and entitled records, M04 production/Daily Sheet/assignments, M05 stock/dispatch, M06 workforce/payroll and M07 six-stage onboarding/Base supporting flows, with M00/M08 baselines and validation throughout. No Base implementation starts without the user's next approval.
