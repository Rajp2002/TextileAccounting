import { z } from 'zod'
import { getSuratTodayString } from './time'

export const AGE_VERIFICATION_METHODS = [
    { value: 'government_id', label: 'Government ID' },
    { value: 'birth_certificate', label: 'Birth certificate' },
    { value: 'school_record', label: 'School record' },
    { value: 'other', label: 'Other verified record' },
] as const

export const WorkerAgeVerificationMethodSchema = z.enum([
    'government_id',
    'birth_certificate',
    'school_record',
    'other',
])

export type WorkerAgeVerificationMethod = z.infer<typeof WorkerAgeVerificationMethodSchema>

export function isStrictDateOnly(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))

    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day
}

export const DateOnlySchema = z
    .string()
    .refine(isStrictDateOnly, 'Enter a valid date in YYYY-MM-DD format')

export function getAdultWorkerCutoffDate(today = getSuratTodayString()): string {
    const [year, month, day] = today.split('-').map(Number)
    const cutoff = new Date(Date.UTC(year - 18, month - 1, day))
    // Date.UTC normalizes 29 February into 1 March in a non-leap year. For an
    // age boundary, use the last valid day of February instead.
    if (cutoff.getUTCMonth() !== month - 1) cutoff.setUTCDate(0)
    return cutoff.toISOString().slice(0, 10)
}

export const WorkerAgeVerificationSchema = z.object({
    date_of_birth: DateOnlySchema,
    age_verification_method: WorkerAgeVerificationMethodSchema,
    age_verification_reference: z
        .string()
        .trim()
        .min(4, 'Enter a non-sensitive evidence reference (at least 4 characters)')
        .max(160, 'Evidence reference is too long'),
}).superRefine((data, ctx) => {
    if (data.date_of_birth > getAdultWorkerCutoffDate()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Worker must be at least 18 years old',
            path: ['date_of_birth'],
        })
    }
})

export function workerValidationError(error: unknown, fallback: string): string {
    if (error instanceof z.ZodError) {
        return error.issues[0]?.message ?? fallback
    }
    return fallback
}
