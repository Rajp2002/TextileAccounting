// Synthetic DTOs only. No founder authorization or source records are loaded.
import type { LegacyRecord, LegacyRegister, listLegacyRecords } from '../../../lib/admin/legacy-read'
export const LEGACY_REGISTERS = {
    grievances: { label: 'Privacy grievances', searchLabel: 'Subject', states: ['pending', 'acknowledged', 'escalated', 'resolved'] },
    incidents: { label: 'Security incidents', searchLabel: 'Title', states: ['reported', 'triaging', 'contained', 'investigating', 'monitoring', 'closed'] },
    dpas: { label: 'DPA records', searchLabel: 'Version', states: ['active', 'inactive'] },
    notices: { label: 'Notice registry', searchLabel: 'Version', states: ['active', 'inactive'] },
}
const asOf = '2026-10-04T10:00:00Z'
const id = '55555555-5555-4555-8555-555555555555'
export function legacyFixtureList(): Awaited<ReturnType<typeof listLegacyRecords>> {
    const query = new URL(location.href).searchParams
    const kind = (query.get('kind') ?? 'grievances') as LegacyRegister
    const title = kind === 'grievances' ? 'Synthetic privacy request' : `Synthetic ${kind} record`
    return { kind, filters: { kind, state: query.get('state') ?? 'all', search: query.get('search') ?? '', limit: 25 },
        items: [{ id, orgId: null, title: query.has('cursor') ? `${title} next page` : title, state: kind === 'grievances' ? 'pending' : 'active', recordedAt: asOf, context: 'Synthetic recorded evidence' }],
        nextCursor: query.has('cursor') ? null : 'synthetic-next', asOf, readOnly: true,
        requestId: '55555555-5555-4555-8555-555555555556', coverage: 'Synthetic component fixture only.' }
}
export function legacyFixtureRecord(): LegacyRecord {
    return { id, orgId: null, title: 'Synthetic privacy request', state: 'pending', recordedAt: asOf, context: 'Synthetic source', kind: 'grievances', asOf, readOnly: true,
        fields: [{ label: 'Requester contact', value: 'requester@example.invalid' }],
        texts: [{ label: 'Request as recorded', value: '<script>window.legacyLeak=true</script> Synthetic text remains text.', truncated: false }] }
}
