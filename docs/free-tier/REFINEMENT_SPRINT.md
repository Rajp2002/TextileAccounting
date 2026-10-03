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
