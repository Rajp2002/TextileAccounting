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

/** Machine status enum — used in the unified supervisor dashboard */
export const MachineStatusSchema = z.enum(['running', 'idle', 'maintenance'])

/** Shift enum */
export const ShiftSchema = z.enum(['day', 'night'])

/** Worker type enum */
export const WorkerTypeSchema = z.enum(['meter', 'fixed'])

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

/** Password: 8–128 chars, uppercase + number + special character required. */
export const PasswordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character')

/**
 * CreateOrgSchema — owner signup form (F1 spec §4)
 * Used by createOrganization() server action.
 */
export const CreateOrgSchema = z.object({
    ownerName:   z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name too long'),
    email:       z.string().trim().email('Invalid email address').max(254),
    password:    PasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    factoryName: z.string().trim().min(2, 'Factory name required').max(120, 'Factory name too long'),
    phone:       z.string().trim().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
    referralCode: z.string().trim().optional(),
}).superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Passwords do not match' })
    }
})

export const UpdateOrgNameSchema = z.object({
    name: z.string().trim().min(2, 'Factory name required').max(120, 'Factory name too long'),
})

export const ProductionModeSchema = z.enum(['market_run', 'order_based', 'both'])
export const ProductExperienceSchema = z.enum(['base', 'full_suite'])

/**
 * JoinOrgSchema — supervisor join form (F1 spec §4)
 * Used by joinOrganization() server action.
 */
export const JoinOrgSchema = z.object({
    joinCode:       z.string().trim().length(8, 'Code must be exactly 8 characters'),
    supervisorName: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name too long'),
    email:          z.string().trim().email('Invalid email address').max(254),
    password:       PasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    phone:          z.string().trim().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
}).superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Passwords do not match' })
    }
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
 * PasswordResetRequestSchema — forgot password form.
 * Used by requestPasswordReset() server action.
 */
export const PasswordResetRequestSchema = z.object({
    email: z.string().trim().email('Invalid email address').max(254),
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
        .max(100_000, 'Price per metre exceeds expected range'),
    /** worker rate per meter in ₹ */
    default_worker_rate_per_m: z
        .number()
        .nonnegative('Rate cannot be negative')
        .max(100_000, 'Worker rate per metre exceeds expected range'),
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

export const YarnMovementTypeSchema = z.enum([
    'purchase',
    'issue_to_warping',
    'issue_to_sizing',
    'issue_to_loom_weft',
    'return_leftover',
    'adjustment',
])

export const AdjustmentModeSchema = z.enum(['add', 'subtract'])

export const YarnLotSchema = z.object({
    supplier: z.string().trim().min(1, 'Supplier is required').max(120, 'Supplier name too long'),
    bill_no: z.string().trim().min(1, 'Bill number is required').max(80, 'Bill number too long'),
    bill_date: DateSchema,
    yarn_type: z.string().trim().min(1, 'Yarn type is required').max(120, 'Yarn type too long'),
    denier_count: z.string().trim().min(1, 'Denier/count is required').max(80, 'Denier/count too long'),
    filament_material: z.string().trim().min(1, 'Filament/material is required').max(120, 'Filament/material too long'),
    received_kg: z.number().positive('Weight must be positive').max(100_000, 'Weight exceeds maximum'),
    received_cones: z.number().int('Cones must be a whole number').min(0, 'Cones cannot be negative').max(1_000_000, 'Cones exceeds maximum'),
    rate_per_kg: z.number().nonnegative('Rate cannot be negative').max(100_000, 'Rate exceeds maximum'),
    gst_percent: z.number().min(0, 'GST cannot be negative').max(100, 'GST cannot exceed 100%'),
    total_cost: z.number().nonnegative('Total cost cannot be negative').max(1_000_000_000, 'Total cost exceeds maximum'),
    notes: z.string().trim().max(500, 'Notes too long').optional().or(z.literal('')),
})

export const BeamCardSchema = z.object({
    beam_no: z.string().trim().min(1, 'Beam number is required').max(80, 'Beam number too long'),
    order_id: UuidSchema,
    quality_label: z.string().trim().min(1, 'Quality is required').max(160, 'Quality label too long'),
    beam_ends: z.number().int('Beam ends must be a whole number').min(0, 'Beam ends cannot be negative').max(1_000_000, 'Beam ends exceeds maximum'),
    tape_length_m: z.number().nonnegative('Tape length cannot be negative').max(1_000_000, 'Tape length exceeds maximum'),
    expected_metres: z.number().nonnegative('Expected metres cannot be negative').max(10_000_000, 'Expected metres exceeds maximum'),
    actual_beam_weight_kg: z.number().nonnegative('Actual beam weight cannot be negative').max(100_000, 'Beam weight exceeds maximum').nullable().optional(),
    sizing_vendor: z.string().trim().max(120, 'Sizing vendor name too long').optional().or(z.literal('')),
    sizing_bill_no: z.string().trim().max(80, 'Sizing bill number too long').optional().or(z.literal('')),
    notes: z.string().trim().max(500, 'Notes too long').optional().or(z.literal('')),
})

export const YarnMovementSchema = z.object({
    yarn_lot_id: UuidSchema,
    movement_type: YarnMovementTypeSchema,
    movement_date: DateSchema,
    quantity_kg: z.number().positive('Quantity must be positive').max(100_000, 'Quantity exceeds maximum'),
    cones: z.number().int('Cones must be a whole number').min(0, 'Cones cannot be negative').max(1_000_000, 'Cones exceeds maximum').default(0),
    order_id: UuidSchema.optional().or(z.literal('')),
    beam_card_id: UuidSchema.optional().or(z.literal('')),
    adjustment_mode: AdjustmentModeSchema.optional(),
    notes: z.string().trim().max(500, 'Notes too long').optional().or(z.literal('')),
}).superRefine((data, ctx) => {
    if (data.movement_type === 'adjustment' && !data.adjustment_mode) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Adjustment mode is required for adjustments',
            path: ['adjustment_mode'],
        })
    }

    if (data.movement_type !== 'adjustment' && data.adjustment_mode) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Adjustment mode can only be used with adjustments',
            path: ['adjustment_mode'],
        })
    }
})

// ─── Order Schemas ────────────────────────────────────────────────────────────

export const OrderSchema = z
    .object({
        id: UuidSchema.optional(),
        party_name: z.string().trim().min(1, 'Party name is required').max(200, 'Name too long'),
        quality_id: UuidSchema,
        total_target_meters: z
            .number()
            .positive('Target metres must be positive')
            .max(10_000_000, 'Target metres exceed the realistic maximum'),
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
    machineIds: z.array(UuidSchema).max(100, 'Too many looms in one assignment'),
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

export const PayrollConfigSchema = z.object({
    cycleStartDay: z.number().int().min(1).max(28, 'Day must be between 1 and 28'),
    payDateDay: z.number().int().min(1).max(28, 'Pay date must be between 1 and 28').default(10),
    payReminderDays: z.number().int().min(0).max(14, 'Reminder window must be between 0 and 14 days').default(3),
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
    // Legacy compatibility field. New profiles choose an explicit overhead
    // method and do not expose or calculate this percentage.
    overhead_pct:            z.number().min(0).max(100).optional(),
    overhead_mode:           z.enum(['direct', 'monthly_expenses']).optional(),
    overhead_override_per_m: z.number().nonnegative().max(100_000).nullable().optional(),
    default_commission_pct:  z.number().min(0).max(100),
    default_transport_per_m: z.number().nonnegative().max(100_000),
})

// ─── Party Ledger Schemas ────────────────────────────────────────────────────

export const PartyTypeSchema = z.enum(['trader', 'processor', 'broker', 'supplier', 'other'])

export const OpeningBalanceTypeSchema = z.enum(['receivable', 'payable'])

export const ReceiptMethodSchema = z.enum(['cash', 'upi', 'bank', 'cheque', 'other'])

export const PartyAdjustmentTypeSchema = z.enum([
    'shortage',
    'quality_claim',
    'rate_difference',
    'discount',
    'bad_debt',
    'other',
])

export const PartyAdjustmentDirectionSchema = z.enum(['credit_to_party', 'debit_to_party'])

export const CreatePartySchema = z.object({
    name: z.string().trim().min(2, 'Party name is required').max(160, 'Party name too long'),
    party_type: PartyTypeSchema.default('trader'),
    phone: z.string().trim().regex(/^\d{10}$/, 'Phone must be exactly 10 digits').optional().or(z.literal('')),
    gstin: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Invalid GSTIN')
        .optional()
        .or(z.literal('')),
    state: z.string().trim().min(2, 'State is required').max(80, 'State too long').default('Gujarat'),
    address: z.string().trim().max(500, 'Address too long').optional().or(z.literal('')),
    broker_name: z.string().trim().max(120, 'Broker name too long').optional().or(z.literal('')),
    default_credit_days: z.number().int().min(0).max(365).default(30),
    credit_limit: z.number().nonnegative().max(100_000_000, 'Credit limit too high').default(0),
    opening_balance: z.number().nonnegative().max(100_000_000, 'Opening balance too high').default(0),
    opening_balance_type: OpeningBalanceTypeSchema.default('receivable'),
    risk_note: z.string().trim().max(500, 'Risk note too long').optional().or(z.literal('')),
})

export const UpdatePartySchema = CreatePartySchema.extend({
    is_active: z.boolean().optional(),
})

export const CreatePartyInvoiceSchema = z
    .object({
        party_id: UuidSchema,
        order_id: UuidSchema.optional().or(z.literal('')),
        invoice_number: z.string().trim().max(40, 'Invoice number too long').optional().or(z.literal('')),
        invoice_date: DateSchema,
        due_date: DateSchema,
        total_meters: z.number().nonnegative('Metres cannot be negative').max(10_000_000),
        rate_per_m: z.number().nonnegative('Rate cannot be negative').max(100_000),
        gst_percent: z.number().min(0).max(100).default(0),
        notes: z.string().trim().max(500, 'Notes too long').optional().or(z.literal('')),
    })
    .refine(d => d.invoice_date <= d.due_date, {
        message: 'Due date must be on or after invoice date',
        path: ['due_date'],
    })

export const CreatePartyReceiptSchema = z.object({
    party_id: UuidSchema,
    invoice_id: UuidSchema.optional().or(z.literal('')),
    receipt_date: DateSchema,
    amount: z.number().positive('Receipt amount must be positive').max(100_000_000, 'Receipt amount too high'),
    method: ReceiptMethodSchema.default('cash'),
    reference_no: z.string().trim().max(80, 'Reference too long').optional().or(z.literal('')),
    notes: z.string().trim().max(500, 'Notes too long').optional().or(z.literal('')),
    allocations: z.array(z.object({
        invoice_id: UuidSchema,
        allocated_amount: z.number().positive('Allocated amount must be positive').max(100_000_000, 'Allocated amount too high'),
    })).optional().default([]),
})

export const CreatePartyAdjustmentSchema = z.object({
    party_id: UuidSchema,
    invoice_id: UuidSchema.optional().or(z.literal('')),
    adjustment_date: DateSchema,
    adjustment_type: PartyAdjustmentTypeSchema.default('other'),
    direction: PartyAdjustmentDirectionSchema,
    amount: z.number().positive('Adjustment amount must be positive').max(100_000_000, 'Adjustment amount too high'),
    notes: z.string().trim().max(500, 'Notes too long').optional().or(z.literal('')),
})

export const CreateSupplierSchema = z.object({
    name: z.string().trim().min(1, 'Supplier name is required').max(120, 'Supplier name too long'),
    phone: z.string().trim().regex(/^\d{10}$/, 'Phone must be exactly 10 digits').optional().or(z.literal('')),
    gst_number: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Invalid GST number')
        .optional()
        .or(z.literal('')),
    notes: z.string().trim().max(500, 'Notes too long').optional().or(z.literal('')),
})

export const CreateSupplierLedgerEntrySchema = z.object({
    supplier_id: UuidSchema,
    type: z.enum(['purchase', 'payment']),
    amount: z.number().positive('Amount must be positive').max(100_000_000, 'Amount too high'),
    entry_date: DateSchema,
    note: z.string().trim().max(500, 'Note too long').optional().or(z.literal('')),
})

// ─── Grey Fabric Stock Schemas ──────────────────────────────────────────────

export const FabricPackageTypeSchema = z.enum(['roll', 'bale', 'package', 'bulk'])

export const FabricInspectionStatusSchema = z.enum(['pending', 'pass', 'minor_defect', 'reject'])

export const FabricStockStateSchema = z.enum(['uninspected', 'ready', 'reserved', 'dispatched', 'claimed', 'returned'])

export const FabricPackageGradeSchema = z.string().trim().min(1, 'Grade is required').max(40, 'Grade too long')

export const CreateFabricPackageSchema = z.object({
    order_id: UuidSchema,
    package_no: z.string().trim().max(40, 'Package number too long').optional().or(z.literal('')),
    package_type: FabricPackageTypeSchema.default('bulk'),
    units_count: z.number().int().min(1, 'Units must be at least 1').max(100_000, 'Units too high').default(1),
    metres: z.number().positive('Metres must be greater than zero').max(1_000_000, 'Metres too high'),
    grade: FabricPackageGradeSchema.default('A'),
    inspection_status: FabricInspectionStatusSchema.default('pending'),
    location: z.string().trim().min(1, 'Location is required').max(120, 'Location too long').default('Grey Floor'),
    inspection_notes: z.string().trim().max(500, 'Notes too long').optional().or(z.literal('')),
    inspection_photo_url: z.string().trim().url('Photo must be a valid URL').optional().or(z.literal('')),
    source_date: DateSchema.optional().or(z.literal('')),
    source_shift: ShiftSchema.optional().or(z.literal('')),
    source_reference: z.string().trim().max(120, 'Reference too long').optional().or(z.literal('')),
})

export const UpdateFabricInspectionSchema = z.object({
    package_id: UuidSchema,
    inspection_status: FabricInspectionStatusSchema,
    grade: FabricPackageGradeSchema,
    location: z.string().trim().min(1, 'Location is required').max(120, 'Location too long'),
    inspection_notes: z.string().trim().max(500, 'Notes too long').optional().or(z.literal('')),
    inspection_photo_url: z.string().trim().url('Photo must be a valid URL').optional().or(z.literal('')),
})

export const UpdateFabricPackageStateSchema = z.object({
    package_id: UuidSchema,
    stock_state: FabricStockStateSchema,
})

export const CorrectFabricPackageMetersSchema = z.object({
    package_id: UuidSchema,
    metres: z.number().positive('Metres must be greater than zero').max(1_000_000, 'Metres too high'),
    correction_note: z.string().trim().min(2, 'Reason is required').max(300, 'Reason too long'),
})

// ─── Phase 1 Taka Stock Schemas ──────────────────────────────────────────────

export const FabricStockSourceTypeSchema = z.enum(['opening', 'market_run', 'order', 'manual', 'adjustment'])

export const CreateTakaStockLotSchema = z.object({
    quality_label: z.string().trim().min(1, 'Quality is required').max(160, 'Quality name too long'),
    godown: z.string().trim().min(1, 'Godown is required').max(120, 'Godown name too long').default('Main Godown'),
    source_type: FabricStockSourceTypeSchema.default('manual'),
    market_run_id: UuidSchema.optional().or(z.literal('')),
    order_id: UuidSchema.optional().or(z.literal('')),
    quote_id: UuidSchema.optional().or(z.literal('')),
    taka_count: z.number().positive('Taka count must be greater than zero').max(1_000_000, 'Taka count too high'),
    meters_per_taka: z.number().positive('Metres per Taka must be greater than zero').max(1_000_000, 'Metres per Taka too high'),
    unit_label: z.string().trim().min(1, 'Unit label is required').max(40, 'Unit label too long').default('taka'),
    cost_per_meter: z.number().nonnegative('Cost cannot be negative').max(1_000_000, 'Cost per metre too high'),
    received_date: DateSchema,
    notes: z.string().trim().max(500, 'Notes too long').optional().or(z.literal('')),
})

export const RecordTakaStockSaleSchema = z.object({
    stock_lot_id: UuidSchema,
    taka_sold: z.number().positive('Taka sold must be greater than zero').max(1_000_000, 'Taka sold is too high'),
    price_per_meter: z.number().nonnegative('Sale price cannot be negative').max(1_000_000, 'Sale price too high'),
    sale_date: DateSchema,
    notes: z.string().trim().max(500, 'Notes too long').optional().or(z.literal('')),
})

export const AdjustTakaStockLotSchema = z.object({
    stock_lot_id: UuidSchema,
    adjustment_mode: z.enum(['add', 'subtract']),
    taka_count: z.number().positive('Taka count must be greater than zero').max(1_000_000, 'Taka count too high'),
    notes: z.string().trim().min(2, 'Reason is required').max(500, 'Reason too long'),
})

export const CreateFabricDispatchSchema = z.object({
    order_id: UuidSchema,
    package_ids: z.array(UuidSchema).min(1, 'Select at least one sold stock entry').max(200, 'Too many stock sales selected'),
    challan_number: z.string().trim().max(80, 'Challan number too long').optional().or(z.literal('')),
    notes: z.string().trim().max(300, 'Notes too long').optional().or(z.literal('')),
    eway_bill_number: z.string().trim().max(30, 'E-way bill number too long').optional().or(z.literal('')),
    vehicle_number: z.string().trim().max(20, 'Vehicle number too long').optional().or(z.literal('')),
    transporter_name: z.string().trim().max(120, 'Transporter name too long').optional().or(z.literal('')),
    transporter_id: z.string().trim().max(30, 'Transporter ID too long').optional().or(z.literal('')),
    approximate_distance_km: z.number().nonnegative('Distance cannot be negative').max(10000, 'Distance too high').optional().nullable(),
    eway_bill_generated_at: z.string().trim().optional().or(z.literal('')),
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
