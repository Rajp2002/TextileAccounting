# GT-00 — Validate the baseline, assumptions and harness

## Task ID and purpose

GT-00. Prove that the repository still matches what the plan was written against, that the checks run, and that the browser harness works, before any code changes. Nothing is modified except harness files in `scratch/` and the status ledger.

## Dependencies and entry conditions

- None. First task.
- The owner has explicitly started an execution session (the planning session does not authorize implementation).

## Read first

1. `CLAUDE.md` (environments, commands, data safety).
2. `docs/GUIDED_TOURS_REFINEMENT_PLAN.md` §0, §1, §10.
3. `docs/guided-tours/EXECUTION_STATUS.md`.
4. `docs/guided-tours/harness/README.md`.

## Allowed change surface

- `scratch/tour-harness/**` (git-ignored).
- `docs/guided-tours/EXECUTION_STATUS.md` (GT-00 row and ledger entry).

## Protected surface

Everything else. No application, test, dependency, lockfile, config or instruction-file changes. Do not run `npm run build`, `npm start`, `npm run dev`, `supabase *` or any `scripts/*` that touches Supabase.

## Required implementation

1. Record `git rev-parse --abbrev-ref HEAD`, `git rev-parse HEAD` and `git status --short`. Uncommitted changes that are not this package's `docs/` files belong to someone else: leave them untouched and list them in the ledger.
2. Drift check against the planning revision `f7cff98`:
   ```bash
   git diff --stat f7cff98 -- components/tours components/estimator/CostEstimateTutorial.tsx components/estimator/SavedCostingsTutorial.tsx components/rates/RateBookTutorial.tsx components/production components/stock components/dispatches components/payroll hooks/use-guided-tour.ts hooks/use-mobile-tour.ts hooks/use-tour-invitation.ts lib/tours lib/*-tour.ts lib/i18n/*tutorial*.ts lib/i18n/tour-invitations.ts lib/mobile-tour-positioning.ts lib/tutorial-target.ts lib/tutorial-viewport-lock.ts app/actions/tour-preferences.ts app/globals.css
   ```
   If this shows changes, list the files in the ledger. Changes to tour files, or to lines cited by a packet, are **drift**: escalate (Failure conditions) before GT-01.
3. Dependencies: if `node_modules` is missing, run `npm ci`; if npm rejects the lockfile (npm older than 11), run `npx -y npm@11.6.2 ci`. Confirm `git status --short package-lock.json` is empty afterwards.
4. Run and record (plan §10.2): type check, lint, full Vitest, and the tour subset command. Compare with plan §1.2. Different totals with no failures are fine if `main` moved; record them as the new baseline. Any failure: record it with output and treat it as a baseline failure only if it also fails on an untouched checkout of the same revision.
5. Harness: copy `docs/guided-tours/harness/` to `scratch/tour-harness/`, start Vite, run `./batch.sh` and `python3 summarize.py`. Save the summary as `scratch/tour-harness/baseline-summary.txt` and paste it into the ledger. This is the "before" evidence every later task compares against.

## Locked decisions

- The baseline is what the checks produce now; a new failure found later cannot be called "pre-existing" unless it appears in this ledger entry.
- Harness evidence is labeled "OBSERVED (harness)"; it does not replace the owner's QA run.

## Permitted local discretion

- Background the Vite server however you prefer.
- If Playwright or Chromium live elsewhere, set `PLAYWRIGHT_ROOT` / `CHROMIUM_PATH` (harness README).

## Verification

The commands above, all exit codes recorded; the harness summary lists every scenario in `main.tsx`.

## Definition of done

- [ ] Branch, revision, worktree state and drift check recorded.
- [ ] tsc, lint, full Vitest and tour-subset results recorded.
- [ ] Harness batch ran; `baseline-summary.txt` saved and pasted into the ledger.
- [ ] No tracked file changed except `EXECUTION_STATUS.md`.

## Failure and escalation conditions

- Drift in tour files or cited lines → stop; write an escalation packet (EXECUTOR_PROMPT §6) listing the changed files and which packets they affect.
- tsc, lint or tests fail on the untouched checkout → record as baseline failures; continue only if none of them is in a file a later packet changes; otherwise escalate.
- Harness cannot run (no Playwright/Chromium) → mark harness checks UNVERIFIED for the whole program and escalate; the owner decides whether to proceed with owner QA runs only.

## Checkpoint

Set GT-00 to PASSED with the evidence above. Next eligible task: **GT-01**.
