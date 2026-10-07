'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActiveSupervisor } from '@/lib/supervisor-session'
import { createClient } from '@/lib/supabase/server'
import { SUPERVISOR_SHEET_PATH, supervisorDateWindow } from '@/lib/supervisor-access'
import type { SupervisorTextKey } from '@/lib/i18n/supervisor-access'

const uuid = z.string().uuid()
const meters = z.number().finite().min(0).max(1_000_000)

const SaveSchema = z.object({
    productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    shift: z.enum(['day', 'night']),
    clientRequestId: uuid,
    expectedUpdatedAt: z.string().max(64).nullable(),
    correctionReason: z.string().trim().max(240).optional(),
    entries: z.array(z.object({
        worker_id: uuid,
        entry_status: z.enum(['blank', 'entered', 'zero', 'absent']),
        meters: meters.nullable(),
        notes: z.string().max(500).nullable(),
        machine_records: z.array(z.object({ machine_id: uuid, state: z.enum(['entered', 'pending', 'not_running', 'absent']) })).max(100),
        allocations: z.array(z.object({ machine_id: uuid, job_id: uuid, meters })).max(100),
    })).min(1).max(500),
})

export type SupervisorSaveInput = z.infer<typeof SaveSchema>
export type SupervisorSaveResult =
    | { success: true; totalMeters: number; idempotent: boolean }
    | { error: SupervisorTextKey; message?: string }

const DATABASE_ERRORS: Record<string, SupervisorTextKey> = {
    '40001': 'errorConflict',
    '23503': 'errorSetup',
    '42501': 'errorAccess',
}

/** The database function re-checks the supervisor, the factory, the date window and every row. */
export async function saveSupervisorDailySheet(input: SupervisorSaveInput): Promise<SupervisorSaveResult> {
    const session = await requireActiveSupervisor()
    const parsed = SaveSchema.safeParse(input)
    if (!parsed.success) return { error: 'enterSomething' }
    const data = parsed.data
    const window = supervisorDateWindow(session.today)
    if (data.productionDate < window.min || data.productionDate > window.max) return { error: 'errorGeneric' }

    const supabase = await createClient()
    const { data: result, error } = await supabase.rpc('save_supervisor_daily_sheet', {
        p_production_date: data.productionDate,
        p_shift: data.shift,
        p_client_request_id: data.clientRequestId,
        p_entries: data.entries,
        p_correction_reason: data.correctionReason || null,
        p_expected_updated_at: data.expectedUpdatedAt,
    })
    if (error) {
        if (error.message) console.error(`[supervisor-daily-sheet] ${error.message}`)
        const key = error.code ? DATABASE_ERRORS[error.code] : undefined
        return key ? { error: key } : { error: 'errorGeneric', ...(error.code === '22023' && error.message ? { message: error.message } : {}) }
    }

    revalidatePath(SUPERVISOR_SHEET_PATH)
    revalidatePath('/owner/production')
    revalidatePath('/owner/payroll')
    const summary = (result ?? {}) as { total_meters?: number | string; idempotent?: boolean }
    return { success: true, totalMeters: Number(summary.total_meters ?? 0), idempotent: summary.idempotent === true }
}
