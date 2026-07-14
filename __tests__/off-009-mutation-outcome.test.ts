import { describe, expect, it, vi } from 'vitest'
import {
    productionSubmissionMatchesPersistedState,
    runMutationWithTimeout,
} from '../lib/mutation-outcome'

describe('OFF-009 mutation unknown-outcome boundary', () => {
    it('returns the mutation result when the response arrives before timeout', async () => {
        await expect(runMutationWithTimeout(async () => ({ success: true }), 50)).resolves.toEqual({
            status: 'completed',
            value: { success: true },
        })
    })

    it('reports unknown rather than failure when the response times out', async () => {
        vi.useFakeTimers()
        try {
            const outcome = runMutationWithTimeout(
                () => new Promise<{ success: true }>((resolve) => setTimeout(() => resolve({ success: true }), 500)),
                100
            )
            await vi.advanceTimersByTimeAsync(100)
            await expect(outcome).resolves.toEqual({ status: 'unknown' })
        } finally {
            vi.useRealTimers()
        }
    })

    it('reconciles an exact replacement-style production submission', () => {
        const submitted = [
            { machine_id: 'loom-a', meters: 42, zero_meter_reason: null },
            { machine_id: 'loom-b', meters: 0, zero_meter_reason: 'maintenance' },
        ]
        expect(productionSubmissionMatchesPersistedState(submitted, submitted)).toBe(true)
        expect(productionSubmissionMatchesPersistedState(submitted, [submitted[0]])).toBe(false)
        expect(productionSubmissionMatchesPersistedState(submitted, [
            submitted[0],
            { ...submitted[1], zero_meter_reason: 'power_cut' },
        ])).toBe(false)
    })
})
