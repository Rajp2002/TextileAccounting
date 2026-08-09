# Sprint 21 route bundle before/after

Status: local post-change production-build analyzer captured; canonical production transfer remains pending.

| Route | Baseline gzip route-chunk union | After | Budget | Result |
| --- | ---: | ---: | ---: | --- |
| Cost Estimate | 465 KB | 357.2 KB (357,201 B) | <200 KB | Over budget; residual EstimatorClient graph |
| Settings | 310 KB | 183.9 KB (183,924 B) | <180 KB | Over budget; residual Settings/client-provider graph |
| Saved Costings | 297 KB | 154.5 KB (154,516 B) | <180 KB | Pass |
| Yarn Rate Book | 252 KB | 107.3 KB (107,304 B) | <180 KB | Pass |
| Subscription & Billing | 244 KB | 92.0 KB (91,990 B) | — | Informational |

The baseline figures are emitted-chunk unions from the Sprint 21 proposal, not browser transfer sizes. The after artifact must include the emitted chunk table, analyzer output, and named residual modules where a budget is exceeded.

The local after values were generated with `scripts/performance/sprint21-bundle-report.mjs` from the `.next` production build. Exact per-chunk raw/gzip values are in `bundle-after.json`.

Named residuals above budget:

- Cost Estimate: `app/(dashboard)/owner/estimator/EstimatorClient.tsx` in `aaea2bcf-33dd9d2eb6fdbb67.js` (100,428 B gzip), plus the shared `components/providers.tsx` i18n/PWA and owner-shell graph in `7009-3f9a8ae19bee5d7d.js` (51,491 B gzip) and owner navigation in `4821-c5e85cc32886a231.js` (38,510 B gzip).
- Settings: the `app/(dashboard)/owner/settings/page.tsx` graph in `7716-71b3225503370cd4.js` (47,319 B gzip), plus the shared i18n/PWA/owner-shell graph in `7009-3f9a8ae19bee5d7d.js` (51,491 B gzip). The persistent query provider is now scoped to query-using layouts; settings cards and the shared shell remain the residual graph.

These are emitted-build measurements, not production Resource Timing measurements; they do not close the runtime release gate.
