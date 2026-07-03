/**
 * lib/production-log-validation.ts — Shared strictness / forgiveness rules
 *
 * Core rule:
 *   Production logs (meters > 0)  → strict:   worker + quality/work anchor + rate > 0
 *   Status logs     (meters === 0) → forgiving: reason required, worker/anchor/rate optional
 *
 * The "quality/work anchor" is the resolved context that tells the system *what*
 * is being produced on a machine. In the current schema this is `order_id`
 * (which itself may reference a market_run, quality, or cost analysis).
 * If additional anchor types are added later, this module should be extended.
 */

// ─── Canonical Zero-Meter Reasons ────────────────────────────────────────────

export const ZERO_METER_REASONS = [
    'machine_idle',
    'maintenance',
    'yarn_issue',
    'beam_issue',
    'worker_absent',
    'power_issue',
    'quality_changeover',
    'no_work_assigned',
    'other',
] as const

export type ZeroMeterReason = (typeof ZERO_METER_REASONS)[number]

export const ZERO_METER_REASON_LABELS: Record<ZeroMeterReason, string> = {
    machine_idle: 'Machine idle',
    maintenance: 'Maintenance',
    yarn_issue: 'Yarn issue',
    beam_issue: 'Beam issue',
    worker_absent: 'Worker absent',
    power_issue: 'Power issue',
    quality_changeover: 'Quality changeover',
    no_work_assigned: 'No work assigned',
    other: 'Other',
}

// ─── Supervisor-Friendly Validation Messages ─────────────────────────────────

export const VALIDATION_MESSAGES = {
    WORKER_REQUIRED: 'Select a worker before saving meters.',
    QUALITY_REQUIRED: 'Select a quality or run before saving meters.',
    RATE_MISSING:
        'No worker rate is set for this quality. Ask the owner to set the rate before saving production.',
    RATE_ZERO: 'Worker rate must be greater than zero for production logs.',
    REASON_REQUIRED: 'Enter a reason for 0m production.',
    NOTE_REQUIRED_OTHER: "Add a note for 'Other' reason.",
    NEGATIVE_METERS: 'Production meters cannot be negative.',
} as const

// A single loom producing this much in one shift is operationally suspicious,
// but still plausible enough to allow after explicit supervisor confirmation.
export const SUSPICIOUS_PRODUCTION_METERS_THRESHOLD = 10_000

// ─── Entry Shape ─────────────────────────────────────────────────────────────

export interface ProductionLogEntry {
    machine_id: string
    meters: number
    worker_id: number | null | undefined
    /** order_id is the current quality/work anchor implementation */
    order_id: string | null | undefined
    rate_per_m: number | null | undefined
    zero_meter_reason?: string | null
    zero_meter_note?: string | null
}

// ─── Validation Result ───────────────────────────────────────────────────────

export interface ValidationResult {
    valid: boolean
    errors: string[]
}

// ─── Validators ──────────────────────────────────────────────────────────────

export function isSuspiciousProductionMeters(meters: number): boolean {
    return Number.isFinite(meters) && meters >= SUSPICIOUS_PRODUCTION_METERS_THRESHOLD
}

/**
 * Validate a production log entry (meters > 0).
 *
 * Strict: worker + quality/work anchor + rate > 0 are all required.
 */
export function validateProductionLog(entry: ProductionLogEntry): ValidationResult {
    const errors: string[] = []

    if (entry.meters < 0) {
        errors.push(VALIDATION_MESSAGES.NEGATIVE_METERS)
    }

    if (!entry.worker_id) {
        errors.push(VALIDATION_MESSAGES.WORKER_REQUIRED)
    }

    // order_id is the current quality/work anchor implementation
    if (!entry.order_id) {
        errors.push(VALIDATION_MESSAGES.QUALITY_REQUIRED)
    }

    const rate = Number(entry.rate_per_m)
    if (entry.rate_per_m == null || isNaN(rate)) {
        errors.push(VALIDATION_MESSAGES.RATE_MISSING)
    } else if (rate <= 0) {
        errors.push(VALIDATION_MESSAGES.RATE_ZERO)
    }

    return { valid: errors.length === 0, errors }
}

/**
 * Validate a status/downtime log (meters === 0).
 *
 * Forgiving: only reason is required. "Other" reason requires a note.
 * Worker, order/quality anchor, and rate are all optional.
 */
export function validateStatusLog(entry: ProductionLogEntry): ValidationResult {
    const errors: string[] = []

    const reason = entry.zero_meter_reason?.trim()
    if (!reason) {
        errors.push(VALIDATION_MESSAGES.REASON_REQUIRED)
    } else if (reason === 'other') {
        const note = entry.zero_meter_note?.trim()
        if (!note) {
            errors.push(VALIDATION_MESSAGES.NOTE_REQUIRED_OTHER)
        }
    }

    return { valid: errors.length === 0, errors }
}

/**
 * Validate any production log entry — dispatches to strict or forgiving
 * based on whether meters > 0.
 */
export function validateEntry(entry: ProductionLogEntry): ValidationResult {
    if (entry.meters < 0) {
        return { valid: false, errors: [VALIDATION_MESSAGES.NEGATIVE_METERS] }
    }

    if (entry.meters > 0) {
        return validateProductionLog(entry)
    }

    // meters === 0 → status/downtime log
    return validateStatusLog(entry)
}
