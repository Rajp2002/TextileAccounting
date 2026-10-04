import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { adminRecordAudit, requireFounder } from './founder'
import type { FounderPrincipal } from './founder'
import { AdminError } from './errors'

export const LEGACY_REGISTERS = {
    grievances: { label: 'Privacy grievances', searchLabel: 'Subject', table: 'grievances', searchColumn: 'subject', states: ['pending', 'acknowledged', 'escalated', 'resolved'] },
    incidents: { label: 'Security incidents', searchLabel: 'Title', table: 'security_incidents', searchColumn: 'title', states: ['reported', 'triaging', 'contained', 'investigating', 'monitoring', 'closed'] },
    dpas: { label: 'DPA records', searchLabel: 'Version', table: 'dpas', searchColumn: 'version_string', states: ['active', 'inactive'] },
    notices: { label: 'Notice registry', searchLabel: 'Version', table: 'notice_registry', searchColumn: 'version_string', states: ['active', 'inactive'] },
} as const
export type LegacyRegister = keyof typeof LEGACY_REGISTERS
const kindSchema = z.enum(['grievances', 'incidents', 'dpas', 'notices'])
const listSchema = z.object({ kind: kindSchema.default('grievances'), state: z.string().max(30).default('all'), search: z.string().trim().max(160).default(''), limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().max(640).optional() }).strict()
const dateTime = z.string().refine(value => Number.isFinite(Date.parse(value))).transform(value => new Date(value).toISOString())
const cursorSchema = z.object({ version: z.literal(1), kind: kindSchema, state: z.string(), searchHash: z.string().regex(/^[a-f0-9]{64}$/), at: dateTime.nullable(), id: z.uuid() }).strict()
const identitySchema = z.object({ id: z.uuid(), created_at: dateTime.nullable() })
const listColumns: Record<LegacyRegister, string> = {
    grievances: 'id,org_id,subject,status,target_entity,grievance_type,target_resolution_date,identity_verification_status,created_at',
    incidents: 'id,org_id,title,status,severity,incident_type,cert_in_assessment,cert_in_assessment_due_at,created_at',
    dpas: 'id,version_string,is_active,created_at',
    notices: 'id,version_string,notice_type,language_code,is_active,created_at',
}
const detailColumns: Record<LegacyRegister, string> = {
    grievances: `${listColumns.grievances},description,requester_email,acknowledged_at,resolved_at,response_summary,identity_verified_at,updated_at`,
    incidents: `${listColumns.incidents},source,aware_at,summary,containment_summary,investigation_summary,remediation_summary,affected_data_categories,cert_in_decision_rationale,cert_in_reported_at,cert_in_reference,dpdp_board_assessment,affected_people_notification,updated_at,closed_at`,
    dpas: `${listColumns.dpas},content_text,updated_at`,
    notices: `${listColumns.notices},body_text,english_transcript,content_hash`,
}
export type LegacyListItem = { id: string; orgId: string | null; title: string; state: string; recordedAt: string | null; context: string }
export type LegacyText = { label: string; value: string | null; truncated: boolean }
export type LegacyField = { label: string; value: string | null; format?: 'instant' | 'date' | 'text' }
export type LegacyRecord = LegacyListItem & { kind: LegacyRegister; fields: LegacyField[]; texts: LegacyText[]; asOf: string; readOnly: true }

export function legacyReadsEnabled() { return process.env.WEAVLY_ADMIN_LEGACY_READS_ENABLED === 'true' }
async function authorizeLegacyRead() {
    const principal = await requireFounder()
    if (!legacyReadsEnabled()) {
        await adminRecordAudit(principal, 'legacy.read.attempt', 'legacy_register', 'gated', randomUUID(), { outcome: 'denied', reasonCode: 'legacy_reads_disabled' })
        throw new AdminError('LEGACY_READS_DISABLED', 403, 'Formal record reads are awaiting operational approval.')
    }
    return principal
}
async function withFailureAudit<T>(principal: FounderPrincipal, action: string, target: string, requestId: ReturnType<typeof randomUUID>, load: () => Promise<T>): Promise<T> {
    try { return await load() }
    catch (error) {
        const safe = error instanceof AdminError ? error : new AdminError('LEGACY_SOURCE_UNAVAILABLE', 503, 'This formal record source is unavailable. No empty register has been assumed.', undefined, requestId)
        if (safe.code !== 'AUDIT_UNAVAILABLE') await adminRecordAudit(principal, action, 'legacy_register', target, requestId, { outcome: 'failure', reasonCode: safe.code.toLowerCase() })
        throw safe
    }
}
function sourceUnavailable(): never { throw new AdminError('LEGACY_SOURCE_UNAVAILABLE', 503, 'This formal record source is unavailable. No empty register has been assumed.') }
function text(value: unknown, max = 240): string | null { return typeof value === 'string' ? value.slice(0, max) : null }
function instant(value: unknown): string | null {
    if (value === null || value === undefined) return null
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return sourceUnavailable()
    return new Date(value).toISOString()
}
function reference(value: unknown): string | null {
    if (value === null || value === undefined) return null
    return z.uuid().safeParse(value).success ? value as string : sourceUnavailable()
}
function row(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !identitySchema.safeParse(value).success) return sourceUnavailable()
    return value as Record<string, unknown>
}
function listItem(kind: LegacyRegister, source: Record<string, unknown>): LegacyListItem {
    const common = { id: source.id as string, orgId: reference(source.org_id), recordedAt: instant(source.created_at) }
    if (kind === 'grievances') return { ...common, title: text(source.subject) ?? 'Subject not recorded', state: text(source.status, 40) ?? 'Not recorded', context: [text(source.target_entity, 40), text(source.grievance_type, 60)].filter(Boolean).join(' · ') }
    if (kind === 'incidents') return { ...common, title: text(source.title) ?? 'Title not recorded', state: text(source.status, 40) ?? 'Not recorded', context: [text(source.severity, 30), text(source.incident_type, 60), `Assessment: ${text(source.cert_in_assessment, 30) ?? 'not recorded'}`].join(' · ') }
    const state = source.is_active === true ? 'active' : source.is_active === false ? 'inactive' : 'Not recorded'
    return { ...common, title: `Version ${text(source.version_string, 160) ?? 'not recorded'}`, state, context: kind === 'notices' ? [text(source.notice_type, 40), text(source.language_code, 20)].filter(Boolean).join(' · ') : 'Retained agreement template' }
}
function filterHash(search: string) { return createHash('sha256').update(search).digest('hex') }
function encodeCursor(kind: LegacyRegister, state: string, search: string, source: Record<string, unknown>) {
    return Buffer.from(JSON.stringify({ version: 1, kind, state, searchHash: filterHash(search), at: instant(source.created_at), id: source.id })).toString('base64url')
}
function parseCursor(encoded: string | undefined, kind: LegacyRegister, state: string, search: string) {
    if (!encoded) return null
    try {
        if (!/^[a-zA-Z0-9_-]+$/.test(encoded)) throw new Error('Invalid encoding')
        const cursor = cursorSchema.parse(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')))
        if (cursor.kind !== kind || cursor.state !== state || cursor.searchHash !== filterHash(search)) throw new Error('Changed filters')
        return cursor
    } catch { throw new AdminError('INVALID_CURSOR', 400, 'This page reference is invalid. Start again with the current filters.') }
}
function cursorFilter(cursor: NonNullable<ReturnType<typeof parseCursor>>) {
    // Both values are schema-validated and canonicalized; no raw filter text
    // or arbitrary sort/table name is accepted from the request.
    return `created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id}),created_at.is.null`
}

export async function listLegacyRecords(query: unknown = {}) {
    const principal = await authorizeLegacyRead(), requestId = randomUUID()
    return withFailureAudit(principal, 'legacy.register.read', 'bounded_list', requestId, async () => {
    const parsed = listSchema.safeParse(query)
    if (!parsed.success) throw new AdminError('INVALID_QUERY', 400, 'Check the register filters and page size.', z.flattenError(parsed.error).fieldErrors, requestId)
    const input = parsed.data, definition = LEGACY_REGISTERS[input.kind]
    if (input.state !== 'all' && !(definition.states as readonly string[]).includes(input.state)) throw new AdminError('INVALID_QUERY', 400, 'Choose a state available in this register.', undefined, requestId)
    const cursor = parseCursor(input.cursor, input.kind, input.state, input.search)
    let request = createAdminClient().from(definition.table).select(listColumns[input.kind]).order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).limit(input.limit + 1)
    if (input.search) request = request.ilike(definition.searchColumn, `%${input.search.replace(/[\\%_]/g, value => `\\${value}`)}%`)
    if (input.state !== 'all') request = input.kind === 'dpas' || input.kind === 'notices' ? request.eq('is_active', input.state === 'active') : request.eq('status', input.state)
    if (cursor) request = cursor.at === null ? request.is('created_at', null).lt('id', cursor.id) : request.or(cursorFilter(cursor))
    const result = await request
    if (result.error || !Array.isArray(result.data)) return sourceUnavailable()
    const sources = result.data.map(row), selected = sources.slice(0, input.limit), last = selected.at(-1)
    const items = selected.map(source => listItem(input.kind, source))
    await adminRecordAudit(principal, 'legacy.register.read', 'legacy_register', input.kind, requestId, { after: { count: selected.length } })
    return { kind: input.kind, items, nextCursor: sources.length > input.limit && last ? encodeCursor(input.kind, input.state, input.search, last) : null, filters: { kind: input.kind, state: input.state, search: input.search, limit: input.limit }, asOf: new Date().toISOString(), requestId, readOnly: true as const, coverage: 'Live retained register, newest recorded rows first; undated rows are visible last. Each page is a fresh read, not a historical snapshot or compliance assessment.' }
    })
}

export async function getLegacyRecord(kindInput: unknown, idInput: unknown): Promise<LegacyRecord> {
    const principal = await authorizeLegacyRead(), requestId = randomUUID()
    return withFailureAudit(principal, 'legacy.record.read', 'bounded_detail', requestId, async () => {
    const parsed = z.object({ kind: kindSchema, id: z.uuid() }).safeParse({ kind: kindInput, id: idInput })
    if (!parsed.success) throw new AdminError('INVALID_REFERENCE', 400, 'Choose a valid formal record reference.', undefined, requestId)
    const { kind, id } = parsed.data
    const result = await createAdminClient().from(LEGACY_REGISTERS[kind].table).select(detailColumns[kind]).eq('id', id).maybeSingle()
    if (result.error) return sourceUnavailable()
    if (!result.data) throw new AdminError('NOT_FOUND', 404, 'Formal record not found.', undefined, requestId)
    const source = row(result.data), fields: LegacyField[] = [], texts: LegacyText[] = []
    const addField = (label: string, key: string, format: LegacyField['format'] = 'text') => fields.push({ label, value: format === 'instant' ? instant(source[key]) : text(source[key], 500), format })
    const addText = (label: string, key: string) => { const value = source[key]; texts.push({ label, value: text(value, 10000), truncated: typeof value === 'string' && value.length > 10000 }) }
    if (kind === 'grievances') {
        addField('Target', 'target_entity'); addField('Request type', 'grievance_type'); addField('Requester contact', 'requester_email')
        addField('Identity verification', 'identity_verification_status'); addField('Identity verified', 'identity_verified_at', 'instant')
        addField('Acknowledged', 'acknowledged_at', 'instant'); addField('Internal response target', 'target_resolution_date', 'date'); addField('Resolved', 'resolved_at', 'instant')
        addText('Request as recorded', 'description'); addText('Response or closure as recorded', 'response_summary')
    } else if (kind === 'incidents') {
        addField('Source', 'source'); addField('Incident type', 'incident_type'); addField('Severity', 'severity'); addField('Awareness recorded', 'aware_at', 'instant')
        addField('CERT-In assessment', 'cert_in_assessment'); addField('Assessment due as recorded', 'cert_in_assessment_due_at', 'instant'); addField('Report recorded', 'cert_in_reported_at', 'instant'); addField('Report reference', 'cert_in_reference')
        addField('DPDP board assessment as recorded', 'dpdp_board_assessment'); addField('Affected-person notification as recorded', 'affected_people_notification'); addField('Closed', 'closed_at', 'instant')
        fields.push({ label: 'Affected data categories', value: Array.isArray(source.affected_data_categories) ? source.affected_data_categories.filter(value => typeof value === 'string').slice(0, 10).map(value => value.slice(0, 80)).join(', ') : null })
        addText('Incident summary', 'summary'); addText('Containment record', 'containment_summary'); addText('Investigation record', 'investigation_summary'); addText('Remediation record', 'remediation_summary'); addText('Report decision rationale', 'cert_in_decision_rationale')
    } else if (kind === 'dpas') { addField('Version', 'version_string'); addText('Retained agreement text', 'content_text') }
    else { addField('Version', 'version_string'); addField('Notice type', 'notice_type'); addField('Language', 'language_code'); addField('Recorded content hash', 'content_hash'); addText('Retained notice text', 'body_text'); addText('Recorded English transcript', 'english_transcript') }
    addField('Last updated', 'updated_at', 'instant')
    const item = listItem(kind, source)
    await adminRecordAudit(principal, 'legacy.record.read', 'legacy_record', id, requestId)
    return { ...item, kind, fields, texts, asOf: new Date().toISOString(), readOnly: true as const }
    })
}

/** A bounded second register; signatures never load worker identities or proof URLs. */
export async function listLegacyDpaBindings(dpaIdInput: unknown, query: unknown = {}) {
    const principal = await authorizeLegacyRead(), requestId = randomUUID()
    return withFailureAudit(principal, 'legacy.dpa_bindings.read', 'bounded_bindings', requestId, async () => {
    const parsed = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().max(640).optional() }).strict().safeParse(query)
    if (!z.uuid().safeParse(dpaIdInput).success || !parsed.success) throw new AdminError('INVALID_QUERY', 400, 'Choose a valid DPA binding page.', undefined, requestId)
    const dpaId = dpaIdInput as string, input = parsed.data, cursor = parseCursor(input.cursor, 'dpas', 'bindings', dpaId)
    let request = createAdminClient().from('organization_dpas').select('id,org_id,status,signed_at,created_at').eq('dpa_id', dpaId).order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).limit(input.limit + 1)
    if (cursor) request = cursor.at === null ? request.is('created_at', null).lt('id', cursor.id) : request.or(cursorFilter(cursor))
    const result = await request
    if (result.error || !Array.isArray(result.data)) return sourceUnavailable()
    const sources = result.data.map(row), selected = sources.slice(0, input.limit), last = selected.at(-1)
    const items = selected.map(source => ({ id: source.id as string, orgId: reference(source.org_id), state: text(source.status, 40), signedAt: instant(source.signed_at), recordedAt: instant(source.created_at) }))
    await adminRecordAudit(principal, 'legacy.dpa_bindings.read', 'legacy_record', dpaId, requestId, { after: { count: items.length } })
    return { items, nextCursor: sources.length > input.limit && last ? encodeCursor('dpas', 'bindings', dpaId, last) : null, asOf: new Date().toISOString(), readOnly: true as const }
    })
}
