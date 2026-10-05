# Free entry and upgrade local component fixture

This local Vite fixture renders the real PlanChooser, PlanCard, preview modal, AuthLayout and authentication forms with the app's CSS and translation provider. Server actions and the Supabase browser client have synthetic local responses; Next navigation/image rendering and auth transition artwork are adapted for Vite. It does not verify authentication, database access, payment capture, deployed routing, or installed-device PWA behavior.

Start from the repository root:

```sh
node scripts/performance/isolated-command.mjs node scripts/qa/free-entry-browser/server.mjs --enable-synthetic-fixtures
```

Open `http://127.0.0.1:4188/fixture?kind=plans&from=estimator`. Other kinds: `signup`, `login`, `forgot`, `reset`, `verify`. `current=lite` preserves the paid-origin plan composition. `ref=WEAVLY-TEST` opens the prefilled signup referral field. `rate-limit=1` with a verify email returns the synthetic resend limit. `payments=1` exposes the real SubscribeButton; use only local interception and a synthetic Razorpay stub.

Run the saved browser checks through Playwright CLI:

```sh
PLAYWRIGHT_CLI_TIMEOUT_SECONDS=60 /Users/rajpatel/.codex/skills/playwright/scripts/playwright_cli.sh --session free-entry open 'http://127.0.0.1:4188/fixture?kind=plans'
PLAYWRIGHT_CLI_TIMEOUT_SECONDS=60 /Users/rajpatel/.codex/skills/playwright/scripts/playwright_cli.sh --session free-entry run-code --filename scripts/qa/free-entry-browser/checks.txt
```

Use the non-public `/fixture` path when checking translations; the real i18n provider deliberately uses a different curated translator for `/` and legal pages. Screenshots are in `output/playwright/free-mobile-redesign/entry`. Baseline screenshots were captured before UI edits at 320×740, 430×932 and 1440×1000. They are synthetic component browser evidence, not production or real-device verification.
