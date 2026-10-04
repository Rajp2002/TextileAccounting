import { describe, expect, it } from 'vitest'
import { retentionHoldSchema, retentionPolicySchema, retentionReadSchema, retentionRecordClasses, type RetentionPolicy } from '@/lib/admin/retention-contracts'

const id = '10000000-0000-4000-8000-000000000001'
const instant = '2026-10-04T12:00:00.000Z'
function policy(): RetentionPolicy {
    return { id, version: 1, policyMode: 'fixed_days', retentionDays: 90, retentionAnchor: 'record_created', summary: 'Synthetic approved fixture period',
        approvalReference: 'fixture:RET-1', approvedBy: id, approvedAt: '2026-10-03T12:00:00.000Z', effectiveFrom: instant, reviewDueAt: null }
}
export function emptyRetentionFixture() {
    return { definitionVersion: 'admin-retention-v1', asOf: instant, automaticPurgeEnabled: false, releaseStatus: 'incomplete',
        classes: retentionRecordClasses.map(recordClass => ({ recordClass, label: recordClass, policyState: 'unconfigured', policy: null, activeHoldCount: 0, sourceLinkageIssues: 0, pendingPolicyCount: 0 })),
        holds: { items: [], totalActive: 0, sourceLinkageIssues: 0 } }
}

describe('retention metadata contracts', () => {
    it('keeps missing policies unconfigured and automatic purge disabled', () => {
        expect(retentionReadSchema.parse(emptyRetentionFixture())).toMatchObject({ releaseStatus: 'incomplete', automaticPurgeEnabled: false })
    })
    it('requires exact positive integer days only for fixed periods, with approval and a meaningful anchor', () => {
        expect(retentionPolicySchema.safeParse(policy()).success).toBe(true)
        for (const retentionDays of [0, -1, 0.5, 36501, null]) {
            expect(retentionPolicySchema.safeParse({ ...policy(), retentionDays }).success).toBe(false)
        }
        expect(retentionPolicySchema.safeParse({ ...policy(), policyMode: 'manual_review', retentionDays: null, retentionAnchor: 'manual_review' }).success).toBe(true)
        expect(retentionPolicySchema.safeParse({ ...policy(), policyMode: 'manual_review' }).success).toBe(false)
        expect(retentionPolicySchema.safeParse({ ...policy(), approvedBy: undefined }).success).toBe(false)
        expect(retentionPolicySchema.safeParse({ ...policy(), approvalReference: 'https://secret@example.test/approval?token=secret' }).success).toBe(false)
        expect(retentionPolicySchema.safeParse({ ...policy(), approvedAt: '2026-10-05T12:00:00.000Z' }).success).toBe(false)
        expect(retentionPolicySchema.safeParse({ ...policy(), reviewDueAt: instant }).success).toBe(false)
    })
    it('rejects missing/duplicate classes and plausible ready claims without approved periods', () => {
        const fixture = emptyRetentionFixture()
        expect(retentionReadSchema.safeParse({ ...fixture, releaseStatus: 'review_ready' }).success).toBe(false)
        expect(retentionReadSchema.safeParse({ ...fixture, classes: fixture.classes.slice(1) }).success).toBe(false)
        expect(retentionReadSchema.safeParse({ ...fixture, classes: fixture.classes.map(item => ({ ...item, recordClass: 'ordinary_support' })) }).success).toBe(false)
        expect(retentionReadSchema.safeParse({ ...fixture, automaticPurgeEnabled: true }).success).toBe(false)
    })
    it('never makes a manual review policy or overdue approval ready', () => {
        const classes = emptyRetentionFixture().classes.map(item => ({ ...item, policyState: 'configured', policy: policy() }))
        expect(retentionReadSchema.safeParse({ ...emptyRetentionFixture(), classes, releaseStatus: 'review_ready' }).success).toBe(true)
        classes[0].policy = { ...policy(), policyMode: 'manual_review', retentionDays: null, retentionAnchor: 'manual_review' }
        expect(retentionReadSchema.safeParse({ ...emptyRetentionFixture(), classes, releaseStatus: 'review_ready' }).success).toBe(false)
        classes[0].policy = { ...policy(), reviewDueAt: '2026-10-04T11:00:00.000Z', effectiveFrom: '2026-10-03T13:00:00.000Z' }
        classes[0].policyState = 'review_due'
        expect(retentionReadSchema.safeParse({ ...emptyRetentionFixture(), classes, releaseStatus: 'incomplete' }).success).toBe(true)
    })
    it('rejects source linkage inconsistencies, private payload fields and unsupported policy anchors', () => {
        const fixture = emptyRetentionFixture()
        expect(retentionReadSchema.safeParse({ ...fixture, holds: { ...fixture.holds, totalActive: 1 } }).success).toBe(false)
        expect(retentionReadSchema.safeParse({ ...fixture, rawTicketBody: 'private' }).success).toBe(false)
        expect(retentionHoldSchema.safeParse({ id, recordClass: 'privacy_cases', sourceType: 'support_ticket', sourceId: id, orgId: null,
            reason: 'Synthetic hold', reference: 'fixture:HOLD-1', placedBy: id, placedAt: instant, sourceLinked: true }).success).toBe(false)
        const classes = fixture.classes.map(item => ({ ...item, policyState: 'configured', policy: policy() }))
        classes[5].policy.retentionAnchor = 'ticket_resolved'
        expect(retentionReadSchema.safeParse({ ...fixture, classes, releaseStatus: 'review_ready' }).success).toBe(false)
    })
})
