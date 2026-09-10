import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { calcFullTotals, buildCostingResult, getBreakEvenScenario, runScenarios } from '../lib/estimator'
import { getEstimatorReadiness, validateEstimatorSnapshot } from '../lib/estimator-validation'
import { estimatorReferenceCases } from '../scripts/performance/estimator-fixture'
import reference from '../docs/performance/application-20260911/estimator-reference.json'

describe('estimator break-even selection preserves pre-optimization outputs', () => {
    for (const [name, state] of Object.entries(estimatorReferenceCases())) {
        it(name, () => {
            const originalInput = structuredClone(state)
            const validation = validateEstimatorSnapshot(state)
            const totals = calcFullTotals(state)
            const result = buildCostingResult(state, totals)
            const readiness = getEstimatorReadiness({ validation, result, totals, warningsAcknowledged: true })
            const scenario = getBreakEvenScenario(state, totals) ?? null
            const expected = reference.reference[name as keyof typeof reference.reference]
            // Captured before production edits from a92b371. Hash includes every
            // authoritative total, audit value, result and validation message.
            expect(scenario).toEqual(expected.scenario)
            expect(createHash('sha256').update(JSON.stringify({ totals, result, validation, readiness, scenario })).digest('hex')).toBe(expected.sha256)
            expect(state).toEqual(originalInput)
            expect(runScenarios(state, totals).find(item => item.id === 'break-even') ?? null).toEqual(scenario)
        })
    }
})
