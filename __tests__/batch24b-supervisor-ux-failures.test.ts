import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    isSuspiciousProductionMeters,
    SUSPICIOUS_PRODUCTION_METERS_THRESHOLD,
    VALIDATION_MESSAGES,
    validateEntry,
    type ProductionLogEntry,
} from '../lib/production-log-validation'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('Batch 24B supervisor production UX fixes', () => {
    const supervisorPage = readProjectFile('app/(dashboard)/supervisor/dashboard/page.tsx')

    it('PROD-023 shows restored localStorage drafts as unsaved and clears the indicator on save/reset', () => {
        expect(supervisorPage).toContain('localStorage.getItem(draftKey)')
        expect(supervisorPage).toContain('countRestoredUnsavedDraftMeters(restoredMeters, existingProductionMeters)')
        expect(supervisorPage).toContain('Restored unsaved draft')
        expect(supervisorPage).toContain('restored from this device and have not been saved yet')

        expect(supervisorPage).toContain('setRestoredDraftInfo(null)')
        expect(supervisorPage).toContain("const resetShiftDraftState = (nextDate: string, nextShift: 'day' | 'night') => {")
        expect(supervisorPage).toContain('setProductionMeters({}) // Reset inputs after success')
    })

    it('PROD-029 removes raw meter-reading claims from production landing and setup copy', () => {
        const copySources = [
            'components/landing/faq.tsx',
            'components/landing/features.tsx',
            'components/landing/pricing.tsx',
            'components/factory-today/SetupPanel.tsx',
            'lib/i18n/legacy-generated.ts',
        ].map(readProjectFile).join('\n')

        expect(copySources).not.toMatch(/opening and closing meter readings/i)
        expect(copySources).not.toMatch(/enter meter readings/i)
        expect(copySources).not.toMatch(/opening and closing readings or produced meters/i)
        expect(copySources).not.toMatch(/meter readings in one record/i)
        expect(copySources).not.toContain('Shift production logs with meter readings')

        expect(copySources).toContain('Base Plan')
        expect(copySources).toContain('Estimator')
        expect(copySources).toContain('Full Suite')
        expect(copySources).toContain('in development')
    })

    it('PROD-013 flags suspiciously large positive meters without hard-blocking valid production', () => {
        expect(SUSPICIOUS_PRODUCTION_METERS_THRESHOLD).toBe(10_000)
        expect(isSuspiciousProductionMeters(SUSPICIOUS_PRODUCTION_METERS_THRESHOLD - 1)).toBe(false)
        expect(isSuspiciousProductionMeters(SUSPICIOUS_PRODUCTION_METERS_THRESHOLD)).toBe(true)

        const validLargeEntry: ProductionLogEntry = {
            machine_id: 'loom-1',
            meters: SUSPICIOUS_PRODUCTION_METERS_THRESHOLD,
            worker_id: 1,
            order_id: 'order-1',
            rate_per_m: 2.5,
        }

        expect(validateEntry(validLargeEntry).valid).toBe(true)
        expect(supervisorPage).toContain('Confirm large shift production')
        expect(supervisorPage).toContain('This is allowed, but confirm the totals before saving.')
        expect(supervisorPage).toContain('confirmedLargeMeters: true')
    })

    it('keeps existing negative-meter validation and avoids migration/RPC/database work', () => {
        const negativeResult = validateEntry({
            machine_id: 'loom-1',
            meters: -1,
            worker_id: 1,
            order_id: 'order-1',
            rate_per_m: 2.5,
        })

        expect(negativeResult.valid).toBe(false)
        expect(negativeResult.errors).toContain(VALIDATION_MESSAGES.NEGATIVE_METERS)
        expect(supervisorPage).toContain('opening_meter_reading: 0')
        expect(supervisorPage).toContain('closing_meter_reading: metersProduced')

        const migrationNames = readdirSync(join(root, 'supabase/migrations'))
        expect(migrationNames.some((name) => name.toLowerCase().includes('batch_24b'))).toBe(false)
    })
})
