import { describe, expect, it } from 'vitest'
import { isPhase1ArchivedRoute, PHASE_1_ARCHIVE_REDIRECT } from '../lib/phase1-scope'

describe('Phase 1 route archive gate', () => {
    it('identifies archived top-level and nested routes', () => {
        expect(isPhase1ArchivedRoute('/admin')).toBe(true)
        expect(isPhase1ArchivedRoute('/admin/users')).toBe(true)
        expect(isPhase1ArchivedRoute('/owner/inventory')).toBe(true)
        expect(isPhase1ArchivedRoute('/owner/ledger/parties')).toBe(true)
        expect(isPhase1ArchivedRoute('/owner/settings/audit')).toBe(true)
        expect(isPhase1ArchivedRoute('/owner/system-health/messages')).toBe(true)
    })

    it('leaves Phase 1 routes active', () => {
        expect(isPhase1ArchivedRoute('/owner/stock')).toBe(false)
        expect(isPhase1ArchivedRoute('/owner/market-runs')).toBe(false)
        expect(isPhase1ArchivedRoute('/owner/settings')).toBe(false)
        expect(isPhase1ArchivedRoute('/supervisor/dashboard')).toBe(false)
    })

    it('keeps public tracking deferred', () => {
        expect(isPhase1ArchivedRoute('/track')).toBe(true)
        expect(isPhase1ArchivedRoute('/track/abc123TOKEN_')).toBe(true)
    })

    it('uses the documented archived redirect target', () => {
        expect(PHASE_1_ARCHIVE_REDIRECT).toBe('/feature-archived')
    })
})
