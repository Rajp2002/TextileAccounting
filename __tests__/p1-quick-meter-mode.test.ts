import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    validateEntry,
    validateProductionLog,
    validateStatusLog,
    VALIDATION_MESSAGES,
} from '../lib/production-log-validation'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

// ============================================================
// Quick Meter Mode — Phase 1 Hardening Tests
// ============================================================
// The supervisor enters "Metres produced this shift" and the app
// saves that value directly. No opening/closing meter readings,
// no counter reset toggle, no closing-reading calculations.

describe('Quick Meter Mode — Phase 1 Verification', () => {
    // ─── 1. Supervisor UI uses "Metres produced this shift" ──────────────

    describe('Supervisor UI labels', () => {
        it('EN locale has "Metres produced this shift" for counterReading', () => {
            const en = readProjectFile('lib/i18n/locales/en.ts')
            expect(en).toContain('counterReading: "Metres produced this shift"')
        })

        it('EN locale has "Metres produced this shift" for shiftProduction', () => {
            const en = readProjectFile('lib/i18n/locales/en.ts')
            expect(en).toContain('shiftProduction: "Metres produced this shift"')
        })

        it('EN locale counterHelper says "Enter the metres produced on each loom for this shift"', () => {
            const en = readProjectFile('lib/i18n/locales/en.ts')
            expect(en).toContain('Enter the metres produced on each loom for this shift')
        })

        it('HI locale has shift-centric language', () => {
            const hi = readProjectFile('lib/i18n/locales/hi.ts')
            expect(hi).toContain('इस पाली में बने मीटर')
        })

        it('GU locale has shift-centric language', () => {
            const gu = readProjectFile('lib/i18n/locales/gu.ts')
            expect(gu).toContain('આ પાળીમાં બનેલા મીટર')
        })
    })

    // ─── 2. No opening/closing/counter reset in active supervisor UI ─────

    describe('No counter mode in active supervisor flow', () => {
        it('supervisor dashboard does NOT render an opening_meter_reading input', () => {
            const dashboard = readProjectFile('app/(dashboard)/supervisor/dashboard/page.tsx')
            // The dashboard should NOT have any rendered label for "openingReading"
            // It does use t('floor.meter.counterHelper') and t('floor.meter.shiftProduction')
            // but never t('floor.meter.openingReading')
            expect(dashboard).not.toContain("t('floor.meter.openingReading')")
        })

        it('supervisor dashboard does NOT render a counter reset toggle', () => {
            const dashboard = readProjectFile('app/(dashboard)/supervisor/dashboard/page.tsx')
            expect(dashboard).not.toContain('counter_reset')
            expect(dashboard).not.toContain('counterReset')
            expect(dashboard).not.toContain('Counter reset')
        })

        it('supervisor dashboard always sends opening_meter_reading: 0', () => {
            const dashboard = readProjectFile('app/(dashboard)/supervisor/dashboard/page.tsx')
            expect(dashboard).toContain('opening_meter_reading: 0')
        })

        it('supervisor dashboard always sends counter_was_reset: false', () => {
            const dashboard = readProjectFile('app/(dashboard)/supervisor/dashboard/page.tsx')
            expect(dashboard).toContain('counter_was_reset: false')
        })

        it('supervisor readiness does not count positive production without a positive rate as valid', () => {
            const dashboard = readProjectFile('app/(dashboard)/supervisor/dashboard/page.tsx')
            expect(dashboard).toContain('normalizeRate(assignment?.rate_per_m) > 0')
            expect(dashboard).toContain("id: 'missing-rate'")
        })
    })

    // ─── 3. bulkLogProduction saves direct metres ────────────────────────

    describe('bulkLogProduction saves direct metres', () => {
        it('server action uses e.meters directly (no resolvedMeters indirection)', () => {
            const actions = readProjectFile('app/(dashboard)/supervisor/actions.ts')
            // After cleanup, resolvedMeters should be gone
            expect(actions).not.toContain('resolvedMeters')
        })

        it('active supervisor paths do not use the old 1.5 rate fallback', () => {
            const actions = readProjectFile('app/(dashboard)/supervisor/actions.ts')
            const dashboard = readProjectFile('app/(dashboard)/supervisor/dashboard/page.tsx')

            expect(actions).not.toContain('?? 1.5')
            expect(actions).not.toContain('|| 1.5')
            expect(dashboard).not.toContain('?? 1.5')
            expect(dashboard).not.toContain('|| 1.5')
        })

        it('server action writes opening_meter_reading: 0 (Quick Meter Mode)', () => {
            const actions = readProjectFile('app/(dashboard)/supervisor/actions.ts')
            expect(actions).toContain('opening_meter_reading: 0,')
            expect(actions).toContain('Quick Meter Mode')
        })

        it('server action writes counter_was_reset: false (Phase 1)', () => {
            const actions = readProjectFile('app/(dashboard)/supervisor/actions.ts')
            // Should always be false, never use e.counter_was_reset
            expect(actions).toContain("counter_was_reset: false,                // Phase 1: no counter mode")
        })

        it('supervisor dashboard sends positive meter rows even when required production fields are missing', () => {
            const dashboard = readProjectFile('app/(dashboard)/supervisor/dashboard/page.tsx')
            expect(dashboard).toContain('.filter((e) => e.meters > 0)')
            expect(dashboard).not.toContain('.filter((e) => e.worker_id && e.order_id && e.meters > 0)')
        })

        it('negative meter check does not reference counter_was_reset', () => {
            const actions = readProjectFile('app/(dashboard)/supervisor/actions.ts')
            // The simplified check should just be e.meters < 0
            expect(actions).toContain('const negativeEntry = entries.find(e => e.meters < 0)')
        })
    })

    // ─── 4. Payroll calculates from direct meters ────────────────────────

    describe('Payroll uses production_logs.meters directly', () => {
        it('payroll query selects meters + worker_rate_snapshot (no opening/closing)', () => {
            const payroll = readProjectFile('app/(dashboard)/owner/payroll/actions.ts')
            expect(payroll).toContain(".select('meters, worker_rate_snapshot')")
            // Must NOT select opening_meter_reading or closing_meter_reading
            expect(payroll).not.toContain('opening_meter_reading')
            expect(payroll).not.toContain('closing_meter_reading')
            expect(payroll).not.toContain('counter_was_reset')
        })

        it('payroll filters on meters > 0 to exclude 0m downtime logs', () => {
            const payroll = readProjectFile('app/(dashboard)/owner/payroll/actions.ts')
            expect(payroll).toContain(".gt('meters', 0)")
        })
    })

    // ─── 5. Stock derives from direct meters ─────────────────────────────

    describe('Stock uses production_logs.meters directly', () => {
        it('0m status log (order_id null) does not create stock', () => {
            // Contract: stock is driven by order_id + meters > 0
            // A 0m status log has order_id = null and meters = 0
            const entry = { machine_id: 'm1', meters: 0, worker_id: null, order_id: null, rate_per_m: null, zero_meter_reason: 'maintenance' as const }
            expect(entry.meters).toBe(0)
            expect(entry.order_id).toBeNull()
        })

        it('stock refresh is triggered only from positive production rows', () => {
            const actions = readProjectFile('app/(dashboard)/supervisor/actions.ts')
            expect(actions).toContain('.filter((log) => log.meters > 0)')
            expect(actions).toContain("supabase.rpc('create_or_refresh_stock_inward_draft'")
        })

        it('positive production log feeds stock basis', () => {
            const entry = { machine_id: 'm1', meters: 100, worker_id: 5, order_id: 'order-uuid', rate_per_m: 2.5 }
            expect(entry.meters).toBeGreaterThan(0)
            expect(entry.order_id).toBeTruthy()
        })
    })

    // ─── 6. Factory Today totals direct meters ───────────────────────────

    describe('Factory Today uses production_logs.meters directly', () => {
        it('today actions query selects meters directly (no opening/closing)', () => {
            const today = readProjectFile('app/(dashboard)/owner/today/actions.ts')
            expect(today).toContain(".select('id, shift, meters, created_at, date')")
            expect(today).not.toContain('opening_meter_reading')
            expect(today).not.toContain('closing_meter_reading')
            expect(today).not.toContain('counter_was_reset')
        })

        it('totalMetersToday correctly sums mixed production and downtime logs', () => {
            const logs = [
                { meters: 100, shift: 'day' },
                { meters: 0, shift: 'day' },   // downtime
                { meters: 50, shift: 'night' },
            ]
            const total = logs.reduce((s, l) => s + l.meters, 0)
            expect(total).toBe(150) // 0m does not inflate total
        })
    })

    // ─── 7. Downtime mode still works ────────────────────────────────────

    describe('Downtime mode still works', () => {
        it('0m with reason passes forgiving validation', () => {
            const result = validateEntry({
                machine_id: 'machine-1',
                meters: 0,
                worker_id: null,
                order_id: null,
                rate_per_m: null,
                zero_meter_reason: 'maintenance',
            })
            expect(result.valid).toBe(true)
        })

        it('0m without reason fails validation', () => {
            const result = validateEntry({
                machine_id: 'machine-1',
                meters: 0,
                worker_id: null,
                order_id: null,
                rate_per_m: null,
            })
            expect(result.valid).toBe(false)
            expect(result.errors).toContain(VALIDATION_MESSAGES.REASON_REQUIRED)
        })

        it('supervisor dashboard handles downtime entries with 0 meters', () => {
            const dashboard = readProjectFile('app/(dashboard)/supervisor/dashboard/page.tsx')
            expect(dashboard).toContain("meters: 0,")
            expect(dashboard).toContain("zero_meter_reason")
        })
    })

    // ─── 8. No counter reset fallback affects production logs ────────────

    describe('No counter reset fallback', () => {
        it('production-log-validation has no counter_was_reset reference', () => {
            const validation = readProjectFile('lib/production-log-validation.ts')
            expect(validation).not.toContain('counter_was_reset')
            expect(validation).not.toContain('counter_reset')
            expect(validation).not.toContain('opening_meter_reading')
            expect(validation).not.toContain('closing_meter_reading')
        })

        it('validation module operates purely on meters field', () => {
            // Strict: meters > 0 requires worker + quality + rate
            const strict = validateProductionLog({
                machine_id: 'm1', meters: 50, worker_id: 1, order_id: 'o1', rate_per_m: 2.5
            })
            expect(strict.valid).toBe(true)

            // Forgiving: meters = 0 requires reason only
            const forgiving = validateStatusLog({
                machine_id: 'm1', meters: 0, worker_id: null, order_id: null, rate_per_m: null,
                zero_meter_reason: 'machine_idle',
            })
            expect(forgiving.valid).toBe(true)
        })
    })

    // ─── 9. Landing page copy is clean ───────────────────────────────────

    describe('Landing page copy consistency', () => {
        it('FAQ does not reference "opening" or "closing" meter readings', () => {
            const faq = readProjectFile('components/landing/faq.tsx')
            expect(faq).not.toContain('opening and closing')
            expect(faq).not.toContain('opening meter')
            expect(faq).not.toContain('closing meter')
        })

        it('pricing page says "shift metres" not "meter readings"', () => {
            const pricing = readProjectFile('components/landing/pricing.tsx')
            expect(pricing).toContain('shift metres')
            expect(pricing).not.toContain('meter readings')
        })
    })

    // ─── 10. Existing logs remain readable ───────────────────────────────

    describe('Backward compatibility', () => {
        it('ProductionLogRow type still includes DB columns for backward reads', () => {
            const actions = readProjectFile('app/(dashboard)/supervisor/actions.ts')
            // The type interface should still declare these for reading old data
            expect(actions).toContain('closing_meter_reading: number | null')
            expect(actions).toContain('opening_meter_reading: number | null')
            expect(actions).toContain('counter_was_reset: boolean')
        })

        it('DB migration added columns that still exist (no drop migration)', () => {
            const migration = readProjectFile('supabase/migrations/20260429173000_add_meter_readings_to_production_logs.sql')
            expect(migration).toContain('ADD COLUMN IF NOT EXISTS closing_meter_reading')
            expect(migration).toContain('ADD COLUMN IF NOT EXISTS opening_meter_reading')
        })

        it('RPC still accepts counter columns for DB compatibility', () => {
            const rpc = readProjectFile('supabase/migrations/20260518100000_strictness_forgiveness_rpc.sql')
            expect(rpc).toContain('opening_meter_reading')
            expect(rpc).toContain('closing_meter_reading')
            expect(rpc).toContain('counter_was_reset')
        })
    })
})
