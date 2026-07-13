import { describe, expect, it, vi } from 'vitest'
import { getRateLimitRetrySeconds } from '../lib/rate-limit'

describe('B10 rate-limit retry duration', () => {
    it('converts an absolute reset timestamp into remaining seconds', () => {
        expect(getRateLimitRetrySeconds(1_700_000_010_001, 1_700_000_000_000)).toBe(11)
    })

    it('never reports a zero or negative retry duration', () => {
        expect(getRateLimitRetrySeconds(1_700_000_000_000, 1_700_000_000_001)).toBe(1)
    })

    it('uses the current clock when no explicit now is supplied', () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
        expect(getRateLimitRetrySeconds(1_700_000_005_000)).toBe(5)
        vi.restoreAllMocks()
    })
})
