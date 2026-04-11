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

/** Password: min 8 chars, uppercase + number required (F1 spec) */
export const PasswordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')

/**
 * CreateOrgSchema — owner signup form (F1 spec §4)
 * Used by createOrganization() server action.
 */
export const CreateOrgSchema = z.object({
    ownerName:   z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name too long'),
    email:       z.string().trim().email('Invalid email address').max(254),
    password:    PasswordSchema,
    factoryName: z.string().trim().min(2, 'Factory name required').max(120, 'Factory name too long'),
    phone:       z.string().trim().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
})

export const UpdateOrgNameSchema = z.object({
    name: z.string().trim().min(2, 'Factory name required').max(120, 'Factory name too long'),
})

/**
 * JoinOrgSchema — supervisor join form (F1 spec §4)
 * Used by joinOrganization() server action.
 */
export const JoinOrgSchema = z.object({
    joinCode:       z.string().trim().length(8, 'Code must be exactly 8 characters'),
    supervisorName: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name too long'),
    email:          z.string().trim().email('Invalid email address').max(254),
    password:       PasswordSchema,
    phone:          z.string().trim().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
})

/**
 * SignInSchema — login form (F1 spec §4)
 * Used by signIn() server action.
 */
export const SignInSchema = z.object({
    email:    z.string().trim().email('Invalid email address'),
    password: z.string().min(1, 'Password required'),
})

/**
 * @deprecated Use CreateOrgSchema instead.
 * Kept temporarily so any lingering references compile.
 */
export const SignupSchema = CreateOrgSchema

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

// ─── Estimator Schemas (V3) ───────────────────────────────────────────────────
// V1 schemas (EstimatorSettingsSchema, EstimatorTemplateSchema, EstimatorQuoteSchema)
// have been removed as part of the Estimator V3 clean break.
// V3 uses TypeScript types from lib/estimator.ts directly for complex JSONB structures.

export const FactoryCostProfileSchema = z.object({
    warping_rate_per_kg:     z.number().nonnegative().max(10_000),
    sizing_rate_per_kg:      z.number().nonnegative().max(10_000),
    winding_rate_per_kg:     z.number().nonnegative().max(10_000),
    overhead_pct:            z.number().min(0).max(100),
    default_commission_pct:  z.number().min(0).max(100),
    default_transport_per_m: z.number().nonnegative().max(100_000),
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
