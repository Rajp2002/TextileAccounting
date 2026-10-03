# Lite refinement sprint: verification record

Sprint package: `Weavly_Lite_Tier_Refinement_Sprint_2026-10-03` (LT00 to LT09, decisions D01 to D16). The package checksums (`SHA256SUMS.txt`) verified on 2026-10-04 before work started. One section per ticket: what changed, the fixtures, commands, results and limits. Nothing here is runtime proof unless a section says so. "Source checks passed, runtime pending" means exactly that.

All commands ran from the worktree through `scripts/performance/isolated-command.mjs`, which blanks `.env*` values and service credentials and points Supabase at a closed loopback port. No QA or production project was contacted, and no account, payment, costing or customer record was created or changed.

## LT00: pin facts, inventory and reproduce

**Status:** complete for repository facts and source reproductions. Target evidence (deployed revision behavior, applied migrations, live flags) is **blocked**: there is no authorized read-only target access in this session, and the QA Supabase host no longer resolves, so signed-in journeys need a deployed candidate.

### Revisions

| Fact | Value | Evidence |
| --- | --- | --- |
| Plan pin | `ff7387dede0a3cf849e90b82b3a4a404c46f4bd8` | sprint package |
| Candidate base | `9da43984` (`origin/main`, merge of PR #181, 2026-10-04) | `git log -1 origin/main` |
| Delta since pin | The Free refinement sprint only (FR00 to FR07): 36 files, mostly `components/estimator/Free*`, `hooks/use-free-*`, `lib/free-*`, `SubscribeButton`, 89 lines in `EstimatorClient.tsx`, and migration `20261004090000_free_monthly_period_end_local_month.sql` | `git diff --stat ff7387de origin/main` |
| Delta touches Lite seams | Only `EstimatorClient.tsx` (Free leave guard, recovery, receipt). The Lite seams the plan pins (yarn suggestions, save payload, reopen inference, autosave hook, Saved Costings summary, export, data export) are unchanged | same diff |

### Shared Free work (from `docs/free-tier/REFINEMENT_SPRINT.md`)

| Ticket | State on `9da43984` | What Lite reuses |
| --- | --- | --- |
| FR01 warning review / original-request recovery | source checks passed, runtime pending | unknown Free attempts are held, never blindly retried |
| FR02 saved result vs balance freshness | source checks passed, runtime pending | a paid result without a saved id is not a Free save |
| FR03 active upgrade containment | source checks passed, runtime pending; **paid autosave stays off inside the Free wrapper after activation** (disclosed scope cut); Back/Forward not guarded | LT02 keeps that boundary and fixes what the paid save path claims about drafts |
| FR04 honest example and first use | source checks passed | shared truthful-copy approach |
| FR05 India-time `period_end` | applied to production 2026-10-04 at the owner's request | not touched by Lite |
| FR06 measurement inventory | `docs/free-tier/MEASUREMENT_INVENTORY.md` | LT08 builds on it |
| FR07 integrated proof | not releasable yet (runtime evidence missing) | same proof conventions |

### Decisions that already have an owner record

- **D01 multi-weft semantics.** The plan treats this as conflicting provenance. The repository resolves the meaning: `docs/maintenance/weavly-refactor/EVIDENCE.md` E15 records the owner's 2026-09-26 decision that each weft row holds that yarn's own picks (34 + 34 for a 68-pick, two-yarn fabric) and that the weft 100/N length split is the defect (CS-1). The same record says the fix needs its own approved package (new calculation version, Base yarn recipes, payroll review), and `STATUS.md` lists CS-1 as "the owner is verifying". **Disposition: arithmetic unchanged in this sprint; no multi-weft accuracy claim; no formula, version or snapshot change.** Single-weft fixtures are the supported basis.
- **D10 exact quotation-document history.** Declined: the owner retired quotations, party orders and market runs by design on 2026-09-27 (production goes to inventory, then dispatch). The customer quotation PDF remains a document export; no quotation entity is added.

### Rulings for this sprint

| Id | Ruling | Cost if wrong |
| --- | --- | --- |
| R1 | Build on `9da43984`; reuse FR01 to FR03 rather than rebuilding them | none expected; the Lite seams did not move |
| R2 | D01 held as above | a multi-weft costing stays on the current (owner-acknowledged) arithmetic until the owner's fix package |
| R3 | D10 declined | a later need for document history becomes a new decision |
| R4 | LT02 keeps paid autosave off inside the Free wrapper and fixes truthfulness only | an activated Free owner still has to press Save; the copy says so |
| R5 | Browser, rendered PDF, phone/zoom/screen-reader and target-database proof recorded as not run | release stays blocked on those gates, as it is for the Free sprint |
| R6 | Yarn names: `40 Ne`, `40s`, `40's` are cotton count (Ne); `75D`, `75 den`, `75 denier` are denier; `X/Y` with both parts at least 10 (for example `80/72`) is denier/filament; every other fraction (`2/40`, `30/1`, `40/2`) and every bare number is unresolved and needs the owner to enter the density | a yarn named in an unlisted convention asks for density instead of filling it |
| R7 | LT01B adds nullable columns through a new migration; the save action falls back to the legacy payload only when the database rejects the new keys before any write, so code that reaches production before the migration keeps saving | without the migration, new saves keep today's behavior (basis not preserved) |
| R8 | The "Review N rates used here" flow is deferred: estimator rows carry no Rate Book identity, and adding one crosses `EstimateState`, the strict Free request schema and saved-row normalizers (D16-adjacent). LT03 ships unknown-outcome containment and Rate Book ids on suggestions | owners still review rates from the rate dialog or Rates page |

### Baseline checks on `9da43984`

| Command | Result |
| --- | --- |
| `node scripts/performance/isolated-command.mjs npx vitest run` | 278 files, 2472 passed, 1 skipped (the gated live Supabase test) |
| `node scripts/performance/isolated-command.mjs npm run test:db` | 16 files, 106 passed (PostgreSQL 17.11, Homebrew) |
| `node scripts/performance/isolated-command.mjs node node_modules/typescript/bin/tsc --noEmit --incremental false` | pass |
| `node scripts/performance/isolated-command.mjs npm run lint` | pass, 0 warnings |

### Source reproductions

Each one is confirmed by reading current source; the ticket sections below add the failing test that proves it before the fix.

| Finding | Where | Observed |
| --- | --- | --- |
| LC08 untyped yarn density | `lib/estimator-yarn-suggestions.ts` `extractDenierFromName`; reducer `SELECT_WARP_YARN`/`SELECT_WEFT_YARN` | "40s Cotton", "60 Ne" and "2/40" all return a bare 40/60 that a Rate Book suggestion carries as denier. Selection keeps the row's old unit and count, and a suggestion with no density keeps the previous yarn's density |
| LC74 / CS-2 saved input basis | `lib/estimator-quote-payload.ts` | No `warping_mode` or `overhead_mode` is written, and `overhead_override_per_m` is written only in direct mode although the engine applies a non-null override in monthly mode too. `estimator_quotes` has no mode columns; reopen infers modes from what remains |
| LC29 no-op draft write reports stored | `hooks/useAutosave.ts` `saveDraftNow` returns `true` when autosave is disabled; `EstimatorClient` offline save then says "Your Cost Estimate and save identity are stored on this device." | true for the Free wrapper after activation (`disableAutosave`) |
| LC26 rate update outcome | `EstimatorClient` `handleSaveRatesAndApply` | an exception shows a toast; the request has no timeout and no reconciliation |
| LC71 recipe-only money | `quotes/page.tsx` passes summary-only templates (`id,name,updated_at,is_active`) and no profile; `QuotesClient` computes "Current recipe" money from default rows | a fabricated per-metre value for a quality with no saved costing |
| LC73 retrieval | `quotes/page.tsx` maps query errors to empty lists; `getEstimatorQuotes` has no paging (PostgREST caps rows per request) | failure looks like an empty library; large libraries can be cut silently |
| LC13 overstated labels | `EstimatorClient` ("Actual margin" twice, "Costing valid"), `QuotesClient` comparison, internal PDF in `lib/estimator-export.ts` | labels present |
| LC49 archive completeness | `app/(dashboard)/owner/settings/data-export.ts` | each dataset is one unpaged `select('*')`; `free_saved_costings` is not in the catalog; query errors already fail closed |
