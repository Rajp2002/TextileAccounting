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

## LT01A: typed yarn density

**Status:** source checks passed, runtime pending.

- `parseYarnDensityFromName` returns a density only with its unit (R6). Rate Book suggestions carry that typed density or none. A saved quality's row keeps the density it was saved with, in its own unit; a Rate Book entry with the same name never overrides it.
- Choosing a yarn goes through `applyYarnSuggestionToRow`: a Ne suggestion sets the row to Ne with the exact count (40 Ne = 132.875 D effective); a denier suggestion sets denier and clears any old count; no density clears the row's density, so the empty "Denier — REQUIRED" field asks for it and the previous yarn's value cannot satisfy readiness. Rate, picks, ends, width, waste and GST are untouched.
- The suggestion chip shows the count for Ne yarns ("40 Ne · 132.88 D").
- No calculation, wire-format or stored-shape change: suggestions are transient, and the strict Free request schema already accepts both units.

| Fixture | Test | Result |
| --- | --- | --- |
| 40 Ne, 40s Cotton, 30's, 60Ne → Ne | `__tests__/lite-yarn-density.test.ts` | pass; the old parser returned bare 40 |
| 75D, 80 den, 150 Denier, 80/72, 50/48 → denier | same | pass |
| 2/40, 30/1, 40/2, 1/69, bare number, blank → unresolved | same | pass |
| into a denier row, into a Ne row, Ne → denier clears count, no density clears density | same | pass |
| recipe density kept over a same-name Rate Book entry | same | pass |
| reducer routes both selections through the helper | same (source contract) | pass |
| old parser contract rewritten (it encoded the defect: 30/1 → 30, 2/40 → 40) | `__tests__/estimator-yarn-ratebook-dropdown.test.ts` | pass |

Not run: the selection in a browser, and the domain reviewer's glossary sign-off for R6.

## LT01B: saved input basis

**Status:** source and disposable-database checks passed. **Migration `20261004120000_estimator_quote_input_basis.sql` is not applied anywhere.**

Chosen representation (recorded before code): two nullable columns on `estimator_quotes`, `warping_mode` and `overhead_mode`, plus `overhead_override_per_m` now stored whenever the engine applied it (in either mode). No versioned input envelope: the payload builder is already the single writer for both save paths, and the snapshot trigger already makes every non-allowlisted column immutable.

- `buildEstimatorQuotePayload` writes the effective modes and the applied override; `saveEstimatorQuoteV3` and `saveAsFabricTemplate` both use it. The migration extends the save RPC's payload allowlist in place, the way `20260825060131` added it. Attestation covers the new keys because it binds the whole payload.
- Readers: `resolveSavedCostingInputBasis` prefers stored modes, then the earlier inference for older rows (no backfill, nothing guessed). Saved Costings reopen and the saved-quality reuse of the latest costing both use the stored modes. The reuse read retries without the two columns if the database does not have them yet.
- Deployment order: readers and writer can ship before the migration. The save action retries once with the legacy payload only when the database rejects the new keys before any write (code 22023, "unsupported fields"), so saves keep working, with today's behavior, until the migration is applied.
- Fingerprint unchanged: it already included `overheadMode` and `warpingMode`, so an unchanged resave of a reopened costing is still `no_change`.

| Fixture | Test | Result |
| --- | --- | --- |
| in-house warping with a kept 12 ₹/kg reference rate, monthly mode with an applied 2.5 ₹/m overhead | `__tests__/db/lite-input-basis.dbtest.ts` | stored as `in_house` / `monthly_expenses` / 2.5; failed before the migration |
| save → SQL → reopen → same production cost; the earlier inference gives a different cost; unchanged resave → `no_change`, same id | same | pass |
| direct mode | same | pass |
| first costing of a new saved quality | same | pass |
| stored basis immutable | same | pass |
| database without the migration: one legacy retry, saved with today's columns | same | pass |
| payload, reader precedence, legacy inference, reuse | `__tests__/lite-input-basis.test.ts` | pass |
| existing save, replay, tamper, tenant and immutability invariants | `costing-save.dbtest.ts`, `costing-immutability.dbtest.ts` | pass |

Rollback: stop the writer by reverting the payload change; keep the columns and readers (old rows stay NULL and read as before). Never drop populated columns.
