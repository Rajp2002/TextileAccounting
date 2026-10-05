# Local Lite supporting QA

Explicitly synthetic, localhost-only actual component fixtures. No credentials, remote account writes, live payment orders or deletion. Server actions/auth/Supabase are aliased at fixture import boundaries; support/status fetches are fulfilled by browser routes. Actual CostingDefaultsCard is mounted.

Run from repository root:

```sh
node scripts/qa/lite-supporting-browser/server.mjs --enable-synthetic-fixtures
node scripts/qa/free-entry-browser/server.mjs --enable-synthetic-fixtures
python3 scripts/qa/lite-supporting-browser/capture.py after
python3 scripts/qa/lite-supporting-browser/run.py text200
python3 scripts/qa/lite-supporting-browser/run.py dialogs200
python3 scripts/qa/lite-supporting-browser/run.py support200
python3 scripts/qa/lite-supporting-browser/run.py behavior
python3 scripts/qa/lite-supporting-browser/run.py recovery
python3 scripts/qa/lite-supporting-browser/run.py support
python3 scripts/qa/lite-supporting-browser/run.py entry200
python3 scripts/qa/lite-supporting-browser/run.py entrybehavior
python3 scripts/qa/lite-supporting-browser/run.py entrycapture
python3 scripts/qa/lite-supporting-browser/compare.py
npx vitest run --config scripts/qa/lite-supporting-browser/vitest.config.mjs
```

The Playwright skill CLI needs named sessions opened first: `lite-supporting`, `lite-supporting-text`, `lite-supporting-behavior`, `lite-supporting-customer`, `lite-entry`. Run scripts for the same session sequentially. Browser assertions adapt synthetic action timing and preserve real navigation/draft guards. Before capture refuses overwriting immutable images. Server4194 disables HMR/watching: restart after source changes before a final run. Evidence goes only to `output/playwright/lite-mobile-supporting`.

Direct200% text checks double every element's original computed font-size/line-height including fixed-pixel text without scaling viewport/root/layout. They check raw text as well as localized labels; hidden screen-reader-only nodes do not count as visible bounds. Compare JSON reports small raster differences rather than claiming pixel identity where it is not exact. See `docs/mobile-redesign/LITE-supporting.md` for scope and limits. Parent owns full repository aggregates and final source commit.
