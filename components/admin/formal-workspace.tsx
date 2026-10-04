'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AdminFreshness, AdminPageHeader, AdminSurface, AdminEmptyState } from './primitives'
import { incidentStatuses, incidentTypes, identityStates, outcomeCodes, privacyCategories, privacyStatuses, severities, type FormalDetail, type FormalKind, type FormalList } from '@/lib/admin/formal-contracts'
import { formalMutationResultSchema } from '@/lib/admin/formal-contracts'
import { definiteSendRejection } from '@/lib/support/send-attempt'

const fieldClass = 'min-h-11 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron'
const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron'
const words = (value: string) => value.replaceAll('_', ' ')
function Field({ label, children, help }: { label: string; children: ReactNode; help?: string }) { return <label className="block text-sm font-medium text-ink"><span className="mb-2 block">{label}</span>{children}{help && <span className="mt-1 block text-xs font-normal leading-5 text-subtle">{help}</span>}</label> }
function value(form: FormData, key: string) { return String(form.get(key) ?? '').trim() }
function optional(form: FormData, key: string) { return value(form, key) || null }
function instant(form: FormData, key: string) { const text = value(form, key); return text ? new Date(`${text}Z`).toISOString() : null }
function localUtc(value: string | null | undefined) { return value ? new Date(value).toISOString().slice(0, 16) : '' }
function shownTime(value: string | null) { return value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Not recorded' }

/** A transport failure retains the original payload and key in memory. A changed
 * draft cannot silently create a second case after an uncertain save. */
function useCaseSave() {
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [dirty, setDirty] = useState(false)
    const [uncertain, setUncertain] = useState(false)
    const pending = useRef<{ url: string; fingerprint: string; payload: Record<string, unknown>; key: string } | null>(null)
    useEffect(() => {
        const handler = (event: BeforeUnloadEvent) => { if (dirty || pending.current) { event.preventDefault(); event.returnValue = '' } }
        window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler)
    }, [dirty])
    async function save(url: string, payload: Record<string, unknown>) {
        if (busy) return null
        const fingerprint = JSON.stringify(payload)
        if (pending.current && (pending.current.url !== url || pending.current.fingerprint !== fingerprint)) {
            setError('An earlier save is unconfirmed. Retry the unchanged draft before saving different content.'); return null
        }
        pending.current ??= { url, fingerprint, payload, key: crypto.randomUUID() }
        const request = pending.current
        setBusy(true); setError('')
        try {
            const response = await fetch(url, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request.payload, clientRequestId: request.key }) })
            const result = await response.json()
            if (!response.ok) {
                if (definiteSendRejection({ status: response.status })) pending.current = null
                throw new Error(typeof result.message === 'string' ? result.message : 'The save could not be confirmed. Retry the unchanged draft.')
            }
            if (!formalMutationResultSchema.safeParse(result).success || result.requestId !== request.key) throw new Error('The save response could not be verified. Retry the unchanged draft.')
            pending.current = null; setDirty(false); setUncertain(false)
            return result as { id: string; kind: FormalKind; version: number }
        } catch (caught) { setUncertain(pending.current !== null); setError(caught instanceof Error ? caught.message : 'The save could not be confirmed. Retry the unchanged draft.'); return null }
        finally { setBusy(false) }
    }
    function retry() { const request = pending.current; return request ? save(request.url, request.payload) : Promise.resolve(null) }
    return { save, retry, uncertain, busy, error, setDirty, dirty }
}
export function FormalLimits() {
    return <p className="mt-5 text-xs leading-5 text-subtle">Raj owns these cases. A saved update records work performed; replies must be delivered through the existing contact channel. Internal targets: privacy acknowledgement within 3 business days and response within 30 calendar days; security acknowledgement within 1 business day. Business-day deadlines need operator review. Reporting assessments, disclosures, erasure and retention decisions require a separate review.</p>
}
export function FormalInbox({ report, kind, queue, search }: { report: FormalList; kind: FormalKind; queue: string; search: string }) {
    const href = (cursor?: string) => `/admin/formal?${new URLSearchParams({ kind, queue, search, ...(cursor ? { cursor } : {}) })}`
    return <><AdminPageHeader title="Formal operations" description="Privacy requests and security incidents, with a clear owner and next action." action={<Link href={`/admin/formal/new?kind=${kind}`} prefetch={false} className={buttonClass}>Record a received {kind === 'privacy' ? 'request' : 'incident'}</Link>}/>
        <nav aria-label="Formal operation tools" className="mb-5 flex flex-wrap gap-5 text-sm"><Link href="/admin/formal/retention" prefetch={false} className="inline-flex min-h-11 items-center underline underline-offset-4">Retention and review</Link><Link href="/admin/legacy" prefetch={false} className="inline-flex min-h-11 items-center underline underline-offset-4">Other retained registers</Link></nav>
        <AdminSurface><form method="get" className="grid gap-4 border-b border-hairline p-5 sm:grid-cols-4"><Field label="Case type"><select name="kind" defaultValue={kind} className={fieldClass}><option value="privacy">Privacy / grievance requests</option><option value="security">Security incidents</option></select></Field><Field label="View"><select name="queue" defaultValue={queue} className={fieldClass}><option value="open">Open cases</option><option value="due">Follow-ups due</option><option value="unmanaged">Needs case handling</option><option value="all">All retained cases</option></select></Field><Field label="Find a subject"><input name="search" type="search" maxLength={160} defaultValue={search} className={fieldClass}/></Field><button className={`${buttonClass} self-end`}>Apply filters</button></form>
        {report.items.length ? <ul className="divide-y divide-hairline">{report.items.map(item => <li key={item.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/admin/formal/${item.kind}/${item.id}`} prefetch={false} className="inline-block min-h-11 py-2 text-base font-semibold underline underline-offset-4">{item.title}</Link><p className="text-xs text-subtle">{words(item.status)}{item.severity && ` · ${words(item.severity)}`} · {item.managed ? 'Raj · case handling active' : 'Needs case handling'}</p></div><p className="text-xs leading-6 text-subtle">Follow-up: {shownTime(item.followUpDueAt)}{item.followUpDueAt && Date.parse(item.followUpDueAt) < Date.parse(report.asOf) && !['resolved', 'closed'].includes(item.status) && <span className="ml-2 font-medium text-danger">Due</span>}</p></div><p className="mt-3 text-sm text-body">{item.nextAction ?? 'Review the retained record and assign its next action.'}</p>{item.internalTargetDate && <p className="mt-2 text-xs text-subtle">Recorded internal response target: {item.internalTargetDate}</p>}</li>)}</ul> : <AdminEmptyState title="No cases match these filters" description="This is a measured empty result from the connected register."/>}
        <div className="flex flex-wrap gap-5 border-t border-hairline px-5 py-3">{report.nextCursor && <Link href={href(report.nextCursor)} prefetch={false} className="min-h-11 py-3 text-sm underline underline-offset-4">Next page</Link>}<Link href={href()} prefetch={false} className="min-h-11 py-3 text-sm underline underline-offset-4">First page</Link></div></AdminSurface><AdminFreshness asOf={report.asOf}/><FormalLimits/></>
}
export function FormalIntake({ initialKind = 'privacy' }: { initialKind?: FormalKind }) {
    const [kind, setKind] = useState<FormalKind>(initialKind), [created, setCreated] = useState(false), router = useRouter(), state = useCaseSave()
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); const form = new FormData(event.currentTarget)
        if (state.uncertain) { const result = await state.retry(); if (result) { setCreated(true); router.push(`/admin/formal/${result.kind}/${result.id}`) } return }
        let receivedAt: string | null, followUpDueAt: string | null
        try { receivedAt = instant(form, 'receivedAt'); followUpDueAt = instant(form, 'followUpDueAt') } catch { return }
        const result = await state.save('/api/admin/formal', { kind, title: value(form, 'title'), body: value(form, 'body'), orgId: optional(form, 'orgId'), requesterUserId: optional(form, 'requesterUserId'), contactEmail: optional(form, 'contactEmail'), receivedAt, nextAction: value(form, 'nextAction'), followUpDueAt, sourceReference: value(form, 'sourceReference'), category: value(form, 'category'), source: value(form, 'source') })
        if (result) { setCreated(true); router.push(`/admin/formal/${result.kind}/${result.id}`) }
    }
    return <><AdminPageHeader title="Record a received case" description="Record an existing request or report. Intake does not send an acknowledgement or verify the requester's authority."/><AdminSurface><form onSubmit={submit} onChange={() => state.setDirty(true)} className="space-y-5 p-5 sm:p-6"><fieldset disabled={state.busy || created} className="contents">
        <Field label="Case type"><select className={fieldClass} value={kind} onChange={event => setKind(event.target.value as FormalKind)}><option value="privacy">Privacy / grievance request</option><option value="security">Security incident</option></select></Field>
        <Field label="Subject"><input name="title" required minLength={3} maxLength={160} className={fieldClass}/></Field><Field label="Received context" help="Use only the details needed to handle the case. Never include passwords, OTPs or payment credentials."><textarea name="body" required minLength={10} maxLength={5000} rows={4} className={fieldClass}/></Field>
        <div className="grid gap-5 sm:grid-cols-2"><Field label="Category"><select name="category" key={`${kind}-category`} className={fieldClass}>{(kind === 'privacy' ? privacyCategories : incidentTypes).map(item => <option key={item} value={item}>{words(item)}</option>)}</select></Field><Field label="Received from"><select name="source" key={`${kind}-source`} className={fieldClass}>{(kind === 'privacy' ? ['manual_email', 'manual_phone', 'manual_whatsapp', 'other'] : ['customer', 'provider', 'monitoring', 'internal', 'other']).map(item => <option key={item} value={item}>{words(item)}</option>)}</select></Field>
        <Field label="Received at (UTC)"><input name="receivedAt" type="datetime-local" required className={fieldClass}/></Field><Field label="Original channel reference" help="A safe message or case reference, or HTTPS link. Keep credentials out of links."><input name="sourceReference" required minLength={3} maxLength={300} className={fieldClass}/></Field>
        <Field label="Factory ID, if verified" help="Leave unbound when the factory has not been established."><input name="orgId" maxLength={36} className={fieldClass}/></Field><Field label="Requester account ID, if verified" help="Optional. It must be a current owner in the selected factory. Binding does not prove authority for disclosure."><input name="requesterUserId" maxLength={36} className={fieldClass}/></Field><Field label="Reply contact, if provided"><input type="email" name="contactEmail" maxLength={254} className={fieldClass}/></Field></div>
        <Field label="Next action"><input name="nextAction" required minLength={3} maxLength={500} className={fieldClass}/></Field><Field label="Internal follow-up due (UTC)"><input name="followUpDueAt" type="datetime-local" required className={fieldClass}/></Field>
        {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}{state.uncertain && <p className="text-sm text-warning">The original save is unconfirmed. Retry uses its original content and request key.</p>}<button type="submit" formNoValidate={state.uncertain} disabled={state.busy} className={buttonClass}>{state.busy ? 'Saving…' : state.uncertain ? 'Retry original save' : 'Record case'}</button><p className="text-xs text-subtle">Stored for founder case handling. Nothing is sent to the contact.</p></fieldset></form></AdminSurface><FormalLimits/></>
}
export function FormalCaseWorkspace({ detail, onSaved }: { detail: FormalDetail; onSaved?: () => void }) {
    const { record } = detail, [status, setStatus] = useState(record.status), [notice, setNotice] = useState(''), state = useCaseSave(), note = useCaseSave(), router = useRouter()
    const draftVersion = useRef(record.version), noteVersion = useRef(record.version)
    const draftContext = useRef(record)
    const [formKey, setFormKey] = useState(record.version), [confirmedVersion, setConfirmedVersion] = useState(record.version)
    const awaitingSnapshot = record.version < confirmedVersion
    // Reconcile a clean form during render; an edited form keeps its original
    // snapshot/version. React rerenders before committing the new form fields.
    if (!state.dirty && record.version > formKey) { setStatus(record.status); setFormKey(record.version) }
    useEffect(() => {
        if (!state.dirty && record.version >= draftVersion.current) { draftVersion.current = record.version; draftContext.current = record }
        if (!note.dirty && record.version >= noteVersion.current) noteVersion.current = record.version
    }, [record, state.dirty, note.dirty])
    const closed = status === 'resolved' || status === 'closed'
    const endpoint = `/api/admin/formal/${record.kind}/${record.id}`
    function completed(version: number) { setConfirmedVersion(version); setNotice('Saved to the case. No message was sent.'); if (onSaved) onSaved(); else router.refresh() }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); const form = new FormData(event.currentTarget)
        if (state.uncertain) { const result = await state.retry(); if (result) { draftVersion.current = result.version; completed(result.version) } return }
        if (!record.managed) {
            const result = await state.save(endpoint, { operation: 'adopt', expectedVersion: 0, nextAction: value(form, 'nextAction'), followUpDueAt: instant(form, 'followUpDueAt') })
            if (result) { draftVersion.current = result.version; completed(result.version) }
            return
        }
        const context = draftContext.current
        const payload: Record<string, unknown> = { operation: 'update', expectedVersion: draftVersion.current, status, nextAction: value(form, 'nextAction'), followUpDueAt: instant(form, 'followUpDueAt'), reason: value(form, 'reason'), acknowledgedAt: instant(form, 'acknowledgedAt'), acknowledgementEvidenceRef: optional(form, 'acknowledgementEvidenceRef'), outcomeCode: optional(form, 'outcomeCode') ?? context.outcomeCode, outcomeSummary: optional(form, 'outcomeSummary') ?? context.outcomeSummary, outcomeEvidenceRef: optional(form, 'outcomeEvidenceRef') ?? context.outcomeEvidenceRef, responseRecordedAt: instant(form, 'responseRecordedAt') ?? context.responseRecordedAt }
        if (record.kind === 'privacy') Object.assign(payload, { identityState: value(form, 'identityState'), identityEvidenceRef: optional(form, 'identityEvidenceRef') })
        else payload.severity = value(form, 'severity')
        const result = await state.save(endpoint, payload)
        if (result) { draftVersion.current = result.version; completed(result.version) }
    }
    async function addNote(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); const form = event.currentTarget, data = new FormData(form)
        if (note.uncertain) { const result = await note.retry(); if (result) { noteVersion.current = result.version; form.reset(); completed(result.version) } return }
        const result = await note.save(endpoint, { operation: 'note', expectedVersion: noteVersion.current, body: value(data, 'body') })
        if (result) { noteVersion.current = result.version; form.reset(); completed(result.version) }
    }
    return <><AdminPageHeader title={record.title} description={`${record.kind === 'privacy' ? 'Privacy / grievance request' : 'Security incident'} · Raj owns the next action`} action={<Link href={`/admin/formal?kind=${record.kind}`} prefetch={false} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Back to cases</Link>}/>
        <AdminSurface className="mb-5 p-5"><p className="text-sm leading-6 whitespace-pre-wrap break-words">{record.body ?? 'Context not recorded'}</p><div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-subtle"><p>Received: {shownTime(record.receivedAt ?? record.recordedAt)}</p><p>Contact: {record.contactEmail ?? 'Not recorded'}</p><p>Authority: {record.identityState ? words(record.identityState) : 'Review as needed'}</p><p>Requester account: {record.requesterBound ? 'Bound to verified factory membership' : 'Unbound'}</p></div>{record.orgId && <Link href={`/admin/factories/${record.orgId}`} prefetch={false} className="mt-3 inline-flex min-h-11 items-center text-sm underline underline-offset-4">Open factory context</Link>}{record.existingAssessment && <p className="mt-3 text-xs text-subtle">Existing reportability assessment: {words(record.existingAssessment)} · recorded assessment due: {shownTime(record.existingAssessmentDueAt)}. Review applicable obligations separately.</p>}{record.internalTargetDate && <p className="mt-3 text-xs text-subtle">Recorded internal response target: {record.internalTargetDate}. This is an internal target, not a legal determination.</p>}</AdminSurface>
        {awaitingSnapshot && <p role="status" className="mb-4 text-sm text-subtle">Saved. Loading the confirmed case before another change.</p>}
        {notice && <p role="status" className="mb-4 text-sm text-ink">{notice}</p>}
        {(state.dirty && formKey < record.version) && <p role="status" className="mb-4 text-sm text-warning">A newer case version is available. Your draft keeps its original version so it cannot overwrite another change. Reload this page to discard the draft and review the latest case.</p>}
        <AdminSurface><form key={formKey} onSubmit={submit} onChange={() => state.setDirty(true)} className="space-y-5 p-5 sm:p-6"><fieldset disabled={awaitingSnapshot || state.busy || note.busy} className="contents"><h2 className="text-lg font-semibold">{record.managed ? 'Case progress' : 'Start case handling'}</h2>
        {record.managed && <><div className="grid gap-5 sm:grid-cols-2"><Field label="State"><select className={fieldClass} value={status} onChange={event => setStatus(event.target.value)}>{(record.kind === 'privacy' ? privacyStatuses : incidentStatuses).map(item => <option key={item} value={item}>{words(item)}</option>)}</select></Field>{record.kind === 'security' && <Field label="Impact"><select name="severity" defaultValue={record.severity ?? 'unassessed'} className={fieldClass}>{severities.map(item => <option key={item} value={item}>{words(item)}</option>)}</select></Field>}</div>
        {record.kind === 'privacy' && <div className="grid gap-5 sm:grid-cols-2"><Field label="Identity / authority review"><select name="identityState" defaultValue={record.identityState ?? 'pending'} className={fieldClass}>{identityStates.map(item => <option key={item} value={item}>{words(item)}</option>)}</select></Field><Field label="Verification evidence reference" help="Record the result and safe reference; do not copy identity documents here."><input name="identityEvidenceRef" defaultValue={record.identityEvidenceRef ?? ''} maxLength={300} className={fieldClass}/></Field></div>}
        <div className="grid gap-5 sm:grid-cols-2"><Field label="Recorded acknowledgement time (UTC)" help="New acknowledgements need delivery evidence. Historical dates without an evidence reference remain unverified."><input type="datetime-local" name="acknowledgedAt" defaultValue={localUtc(record.acknowledgedAt)} className={fieldClass}/></Field><Field label="Acknowledgement evidence reference"><input name="acknowledgementEvidenceRef" defaultValue={record.acknowledgementEvidenceRef ?? ''} maxLength={300} className={fieldClass}/></Field></div></>}
        <Field label="Next action"><input name="nextAction" required minLength={3} maxLength={500} defaultValue={record.nextAction ?? ''} className={fieldClass}/></Field><Field label="Internal follow-up due (UTC)"><input name="followUpDueAt" type="datetime-local" required={!closed || !record.managed} defaultValue={localUtc(record.followUpDueAt)} className={fieldClass}/></Field>
        {record.managed && closed && <div className="space-y-5 border-t border-hairline pt-5"><h3 className="font-semibold">Record the actual outcome</h3><Field label="Outcome"><select name="outcomeCode" defaultValue={record.outcomeCode ?? 'response_recorded'} required className={fieldClass}>{outcomeCodes.map(item => <option key={item} value={item}>{words(item)}</option>)}</select></Field><Field label="Outcome summary"><textarea name="outcomeSummary" required minLength={3} maxLength={2000} defaultValue={record.outcomeSummary ?? ''} rows={3} className={fieldClass}/></Field><Field label="Outcome / response evidence reference"><input name="outcomeEvidenceRef" required minLength={3} maxLength={300} defaultValue={record.outcomeEvidenceRef ?? ''} className={fieldClass}/></Field><Field label="Actual response recorded at (UTC)" help="Required for privacy closure. Record delivery through the original channel; saving this form does not deliver it."><input type="datetime-local" name="responseRecordedAt" required={record.kind === 'privacy'} defaultValue={localUtc(record.responseRecordedAt)} className={fieldClass}/></Field></div>}
        {record.managed && <Field label="Reason for change (private)"><input name="reason" required minLength={3} maxLength={500} className={fieldClass}/></Field>}{state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}{state.uncertain && <p className="text-sm text-warning">The original save is unconfirmed. Retry uses its original content and version.</p>}<button type="submit" formNoValidate={state.uncertain} disabled={state.busy || note.busy} className={buttonClass}>{state.busy ? 'Saving…' : state.uncertain ? 'Retry original save' : record.managed ? 'Save case update' : 'Start case handling'}</button><p className="text-xs text-subtle">Records progress only. No disclosure, deletion, notification or lockdown is performed.</p></fieldset></form></AdminSurface>
        {record.managed && <AdminSurface className="mt-5"><form onSubmit={addNote} onChange={() => { if (!note.dirty) noteVersion.current = record.version; note.setDirty(true) }} className="space-y-4 p-5"><fieldset disabled={awaitingSnapshot || state.busy || note.busy} className="contents"><h2 className="text-lg font-semibold">Founder private notes</h2><Field label="Private note" help="Visible only to the verified founder. Drafts stay in this page's memory."><textarea name="body" required maxLength={10000} rows={3} className={fieldClass}/></Field>{note.error && <p role="alert" className="text-sm text-danger">{note.error}</p>}<button type="submit" formNoValidate={note.uncertain} disabled={note.busy || state.busy} className={buttonClass}>{note.busy ? 'Saving…' : note.uncertain ? 'Retry original note' : 'Add private note'}</button></fieldset></form><ul className="divide-y divide-hairline border-t border-hairline">{detail.notes.map(entry => <li key={entry.id} className="p-5"><p className="whitespace-pre-wrap break-words text-sm">{entry.body}</p><p className="mt-2 text-xs text-subtle">{shownTime(entry.createdAt)}</p></li>)}</ul></AdminSurface>}
        <EvidenceHistory revisions={detail.revisions}/>
        <AdminSurface className="mt-5 p-5"><h2 className="mb-3 text-lg font-semibold">Case history</h2><ol className="space-y-3 text-sm">{detail.events.map(entry => <li key={entry.id}><span className="font-medium">{words(entry.eventType)}</span> · {String(entry.after.status ?? '')}<p className="mt-1 text-xs text-subtle">{shownTime(entry.createdAt)}</p></li>)}</ol>{detail.nextHistoryCursor && <Link prefetch={false} href={`${windowSafePath(record.kind, record.id)}?${new URLSearchParams({ historyAt: detail.nextHistoryCursor.createdAt, historyId: detail.nextHistoryCursor.id })}`} className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4">Earlier notes and events</Link>}</AdminSurface><AdminFreshness asOf={detail.asOf}/><FormalLimits/></>
}
function windowSafePath(kind: FormalKind, id: string) { return `/admin/formal/${kind}/${id}` }

function EvidenceHistory({ revisions }: { revisions: FormalDetail['revisions'] }) {
    const labels: Record<string, string> = { status: 'State', severity: 'Impact', identityState: 'Identity review', identityEvidenceRef: 'Verification evidence', acknowledgedAt: 'Acknowledged at', acknowledgementEvidenceRef: 'Acknowledgement evidence', outcomeCode: 'Outcome', outcomeSummary: 'Outcome summary', outcomeEvidenceRef: 'Outcome evidence', responseRecordedAt: 'Response recorded at', closedAt: 'Closed at', nextAction: 'Next action', followUpDueAt: 'Follow-up due', retainedProofHash: 'Retained proof fingerprint', identityVerifiedAt: 'Verification recorded at' }
    return <AdminSurface className="mt-5 p-5"><h2 className="mb-3 text-lg font-semibold">Private evidence history</h2><p className="mb-4 text-xs text-subtle">Corrections retain their previous values. This history stays with the founder case record.</p><div className="space-y-3">{revisions.map(revision => {
        const previous = revision.before as Record<string, unknown>, next = revision.after as Record<string, unknown>
        return <details key={revision.id} className="rounded-lg border border-hairline p-4"><summary className="min-h-11 cursor-pointer text-sm font-medium">Version {revision.version} · {shownTime(revision.createdAt)}</summary><dl className="space-y-4 pt-3">{Object.entries(labels).filter(([key]) => previous[key] !== next[key]).map(([key, label]) => <div key={key} className="break-words text-sm"><dt className="font-medium">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-subtle">Previous: {String(previous[key] ?? 'Not recorded')}</dd><dd className="mt-1 whitespace-pre-wrap">Recorded: {String(next[key] ?? 'Not recorded')}</dd></div>)}</dl></details>
    })}</div></AdminSurface>
}
