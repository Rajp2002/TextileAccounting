import { z } from 'zod'

const meterText = z.string().max(32)
const rowSchema = z.object({
    meters: meterText,
    status: z.enum(['blank', 'entered', 'zero', 'absent']),
    machineMeters: z.record(z.string(), meterText),
    savedUnallocatedMeters: z.number().finite().nonnegative().nullable(),
})
const draftSchema = z.object({
    version: z.literal(1),
    revision: z.string().nullable(),
    requestId: z.string().uuid(),
    reason: z.string().max(240),
    rows: z.record(z.string(), rowSchema),
})
export type BaseProductionDraft = z.infer<typeof draftSchema>

export function baseProductionDraftKey(orgId: string, actorId: string, date: string, shift: string) {
    return `weavly:base-production:v1:${orgId}:${actorId}:${date}:${shift}`
}

export function parseBaseProductionDraft(text: string | null): BaseProductionDraft | null {
    if (!text || text.length > 1_000_000) return null
    try {
        const result = draftSchema.safeParse(JSON.parse(text))
        return result.success ? result.data : null
    } catch { return null }
}
