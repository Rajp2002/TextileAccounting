/**
 * lib/schemas.ts — Centralized Zod v4 Schema Library
 *
 * All server action inputs are validated against these schemas before
 * any database interaction. This prevents:
 *   - Business logic corruption from out-of-range numeric values
 *   - Type confusion attacks (e.g., passing a string as a workerId)
 *   - Date/UUID format issues that could produce unexpected query results
 *
 * Schemas are intentionally strict: they use .safeParse() which never throws,
 * and action handlers return { error: 'Invalid input' } on failure so
 * clients get a clean error rather than an unhandled exception.
 */

import { z } from 'zod'

// ─── Primitives ───────────────────────────────────────────────────────────────

/** Valid UUID string (v4 format) */
export const UuidSchema = z.string().uuid({ message: 'Invalid ID format' })

/** ISO date string YYYY-MM-DD */
export const DateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine(s => !isNaN(Date.parse(s)), 'Invalid date')

/** Month string YYYY-MM */
export const MonthSchema = z
    .string()
    .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, 'Month must be in YYYY-MM format')

/** Positive integer (worker IDs, advance IDs, etc.) */
export const PositiveIntSchema = z
    .number()
    .int('Must be a whole number')
    .positive('Must be a positive number')
    .max(Number.MAX_SAFE_INTEGER)

/** Access code — exactly 6 uppercase alphanumeric characters */
export const AccessCodeSchema = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, 'Access code must be exactly 6 alphanumeric characters')

/** Shift enum */
export const ShiftSchema = z.enum(['day', 'night'])

/** Worker type enum */
export const WorkerTypeSchema = z.enum(['meter', 'fixed'])

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

/** Password: min 8 chars, at least 1 number or special char */
export const PasswordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .refine(
        p => /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p),
        'Password must contain at least 1 number or symbol'
    )

export const SignupSchema = z
    .object({
        name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
        email: z.string().trim().email('Invalid email address').max(254),
        password: PasswordSchema,
        confirmPassword: z.string(),
        role: z.enum(['owner', 'supervisor'], { message: 'Role must be owner or supervisor' }),
        factoryId: z.string().trim().optional().nullable(),
        orgName: z.string().trim().optional().nullable(),
    })
    .refine(d => d.password === d.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    })
    .refine(d => !(d.role === 'supervisor' && !d.factoryId), {
        message: 'Factory ID is required for supervisors',
        path: ['factoryId'],
    })
    .refine(d => !(d.role === 'owner' && !d.orgName), {
        message: 'Organisation name is required for owners',
        path: ['orgName'],
    })

// ─── Inventory Schemas ────────────────────────────────────────────────────────

export const QualitySchema = z.object({
    name: z.string().trim().min(1, 'Quality name is required').max(100, 'Name too long'),
    /** m/kg — typical textile range */
    target_yield: z
        .number()
        .positive('Target yield must be positive')
        .max(100, 'Target yield cannot exceed 100 m/kg — check your value'),
    /** avg revenue per meter in ₹ */
    avg_sale_price_per_m: z
        .number()
        .nonnegative('Price cannot be negative')
        .max(100_000, 'Price per meter exceeds expected range'),
    /** worker rate per meter in ₹ */
    default_worker_rate_per_m: z
        .number()
        .nonnegative('Rate cannot be negative')
        .max(100_000, 'Worker rate per meter exceeds expected range'),
})

export const YarnBatchSchema = z.object({
    name: z.string().trim().min(1, 'Batch name is required').max(100, 'Name too long'),
    quality_id: UuidSchema,
    total_weight_kg: z
        .number()
        .positive('Weight must be positive')
        .max(10_000, 'Weight exceeds maximum (10,000 kg)'),
})

export const CloseBatchSchema = z.object({
    batchId: UuidSchema,
    leftoverWeightKg: z
        .number()
        .nonnegative('Leftover weight cannot be negative')
        .max(10_000, 'Leftover weight exceeds maximum')
        .default(0),
})

// ─── Order Schemas ────────────────────────────────────────────────────────────

export const OrderSchema = z
    .object({
        id: UuidSchema.optional(),
        party_name: z.string().trim().min(1, 'Party name is required').max(200, 'Name too long'),
        quality_id: UuidSchema,
        total_target_meters: z
            .number()
            .positive('Target meters must be positive')
            .max(10_000_000, 'Target meters exceeds realistic maximum'),
        start_date: DateSchema,
        deadline: DateSchema,
        status: z.enum(['active', 'completed', 'cancelled']),
    })
    .refine(d => d.start_date <= d.deadline, {
        message: 'Start date must be on or before the deadline',
        path: ['deadline'],
    })

export const AssignOrderSchema = z.object({
    orderId: UuidSchema,
    /** Array of machine UUIDs — empty array to unassign all */
    machineIds: z.array(UuidSchema).max(100, 'Too many machines in one assignment'),
})

// ─── Advance Schemas ──────────────────────────────────────────────────────────

export const CreateAdvanceSchema = z.object({
    workerType: WorkerTypeSchema,
    workerId: PositiveIntSchema,
    /** Amount in ₹ — min ₹1, max ₹10,000,000 to prevent overflow */
    amount: z
        .number()
        .positive('Advance amount must be positive')
        .max(10_000_000, 'Amount exceeds maximum allowed advance'),
    description: z
        .string()
        .trim()
        .max(500, 'Description too long — max 500 characters')
        .optional()
        .default(''),
})

export const GetAdvancesSchema = z.object({
    workerType: WorkerTypeSchema,
    workerId: PositiveIntSchema,
    statusFilter: z.enum(['pending', 'deducted']).optional(),
})

// ─── Payroll Schemas ──────────────────────────────────────────────────────────

export const ToggleWorkerPaidSchema = z.object({
    workerType: WorkerTypeSchema,
    workerId: PositiveIntSchema,
    month: MonthSchema,
    currentPaid: z.boolean(),
})

// ─── Attendance Schemas ───────────────────────────────────────────────────────

const AttendanceRecordSchema = z.object({
    fixed_worker_id: PositiveIntSchema,
    present: z.boolean(),
})

import { getSuratTodayString } from './time'

export const SavePastAttendanceSchema = z.object({
    date: DateSchema.refine(
        d => d <= getSuratTodayString(),
        'Cannot save attendance for a future date'
    ),
    records: z
        .array(AttendanceRecordSchema)
        .min(1, 'At least one attendance record is required')
        .max(500, 'Too many records in one submission'),
    accessCode: AccessCodeSchema,
})

// ─── Machine / Worker Delete Schemas ─────────────────────────────────────────

export const DeleteWithCodeSchema = z.object({
    id: z.union([PositiveIntSchema, UuidSchema.pipe(z.string())]),
    accessCode: AccessCodeSchema,
})

export const MachineIdSchema = UuidSchema  // Machines use UUID primary keys
export const WorkerIdSchema = PositiveIntSchema  // Workers use integer primary keys

// ─── Estimator Schemas ────────────────────────────────────────────────────────

export const EstimatorSettingsSchema = z.object({
    electricity_rate: z.number().nonnegative().max(100),
    factory_rent_per_day: z.number().nonnegative().max(10_000_000),
    admin_overhead_per_day: z.number().nonnegative().max(10_000_000),
    avg_machine_efficiency: z.number().min(0).max(1),
    standard_wastage_percent: z.number().min(0).max(100),
    standard_shrinkage_percent: z.number().min(0).max(100),
    gst_rate: z.number().min(0).max(100),
    is_gst_inclusive: z.boolean(),
})

export const EstimatorTemplateSchema = z.object({
    id: UuidSchema.optional(),
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    ppi: z.number().int().positive().max(500),
    yarn_denier: z.number().int().positive().max(2000),
    gsm: z.number().int().positive().max(1000),
    default_yarn_rate: z.number().positive().max(100_000),
})

export const JobWorkItemSchema = z.object({
    name: z.string().trim().min(1),
    rate: z.number().nonnegative(),
    shrinkage: z.number().min(0).max(100).default(0),
})

export const EstimatorQuoteSchema = z.object({
    party_name: z.string().trim().min(1, 'Party name is required'),
    template_id: UuidSchema.optional().nullable(),
    ppi: z.number().int().positive(),
    yarn_denier: z.number().int().positive(),
    gsm: z.number().int().positive(),
    meters: z.number().positive(),
    yarn_rate_per_kg: z.number().positive(),
    job_work_charges: z.array(JobWorkItemSchema).default([]),
    landed_cost_per_meter: z.number().positive(),
    quote_price_per_meter: z.number().positive(),
    intended_margin_percent: z.number().min(-100).max(1000),
    order_id: UuidSchema.optional().nullable(),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse and return safe data, or throw a standardized error.
 * Use when you want to fail-fast inside a server action.
 *
 * @example
 * const data = parseOrThrow(QualitySchema, rawInput)
 */
export function parseOrThrow<T>(schema: z.ZodSchema<T>, input: unknown): T {
    const result = schema.safeParse(input)
    if (!result.success) {
        // Return only the first error message — don't expose schema structure
        const firstError = result.error.issues[0]?.message ?? 'Invalid input'
        throw new Error(firstError)
    }
    return result.data
}

/**
 * Parse and return { error } on failure — does NOT throw.
 * Use when the server action returns { error: string } conventionally.
 *
 * @example
 * const parsed = safeParse(QualitySchema, rawInput)
 * if ('error' in parsed) return parsed
 * const data = parsed.data
 */
export function safeParse<T>(
    schema: z.ZodSchema<T>,
    input: unknown
): { data: T } | { error: string } {
    const result = schema.safeParse(input)
    if (!result.success) {
        const firstError = result.error.issues[0]?.message ?? 'Invalid input'
        return { error: firstError }
    }
    return { data: result.data }
}
