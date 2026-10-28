// Writes free-estimate.json, the Calculate body the harness posts to
// /api/free/calculate. Rerun after the estimator input shape changes:
//   ./node_modules/.bin/jiti scripts/performance/signed-in-latency/make-free-estimate.ts
import { writeFileSync } from 'node:fs'
import { makeFreeEstimate } from '../../../lib/free-estimator-defaults'
import { parseFreeEstimate } from '../../../lib/free-estimator-input'
import { FREE_ESTIMATE_VALIDATION_OPTIONS, validateEstimatorSnapshot } from '../../../lib/estimator-validation'

// The same complete costing the Free service tests submit.
const estimate = makeFreeEstimate()
estimate.warpRows[0] = { ...estimate.warpRows[0], calcDenier: 100, beamEnds: 4000, yarnRate: 200 }
estimate.weftRows[0] = { ...estimate.weftRows[0], calcDenier: 150, picks: 60, reedSpace: 150, yarnRate: 230 }
estimate.perPickCostPaisa = 0.16
estimate.overheadOverridePerM = 2
const validation = validateEstimatorSnapshot(parseFreeEstimate(estimate), FREE_ESTIMATE_VALIDATION_OPTIONS)
if (!validation.valid) throw new Error(`estimate is invalid: ${JSON.stringify(validation.issues)}`)
writeFileSync(new URL('./free-estimate.json', import.meta.url), `${JSON.stringify({ estimate, warningsAcknowledged: true }, null, 2)}\n`)
console.log(`wrote free-estimate.json (${validation.warnings?.length ?? 0} warnings, acknowledged)`)
