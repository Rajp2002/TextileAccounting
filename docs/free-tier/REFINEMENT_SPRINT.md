# Free refinement sprint: verification record

Sprint package: `Weavly_Free_Tier_Refinement_Sprint_2026-10-03` (main sprint, FR00 to FR07). One section per ticket: candidate, fixtures, commands, observed results, limits and whether dependent work may proceed. Nothing here is runtime proof unless a section says so explicitly. "Source checks passed, runtime pending" means exactly that.

All commands were run from the worktree through `scripts/performance/isolated-command.mjs`, which blanks `.env*` values and service credentials and points Supabase at a closed loopback port. No QA or production project was contacted, and no account, payment or customer record was created or changed.

## FR00: pin facts and reproduce

**Status:** complete for repository facts and isolated reproductions. Target database evidence is **blocked** (no authorized read-only target access in this session).

### Revisions

| Fact | Value | Evidence |
| --- | --- | --- |
| Sprint baseline | `faaf54048c157cc24ee1b3ca2c5ce2a9541361f7` | sprint package |
| Candidate base | `ff7387dede0a3cf849e90b82b3a4a404c46f4bd8` (`origin/main`, 2026-10-03) | `git rev-parse origin/main` |
| Delta since baseline | PR #180 only: `app/(dashboard)/owner/settings/page.tsx`, `__tests__/settings-payroll-query-gating.test.ts` | `git diff --stat faaf540 origin/main` |
| Delta touches Free seams | No. PR #180 is the separate Settings gate; it stays outside this sprint and is checked only as an adjacent regression | same diff |
| Deployed production revision | `ff7387de`, Vercel "Deployment has completed", 2026-10-03T12:00:45Z | `gh api repos/Rajp2002/TextileAccounting/commits/ff7387de/status` and `/deployments` |

The deployed revision comes from the GitHub deployment record Vercel writes. It does not show applied migrations, live flags or a working journey.

### Target configuration (blocked)

Not read in this session, because no read-only production access was authorized: the applied `commit_free_calculation` definition, `free_quota_policies` pointer and row policy versions, `free_rollout` flags, signing-key availability, `weavly-free-retention` job state and `analytics_eligible` admission. Earlier owner notes say the monthly allowance migration and `20260928160000_free_enrollment_default_on.sql` were applied and the signing keyring was set (2026-09-26/28). Those notes are history, not current evidence. **Runtime release is blocked until an authorized operator records these reads.**

### Baseline checks

| Command | Result |
| --- | --- |
| `node scripts/performance/isolated-command.mjs npx vitest run __tests__/free-* __tests__/standalone-plan-chooser.test.ts __tests__/motion-polish.test.ts` | 12 files, 147 passed |
| `node scripts/performance/isolated-command.mjs npx vitest run` | 271 files, 2394 passed, 1 skipped (the gated live Supabase test) |

### Isolated reproductions

Each reproduction mounts the real hook or provider in node with the minimal host element used by `__tests__/autosave-status.test.tsx`, with fake `fetch` replies or a failing lazy import. They are written as the regression tests the fixes must turn green.

| Fixture | Test | Expected | Observed on `ff7387de` |
| --- | --- | --- | --- |
| F01 initial warning | `__tests__/free-transaction-flow.test.tsx` "lets the owner either correct the inputs or explicitly confirm them" | After a non-debited warning the editor is unlocked and the card offers Correct and "I reviewed the inputs; calculate" | **Fails**: `meter.pending` stays `true`, so `FreeTransactionRecovery` renders only "Retry the same calculation", which resends `warningsAcknowledged:false` and gets the same warning; the fieldset stays `inert` |
| F04 save then status failure | same file, "keeps the saved result confirmed" | Saved result confirmed, transaction error empty, only the balance unverified | **Fails**: the post-save status error is stored as the submit error, so the card shows "Unable to confirm the outcome" for a saved costing |
| F13 sample engine fails | `__tests__/landing-sample-engine-state.test.tsx` | Changed controls never show the starting money; engine state is reported | **Fails**: with the engine import rejected, `result` is the server-rendered starting result for changed inputs |
| F12 active plan navigation (source) | `grep -n "/plans?from" components/estimator app/free` | In-place comparison from the mounted estimator | Five hard links leave the mounted page: `FreeUsageCard.tsx:229,263`, `FreeTransactionRecovery.tsx:128`, `UpgradeBenefitsPreview.tsx:52`, `FreeBillingClient.tsx:107` |

Also traced in source and confirmed:

- `EstimatorClient` passes input staleness (`freeMeter.stale`) into `FreeUsageCard`, whose badge reads "Last confirmed" with the tooltip "Offline · showing cached allowance".
- `commit_free_calculation` (`20260912130854_free_monthly_allowance.sql`) runs with `SET timezone = 'UTC'` and stores `period_end = v_start + interval '1 month'`, so March 2026 ends at 28 Mar 18:30 UTC instead of 31 Mar 18:30 UTC. `freeQuotaWindow` in `lib/free-tier-policy.ts` computes the correct end independently.
- The Free branch of `handleSaveQuote` calls `freeMeter.submit` before any local validation or warning review.

**Dependent work may proceed** in isolation. Release stays blocked on the target reads above.

## Environment for FR01 to FR07

macOS, Node 24.11.1, npm 11.6.2, PostgreSQL 17.11 (Homebrew) for `npm run test:db`. CI uses PostgreSQL 16. Every command ran through `scripts/performance/isolated-command.mjs`. Candidate: branch `claude/free-tier-sprint-plan-1dcd08`, code head `5bcabb32` on top of `ff7387de`.

| Check on `5bcabb32` | Result |
| --- | --- |
| `node scripts/performance/isolated-command.mjs node node_modules/typescript/bin/tsc --noEmit --incremental false` | pass |
| `node scripts/performance/isolated-command.mjs npm run lint` | pass, 0 warnings |
| `node scripts/performance/isolated-command.mjs npx vitest run` | 278 files, 2472 passed, 1 skipped (gated live test) |
| `node scripts/performance/isolated-command.mjs npm run test:db` | 16 files, 106 passed |
| `npm run build` | **not run** (see FR07) |

## FR01: warning review and original-request recovery

**Status:** source checks passed, runtime pending.

- Phases live in `lib/free-transaction.ts`: editing, submitting, review (known, not debited), unknown (may have committed), rejected. `hooks/use-free-meter.tsx` drives them; `FreeTransactionRecovery` renders one card per phase.
- Review offers "Change the inputs" (reveals and focuses the flagged field) or "I reviewed the inputs; calculate", which resends the same payload and token with the acknowledgement. Editing the reviewed values voids the review.
- An uncertain send keeps payload, token and acknowledgement. Retry resends exactly that. A later rejection never resolves it; once replay cannot answer (expired, conflict, access, paid), the owner gets saved history in a new tab and an explicit "Edit inputs again".
- The service adds an `outcome` discriminant. Warnings still carry field names only; the card shows the shared validator's own message for each.
- A status read for a different owner clears the previous owner's result and attempt; a delayed response for the old owner is ignored.

| Fixture | Test | Result |
| --- | --- | --- |
| F01 | `free-transaction-flow.test.tsx` F01 (3 tests), `free-transaction.test.ts`, `free-usage-counter.test.ts` TR-02/TR-05 | pass; failed on `ff7387de` |
| F02 | flow F02 (lost acknowledged response replays the identical body; rapid double press sends once) | pass |
| F03 | flow F03 (late `FREE_REQUEST_EXPIRED` keeps identity, no retry, explicit release) | pass |
| F10 | `free-transaction.test.ts` classification and transitions | pass, unit level |
| F14 | flow F14 (owner switch; delayed response after switch, mutation-checked) | pass, hook level |

Limits: pending identity is page memory. Reload or a closed tab loses it; the leave guard (FR03) asks first. No receipt lookup endpoint was added.

## FR02: field recovery and independent result and balance

**Status:** source checks passed, runtime pending.

- The Free save runs `freePreflight` on the current inputs: invalid fields are revealed and focused with no request; local warnings use the existing review dialog and then send the acknowledgement.
- A confirmed save shows `FreeSavedReceipt`: label, local confirmation time (the response has no saved-at), "1 costing used" or "Already saved. No additional costing was used." on replay, and a link to saved history. The receipt balance never replaces the current status.
- The usage card's badge now means only a failed refresh. If no read has succeeded since a save, it says "Balance could not be refreshed" with no number. Only the newest read applies, and a save retires reads issued before it.
- Edited inputs label the money "Last saved result", name the changed input groups and say a rerun uses one costing.
- At zero, the card links to saved costings and PDFs. The estimator note states the monthly policy.

| Fixture | Test | Result |
| --- | --- | --- |
| F04 | flow F04 (save then failed refresh; late older read; read started before a save; old-month replay) | pass; save-then-failure failed on `ff7387de` |
| F05 | `free-transaction.test.ts` freePreflight; `free-usage-counter.test.ts` IN-01 (source contract) | pass; mounted EstimatorClient not exercised |
| F11 | card UI-03b | pass, component level; history and PDFs at zero not browser-checked |

## FR03: active upgrade containment

**Status:** source checks passed, runtime pending. This is the guarded-fallback scope, not full checkout continuity.

- Plan actions on the usage card and quota recovery open `UpgradeBenefitsPreview` in place.
- `SubscribeButton` has an opt-in `deferRefresh`, used only by that preview, so activation no longer re-runs the Free layout's paid redirect. Access is verified by the Free status read, which switches to the paid estimator in the same mounted page.
- Verified paid access is held while a Free attempt is unresolved; the attempt becomes uncheckable and the switch happens on explicit release.
- While a request is unconfirmed or inputs differ from the last save, in-app links and reloads ask first (`useFreeLeaveGuard`, `FreeLeaveDialog`), in Free and in the paid estimator it becomes. New-tab links pass through.

| Fixture | Test | Result |
| --- | --- | --- |
| F06 | flow F06 (hold, then release activates) | pass, hook level |
| F12 | `free-leave-guard.test.ts`, `free-leave-guard-hook.test.tsx`, `free-upgrade-handoff.test.ts` (source contracts) | pass; no real checkout |

Limits, all disclosed: paid autosave stays disabled inside the Free wrapper after activation, so an activated owner must press Save (existing copy says so). Browser Back and Forward are not intercepted. Not exercised: real Razorpay checkout, delayed activation in another tab, layout remount and refresh.

## FR04: honest example and first use

**Status:** source checks passed, runtime pending.

- The landing example tracks its lazy engine and never shows starting money as the result of changed controls: figures are dimmed and labelled "Example baseline", with a retry on failure. The cost-stack ledger shows no figures in that state. Copy says the rates are illustrative and the example uses none of the visitor's Free costings.
- Signup no longer claims "Your account was not created" after a network failure; Free signup says "Create Free account".
- Saved history labels the demonstration "Example, not one of your saved costings", hides it instead of deleting, and can show it again. The preference stays browser-wide.

| Fixture | Test | Result |
| --- | --- | --- |
| F13 | `landing-sample-engine-state.test.tsx` (failed import, reset, retry, display rule) | pass; failed on `ff7387de` |
| First use | `free-first-use.test.ts`, `public-page-i18n.test.ts` | pass |

Limits: the example fixture is not domain-reviewed (D02), so no reference or accuracy claim is made. Comprehension needs the R01 usability round.

## FR05: India-time period_end

**Status:** prepared and proven in a disposable database. **Not applied anywhere.** Production application and backfill is a separate approved step: see `FR05_PERIOD_END_RUNBOOK.md`.

| Fixture | Test | Result |
| --- | --- | --- |
| F08 | `__tests__/db/free-monthly-period-end.dbtest.ts` (12 months, leap year, December to January, IST midnight, four session zones, new debit, backfill on zero/one/full rows, weekly and anomalous rows untouched, receipts and snapshots unchanged, idempotent) | 9 passed; a new October debit stored `2026-10-30T18:30Z` before the migration; backfill test fails without the `UPDATE` |
| F09 | Replay keeps the receipt's original row (unchanged SQL); flow test shows a replayed old-month receipt never becomes the current balance | partial: month-crossing replay was not driven in SQL because the debit uses `now()` |

## FR06: existing measurement

**Status:** inventory and reconciliation done; no new collection. See `MEASUREMENT_INVENTORY.md`.

| Fixture | Test | Result |
| --- | --- | --- |
| F15 | `__tests__/db/free-measurement-reconciliation.dbtest.ts`; flow F15 | pass (characterization) |

## FR07: integrated proof and release decision

**Release decision: not releasable yet.** Source checks pass. Runtime proof and the target evidence are missing.

| Required evidence | State |
| --- | --- |
| Target reads (FR00): applied function, policy, flags, signing key, retention job, cohort admission | blocked, no authorized access |
| Browser traces: active upgrade, unknown recovery, account switch, sample failure | not run. QA Supabase does not resolve, so signed-in flows need a deployed candidate |
| Actual internal and customer PDFs at zero allowance, EN/HI/GU | not run |
| Phone widths, 200% zoom, screen reader, keyboard | not run |
| F07 concurrent final-credit race on separate connections | not run in this sprint; existing `free-debit.dbtest.ts` covers sequential replay and exhaustion only |
| `npm run build` (router, lazy import and generated types) | not run |
| Domain sign-off on supported single-weft cases (D02) | not started |
| FR05 application to the approved target | not approved |
| Native GU/HI review of new strings | not done (the dictionary header calls it a release gate) |

Residual risks to accept or hold: D01 canonical overbinding (unchanged), D02 domain scope (multi-weft untouched), D03 mounted-only continuity (no persistence, Back unguarded, paid autosave off in the wrapper), D06 collection (none added; `upgrade_started` entry point misattributed).
