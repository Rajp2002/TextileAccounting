import { formalDetailSchema, type FormalDetail, type FormalKind } from '@/lib/admin/formal-contracts'
import { retentionRecordClasses, type RetentionReview } from '@/lib/admin/retention-contracts'
export { createFormalSchema, adoptFormalSchema, noteFormalSchema, updateFormalSchema } from '@/lib/admin/formal-contracts'

export const fixtureId = '20000000-0000-4000-8000-000000000001'
export const fixtureOrgId = '20000000-0000-4000-8000-000000000002'
export const fixtureInstant = '2026-10-04T12:00:00.000Z'
export function formalFixture(kind: FormalKind, managed = true): FormalDetail {
    return formalDetailSchema.parse({ record: {
        id: fixtureId, kind, orgId: fixtureOrgId, title: kind === 'privacy' ? 'Synthetic privacy request' : 'Synthetic security incident',
        status: kind === 'privacy' ? 'pending' : 'reported', severity: kind === 'security' ? 'unassessed' : null, identityState: kind === 'privacy' ? 'pending' : null,
        recordedAt: fixtureInstant, sortAt: fixtureInstant, internalTargetDate: kind === 'privacy' ? '2026-11-03' : null,
        managed, version: managed ? 1 : 0, nextAction: 'Review synthetic received context', followUpDueAt: '2026-10-05T12:00:00.000Z',
        body: '<img src=x onerror="window.__syntheticXss=true"> Synthetic received context rendered as text.', contactEmail: 'synthetic-person@example.test',
        category: 'other', source: kind === 'security' ? 'internal' : 'manual_email', receivedAt: fixtureInstant, requesterBound: false, acknowledgedAt: null, acknowledgementEvidenceRef: null,
        identityEvidenceRef: null, outcomeCode: null, outcomeSummary: null, outcomeEvidenceRef: null, responseRecordedAt: null, closedAt: null,
        sourceReference: 'fixture:received-message', existingAssessment: kind === 'security' ? 'pending' : null, existingAssessmentDueAt: kind === 'security' ? '2026-10-04T18:00:00.000Z' : null,
    }, notes: [{ id: '20000000-0000-4000-8000-000000000003', body: '<script>window.__syntheticXss=true</script> Synthetic founder-only note.', createdAt: fixtureInstant }],
    events: [{ id: '20000000-0000-4000-8000-000000000004', eventType: 'case_received', before: {}, after: { status: kind === 'privacy' ? 'pending' : 'reported' }, createdAt: fixtureInstant }],
    revisions: [], nextHistoryCursor: null, asOf: fixtureInstant })
}
export function retentionFixture(): RetentionReview {
    const labels = ['Ordinary support', 'Internal support notes', 'Privacy cases', 'Security incidents and founder audit', 'Billing evidence', 'Reporting data']
    return { definitionVersion: 'admin-retention-v1', asOf: fixtureInstant, automaticPurgeEnabled: false, releaseStatus: 'incomplete',
        classes: retentionRecordClasses.map((recordClass, index) => ({ recordClass, label: labels[index], policyState: 'unconfigured', policy: null, activeHoldCount: 0, sourceLinkageIssues: 0, pendingPolicyCount: 0 })),
        holds: { items: [], totalActive: 0, sourceLinkageIssues: 0, nextCursor: null }, requestId: '20000000-0000-4000-8000-000000000005' }
}
