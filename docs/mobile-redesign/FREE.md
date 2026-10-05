# Free mobile redesign

Only Free is authorized. Lite and Base each require a separate approval after the preceding phase checkpoint. Local implementation was authorized on 5 October 2026 after the requested cloud executor proved unavailable. No production data, migrations, merge, deployment, push, or PR publication is authorized.

## Evidence and baseline

Read the complete published [planning package](https://chatgpt.com/space/page_302f6325fecc8191bb735dddb2ccf45b) and all six children: [estimator](https://chatgpt.com/space/page_bbcdd06a7a888191bca522a83e5933e1), [navigation/costing](https://chatgpt.com/space/page_1564e74f3260819180c0050cc8475c0b), [operations](https://chatgpt.com/space/page_0dabc2ff834081919e8a78545fc70213), [account/support](https://chatgpt.com/space/page_e44f868bced48191814b0a66180986b4), [principles](https://chatgpt.com/space/page_80452de9771881918b02e53d84c50bad), and [delivery/validation](https://chatgpt.com/space/page_810022fe04d48191a209744ab7357d49). The original image was read through the estimator Page's `library-file:` reference and inspected; it shows Base, so its paid controls are not Free requirements.

Fetched `origin/main`: `cf00bf4616cfb8c2e128815eeb266d00b67d7ca1`, identical to the research baseline. The clean original local checkout was `36e6e4edac8de76052dc8247d99a74b90ef3772d`, 39 commits behind after fetch. Branch `codex/free-mobile-redesign` starts at `origin/main`, preserving merged Lite correctness, private support, and founder/auth work. Existing mobile PR #172 and Free recalculation, modal and saved-navigation changes are already integrated. No new redesign branch or uncommitted work was found in the exposed checkout/reference inventory; this does not establish the stopped cloud task's inaccessible state.

Repository instructions: `CLAUDE.md`, `.agents/rules/weavly-global-premium-design-principles.md`, `design.md`, current CI and test commands. `.agents/skills` is absent. Use isolated local synthetic fixtures and `scripts/performance/isolated-command.mjs`; ordinary development/build environment files target remote services.

## Tier allocation of M00–M08

| Workstream | Free now | Lite after approval | Base after separate approval |
| --- | --- | --- | --- |
| M00 Baseline | Free route/state inventory; paid/desktop control captures | Paid costing baseline | Operational/onboarding baseline |
| M01 Shell | Free direct destinations and necessary shared foundations | Lite shell | Base domain/section navigation |
| M02 Estimator | Metered inputs, results, receipts, corrections, upgrade retention | Live engine presentation, quality recall/version saves | Base-specific integrations |
| M03 Reuse/records | Existing Free saved snapshots and export | Paid Saved Costings, comparison, qualities, Rate Book | Operational record handoffs |
| M04 Production | Entitlement regression only | Deferred | Daily Sheet, assignments, machines |
| M05 Stock/dispatch | Entitlement regression only | Deferred | Fabric/yarn, audit, challans/print |
| M06 Workforce | Entitlement regression only | Deferred | Workers, payroll, settlements |
| M07 Supporting | Free account/billing, entry/recovery, upgrade, customer support; utility review | Paid defaults/settings/billing/archive | Six-stage Base onboarding and Base configuration |
| M08 Validation | Free flows plus paid/desktop regression; device QA recorded separately | Lite validation | Full operational validation |

## Reachable-route inventory

[FREE-routes.json](FREE-routes.json) lists all 67 current UI page entrypoints individually. They are grouped below, including grouped owner/admin destinations. API and auth callback/signout endpoints retain their existing contracts; they are not new screen designs.

| Route | Free disposition |
| --- | --- |
| `/free`, `/free?costing=<id>` | Mobile task hierarchy, optional Help, allowance/action area, result and correction states |
| `/free/costings`, `/free/costings?costing=<id>` | Search, existing filters, saved cards, detail/export and correction access |
| `/free/account` | Personal/factory/security/device display and existing deletion review; no paid defaults or payroll |
| `/free/billing` | Free plan/access/allowance, comparison, payment receipts/history |
| `/free/settings` | Compatibility redirect to account |
| `/plans` | Free upgrade comparison/return; preserve payment reconciliation and all terms |
| `/login`, `/signup` (Free/default), `/forgot-password`, `/reset-password`, `/verify` | Free mobile entry/recovery and accessible controls |
| `/auth/confirm`, `/auth/auth-code-error` | Entry/recovery regression; preserve security behavior |
| `/onboarding`, `/onboarding/plans` | Redirect continuity; no Free setup wizard |
| `/support`, `/support/[id]` | Free customer presentation/fallbacks; keep requester-private access/send state |
| `/install`, `/offline`, `/locked` | Supporting review/regression; retain honest online requirement, original-route retry and restricted-access state |
| `/privacy`, `/terms`, `/refund-policy`, `/privacy-request`, `/security-incident` | Supporting reflow/access review; preserve full policy, versions, material terms and mailto truth |
| `/owner/estimator`, `/owner/quotes`, `/owner/settings`, `/owner/billing` | Free redirect and paid/desktop regression; paid-specific redesign deferred |
| `/owner/data-export`, `/owner/settings/audit`, `/owner/settings/dpa` | Paid/history-specific redesign deferred; preserve expired paid archive access. Pure Free has no `account_data` entitlement |
| `/onboarding/base`, `/owner/rates` | Paid-specific redesign deferred |
| `/owner/production`, `/owner/production/daily-sheet`, `/owner/assignments`, `/owner/machines`, `/owner/workers`, `/owner/payroll` | Base redesign deferred; entitlement regression only |
| `/owner/stock`, `/owner/stock/yarn`, `/owner/stock/audit`, `/owner/dispatches`, `/owner/dispatches/[id]/print` | Base redesign deferred; entitlement regression only |
| `/owner/operations`, `/owner/setup` | Existing paid compatibility redirects; deferred |
| `/feature-archived` | Safe fallback review |
| `/track/[token]` | Intentionally unavailable; no restoration |
| `/`, `/admin/**` | Explicitly outside scope |
| `/help`, `/free/estimator` | No existing page routes; do not invent capabilities |

## Behavior boundaries

Free has estimator, account settings, saved costings and document export only. Calculate and save consumes allowance; eligible Recalculate and save updates the same saved entry within its original 30-minute window without another allowance debit, including at zero remaining allowance. Paid calculations stay live. Preserve signed request binding, synchronous duplicate lock, exact uncertain retry, warning acknowledgement, server time/revision identity, released-attempt reconciliation, confirmed receipt even when balance refresh fails, and all leave/update guards.

Free and its mounted in-place upgraded session have no durable local draft recovery. No persistence or background mutation replay is added. Invalid fields, units, unsaved/stale status, monetary consequences and uncertain outcomes stay discoverable in their action context. Reuse the current visual viewport, input accessory, safe areas and measured bottom navigation.

`lib/billing-document-policy.ts` explicitly decides payment receipt PDF only and no GST tax invoices during the paid pilot. Fix contradictory promise using that shared policy; do not change policy, price or tax arithmetic.

## Verification ledger

Free is implemented in local commit `c40c92ebf19bb63f749181eba74ad7d73ab9e8bb`, with final accessibility corrections in `34ab189d5ac6e83e7087d71156d3d005a33f07cd` and `3d3831c6a08bfafac104b48cbb29b813f8bf7ba2`, on `codex/free-mobile-redesign`. [FREE-validation.md](FREE-validation.md) records final aggregate results, fresh review, screenshots, interrupted runs, limitations and the proposed Lite scope. [FREE-supporting.md](FREE-supporting.md) records the account/billing/support slice in detail.

Final type checking, zero-warning lint, production build, all 324 unit/integration test files (2968 passed, one existing skipped test), and all 32 disposable database files (273 passed) exited 0. The database runner emitted a worker teardown timeout warning after successful assertions; the final standard command exited 0, as did the earlier standard and bounded-worker checks at the initial redesign commit. No task-owned database/server process remains running.

The final estimator/shell/history browser run covers 19 groups against the committed app source. Entry checks passed 31 records plus four paid-signup presentation checks; supporting interrupted flows and 12 support/founder regression tests passed. Stronger computed-text checks passed 24 estimator, 12 history, 12 entry and 15 supporting cases, including direct text bounds, unit/value clearance and 44-pixel touch controls. Seven read-only public utility routes also passed against the local Next production build. Synthetic component emulation, actual local build checks and disposable database tests are distinguished from installed iOS/Android PWA and live-provider verification.

No unresolved product defect was found in the completed checks. Installed-device keyboard/safe-area/accessibility/lifecycle QA, live auth/provider outcomes and native-speaker copy review remain unrun. Full policy text and original offline/privacy behavior are preserved. No Lite/Base-specific redesign, durable draft recovery, production mutation, publication or deployment has been performed.

## Approval checkpoint

Free implementation and verification are complete for review, with the remaining device/provider QA explicitly listed. Stop here. Lite may begin only after the user's explicit approval; Base requires its own later checkpoint. The proposed Lite scope is an outline, not authorization or an implemented paid redesign.
