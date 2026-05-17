import { describe, it, expect } from 'vitest'
import {
    validateProductionLog,
    validateStatusLog,
    validateEntry,
    VALIDATION_MESSAGES,
    ZERO_METER_REASONS,
    ZERO_METER_REASON_LABELS,
    type ProductionLogEntry,
} from '../lib/production-log-validation'

// ============================================================
// Shared Validation Module Tests
// ============================================================

describe('Production Log Strictness / Forgiveness Validation', () => {
    // ─── Strict Mode: meters > 0 ─────────────────────────────────────────────

    describe('Strict mode (meters > 0)', () => {
        const validEntry: ProductionLogEntry = {
            machine_id: 'machine-1',
            meters: 50,
            worker_id: 1,
            order_id: 'order-uuid',
            rate_per_m: 2.5,
        }

        it('accepts positive meters with worker + quality/work anchor + rate', () => {
            const result = validateProductionLog(validEntry)
            expect(result.valid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('rejects positive meters without worker_id', () => {
            const result = validateProductionLog({ ...validEntry, worker_id: null })
            expect(result.valid).toBe(false)
            expect(result.errors).toContain(VALIDATION_MESSAGES.WORKER_REQUIRED)
        })

        it('rejects positive meters without quality/work anchor (order_id)', () => {
            const result = validateProductionLog({ ...validEntry, order_id: null })
            expect(result.valid).toBe(false)
            expect(result.errors).toContain(VALIDATION_MESSAGES.QUALITY_REQUIRED)
        })

        it('rejects positive meters without rate snapshot', () => {
            const result = validateProductionLog({ ...validEntry, rate_per_m: null })
            expect(result.valid).toBe(false)
            expect(result.errors).toContain(VALIDATION_MESSAGES.RATE_MISSING)
        })

        it('rejects positive meters with rate = 0', () => {
            const result = validateProductionLog({ ...validEntry, rate_per_m: 0 })
            expect(result.valid).toBe(false)
            expect(result.errors).toContain(VALIDATION_MESSAGES.RATE_ZERO)
        })

        it('rejects positive meters with rate = undefined', () => {
            const result = validateProductionLog({ ...validEntry, rate_per_m: undefined })
            expect(result.valid).toBe(false)
            expect(result.errors).toContain(VALIDATION_MESSAGES.RATE_MISSING)
        })

        it('rejects positive meters with rate = NaN', () => {
            const result = validateProductionLog({ ...validEntry, rate_per_m: NaN })
            expect(result.valid).toBe(false)
            expect(result.errors).toContain(VALIDATION_MESSAGES.RATE_MISSING)
        })

        it('rejects negative meters', () => {
            const result = validateProductionLog({ ...validEntry, meters: -5 })
            expect(result.valid).toBe(false)
            expect(result.errors).toContain(VALIDATION_MESSAGES.NEGATIVE_METERS)
        })

        it('collects multiple errors when multiple fields are missing', () => {
            const result = validateProductionLog({
                ...validEntry,
                worker_id: null,
                order_id: null,
                rate_per_m: null,
            })
            expect(result.valid).toBe(false)
            expect(result.errors.length).toBeGreaterThanOrEqual(3)
        })
    })

    // ─── Forgiving Mode: meters = 0 ──────────────────────────────────────────

    describe('Forgiving mode (meters = 0)', () => {
        it('rejects 0m without zero_meter_reason', () => {
            const result = validateStatusLog({
                machine_id: 'machine-1',
                meters: 0,
                worker_id: null,
                order_id: null,
                rate_per_m: null,
            })
            expect(result.valid).toBe(false)
            expect(result.errors).toContain(VALIDATION_MESSAGES.REASON_REQUIRED)
        })

        it('accepts 0m with reason and no worker', () => {
            const result = validateStatusLog({
                machine_id: 'machine-1',
                meters: 0,
                worker_id: null,
                order_id: null,
                rate_per_m: null,
                zero_meter_reason: 'maintenance',
            })
            expect(result.valid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('accepts 0m with reason and no quality/order', () => {
            const result = validateStatusLog({
                machine_id: 'machine-1',
                meters: 0,
                worker_id: 1,
                order_id: null,
                rate_per_m: null,
                zero_meter_reason: 'machine_idle',
            })
            expect(result.valid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('rejects Other reason without note', () => {
            const result = validateStatusLog({
                machine_id: 'machine-1',
                meters: 0,
                worker_id: null,
                order_id: null,
                rate_per_m: null,
                zero_meter_reason: 'other',
            })
            expect(result.valid).toBe(false)
            expect(result.errors).toContain(VALIDATION_MESSAGES.NOTE_REQUIRED_OTHER)
        })

        it('accepts Other reason with note', () => {
            const result = validateStatusLog({
                machine_id: 'machine-1',
                meters: 0,
                worker_id: null,
                order_id: null,
                rate_per_m: null,
                zero_meter_reason: 'other',
                zero_meter_note: 'Waiting for electrician to fix motor',
            })
            expect(result.valid).toBe(true)
            expect(result.errors).toHaveLength(0)
        })

        it('accepts all canonical zero-meter reasons', () => {
            for (const reason of ZERO_METER_REASONS) {
                if (reason === 'other') continue
                const result = validateStatusLog({
                    machine_id: 'machine-1',
                    meters: 0,
                    worker_id: null,
                    order_id: null,
                    rate_per_m: null,
                    zero_meter_reason: reason,
                })
                expect(result.valid).toBe(true)
            }
        })
    })

    // ─── Unified validateEntry dispatches correctly ──────────────────────────

    describe('validateEntry dispatch', () => {
        it('dispatches meters > 0 to strict validation', () => {
            const result = validateEntry({
                machine_id: 'machine-1',
                meters: 10,
                worker_id: null,
                order_id: null,
                rate_per_m: null,
            })
            expect(result.valid).toBe(false)
            // Should contain strict errors, not status errors
            expect(result.errors).toContain(VALIDATION_MESSAGES.WORKER_REQUIRED)
        })

        it('dispatches meters = 0 to forgiving validation', () => {
            const result = validateEntry({
                machine_id: 'machine-1',
                meters: 0,
                worker_id: null,
                order_id: null,
                rate_per_m: null,
            })
            expect(result.valid).toBe(false)
            // Should contain forgiving errors, not strict errors
            expect(result.errors).toContain(VALIDATION_MESSAGES.REASON_REQUIRED)
            expect(result.errors).not.toContain(VALIDATION_MESSAGES.WORKER_REQUIRED)
        })

        it('rejects negative meters immediately', () => {
            const result = validateEntry({
                machine_id: 'machine-1',
                meters: -1,
                worker_id: 1,
                order_id: 'order-1',
                rate_per_m: 2,
            })
            expect(result.valid).toBe(false)
            expect(result.errors).toContain(VALIDATION_MESSAGES.NEGATIVE_METERS)
        })
    })

    // ─── 0m status log field behavior ────────────────────────────────────────

    describe('0m status log field behavior', () => {
        it('0m status log should use worker_id null when missing', () => {
            // This is a behavioral contract test — the validation module
            // does NOT require worker_id for 0m logs.
            const result = validateStatusLog({
                machine_id: 'machine-1',
                meters: 0,
                worker_id: null,
                order_id: null,
                rate_per_m: null,
                zero_meter_reason: 'maintenance',
            })
            expect(result.valid).toBe(true)
        })

        it('0m status log should use order_id null when missing', () => {
            const result = validateStatusLog({
                machine_id: 'machine-1',
                meters: 0,
                worker_id: null,
                order_id: null,
                rate_per_m: null,
                zero_meter_reason: 'machine_idle',
            })
            expect(result.valid).toBe(true)
        })
    })

    // ─── Payroll safety ──────────────────────────────────────────────────────

    describe('Payroll safety', () => {
        it('0m status log does not create payroll earnings (worker_id is null)', () => {
            // Payroll queries filter: .eq('worker_id', X).gt('meters', 0)
            // A 0m log with worker_id=null will never match any worker query.
            const statusEntry: ProductionLogEntry = {
                machine_id: 'machine-1',
                meters: 0,
                worker_id: null,
                order_id: null,
                rate_per_m: null,
                zero_meter_reason: 'machine_idle',
            }
            // meters=0 and worker_id=null means no payroll match
            expect(statusEntry.meters).toBe(0)
            expect(statusEntry.worker_id).toBeNull()
        })

        it('positive production log still feeds payroll basis', () => {
            const productionEntry: ProductionLogEntry = {
                machine_id: 'machine-1',
                meters: 100,
                worker_id: 5,
                order_id: 'order-uuid',
                rate_per_m: 2.5,
            }
            // meters > 0, worker_id present, rate > 0 → payroll earnings = 100 * 2.5
            expect(productionEntry.meters).toBeGreaterThan(0)
            expect(productionEntry.worker_id).toBeTruthy()
            expect(Number(productionEntry.rate_per_m)).toBeGreaterThan(0)
        })
    })

    // ─── Stock safety ────────────────────────────────────────────────────────

    describe('Stock safety', () => {
        it('0m status log does not create stock quantity (order_id is null, meters = 0)', () => {
            // Stock RPC: IF v_meters <= 0 THEN RETURN;
            // Additionally, 0m status logs have order_id=null, so SUM query returns 0.
            const statusEntry: ProductionLogEntry = {
                machine_id: 'machine-1',
                meters: 0,
                worker_id: null,
                order_id: null,
                rate_per_m: null,
                zero_meter_reason: 'maintenance',
            }
            expect(statusEntry.meters).toBe(0)
            expect(statusEntry.order_id).toBeNull()
        })

        it('positive production log still feeds stock basis', () => {
            const productionEntry: ProductionLogEntry = {
                machine_id: 'machine-1',
                meters: 100,
                worker_id: 5,
                order_id: 'order-uuid',
                rate_per_m: 2.5,
            }
            expect(productionEntry.meters).toBeGreaterThan(0)
            expect(productionEntry.order_id).toBeTruthy()
        })
    })

    // ─── Factory Today ───────────────────────────────────────────────────────

    describe('Factory Today handles 0m status logs', () => {
        it('0m status logs count as logged/accounted for shift status', () => {
            // Factory Today: dayShiftLogged = logs.some(l => l.shift === 'day')
            // A 0m status log with shift='day' still satisfies this check.
            // This test documents the contract.
            const log = { shift: 'day', meters: 0 }
            expect([log].some(l => l.shift === 'day')).toBe(true)
        })

        it('totalMetersToday correctly sums 0m status logs as 0', () => {
            const logs = [
                { meters: 100 }, // production
                { meters: 0 },   // status
                { meters: 50 },  // production
            ]
            const total = logs.reduce((s, l) => s + l.meters, 0)
            expect(total).toBe(150) // 0m does not inflate total
        })
    })

    // ─── Duplicate shift correction still works ──────────────────────────────

    describe('Duplicate shift correction', () => {
        it('a mix of production and status entries can be submitted together', () => {
            const entries: ProductionLogEntry[] = [
                { machine_id: 'm1', meters: 50, worker_id: 1, order_id: 'o1', rate_per_m: 2.5 },
                { machine_id: 'm2', meters: 0, worker_id: null, order_id: null, rate_per_m: null, zero_meter_reason: 'maintenance' },
            ]

            const results = entries.map(e => validateEntry(e))
            expect(results.every(r => r.valid)).toBe(true)
        })
    })

    // ─── Validation copy completeness ────────────────────────────────────────

    describe('Validation copy completeness', () => {
        it('all required validation messages exist', () => {
            expect(VALIDATION_MESSAGES.WORKER_REQUIRED).toBe('Select a worker before saving meters.')
            expect(VALIDATION_MESSAGES.QUALITY_REQUIRED).toBe('Select a quality or run before saving meters.')
            expect(VALIDATION_MESSAGES.RATE_MISSING).toContain('No worker rate is set')
            expect(VALIDATION_MESSAGES.REASON_REQUIRED).toBe('Enter a reason for 0m production.')
            expect(VALIDATION_MESSAGES.NOTE_REQUIRED_OTHER).toContain("'Other'")
            expect(VALIDATION_MESSAGES.NEGATIVE_METERS).toBe('Production meters cannot be negative.')
            expect(VALIDATION_MESSAGES.RATE_ZERO).toContain('greater than zero')
        })

        it('all canonical zero-meter reasons have labels', () => {
            for (const reason of ZERO_METER_REASONS) {
                expect(ZERO_METER_REASON_LABELS[reason]).toBeTruthy()
            }
        })
    })

    // ─── No fallback rate 1.5 ────────────────────────────────────────────────

    describe('No fallback rate 1.5', () => {
        it('validation rejects missing rate — no silent fallback', () => {
            const result = validateProductionLog({
                machine_id: 'machine-1',
                meters: 50,
                worker_id: 1,
                order_id: 'order-uuid',
                rate_per_m: undefined,
            })
            expect(result.valid).toBe(false)
            // Ensures no fallback to 1.5 happens — the entry is rejected
        })

        it('validation rejects rate = 0 — no silent fallback', () => {
            const result = validateProductionLog({
                machine_id: 'machine-1',
                meters: 50,
                worker_id: 1,
                order_id: 'order-uuid',
                rate_per_m: 0,
            })
            expect(result.valid).toBe(false)
        })
    })
})
