# Formal component browser fixtures

Run `npm run test:admin:formal-fixtures` from the isolated checkout. The separate Playwright config starts Vite on `127.0.0.1:4190` and renders the actual `FormalIntake`, `FormalCaseWorkspace` and `RetentionReviewScreen` client components with synthetic DTOs. It does not import protected RSC pages, load environment files, connect to Auth/database services, use credentials, deliver messages or execute erasure. Browser requests to non-loopback hosts are blocked.

The UI carries a persistent **Synthetic component fixtures — no authentication or production-data verification** banner. Next navigation/link shims are presentation-only. The response adapter validates synthetic requests using the application's input contracts, tracks optimistic versions and deduplicates fixture requests in process memory. Each browser context receives a separate synthetic fixture cookie; it is not an authentication credential. State is reset for every test.

The ambiguous-success fixture commits a synthetic request, then returns a deliberately truncated JSON response so the component cannot verify success. This avoids Chromium automatically retrying a disconnected connection and consuming the scripted subsequent 429. Later retries return the recorded result using the original UUID/payload. No real network/provider success or production transaction is claimed by this simulation.

On 4 October 2026, the final run passed **24/24 cases in 33.0 seconds**, covering both desktop Chrome and an emulated mobile viewport:

- Manual intake records receipt without acknowledgement/delivery claims.
- Privacy resolution requires outcome summary, delivery evidence and actual response time.
- Private notes use their own operation and never enter update payloads; HTML is escaped.
- Privacy/security expose their own states and no disclosure, erasure, notification or lockdown controls.
- Six unconfigured retention classes remain incomplete with purge disabled.
- A committed response lost before confirmation, followed by 429, preserves the original request UUID/payload.
- A dirty version-one draft stays pinned after version-two props and receives 409.
- An unconfirmed save retains its original payload despite edited fields and refreshed outcome context.
- Adoption retries remain possible when refreshed managed context introduces required fields.
- Private-note retries preserve original note/version/key through context refresh and 429.
- Confirmed saves disable both mutation forms until refreshed detail reaches the committed version; the next save then uses that version.
- Normal adoption confirms its returned version before exposing managed progress.

Scoped harness lint, integrated TypeScript checking and `git diff --check` also passed. The initial development runs exposed fixture selector/HMR issues; those runs were not acceptance passes. The missing native-validation bypass for original retries and adoption result-variable scope were reported to the integration owner and corrected in the product component before the final run.

Useful screenshot scenes, visually inspected and marked synthetic:

- `output/playwright/admin-console/formal-fixtures/workspace-desktop-synthetic.png`
- `output/playwright/admin-console/formal-fixtures/workspace-mobile-synthetic.png`
- `output/playwright/admin-console/formal-fixtures/retention-desktop-synthetic.png`
- `output/playwright/admin-console/formal-fixtures/retention-mobile-synthetic.png`

Machine-readable results are in `output/playwright/admin-console/formal-fixtures/results.json`. These checks demonstrate component behavior against the synthetic response adapter. Actual authorization, database transactions, production privacy/security policy, MFA and deployed network/cache behavior require their separate acceptance evidence.

The final source hashes were:

| Source | SHA-256 |
| --- | --- |
| `components/admin/formal-workspace.tsx` | `558a32f6bbb201b1c455d38e17b1f43d2e090739f2a8523bd3c6127d379ae56a` |
| `components/admin/retention-review.tsx` | `121de701fc5875f75428ab8d7bca1e8ddabd565e8364f8ca739be0398a5b711d` |
| `lib/admin/formal-contracts.ts` | `144f46656b58a3cf0505bc985c51d6447aa9cea2c4cdfa81465377567770958f` |

Rollback removes the dedicated fixture script/config/harness. It has no product authorization bypass, migrations or stored customer records to undo.
