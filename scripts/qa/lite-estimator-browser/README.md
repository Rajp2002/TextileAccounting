# Lite estimator browser verification

This fixture mounts the actual paid `EstimatorClient`, costing engine, version/save/recovery handlers, paid autosave, owner navigation, `MobileViewport`, input accessory, and app `Toaster`. Its Free regression mounts the actual `FreeClient`/`FreeWorkspace`. It uses synthetic records and explicit localhost server-action adapters. It does not execute remote authentication, payment, database, analytics, or production actions.

Run the server and verifier in separate terminals:

```sh
node scripts/performance/isolated-command.mjs node scripts/qa/lite-estimator-browser/server.mjs --enable-synthetic-fixtures
node scripts/performance/isolated-command.mjs node scripts/qa/lite-estimator-browser/verify.mjs --stage=after --source-commit=COMMIT_SHA
```

The server listens only on `127.0.0.1:4197`; the verifier blocks external browser requests. HMR and file watching are disabled: restart the fixture after source changes. Run scenarios sequentially because the synthetic backend resets shared receipt/template state before each group. `--only=group-name,other-group` writes `partial-verification.json`, without replacing the complete `verification.json`.

The immutable BEFORE source is merged Free commit `34f37ce223ecd321c1c046901384175ca118b04a`, archived into `/tmp/weavly-lite-baseline-34f37ce2` with a symlink to this checkout's `node_modules`. This session-local baseline is outside the repository; reproduce it with a Git archive of that exact SHA and a dependency symlink. The same fixture mounts old components through `--baseline` on port4196; no app files are patched in that archive.

```sh
node scripts/performance/isolated-command.mjs node scripts/qa/lite-estimator-browser/server.mjs --enable-synthetic-fixtures --baseline
node scripts/performance/isolated-command.mjs node scripts/qa/lite-estimator-browser/verify.mjs --url=http://127.0.0.1:4196 --only=baseline-and-regression-captures --stage=before --source-commit=34f37ce223ecd321c1c046901384175ca118b04a
python3 scripts/qa/lite-estimator-browser/compare.py
```

Screenshots/reports live in `output/playwright/lite-mobile-redesign/estimator/`. Initial captures use matching Chromium viewports320×568,390×844,430×932 and1440×900, local public assets and system font fallbacks. Baseline/after control pairs are the four Base and four Free viewports plus Lite desktop1440. Working desktop snapshots are retained separately. A comparison contact sheet shows Lite initial mobile layouts before/after. Results describe captured component states, not every desktop/paid workflow.

## Scenario groups

The complete verifier covers24 groups:

- Initial Lite/Free/Base capture and reflow controls; Help and picker Close/Escape/outside focus; paid live recalculation and same-task repeated save clicks.
- Actual org+user paid draft persistence, Resume/Discard/Keep for later, debounce flush on fast navigation, Back/Forward recovery, offline edits, cross-tab conflict, expired draft and unavailable device storage.
- Saved-quality search, dirty replace/Cancel/Undo, review-rates/version choice, confirmed factory versions, New quality Cancel/reset, loading/empty/failed-list retry, rate-save unknown-outcome reconciliation.
- Invalid inputs, consequential unusual-value acknowledgement/Cancel, definite save failure, immutable pending request ID/payload through reload, exact retry and lost-response receipt reconciliation.
- Saved export source and working-value distinction; immutable v1/no-change/v2 save/source fence; Quick/Detailed/manual units/zero transport and commission; Base live and Free metered boundaries.
- Simulated keyboard opening/closing through the actual viewport observer; measured action reserve; EN/HI/GU320-pixel computed text150/200% in Quick, Help, Detailed manual/paise, result, picker, rates and five paid dialogs.

Text emulation scales each element's original computed font and line height, including fixed-pixel labels, without enlarging viewport/layout dimensions. It disables transitions/animations to inspect settled geometry. Bounds checks inspect rendered text ranges and control boxes, clipping ancestors, text overlaps, native input linebox/value clearance and unit gutters. Touch checks require44px actual hit regions for reachable pointer controls, including intentional clickable pseudo elements (the app toast close has32px visible box and44px hit area). Radix makes outside notices pointer-inactive while its modal is open; these passive controls are excluded. Success notice/dialog overlap is ignored only when the dialog actually paints above it. Paint-order probes briefly normalize notice pointer eligibility for `elementsFromPoint` and restore it before screenshots; this affects hit testing alone. Explicit success/warning/error checks and viewport screenshots confirm the intended stack. Full-document captures supplement direct geometry; fixed dialogs also have viewport captures because full-page screenshots can omit their visible viewport composition.

## Boundaries and invalidated diagnostics

Synthetic action answers model receipt/idempotency scenarios; they verify actual client behavior against controlled responses. They do not prove hosted server transaction, security or provider guarantees. The actual paid local draft hook is enabled; owner routes outside the estimator use explicitly labelled navigation placeholders and are verified by separate records/supporting suites. The save-as-quality dialog is checked for reflow/dismissal but its combined create/save server behavior is not asserted here.

Keyboard checks inject a reduced `visualViewport` into touch Chromium and exercise the real observer/accessory. They do not open a real software keyboard. Installed iOS/Android PWA, hardware/software keyboard, real safe-area/device text settings, auth/payment providers, native-speaker translation and remote integration checks remain unrun.

Earlier diagnostics were invalidated where fixture assumptions were wrong: locator names/collapsed yarn rows, an initial invalid synthetic overhead mode, dynamic Vite dependency reoptimization during export, and a raw Sonner Toaster import. Final captures use the actual app Toaster; earlier toast size/position claims from the raw import do not describe Weavly. A separate actual-Toaster long-message/modal stacking finding was visually confirmed and reported to the implementation owner. Canonical BEFORE/AFTER reports and comparisons are the review evidence; preliminary failures are not final results.
