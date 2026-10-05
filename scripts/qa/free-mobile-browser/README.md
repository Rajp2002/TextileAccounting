# Free mobile component browser verification

This mounts actual `FreeClient`, `FreeWorkspace`, `EstimatorClient`, `SavedFreeCostings`, `MobileViewport`, and `MobileInputNavigation`. It uses the actual costing engine, Free transaction hook, leave guard and input controls. Everything runs on localhost with synthetic records. No remote authentication, data, payment provider, migration or deployment is exercised.

Run the isolated server and verifier in separate terminals:

```sh
node scripts/performance/isolated-command.mjs node scripts/qa/free-mobile-browser/server.mjs --enable-synthetic-fixtures
node scripts/performance/isolated-command.mjs node scripts/qa/free-mobile-browser/verify.mjs --stage=after
```

The server listens on `127.0.0.1:4190`, and the verifier blocks all external browser requests. Screenshots and machine-readable results are written to `output/playwright/free-mobile-redesign/after/`. The script accepts `--only=check-name,other-check` for focused reruns; those write separate reports without replacing the complete run.

HMR and file watching are disabled so a shared source edit cannot reload a page during a transaction check. Restart the fixture server after source changes.

For this implementation's immutable BEFORE source, `--baseline` uses `/tmp/weavly-mobile-baseline-cf00bf46` on port `4187`. That tree was extracted from commit `cf00bf4616cfb8c2e128815eeb266d00b67d7ca1` before UI edits. It contains a symlink to this checkout's `node_modules` and is outside the repository so scratch copies cannot pollute type checking. The baseline tree is session-local, not a tracked artifact. To reproduce it, archive that commit into the same directory, then link `node_modules`.

```sh
node scripts/performance/isolated-command.mjs node scripts/qa/free-mobile-browser/server.mjs --enable-synthetic-fixtures --baseline
node scripts/performance/isolated-command.mjs node scripts/qa/free-mobile-browser/verify.mjs --url=http://127.0.0.1:4187 --stage=before --only=mobile-and-desktop-captures
```

The reference screenshots use matching viewport-only Chromium contexts at `320×568`, `390×844`, `430×932`, and `1440×900`. Touch emulation is enabled separately for keyboard/input checks. The fixture uses local public assets and system font fallbacks rather than downloading Next font assets.

The 320-pixel English/Hindi/Gujarati text checks scale each element's original computed font and line height to 150% and 200%, including fixed-pixel labels, without scaling layout dimensions. Transitions are disabled during this emulation so geometry represents settled text. Expanded, filled yarn rows, both width/weaving-rate units, manual kg/100m inputs, and opened Help in replay and invitation/detail states are checked using rendered text/control bounds, clipping ancestors, text overlap, native value/linebox clearance and unit gutters; document scroll width alone is insufficient. The explicit `guide-invite=1` fixture query changes only the synthetic Free tutorial preference, leaving the default and paid fixtures unchanged.

The history Help/filter group also checks 200% text at 320 pixels in all three languages, including initial actions, native search linebox clearance, active/collapsed filters with retained search and values, opened Help/details, and focus return. Its rendered bounds are recorded in `history-text-control-bounds.json`.

The mocked boundaries are explicit: Next router/dynamic/image adapters; inert Supabase auth subscription; empty synthetic server-action answers; in-memory Free and billing API responses; and a Razorpay callback stub. Hook-specific saved receipt/balance tests hold the existing successful-save navigation so the mounted state can be inspected. A separate test performs the actual save-to-history route handoff and opens its saved record. Keyboard checks shrink `visualViewport` and run the real viewport observer; they do not open a real software keyboard.

Passed fixture tests prove component behavior against these controlled answers. Installed iOS/Android PWA behavior, auth/security, payment-provider callbacks, actual server transaction/idempotency guarantees and real keyboard/safe-area behavior still need their corresponding integration/device checks.

The paid tier fixtures mount the common estimator with tier-specific shell navigation and disable autosave and production-pipeline actions. They verify live computation and visual regression in the captured states, rather than paid persistence or production workflows.
