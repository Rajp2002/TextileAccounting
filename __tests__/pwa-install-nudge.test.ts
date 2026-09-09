import { describe, expect, it } from 'vitest'
import { isPwaNudgeDue, PWA_NUDGE_INTERVAL_MS, readPwaNudgePreference } from '../lib/pwa-install-nudge'

describe('PWA installation reminder frequency', () => {
    const now = 1_800_000_000_000

    it('shows for a first visit and recovers malformed storage', () => {
        for (const raw of [null, '{broken', 'null', '{"lastShownAt":"yesterday"}']) {
            expect(isPwaNudgeDue(readPwaNudgePreference(raw), now)).toBe(true)
        }
    })

    it('waits a full seven days after the last impression', () => {
        const preference = { dismissed: false, lastShownAt: now }
        expect(isPwaNudgeDue(preference, now + PWA_NUDGE_INTERVAL_MS - 1)).toBe(false)
        expect(isPwaNudgeDue(preference, now + PWA_NUDGE_INTERVAL_MS)).toBe(true)
    })

    it('preserves the permanent opt-out even with an invalid timestamp', () => {
        const preference = readPwaNudgePreference('{"dismissed":true,"lastShownAt":"invalid"}')
        expect(isPwaNudgeDue(preference, now + 100 * PWA_NUDGE_INTERVAL_MS)).toBe(false)
    })

    it('does not re-show if the device clock moves backwards', () => {
        expect(isPwaNudgeDue({ dismissed: false, lastShownAt: now }, now - 1000)).toBe(false)
    })
})
