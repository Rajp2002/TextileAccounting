# Lite records component browser fixture

This mounts the actual `QuotesClient`, `RatesClient`, retained `SavedFreeCostings`, translation provider and verified-plan presentation context on localhost. Synthetic records and action answers exercise UI behavior without authentication, production data, a database, payment calls or deployment. The bottom destinations are a fixture, not the Next owner shell.

```sh
node scripts/performance/isolated-command.mjs node scripts/qa/lite-records-browser/server.mjs --enable-synthetic-fixtures
python3 scripts/qa/lite-records-browser/capture.py after
python3 scripts/qa/lite-records-browser/capture.py after-prior --prior
python3 scripts/qa/lite-records-browser/run.py behavior-final scripts/qa/lite-records-browser/behavior.js
python3 scripts/qa/lite-records-browser/run.py text200-en-final scripts/qa/lite-records-browser/text200.js en
python3 scripts/qa/lite-records-browser/run.py text200-hi-final scripts/qa/lite-records-browser/text200.js hi
python3 scripts/qa/lite-records-browser/run.py text200-gu-final scripts/qa/lite-records-browser/text200.js gu
```

The fixture listens only on `127.0.0.1:4195`, uses its own `/tmp` Vite cache, disables HMR and file watching, and requires the explicit synthetic-fixture flag. Restart it after source changes. The capture/check runners use the named Playwright CLI session `lite-records`; open that session before running commands. They reject CLI errors, missing JSON results and failed checks. `duplicates.js` is a diagnostic reproduction, not the final interrupted-flow suite.

Queries: `tier=lite` (default), `base`, `free` or `none`; `lang=en|hi|gu`; `prior=1` mounts existing Free history; `priorError=1` returns a synthetic load failure. Use `/owner/quotes` and `/owner/rates`, which match the private translation path. Free/none paid-client mounts test presentation fallback only, not real route access or entitlements.

For immutable baseline clients, start the server with `--baseline`. Its pretransform loads only the two original route clients directly from commit `34f37ce223ecd321c1c046901384175ca118b04a`; relative imports keep their original paths. `capture.py ... --baseline --prior` selects the original unwrapped retained history. The initial standalone BEFORE images were captured before UI edits; retained-history BEFORE was reconstructed from immutable baseline clients after implementation and is labelled separately.

`behavior.js` checks thirteen interrupted/repeated flow groups: Help/focus/tour state, search/filter retention, exact-version comparison/export, paid local-draft overwrite Cancel, archive Cancel/failure, rate invalid/rejected/uncertain/exact retry, favourite single flight/retry, captured bulk review set, Back/Forward and smaller viewport focus, retained history mounting, unique connected labels, and visible load errors. Real server idempotency/CAS enforcement is outside this fixture.

`text200.js` opens nine actual scenes per language at 320×568 with coarse/touch emulation. It doubles every element's original computed font and line height, including fixed-pixel text, without scaling layout. It checks rendered text ranges, clipping ancestors, reachable scroll containers, enabled target dimensions, native input/select linebox clearance and the quick rate's ₹/kg gutters. Screen-reader-only text, deliberately hidden table column labels and the synthetic navigation are excluded from visual bounds.

Canonical evidence is under `output/playwright/lite-mobile-records/`: `summary.json`, `final-source.json`, `behavior-final`, `text200-{en,hi,gu}-final`, `free-history-regression`, `before`, `before-prior-reconstructed`, `after`, `after-prior`, `visual-regression.json`. The canonical retained-history desktop final capture is `prior-desktop-reduced/desktop-prior-reduced.png`, using reduced motion; the default-motion image showed a capture fade despite normal settled computed styles. `before-prior`, `before-prior-records`, earlier `behavior` and earlier `text200-en` are harness diagnostics and are not baseline/pass evidence.

Installed iOS/Android PWAs, actual keyboard/safe areas, hosted auth/security, actual backend mutation outcomes and PDF delivery remain unrun here. The smaller-viewport focus case resizes the browser; it does not open a native keyboard.
