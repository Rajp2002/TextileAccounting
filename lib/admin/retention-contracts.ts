import { z } from 'zod'

export const retentionRecordClasses = ['ordinary_support', 'internal_notes', 'privacy_cases', 'security_incidents_audit', 'billing_evidence', 'reporting_data'] as const
export const retentionSourceTypes = ['support_ticket', 'support_internal_note', 'grievance', 'security_incident', 'admin_audit_event', 'billing_fact', 'billing_coverage', 'reporting_classification'] as const
const sourceClasses = { support_ticket: 'ordinary_support', support_internal_note: 'internal_notes', grievance: 'privacy_cases', security_incident: 'security_incidents_audit',
    admin_audit_event: 'security_incidents_audit', billing_fact: 'billing_evidence', billing_coverage: 'billing_evidence', reporting_classification: 'reporting_data' } as const
const instant = z.iso.datetime({ offset: true })
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const reference = z.string().min(3).max(240).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]+$/)
const description = z.string().trim().min(3).max(500).refine(value => !/[\u0000-\u001f\u007f]/.test(value))

export const retentionPolicySchema = z.object({
    id: z.uuid(), version: z.number().int().positive(), policyMode: z.enum(['fixed_days', 'manual_review']),
    retentionDays: z.number().int().min(1).max(36500).nullable(),
    retentionAnchor: z.enum(['record_created', 'ticket_resolved', 'case_closed', 'provider_event', 'manual_review']),
    summary: description, approvalReference: reference, approvedBy: z.uuid(), approvedAt: instant,
    effectiveFrom: instant, reviewDueAt: instant.nullable(),
}).strict().refine(value => value.policyMode === 'fixed_days'
    ? value.retentionDays !== null && value.retentionAnchor !== 'manual_review'
    : value.retentionDays === null && value.retentionAnchor === 'manual_review', 'Policy mode and period must agree.')
    .refine(value => Date.parse(value.effectiveFrom) >= Date.parse(value.approvedAt), 'Approval must precede effect.')
    .refine(value => !value.reviewDueAt || Date.parse(value.reviewDueAt) > Date.parse(value.effectiveFrom), 'Review must follow effect.')

export const retentionClassSchema = z.object({
    recordClass: z.enum(retentionRecordClasses), label: z.string().min(1).max(100),
    policyState: z.enum(['unconfigured', 'configured', 'review_due']), policy: retentionPolicySchema.nullable(),
    activeHoldCount: count, sourceLinkageIssues: count, pendingPolicyCount: count,
}).strict().refine(value => (value.policyState === 'unconfigured') === (value.policy === null), 'Missing policy must remain unconfigured.')
    .refine(value => value.sourceLinkageIssues <= value.activeHoldCount, 'Source issues must be bounded by holds.')

export const retentionHoldSchema = z.object({
    id: z.uuid(), recordClass: z.enum(retentionRecordClasses), sourceType: z.enum(retentionSourceTypes), sourceId: z.uuid(), orgId: z.uuid().nullable(),
    reason: description, reference, placedBy: z.uuid(), placedAt: instant, sourceLinked: z.boolean(),
}).strict().refine(value => sourceClasses[value.sourceType] === value.recordClass, 'Hold class must match its source.')

/** Narrow reviewed metadata only: no bodies, credentials, erasure operations or legal conclusions. */
export const retentionReadSchema = z.object({
    definitionVersion: z.literal('admin-retention-v1'), asOf: instant, automaticPurgeEnabled: z.literal(false),
    releaseStatus: z.enum(['incomplete', 'review_ready']), classes: z.array(retentionClassSchema).length(retentionRecordClasses.length),
    holds: z.object({ items: z.array(retentionHoldSchema).max(101), totalActive: count, sourceLinkageIssues: count }).strict(),
}).strict().superRefine((value, ctx) => {
    if (value.classes.some((item, index) => item.recordClass !== retentionRecordClasses[index])) {
        ctx.addIssue({ code: 'custom', message: 'Record classes must be complete and in order.', path: ['classes'] })
    }
    if (value.classes.reduce((sum, item) => sum + item.activeHoldCount, 0) !== value.holds.totalActive
        || value.classes.reduce((sum, item) => sum + item.sourceLinkageIssues, 0) !== value.holds.sourceLinkageIssues
        || value.holds.items.length > value.holds.totalActive || new Set(value.holds.items.map(item => item.id)).size !== value.holds.items.length) {
        ctx.addIssue({ code: 'custom', message: 'Hold totals must agree.', path: ['holds'] })
    }
    if (value.holds.items.some(item => Date.parse(item.placedAt) > Date.parse(value.asOf))) {
        ctx.addIssue({ code: 'custom', message: 'Hold time must precede the snapshot.', path: ['holds'] })
    }
    const periodsReady = value.classes.every(item => item.policyState === 'configured' && item.policy?.policyMode === 'fixed_days')
        && value.holds.sourceLinkageIssues === 0
    if ((value.releaseStatus === 'review_ready') !== periodsReady) {
        ctx.addIssue({ code: 'custom', message: 'Incomplete policy periods cannot be ready.', path: ['releaseStatus'] })
    }
    for (const [index, item] of value.classes.entries()) {
        if (item.policy) {
            const reviewDue = item.policy.reviewDueAt !== null && Date.parse(item.policy.reviewDueAt) <= Date.parse(value.asOf)
            if (Date.parse(item.policy.effectiveFrom) > Date.parse(value.asOf) || (item.policyState === 'review_due') !== reviewDue) {
                ctx.addIssue({ code: 'custom', message: 'Policy state must match the snapshot.', path: ['classes', index, 'policyState'] })
            }
            const anchor = item.policy.retentionAnchor
            if ((anchor === 'ticket_resolved' && !['ordinary_support', 'internal_notes'].includes(item.recordClass))
                || (anchor === 'case_closed' && !['privacy_cases', 'security_incidents_audit'].includes(item.recordClass))
                || (anchor === 'provider_event' && item.recordClass !== 'billing_evidence')) {
                ctx.addIssue({ code: 'custom', message: 'Policy anchor must match the source.', path: ['classes', index, 'policy'] })
            }
        }
    }
})

export const retentionQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().max(700).optional() }).strict()
export const retentionCursorSchema = z.object({ at: instant, id: z.uuid(), asOf: instant }).strict()
export type RetentionRecordClass = typeof retentionRecordClasses[number]
export type RetentionPolicy = z.infer<typeof retentionPolicySchema>
export type RetentionHold = z.infer<typeof retentionHoldSchema>
export type RetentionReview = Omit<z.infer<typeof retentionReadSchema>, 'holds'> & {
    holds: z.infer<typeof retentionReadSchema>['holds'] & { nextCursor: string | null }
    requestId: string
}
