import { describe, expect, it } from 'vitest'
import { baseProductionDraftKey, parseBaseProductionDraft } from '../lib/base-production-draft'
import { baseProductionHref, readBaseProductionNavigation, safeBaseReturnPath, validBaseDate } from '../lib/base-production-navigation'
import { baseProductionAuditChanges } from '../lib/base-production-audit'

describe('production navigation and local drafts', () => {
    it('preserves record context and a safe return route', () => {
        const context = { date: '2026-08-31', shift: 'night' as const, entry: '11111111-1111-4111-8111-111111111111', returnTo: '/owner/payroll' }
        expect(readBaseProductionNavigation(new URL(baseProductionHref(context), 'https://example.test').searchParams)).toMatchObject(context)
    })
    it('rejects invalid dates and external or unrelated return destinations', () => {
        expect(validBaseDate('2026-02-30')).toBe(false)
        expect(safeBaseReturnPath('/owner/setup?section=machines')).toBe('/owner/setup?section=machines')
        expect(safeBaseReturnPath('/owner/operations?shift=night')).toBe('/owner/operations?shift=night')
        expect(safeBaseReturnPath('//attacker.test')).toBeUndefined()
        expect(safeBaseReturnPath('/owner/production/../../api/delete')).toBeUndefined()
        expect(safeBaseReturnPath('https://attacker.test/owner/payroll')).toBeUndefined()
    })
    it('isolates drafts by owner, organization, date and shift', () => {
        const key = baseProductionDraftKey('org', 'owner', '2026-08-31', 'day')
        for (const args of [['other', 'owner', '2026-08-31', 'day'], ['org', 'other', '2026-08-31', 'day'], ['org', 'owner', '2026-08-30', 'day'], ['org', 'owner', '2026-08-31', 'night']]) expect(baseProductionDraftKey(...args as [string, string, string, string])).not.toBe(key)
    })
    it('rejects corrupt/unversioned drafts and preserves a valid retry identity', () => {
        expect(parseBaseProductionDraft('{')).toBeNull()
        expect(parseBaseProductionDraft('{"rows":{}}')).toBeNull()
        const draft = { version: 1, revision: null, requestId: '11111111-1111-4111-8111-111111111111', reason: '', rows: { worker: { meters: '', status: 'entered', machineMeters: { 'machine:job': '42.25' }, savedUnallocatedMeters: null } } }
        expect(parseBaseProductionDraft(JSON.stringify(draft))).toEqual(draft)
    })
})

describe('correction money traceability', () => {
    it('shows both pay changes when total metres are unchanged', () => {
        const snapshot = (first: number, second: number) => ({ total_meters: 100, entered_count: 2, zero_count: 0, absent_count: 0, worker_count: 2, entries: [{ worker_id: 'A', meters: first, worker_rate_snapshot: 8, entry_status: 'entered' as const, allocations: [] }, { worker_id: 'B', meters: second, worker_rate_snapshot: 10, entry_status: 'entered' as const, allocations: [] }] })
        const changes = baseProductionAuditChanges(snapshot(60, 40), snapshot(40, 60))
        expect(changes).toHaveLength(2)
        expect(changes[0].before?.pay).toBe(480)
        expect(changes[0].after?.pay).toBe(320)
        expect(changes[1].before?.pay).toBe(400)
        expect(changes[1].after?.pay).toBe(600)
    })
})
