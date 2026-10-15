import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspace = readFileSync('app/(dashboard)/owner/production/BaseAssignmentWorkspace.tsx', 'utf8')
const phrases = readFileSync('lib/i18n/base-continuity-phrases.ts', 'utf8')

describe('assignment board shift visibility', () => {
    it('hides workers placed on the other shift unless the toggle is on, and orders by assignment', () => {
        expect(workspace).toContain('workersHeldByOtherShift(')
        expect(workspace).toContain('orderWorkersByAssignment(')
        expect(workspace).toContain('showOtherShiftWorkers')
        expect(workspace).toContain("tx('Hide workers on the other shift')")
    })

    it('translates the toggle labels', () => {
        expect(phrases).toContain("'Show {count} workers on the other shift'")
        expect(phrases).toContain("'Hide workers on the other shift'")
    })
})
