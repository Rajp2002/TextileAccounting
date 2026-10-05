# Synthetic Free supporting-screen browser checks

This mounts actual Free account/settings, billing and customer support components. Server actions and support responses use explicit synthetic local transport; deletion throws instead of calling a provider. The fixture provides no authentication, RLS, backend idempotency, real payment, installed PWA or device evidence.

Run from the repository root:

```sh
node scripts/qa/free-supporting-browser/server.mjs --enable-synthetic-fixtures
```

In another terminal, open the named browser through the supported Playwright CLI, then run checks and captures:

```sh
PLAYWRIGHT_CLI_TIMEOUT_SECONDS=60 /Users/rajpatel/.codex/skills/playwright/scripts/playwright_cli.sh --session free-supporting-final open http://127.0.0.1:4192/
python3 scripts/qa/free-supporting-browser/verify.py
python3 scripts/qa/free-supporting-browser/capture.py after
```

The server binds only to `127.0.0.1:4192` and uses `/tmp/weavly-free-supporting-vite-cache`. Run browser verification and capture sequentially; both control the same named session. The verification script requires an explicit completed Result and writes `output/playwright/free-mobile-supporting/verification.log`. BEFORE images in that directory were captured from these components before presentation edits; rerunning `capture.py before` against modified source would replace that evidence and must not be used as an immutable baseline.

Query parameters select `view=account|billing|support|thread`, `lang=en|hi|gu`, billing `grant=active|pending|suspended`, `tier=free|none|lite|base`, and account `verified=false`. Default route adapters also handle the normal successful intake handoff to `/support/<id>`. The settings synthetic action rejects the exact fixture name `Synthetic rejected owner` after a delay to test feedback visibility after disclosure closure.

The browser verifier blocks external requests and checks 320-pixel reflow at normal/200% root text. It validates memory-only drafts, mounted editors, visible validation/asynchronous errors, safe deletion Cancel/focus, truthful billing states, immutable lost-response retries, same-task repeated submission taps, Enter/newline, conversation disclosures and English/Hindi/Gujarati. Real browser Back/Forward with a terminating page, mobile keyboards, safe areas, app suspension and assistive technology remain separate device/integration checks.
