import { describe, expect, it } from 'vitest'
import { calculateBaseJobSummaries } from '../lib/base-job-summaries'
import { calculateBaseJobSummary } from '../lib/base-production-core'
import { jobSummariesFixture } from '../scripts/performance/job-summaries-fixture'

const original = ({ jobs, entries, allocations }: ReturnType<typeof jobSummariesFixture>) => (
    new Map(jobs.map(job => [job.id, calculateBaseJobSummary(job, entries, allocations)]))
)

describe('Base job summaries', () => {
    it('matches the original call-site results exactly on interleaved histories without mutation', () => {
        for (let seed = 0; seed < 20; seed++) {
            const input = jobSummariesFixture(25, 1000, seed)
            const snapshot = structuredClone(input)
            expect(calculateBaseJobSummaries(input.jobs, input.entries, input.allocations)).toStrictEqual(original(input))
            expect(input).toStrictEqual(snapshot)
        }
    })

    it('preserves duplicate job keys, insertion order, duplicate rows and unmatched jobs', () => {
        const input = jobSummariesFixture(3, 10)
        input.jobs.push({ ...input.jobs[0], target_meters: 2 }, { ...input.jobs[0], id: '__proto__' })
        input.entries.push(input.entries[0], { job_id: '__proto__', meters: 1 })
        const result = calculateBaseJobSummaries(input.jobs, input.entries, input.allocations)
        expect(result).toStrictEqual(original(input))
        expect([...result.keys()]).toEqual(['job-0', 'job-1', 'job-2', '__proto__'])
        expect(result.get('job-0')?.planned_cost_total).toBe(40.25)
    })

    it('preserves exact Decimal addition order, rounding and invalid-number behavior', () => {
        const input = jobSummariesFixture(2, 0)
        input.entries = [1e25, 0.005, -1e25, 0.015, NaN, Infinity, -Infinity, -0].map(meters => ({ job_id: 'job-0', meters }))
        input.allocations = [1e25, -1e25, 0.025].map(meters => ({ job_id: 'job-0', meters }))
        for (const target of [0, -1, 0.005, NaN, Infinity, 1000]) {
            input.jobs[0].target_meters = target
            expect(calculateBaseJobSummaries(input.jobs, input.entries, input.allocations)).toStrictEqual(original(input))
        }
        expect(calculateBaseJobSummaries(input.jobs, input.entries, input.allocations).get('job-0')?.produced_meters).toBe(0.04)
    })

    it('handles empty inputs, default allocations and subsequent corrections', () => {
        expect(calculateBaseJobSummaries([], [], [])).toEqual(new Map())
        const input = jobSummariesFixture(2, 0)
        expect(calculateBaseJobSummaries(input.jobs, input.entries)).toStrictEqual(original(input))
        input.entries.push({ job_id: 'job-0', meters: 20.005 })
        const before = calculateBaseJobSummaries(input.jobs, input.entries)
        input.entries[0].meters = 30.005
        expect(calculateBaseJobSummaries(input.jobs, input.entries)).toStrictEqual(original(input))
        expect(calculateBaseJobSummaries(input.jobs, input.entries)).not.toStrictEqual(before)
    })
})
