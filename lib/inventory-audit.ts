import Decimal from 'decimal.js'
import { z } from 'zod'

export type AuditStatus = 'draft' | 'finalized'

export type InventoryAudit = {
    id: string
    org_id: string
    audit_date: string
    status: AuditStatus
    title: string
    notes: string | null
    snapshot: unknown
    created_by: string | null
    finalized_by: string | null
    finalized_at: string | null
    created_at: string
    updated_at: string
}

export type AuditLine = {
    id: string
    audit_id: string
    org_id: string
    item_type: 'fabric' | 'yarn'
    item_id: string
    item_label: string
    system_quantity: number
    physical_count: number | null
    variance: number | null
    adjustment_applied: boolean
    adjustment_movement_id: string | null
    notes: string | null
    created_at: string
    updated_at: string
}

export type AuditSummary = {
    total_fabric_meters: number
    total_loose_yarn_kg: number
    total_embodied_yarn_kg: number
    total_yarn_represented_kg: number
    unresolved_fabric_meters: number
}

export type YarnAuditItem = {
    id: string
    yarn_name: string
    yarn_key: string
    system_loose_kg: number
}

export type FabricAuditItem = {
    id: string
    quality_label: string
    quality_key: string
    system_meters: number
}

export type MaterialPositionDrilldown = {
    lot_id: string
    quality_label: string
    costing_version: number
    produced_meters: number
    remaining_meters: number
    embodied_kg: number
    production_date: string
    created_at: string
}

export type MaterialPositionItem = {
    yarn_id: string
    yarn_name: string
    yarn_key: string
    loose_kg: number
    embodied_kg: number
    total_represented_kg: number
    drilldown: MaterialPositionDrilldown[]
}

export type InventoryAuditBoard = {
    audit_date: string
    audit: InventoryAudit | null
    lines: AuditLine[]
    summary: AuditSummary
    yarns: YarnAuditItem[]
    fabric: FabricAuditItem[]
    material_position: MaterialPositionItem[]
}

/**
 * The variance shown for a counted line: the physical count minus the system quantity as of the audit date, rounded
 * half away from zero at the unit scale (metres 2, kg 3). The database computes the same figure when it applies an
 * adjustment (round(physical - system as of the audit date)), so what the owner sees is what is applied (PI-06).
 */
export function auditVariance(physical: number | null | undefined, system: number, decimals: 2 | 3): number | null {
    if (physical === null || physical === undefined) return null
    return new Decimal(physical).minus(system).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber()
}

const AUDIT_LOCALES = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' } as const

/** A quantity with Indian digit grouping in the owner's language. Digits stay Latin so figures read the same everywhere. */
export function formatAuditQuantity(value: number, language: keyof typeof AUDIT_LOCALES, decimals: number, options: { signed?: boolean } = {}) {
    const text = value.toLocaleString(AUDIT_LOCALES[language], { minimumFractionDigits: decimals, maximumFractionDigits: decimals, numberingSystem: 'latn' })
    return options.signed && value > 0 ? `+${text}` : text
}

export const CreateAuditSchema = z.object({
    auditDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    title: z.string().trim().min(1).max(160),
    notes: z.string().trim().max(1000).optional(),
})

export const AuditPhysicalCountSchema = z.object({
    auditId: z.string().uuid(),
    itemType: z.enum(['fabric', 'yarn']),
    itemId: z.string().uuid(),
    itemLabel: z.string().trim().min(1),
    systemQuantity: z.number().finite().min(0),
    physicalCount: z.number().finite().min(0),
    notes: z.string().trim().max(500).optional(),
})

export const AuditAdjustmentSchema = z.object({
    auditId: z.string().uuid(),
    itemType: z.enum(['fabric', 'yarn']),
    itemId: z.string().uuid(),
    physicalCount: z.number().finite().min(0),
    // The variance the owner was shown. The database refuses the adjustment if it would now be a different number.
    expectedVariance: z.number().finite().optional(),
    reason: z.string().trim().min(3).max(500),
})

export const FinalizeAuditSchema = z.object({
    auditId: z.string().uuid(),
})

/**
 * Calculates embodied yarn from remaining fabric lots and their consumption snapshots.
 * Formula per Section 22:
 * Embodied Yarn = Original Recorded Yarn Consumption * (Remaining Fabric Metres / Original Produced Metres)
 */
export function calculateEmbodiedYarn(
    lots: Array<{
        produced_meters: number
        remaining_meters: number
        yarn_consumption: Array<{
            yarn_key: string
            consumed_kg: number
        }>
    }>
): Map<string, number> {
    const embodiedMap = new Map<string, Decimal>()

    for (const lot of lots) {
        if (lot.remaining_meters <= 0 || lot.produced_meters <= 0) continue
        const ratio = new Decimal(lot.remaining_meters).dividedBy(lot.produced_meters)

        for (const item of lot.yarn_consumption) {
            const consumed = new Decimal(item.consumed_kg)
            const embodied = consumed.times(ratio)
            const current = embodiedMap.get(item.yarn_key) ?? new Decimal(0)
            embodiedMap.set(item.yarn_key, current.plus(embodied))
        }
    }

    const result = new Map<string, number>()
    for (const [key, decimal] of embodiedMap.entries()) {
        result.set(key, decimal.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber())
    }
    return result
}

/**
 * Generates CSV representation of the Material Position & Audit.
 */
export function generateMaterialPositionCsv(data: InventoryAuditBoard): string {
    const cell = (val: string | number) =>
        `"${String(val).replace(/^[\s]*[=+@-]/, match => `'${match}`).replaceAll('"', '""')}"`

    const lines: (string | number)[][] = [
        ['Weavly - Inventory Audit & Material Position Report'],
        ['Audit Date', data.audit_date],
        ['Status', data.audit ? data.audit.status.toUpperCase() : 'CURRENT POSITION'],
        ['Total Finished Fabric (m)', data.summary.total_fabric_meters],
        ['Total Loose Usable Yarn (kg)', data.summary.total_loose_yarn_kg],
        ['Total Yarn Embodied in Fabric (kg)', data.summary.total_embodied_yarn_kg],
        ['Total Yarn Inventory Equivalent (kg)', data.summary.total_yarn_represented_kg],
        [],
        ['MATERIAL POSITION / AUDIT (KG)'],
        ['Yarn Specification', 'Loose Usable Yarn (kg)', 'In Fabric Stock (kg)', 'Total Represented (kg)'],
    ]

    for (const row of data.material_position) {
        lines.push([
            row.yarn_name,
            row.loose_kg,
            row.embodied_kg,
            row.total_represented_kg,
        ])
    }

    if (data.summary.unresolved_fabric_meters > 0) {
        lines.push([])
        lines.push([`Note: ${data.summary.unresolved_fabric_meters}m legacy fabric has unresolved yarn composition.`])
    }

    return '\uFEFF' + lines.map(line => line.map(cell).join(',')).join('\r\n')
}
