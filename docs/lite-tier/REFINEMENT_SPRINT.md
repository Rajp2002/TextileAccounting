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

## LT02: truthful draft writes

**Status:** source checks passed, runtime pending. No new storage, no migration.

- `saveDraftNow` and `flushDraft` return a `DraftWriteOutcome` instead of a boolean: `written`, `nothing_to_store`, `disabled`, `unavailable` or `blocked` (a recovered draft is waiting for the restore choice). `isDraftStored` is true only for `written`. Before, a disabled hook returned `true` without writing.
- Every estimator consumer that used the result now uses it truthfully: the offline save toast, the PWA refresh guard and the save-failure toast. The offline toast now distinguishes stored on this device, kept on this page only (drafts off), waiting for a restore choice, and storage unavailable.
- The shared Free contracts are reused, not rebuilt (R1, R4): FR03 keeps paid autosave off inside the Free wrapper after activation, so an activated owner who goes offline is told the estimate lives only on this page.
- Hindi and Gujarati for the five offline messages are in `lib/i18n/lite-refinement-phrases.ts` (not native-reviewed).

| Fixture | Test | Result |
| --- | --- | --- |
| disabled hook: `disabled`, no write | `__tests__/lite-draft-truth.test.tsx` | pass; returned `true` on `4f49fb27` |
| accepted write `written`; storage exception `unavailable`; nothing to recover `nothing_to_store` | same | pass |
| pending restore choice: `blocked`, earlier draft untouched | same | pass |
| offline toast, refresh guard and failure toast only claim storage for `written` (source contract) | same | pass |
| HI/GU present for every offline message (mutation-checked) | same | pass |
| existing autosave behavior, assertions moved from booleans to outcomes | `__tests__/autosave-status.test.tsx` | pass |

Not run in this sprint: the plan's composed upgrade journeys (real checkout, delayed activation in another tab, layout remount, account switch during activation, Back/Forward). They belong to FR03/FR07 runtime proof, which is still pending.

## LT03: rate-update outcome containment

**Status:** source checks passed, runtime pending. No new schema or receipt table (D07 default).

- The saved-quality rate update ("Save and apply" in the quality rates dialog) now waits through `runMutationWithTimeout`. A timeout or a lost connection no longer shows a generic toast and releases the lock: the proposal (quality, expected version, proposed rows) is kept, Save and "Use saved rates" are blocked, and the dialog explains that the outcome is unknown.
- "Check saved rates" reloads the qualities and reconciles with `reconcileTemplateRateUpdate`: same version means it did not commit (saving again is safe because the server re-checks the version); a quality that now has exactly the proposed rows is applied and described as "the saved quality now has these rates", not as this request's success; anything else is a conflict or a missing quality, and the owner discards the proposal and reopens the quality. Nothing is resent automatically.
- The secondary effects of the server action (`syncTemplateYarnRenames`, revalidation) do not run for a rate-only update in a way the owner can observe: this dialog never changes yarn names, so rename sync has nothing to do. The reconciler deliberately does not claim they completed.
- The unresolved state is page memory; the panel says so ("kept only while this page is open").

| Fixture | Test | Result |
| --- | --- | --- |
| same version → not applied; rows equal → matches (no attribution); rows differ → conflict; gone/archived → missing; key order and row ids ignored | `__tests__/lite-rate-reconciliation.test.ts` | pass |
| handler uses the timeout, keeps an unknown outcome, blocks resend; dialog panel and disabled buttons (source contract) | same | pass |
| HI/GU for all nine panel and toast messages | same | pass |

Deferred (R8): "Review N rates used here" navigation and Rate Book identity on estimator rows. Rows carry no Rate Book id, so focused review would need a new row field across `EstimateState`, the strict Free request schema and saved-row normalizers (D16-adjacent). An id on suggestions alone would have no consumer, so none was added. Not run: double-click, cross-tab conflict and late commit in a browser.

## LT04 (P0): honest Saved Costings summary and complete retrieval

**Status:** source checks passed, runtime pending.

- A quality with no saved costing showed "Current recipe" money computed from the summary row (id, name, dates) and no factory profile, so the engine priced default inputs. `canPriceSavedRecipe` now requires the full recipe rows and the profile; Saved Costings has neither, so the card says "Not calculated" and the detail keeps "No costing saved for this quality yet". Saved snapshot cards are unchanged. Nothing reprices history.
- A failed library or quality read used to become empty lists, and an empty account shows the demonstration sample. The page now passes `loadError`; the client shows "Saved costings could not be loaded. Nothing was deleted. Try again." with a retry, before any empty, no-match or sample state, and the sample is never offered over a failed load.
- `getEstimatorQuotes` reads every page through `readAllPages` (keyset after `created_at desc, id desc`, until an empty page), so a library larger than the server's row cap is not cut short, a newer row added mid-read is neither repeated nor skipped, and any page error fails the whole read.

| Fixture | Test | Result |
| --- | --- | --- |
| summary row priced through defaults gives a number (characterization) | `__tests__/lite-saved-costings-truth.test.ts` | recorded |
| summary-only / no profile / empty weft → not priced; full recipe + profile → priced | same | pass |
| card copy and guard (source contract) | same | pass |
| load failure passed and shown before empty/sample states (source contract) | same | pass |
| 2,345 rows, 500-row runs of equal timestamps, server caps 1000 / 400 / 1 → every id once | same | pass |
| page 2 fails → whole read fails; row inserted ahead mid-read → no miss or repeat; non-advancing page → error | same | pass |
| library read uses deterministic order and the keyset filter (source contract) | same | pass |

Not run: archived/active boundaries and oldest-row retrieval against a real database above the production row cap (the disposable-database adapter does not implement `or`/`limit`), and the error state in a browser.

## LT04 (P1): recall, save scope and revision wording

**Status:** source checks passed, runtime pending.

- Each saved-quality card in the estimator shows a construction cue built only from the recipe: warp × weft yarns, total picks and costing width ("80/72 Micro × 75D Roto · 68 PPI · 160 cm"). Weft picks are summed because each row holds that yarn's own picks (owner decision, E15). Missing parts are left out; nothing is inferred. Long names wrap to two lines and keep the full name as a tooltip instead of truncating.
- The quality search matches every word against the name, the cue and the yarn labels, so "40s" or "poplin 64 ppi 160 cm" finds qualities whose names do not say it. Loading, empty, no-match and load-failure states are unchanged.
- The save-scope dialog's buttons now say "Save this version only" and "Save version and update {quality} for future costings" (EN/HI/GU). The scopes and their server behavior are unchanged.
- The Saved Costings comparison starts with "v1 (3 Oct 2026) → v2 (4 Oct 2026): suggested price ₹0.42/m higher", or "not available" when a value is missing. It reads only the two snapshots.

| Fixture | Test | Result |
| --- | --- | --- |
| cue: single weft, two weft rows (34 + 34 = 68), density fallback, nothing known → null | `__tests__/lite-quality-recall.test.ts` | pass |
| 24 near-duplicate qualities (four yarns, three pick values, two widths, Gujarati names): yarn search, all-words search, Gujarati, empty query | same | pass |
| revision lead: higher, lower, unchanged, unavailable | same | pass |
| picker, card, dialog and comparison wiring (source contracts) | same | pass |
| save-scope copy contract updated deliberately | `__tests__/sprint1-costing-save-trust.test.ts` | pass |

Not done: Recent/Favorites ordering (D05, not authorized), the operator scope-prediction and time-to-correct-quality study (needs real users), and phone-width checks of the longer card. The comparison dialog's copy is English-only, as it was.

## LT05: estimated-economics language

**Status:** source checks passed, runtime pending.

- "Actual margin" is now "Estimated margin at this price" on the live result (Quick and Detailed share the tile; the hidden legacy cockpit was changed too so the two cannot drift) and on the internal cost sheet; the Saved Costings comparison row is "Estimated margin". The customer quotation still shows no margin.
- "Costing valid" is now "Estimate ready for review"; its description ("Price and break-even are calculated from the current inputs.") already described input completeness, not a confirmed save.
- HI/GU: new phrases in `lib/i18n/lite-refinement-phrases.ts`; the old "Actual margin" phrase entries ("वास्तविक margin", "વાસ્તવિક margin") were removed.

| Fixture | Test | Result |
| --- | --- | --- |
| estimator, comparison and internal PDF labels; customer PDF has no margin label | `__tests__/lite-estimated-language.test.ts` | pass; failed before the change |
| HI/GU for the new labels; old phrase gone | same | pass |
| old-label contracts updated deliberately | `sprint-estimator-aesthetic`, `base-estimator-refinements`, `lite-document-privacy`, `lite-task-validation` | pass |

Not done in this sprint (P1, needs the domain/language reviewer or browser): explaining target margin and commission as shares of selling price, the yarn-tax and weaving-charge scope help, progressive first-use setup (D08 held), and the 360/390 px, 200% zoom, keyboard and screen-reader journeys. The existing dismissible wizard and its direct-overhead rule are unchanged.

## LT06: document source and privacy

**Status:** source checks passed. Actual generated PDFs, phone layout and share sheets: not run.

- The export dialog now opens with one line naming what the numbers come from: "Customer quotation · based on {quality} costing v{n} · saved {date}" (or "Internal cost sheet · …") when the costing was saved, from the server receipt or the saved row, and "Internal estimate · unsaved working inputs" (or "Customer quotation · …") for working inputs. The line follows the selected mode and sits under the dialog title, above the preview and form, so it is visible on phone and desktop layouts. Defaults are unchanged: working inputs default to internal, a saved receipt to customer; nothing reuses the last-used mode. Free's saved-history export is unchanged (Free scope).
- Privacy is preserved, not rebuilt. New proof on the generated document HTML, which is what the PDF is rendered from: the customer file contains the quoted price but none of production cost, break-even or landed cost (in the document's own "Rs 1,234.56" format), no yarn names and no yarn rates; internal notes reach only the internal file (the dialog maps customer mode to customer terms); share text is exactly the allowlisted lines (quotation, for, quality, price, quantity, valid until, attachment note).
- History boundary (D10 declined): a saved costing keeps its economics, not the exact earlier PDF or its recipient and terms. Quotation records are retired by the owner's decision, so no document history is added.

| Fixture | Test | Result |
| --- | --- | --- |
| saved source in both modes; working inputs in both modes; HI/GU for all four | `__tests__/lite-document-source.test.ts` | pass; failed before the change |
| dialog line and caller wiring (estimator receipt/working, Saved Costings row) | same (source contract) | pass |
| customer HTML: no cost values, yarn names or rates; price present | same | pass on current code (preservation) |
| share text allowlist | same | pass on current code (preservation) |
| internal notes never mapped to the customer file | same (source contract) | pass |

A first draft of the cost-value check used "₹" while the document prints "Rs", which would have passed vacuously; the test now uses the document's formatter and also asserts the quoted price is present.

Not run: real PDF render and text extraction, EN/HI/GU glyphs and page breaks in the PDF, delayed generation vs edits in a browser, share cancel and download fallback on a phone, and zero-allowance Free exports with ledger proof.

## LT07: owner archive completeness and retained access

**Status:** source checks passed. Runtime access per cohort against a deployed candidate: not run.

### Access

Reading every guard together (proxy, owner layout and its two boundaries, the page, the server action and the history read) found a confirmed source gap (LC48): a former Free account whose paid Lite expired resolves to `effectiveTier: 'none', freeAccount: true`. The owner layout, `requireRole` and the action all sent it to `/free`, so `/owner/data-export`, which promises the archive "remains available when plan access ends", was unreachable for that cohort.

- `hasOwnerArchiveAccess(access)` is true for every organization that has had paid access (active Lite/Base, never-Free expired Lite, former-Free expired Lite, retained Lite after paid Base) and false for a pure Free account, which keeps its Free workspace as before.
- Only `/owner/data-export` is exempt in the owner layout. Its two boundaries now pass `allowFreeAccount` because the layout already redirects every other Free-account path before they render. The page, the export action and the export history read allow retained owners and still send pure Free accounts to `/free`. The proxy's onboarding allow-list includes `/owner/data-export`.
- Nothing else is granted: no paid route, write or entitlement changes. Wrong role, unauthenticated and foreign-tenant behavior is unchanged (`requireRole` role check and redirect; the org always comes from the verified profile).
- PR #180's Settings gate is untouched.

| Cohort | Archive access |
| --- | --- |
| pure Free | no (unchanged; Free workspace and history) |
| active Lite, active Base | yes (unchanged) |
| never-Free, Lite expired | yes (unchanged) |
| former Free, paid Lite expired | **yes (was redirected to /free)** |
| paid-Base history, retained Lite | yes (unchanged) |

### Completeness (LC49)

- Every dataset is read in pages of 1,000 ordered by its key until an empty page (`readAllPages`), so a table larger than PostgREST's per-request row cap is no longer cut silently. Keys: `id` everywhere except the one-row-per-org tables (`payroll_configs`, `quality_stock_cutover`, `yarn_stock_settings` by `org_id`), `yarn_stock_recipes` by `quality_id` within the org, and `whatsapp_cooldowns`, which has only a composite key and is read in ordered offset pages (its writers were unscheduled on 2026-10-01). The key list came from probing the disposable migrated database.
- Machine-assignment and referral lookups by parent ids are batched (200 ids per request) and each batch is paged.
- `free_saved_costings` (completed Free costings kept after upgrade or expiry; org-scoped) is in the catalog. Request tokens and receipts are not.
- The file now carries `completeness`: status, page size, method, and the consistency limit ("datasets are read separately, each in pages … not a point-in-time backup"). Any failed page still fails the whole export, records a failed run and produces no file. Redaction, payload hash, run record and audit are unchanged.

| Fixture | Test | Result |
| --- | --- | --- |
| 2,345 rows with long runs of equal timestamps, fake PostgREST capped at 1,000 per response | `__tests__/lite-archive-completeness.test.ts` | all 2,345 once; returned 1,000 before |
| 450 machines, 1,200 assignments across batches | same | all 1,200; failed before |
| Free costings: ours present, another org's absent | same | pass; failed before |
| one-row and composite-key tables | same | pass |
| every read carries a tenant filter | same | pass |
| page 2 fails → export throws, one failed run, no generated run | same | pass |
| cohort matrix (helper) and the former-Free expired owner exports while pure Free is redirected | same | pass; failed before |
| all guards open for retained owners (source contracts) | same; three older guard contracts updated deliberately | pass |

Not run: the cohort journeys in a browser, and a real database above the production row cap.

## LT08: measurement inventory and pilot protocol

**Status:** done as documentation. No collection, retention, cohort, recruitment or outreach change. See `MEASUREMENT_AND_PILOT.md`.

Findings worth a decision (D12): `plan_usage_events` has no storage dedupe, no retention policy, no report reading it, is not in the owner archive, and records the subscription tier rather than the effective tier (retained Lite shows as `none`). The new LT02/LT03/LT06 states (page-only offline save, unresolved rate update, export source) have no events. The pilot protocol is prepared and unstarted; it needs D13 and the LT09 gates first.

## Final review fix: applying a saved quality kept the editor's overhead

Found in the whole-branch review (pre-existing since the Sprint 3 reducer, not introduced here). Applying a saved quality restored its latest costing's overhead and commercial context, then overwrote the overhead mode and rate with whatever the editor already held, while the rate dialog says "Uses this quality's saved costing assumptions". Warping mode was always forced to in-house. That defeated LT01B on the quality-reuse path.

`resolveAppliedQualityBasis` now gives the quality's own direct overhead first, then the reused costing's restored overhead basis and stored warping mode, and in-house warping only when neither is known. With no reused costing the result is unchanged (editor overhead, in-house warping).

| Fixture | Test | Result |
| --- | --- | --- |
| reused monthly costing with applied overhead and in-house warping; quality direct override first; no reused costing unchanged; reducer wiring | `__tests__/lite-input-basis.test.ts` | pass; failed before |
| existing reuse contract | `__tests__/saved-quality-commercial-reuse.test.ts` | pass |

Two further review fixes, test-first: reopening the quality rates dialog while an update is unresolved now shows the kept proposal rather than the saved rates (the panel says the proposal is kept on the page), and the archive's consistency note says datasets are read separately (they are read concurrently), not "one after another".

## LT09: integrated proof and release decision

**Candidate:** `d4d7f555` on branch `claude/lite-tier-sprint-plan-d0f61b` (base `9da43984`). Environment: macOS, Node 24.11.1, npm 11.6.2, PostgreSQL 17.11 for `test:db` (CI uses 16). Every command through `scripts/performance/isolated-command.mjs`; the worktree has no `.env*` files, so the build loaded no QA or production settings.

| Gate | Result |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | pass (34 s) |
| `npm run lint` | pass, 0 warnings |
| `npx vitest run` | 287 files, 2,563 passed, 1 skipped (the gated live Supabase test); baseline was 278 / 2,472 / 1 |
| `npm run test:db` | 17 files, 112 passed; baseline 16 / 106 |
| `npm run build` (prebuild runs the full suite) | pass, compiled in 3.2 min (598 s total under heavy machine load) |

**Release decision: not releasable as a runtime release yet.** Source and disposable-database gates pass. The following are **not run** and remain release gates:

- Migration `20261004120000_estimator_quote_input_basis.sql` applied to the target (needs the owner's approval). Code is safe to deploy first; the basis is only stored once it is applied.
- Signed-in browser journeys on a deployed candidate (QA Supabase does not resolve): typed yarn selection, save → reopen basis, offline save in the activated Free wrapper, unresolved rate update, Saved Costings load failure, quality search, export source line, archive download for each cohort.
- Real PDF render and text extraction (EN/HI/GU glyphs, page breaks), phone widths, 200% zoom, keyboard and screen reader.
- Native Hindi and Gujarati review of `lib/i18n/lite-refinement-phrases.ts` and the changed `save_version_*` strings.
- Domain sign-off on R6 (yarn name conventions) and on single-weft supported scope (D01 held).
- Production read of how many saved costings exceed the library row cap (none needed for correctness now; useful for prioritising).

**Deployment order:** code can merge before the migration. After applying the migration, record it in `schema_migrations`, then new saves store the basis. Rollback: revert the payload change; keep the columns and readers.

### Decisions (D01 to D16)

| Decision | Disposition in this sprint |
| --- | --- |
| D01 multi-weft semantics | Held: owner's 2026-09-26 meaning recorded, fix awaits the owner's own package |
| D02 new charge basis, D03 negotiated price, D04 conversion-only | Not started (no authorization) |
| D05 Recent/Favorites | Not started; construction cue and search shipped instead |
| D06 richer rate identity, D07 rate receipt schema, D16 durable used-rate provenance | Not started; LT03 containment needs none of them |
| D08 broader onboarding/tours | Not started; existing wizard unchanged |
| D09 localized PDF templates | Not started; static PDF labels stay English |
| D10 quotation-document history | Declined (quotations retired by the owner) |
| D11 readable archive | Not started; JSON completeness first |
| D12 new telemetry | Not started; gaps listed in `MEASUREMENT_AND_PILOT.md` |
| D13 outreach/pricing, D14 broader platform | Not started |
| D15 Lite-only archive | Not needed: the whole-organization archive is now complete |

### Residual risks

- Keyset paging is proven against an in-memory PostgREST stand-in (capped at 1,000 rows) and unit tests, not against real PostgREST; the library read's quoted `or` filter has not run against a real server.
- The archive is not a point-in-time snapshot (stated in the file).
- `plan_usage_events` has no retention, dedupe or report (LT08).
- Free's saved-history export has no source line (Free scope).
