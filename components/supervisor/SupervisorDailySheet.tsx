'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, ClipboardList, FileClock, Loader2, Lock, LockOpen, Save, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LiquidSegmented } from '@/components/ui/liquid-segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { usePwaRefreshGuard } from '@/hooks/use-pwa-refresh-guard'
import { usePwaInstallBlocker } from '@/hooks/use-pwa-install-blocker'
import { useTranslation } from '@/lib/i18n/context'
import { GoLiveNotice } from '@/components/production/GoLiveNotice'
import { formatGoLiveDate } from '@/lib/base-go-live'
import { supervisorText, type SupervisorTextKey } from '@/lib/i18n/supervisor-access'
import { baseProductionDraftKey, parseBaseProductionDraft } from '@/lib/base-production-draft'
import { machineReadingState, machineWorkerStatus } from '@/lib/base-machine-register'
import type { BaseDailyProductionStatus } from '@/lib/base-production-core'
import { SUPERVISOR_SHEET_PATH } from '@/lib/supervisor-access'
import { describeBaseSheetRows } from '@/lib/base-operator'
import {
    blockedSupervisorRows,
    buildSupervisorSavePayload,
    buildSupervisorSheet,
    contextKey,
    summarizeSupervisorSheet,
    type SupervisorDraftRow,
    type SupervisorMachineRow,
    type SupervisorSheetData,
} from '@/lib/supervisor-daily-sheet'
import { saveSupervisorDailySheet } from '@/app/supervisor/daily-sheet/actions'
import { cn } from '@/lib/utils'

type DraftStatus = 'none' | 'local' | 'error' | 'conflict'
type Text = (key: SupervisorTextKey, values?: Record<string, string | number>) => string

const blankRow: SupervisorDraftRow = { meters: '', status: 'blank', machineMeters: {}, savedUnallocatedMeters: null }

function newRequestId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
        const random = Math.floor(Math.random() * 16)
        return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16)
    })
}

function formatMeters(value: number) {
    return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)} m`
}

function formatDay(value: string) {
    const [year, month, day] = value.split('-').map(Number)
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatDateTime(value: string) {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(value))
}

type ReadingActions = { change: (row: SupervisorMachineRow, value: string) => void; keyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void }

const ReadingRow = memo(function ReadingRow({ row, value, state, absent, disabled, text, actions }: {
    row: SupervisorMachineRow; value: string; state: ReturnType<typeof machineReadingState>
    absent: boolean; disabled: boolean; text: Text; actions: ReadingActions
}) {
    if (!row.workerId) return (
        <div className="bg-[var(--wv-ochre-50)]/40 px-4 py-3">
            <p className="font-bold text-ink" data-i18n-skip="true">{row.machineLabel}</p>
            <p className="text-xs text-body">{text('noWorker')}</p>
        </div>
    )
    const stateLabel = state === 'entered' ? text('entered') : state === 'not_running' ? text('notRunning') : state === 'absent' ? text('absent') : state === 'invalid' ? text('checkReading') : text('pending')
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_128px] items-center gap-x-3 gap-y-2 px-4 py-3.5 focus-within:bg-saffron-soft/30">
            <div className="min-w-0">
                <p className="truncate font-bold text-ink" data-i18n-skip="true">{row.machineLabel}</p>
                <p className="truncate text-xs text-muted-foreground" data-i18n-skip="true">{row.jobLabel ?? text('noQuality')}</p>
                <p className="truncate text-sm text-body" data-i18n-skip="true">{row.workerName ?? text('unknownWorker')}</p>
                {row.unavailable && <p className="text-xs font-semibold text-[var(--wv-ochre-800)]">{text('operatorUnavailable')}</p>}
            </div>
            <div>
                <Input
                    aria-label={`${row.machineLabel} ${row.workerName ?? ''} ${text('metres')}`}
                    aria-invalid={state === 'invalid'}
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="next"
                    autoComplete="off"
                    placeholder={text('metres')}
                    data-supervisor-meters
                    value={value}
                    disabled={absent || disabled || !row.jobId}
                    onChange={event => actions.change(row, event.target.value)}
                    onKeyDown={actions.keyDown}
                    onFocus={event => { event.currentTarget.select(); event.currentTarget.scrollIntoView({ block: 'nearest' }) }}
                    className="h-11 rounded-xl border-hairline bg-surface text-right text-base font-bold tabular-nums text-ink shadow-xs"
                />
            </div>
            <div className="col-span-2 flex flex-wrap items-center gap-2 text-xs">
                <span className={cn('inline-flex rounded-full px-2 py-0.5 font-bold',
                    state === 'entered' ? 'bg-[var(--wv-moss-50)] text-[var(--wv-moss-700)]'
                        : state === 'pending' || state === 'invalid' ? 'bg-[var(--wv-ochre-50)] text-[var(--wv-ochre-800)]'
                            : 'bg-surface-soft text-body')}>{stateLabel}</span>
                {row.paid && <span className="text-muted-foreground">{text('paidProtected')}</span>}
                {state === 'invalid' && <span className="font-semibold text-destructive">{text('readingHint')}</span>}
                {!row.jobId && <span className="text-muted-foreground">{text('noQuality')}</span>}
                {!disabled && !absent && row.jobId && (
                    <Button type="button" variant="ghost" size="sm" className="ml-auto min-h-11 rounded-lg px-3 text-xs text-muted-foreground hover:text-ink"
                        onClick={() => {
                            if (state === 'entered' && !window.confirm(text('replaceWithZeroConfirm'))) return
                            actions.change(row, state === 'not_running' ? '' : '0')
                        }}>
                        {state === 'not_running' ? text('undo') : text('notRunning')}
                    </Button>
                )}
            </div>
        </div>
    )
})

/** goLiveDate: the day recording opens; null when not scheduled, undefined when unknown (treated as open). */
export function SupervisorDailySheet({ data, date, shift, actorId, goLiveDate }: { data: SupervisorSheetData; date: string; shift: 'day' | 'night'; actorId: string; goLiveDate?: string | null }) {
    const router = useRouter()
    const { language, t } = useTranslation()
    const beforeGoLive = goLiveDate === null || (typeof goLiveDate === 'string' && date < goLiveDate)
    const text = useCallback<Text>((key, values) => supervisorText(language, key, values), [language])

    const sheet = useMemo(() => buildSupervisorSheet(data, date, shift), [data, date, shift])
    const batch = data.batch
    const draftKey = baseProductionDraftKey(data.orgId, actorId, date, shift)

    const [rows, setRows] = useState<Record<string, SupervisorDraftRow>>(sheet.baseline)
    const [requestId, setRequestId] = useState(newRequestId)
    const [draftStatus, setDraftStatus] = useState<DraftStatus>('none')
    const [reason, setReason] = useState('')
    const [unlocked, setUnlocked] = useState(false)
    const [saving, setSaving] = useState(false)
    const [unlockOpen, setUnlockOpen] = useState(false)
    const [reviewOpen, setReviewOpen] = useState(false)
    const [workersOpen, setWorkersOpen] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [draftReset, setDraftReset] = useState(0)

    usePwaRefreshGuard(useCallback(() => !saving && draftStatus !== 'error' && draftStatus !== 'conflict' && !unlockOpen && !reviewOpen, [saving, draftStatus, unlockOpen, reviewOpen]))
    usePwaInstallBlocker(saving || draftStatus !== 'none' || unlockOpen || reviewOpen)

    // Restore a draft kept on this device, unless it was the request just saved.
    useEffect(() => {
        try {
            const draft = parseBaseProductionDraft(localStorage.getItem(draftKey))
            if (draft && batch?.clientRequestId === draft.requestId) localStorage.removeItem(draftKey)
            else if (draft) {
                setRows({ ...sheet.baseline, ...draft.rows })
                setRequestId(draft.requestId)
                setReason(draft.reason)
                setDraftStatus(draft.revision === (batch?.updatedAt ?? null) ? 'local' : 'conflict')
                return
            }
        } catch { setDraftStatus('error'); return }
        setRows(sheet.baseline)
        setRequestId(newRequestId())
        setDraftStatus('none')
        setReason('')
    }, [draftKey, batch?.clientRequestId, batch?.updatedAt, sheet.baseline, draftReset])

    useEffect(() => {
        if (draftStatus !== 'error') return
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [draftStatus])

    const isFinalized = batch?.status === 'finalized' || (sheet.workers.length > 0 && sheet.workers.every(worker => worker.paid))
    const isProtected = Boolean(batch) && !isFinalized && !unlocked
    const inputsDisabled = saving || isFinalized || isProtected || draftStatus === 'conflict' || beforeGoLive
    const paidWorkers = useMemo(() => new Set(sheet.workers.filter(worker => worker.paid).map(worker => worker.id)), [sheet.workers])
    const summary = summarizeSupervisorSheet(sheet, rows)
    const unmatchedDraft = Object.entries(rows).some(([workerId, row]) => {
        const contexts = sheet.rowsByWorker.get(workerId) ?? []
        return Object.entries(row.machineMeters).some(([key, value]) => value.trim() !== '' && !contexts.some(context => contextKey(context) === key))
    })

    function updateRow(workerId: string, patch: Partial<SupervisorDraftRow>) {
        const next = { ...rows, [workerId]: { ...(rows[workerId] ?? blankRow), ...patch } }
        const nextRequestId = newRequestId()
        setRows(next)
        setRequestId(nextRequestId)
        try {
            localStorage.setItem(draftKey, JSON.stringify({ version: 1, revision: batch?.updatedAt ?? null, requestId: nextRequestId, reason, rows: next }))
            setDraftStatus('local')
        } catch { setDraftStatus('error') }
    }

    function changeReading(row: SupervisorMachineRow, value: string) {
        if (!row.workerId || inputsDisabled || paidWorkers.has(row.workerId)) return
        const current = rows[row.workerId] ?? blankRow
        const machineMeters = { ...current.machineMeters, [contextKey(row)]: value }
        updateRow(row.workerId, { machineMeters, status: machineWorkerStatus(Object.values(machineMeters)) })
    }

    function moveFocus(event: ReactKeyboardEvent<HTMLInputElement>) {
        if (event.key !== 'Enter' && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        const fields = Array.from(document.querySelectorAll<HTMLInputElement>('[data-supervisor-meters]:not(:disabled)'))
        const next = fields[fields.indexOf(event.currentTarget) + (event.key === 'ArrowUp' || event.shiftKey ? -1 : 1)]
        event.preventDefault()
        next?.focus()
        next?.select()
    }

    // Stable handlers for memoized rows, dispatching to the latest state.
    const handlers = useRef<ReadingActions | null>(null)
    useLayoutEffect(() => { handlers.current = { change: changeReading, keyDown: moveFocus } })
    const actions = useMemo<ReadingActions>(() => ({
        change: (row, value) => handlers.current?.change(row, value),
        keyDown: event => handlers.current?.keyDown(event),
    }), [])

    function changeWorkerStatus(workerId: string, status: BaseDailyProductionStatus) {
        const current = rows[workerId] ?? blankRow
        const contexts = sheet.rowsByWorker.get(workerId) ?? []
        const hasMetres = Object.values(current.machineMeters).some(value => Number(value) > 0)
        if (status !== 'entered' && hasMetres && !window.confirm(text('clearWorkerConfirm'))) return
        updateRow(workerId, {
            status,
            meters: '',
            machineMeters: status === 'entered' ? current.machineMeters
                : status === 'zero' ? Object.fromEntries(contexts.filter(context => context.jobId).map(context => [contextKey(context), '0'])) : {},
        })
    }

    function selectSheet(nextDate: string, nextShift: 'day' | 'night') {
        if (saving || (nextDate === date && nextShift === shift)) return
        if (draftStatus === 'error' && !window.confirm(text('discardDraftConfirm'))) return
        router.replace(`${SUPERVISOR_SHEET_PATH}?date=${nextDate}&shift=${nextShift}`)
    }

    function discardDraft() {
        if (!window.confirm(text('discardDraftConfirm'))) return
        try { localStorage.removeItem(draftKey) } catch { /* The saved request id is recognised on restore. */ }
        setDraftReset(value => value + 1)
        router.refresh()
    }

    async function save(confirmed = false) {
        if (saving) return
        if (draftStatus === 'conflict' || unmatchedDraft) { toast.error(text('unmatchedDraft')); return }
        if (isFinalized) { toast.error(text('finalizedBody')); return }
        if (isProtected) { toast.error(text('savedLocked')); return }
        if (summary.invalidCount > 0 || summary.register.invalid > 0) { toast.error(text('fixReadings')); return }
        if (summary.recordedCount === 0) { toast.error(text('enterSomething')); return }
        const blocked = blockedSupervisorRows(sheet, rows)
        if (blocked.length > 0) { toast.error(text('operatorUnavailableSave', { rows: describeBaseSheetRows(blocked) })); return }
        if (!confirmed && (summary.register.pending > 0 || summary.outstandingCount > 0)) { setReviewOpen(true); return }

        setSaving(true)
        try {
            const result = await saveSupervisorDailySheet({
                productionDate: date,
                shift,
                clientRequestId: requestId,
                expectedUpdatedAt: batch?.updatedAt ?? null,
                correctionReason: batch ? reason : undefined,
                entries: buildSupervisorSavePayload(sheet, rows).map(entry => ({
                    ...entry,
                    machine_records: entry.machine_records.map(record => ({ ...record, state: record.state === 'invalid' ? 'pending' : record.state })),
                })),
            })
            if ('error' in result) {
                toast.error(result.message ? `${text(result.error)} ${result.message}` : text(result.error))
                return
            }
            toast.success(result.idempotent ? text('alreadySavedToast') : text('savedToast', { metres: formatMeters(result.totalMeters) }))
            try { localStorage.removeItem(draftKey) } catch { /* Recognised on restore by request id. */ }
            setReviewOpen(false)
            setUnlocked(false)
            setReason('')
            setDraftStatus('none')
            setRequestId(newRequestId())
            router.refresh()
        } catch {
            toast.error(text('errorGeneric'))
        } finally {
            setSaving(false)
        }
    }

    const statusLine = saving ? text('saving') : draftStatus === 'error' ? text('draftError') : draftStatus === 'conflict' ? text('draftConflict')
        : draftStatus === 'local' ? text('draftOnDevice') : batch ? text('saved') : text('notSubmitted')
    const saveDisabled = saving || inputsDisabled || unmatchedDraft || summary.invalidCount > 0 || summary.register.invalid > 0 || summary.recordedCount === 0

    return (
        <div className="space-y-4 pb-32">
            <div className="text-center">
                <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink">{text('sheetTitle')}</h1>
            </div>

            {beforeGoLive && (
                <GoLiveNotice>{goLiveDate
                    ? t('goLive.supervisorStarts', { date: formatGoLiveDate(goLiveDate, language) })
                    : t('goLive.scheduleTitle')}</GoLiveNotice>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
                <LiquidSegmented
                    aria-label={text('dateLabel')}
                    fullWidth
                    value={date}
                    onValueChange={(value) => selectSheet(value, shift)}
                    options={[
                        { value: data.today, label: `${text('today')} · ${formatDay(data.today)}` },
                        { value: data.minDate, label: `${text('yesterday')} · ${formatDay(data.minDate)}` },
                    ]}
                />
                <LiquidSegmented
                    aria-label={text('shiftLabel')}
                    fullWidth
                    value={shift}
                    onValueChange={(value) => selectSheet(date, value)}
                    options={[
                        { value: 'day', label: text('dayShift') },
                        { value: 'night', label: text('nightShift') },
                    ]}
                />
            </div>

            {(draftStatus === 'error' || draftStatus === 'conflict' || unmatchedDraft) && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
                    <p>{draftStatus === 'conflict' ? text('draftConflict') : draftStatus === 'error' ? text('draftError') : text('unmatchedDraft')}</p>
                    <Button variant="outline" className="min-h-11" onClick={discardDraft}>{text('discardDraft')}</Button>
                </div>
            )}

            {batch && (
                <div className={cn('flex flex-col gap-3 rounded-2xl border px-4 py-3.5 text-sm shadow-xs sm:flex-row sm:items-center sm:justify-between',
                    isProtected || isFinalized ? 'border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)]/50' : 'border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)]/50')}>
                    <p className="flex items-start gap-2.5 text-body">
                        {isProtected || isFinalized ? <Lock className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                        <span>
                            <strong className="font-bold text-ink">{isFinalized ? text('finalized') : summary.register.pending > 0 ? text('savedIncomplete') : text('saved')}</strong>
                            {' · '}{isFinalized ? text('finalizedBody') : isProtected ? text('savedLocked') : text('correctionActive')}
                        </span>
                    </p>
                    <div className="flex shrink-0 flex-wrap gap-2">
                        {data.revisions.length > 0 && (
                            <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => setHistoryOpen(true)}>
                                <FileClock className="h-4 w-4" /> {text('historyButton')}
                            </Button>
                        )}
                        {isProtected && (
                            <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => setUnlockOpen(true)}>
                                <LockOpen className="h-4 w-4" /> {text('unlockButton')}
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <section className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep"><ClipboardList className="h-5 w-5" /></span>
                        <div>
                            <h2 className="text-base font-bold text-ink">{text('machinesAccounted', { done: summary.register.accounted, total: summary.register.total })}</h2>
                            <p className="text-xs text-muted-foreground">{text('leaveBlankHint')}</p>
                        </div>
                    </div>
                    {sheet.workers.length > 0 && (
                        <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => setWorkersOpen(true)}>
                            <Users className="h-4 w-4" /> {text('workersButton')}
                        </Button>
                    )}
                </header>
                <div role="region" aria-label={text('sheetTitle')} className="divide-y divide-hairline">
                    {sheet.rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-body">{text('noMachines')}</p>}
                    {sheet.rows.map(row => {
                        const draft = row.workerId ? rows[row.workerId] ?? blankRow : blankRow
                        return (
                            <ReadingRow key={row.machineId} row={row} text={text} actions={actions}
                                value={draft.machineMeters[contextKey(row)] ?? ''}
                                state={summary.stateOf(row)}
                                absent={draft.status === 'absent'}
                                disabled={inputsDisabled || row.paid} />
                        )
                    })}
                </div>
            </section>

            {sheet.rows.length > 0 && (
                <div className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-surface/95 px-4 pb-[calc(0.75rem+var(--safe-area-bottom,0px))] pt-3 backdrop-blur">
                    <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-ink">{text('totalMetres', { metres: formatMeters(summary.totalMeters) })}</p>
                            <p role="status" className="truncate text-xs text-body">{statusLine}</p>
                        </div>
                        <Button onClick={() => save()} disabled={saveDisabled} className="h-11 min-w-[140px] rounded-xl font-bold">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {saving ? text('saving') : batch ? text('saveCorrection') : text('saveShift')}
                        </Button>
                    </div>
                </div>
            )}

            <Dialog open={workersOpen} onOpenChange={setWorkersOpen}>
                <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-lg">
                    <DialogHeader className="border-b border-hairline p-5">
                        <DialogTitle>{text('workersTitle')}</DialogTitle>
                        <DialogDescription>{text('workersDescription')}</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] divide-y divide-hairline overflow-y-auto">
                        {sheet.workers.map(worker => {
                            const row = rows[worker.id] ?? blankRow
                            const contexts = sheet.rowsByWorker.get(worker.id) ?? []
                            return (
                                <div key={worker.id} className="grid grid-cols-[minmax(0,1fr)_150px] items-center gap-3 px-5 py-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-bold text-ink" data-i18n-skip="true">{worker.name}</p>
                                        <p className="truncate text-xs text-muted-foreground" data-i18n-skip="true">
                                            {contexts.length > 0 ? contexts.map(context => context.machineLabel).join(', ') : text('noMachineToday')}
                                        </p>
                                    </div>
                                    <Select value={row.status} onValueChange={value => changeWorkerStatus(worker.id, value as BaseDailyProductionStatus)} disabled={inputsDisabled || worker.paid}>
                                        <SelectTrigger className="h-11 w-full rounded-xl" aria-label={worker.name}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="blank">{text('statusNotEntered')}</SelectItem>
                                            {contexts.length > 0 && <SelectItem value="entered">{text('statusProduced')}</SelectItem>}
                                            <SelectItem value="zero">{text('statusZero')}</SelectItem>
                                            <SelectItem value="absent">{text('statusAbsent')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )
                        })}
                    </div>
                    <DialogFooter className="border-t border-hairline p-4">
                        <Button className="min-h-11" onClick={() => setWorkersOpen(false)}>{text('done')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={reviewOpen} onOpenChange={open => { if (!saving) setReviewOpen(open) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{text('incompleteTitle')}</DialogTitle>
                        <DialogDescription>{text('incompleteBody', { pending: summary.register.pending })}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" className="min-h-11" disabled={saving} onClick={() => setReviewOpen(false)}>{text('keepEntering')}</Button>
                        <Button className="min-h-11" disabled={saving} onClick={() => save(true)}>{saving ? text('saving') : text('saveIncomplete')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{text('unlockTitle')}</DialogTitle>
                        <DialogDescription>{text('unlockBody')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="supervisor-correction-reason">{text('reasonLabel')}</Label>
                        <Textarea id="supervisor-correction-reason" value={reason} maxLength={240} autoFocus
                            placeholder={text('reasonPlaceholder')} onChange={event => setReason(event.target.value)} />
                        <p className="text-right text-xs text-muted-foreground">{reason.length}/240</p>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" className="min-h-11" onClick={() => setUnlockOpen(false)}>{text('keepLocked')}</Button>
                        <Button className="min-h-11" disabled={reason.trim().length < 3}
                            onClick={() => { setUnlocked(true); setUnlockOpen(false) }}>
                            <LockOpen className="h-4 w-4" /> {text('unlock')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{text('historyTitle')}</DialogTitle>
                        <DialogDescription>{formatDay(date)} · {shift === 'day' ? text('dayShift') : text('nightShift')}</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                        {data.revisions.map(revision => (
                            <div key={revision.revision_number} className="rounded-xl border border-hairline p-3.5 text-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <p className="font-bold text-ink">{revision.change_kind === 'created' ? text('historyCreated') : text('historyCorrected', { number: revision.revision_number - 1 })}</p>
                                    <p className="text-xs text-muted-foreground">{formatDateTime(revision.changed_at)}</p>
                                </div>
                                <p className="text-xs text-muted-foreground" data-i18n-skip="true">{text('historyBy', { name: revision.changed_by_name ?? text('unknownAuthor') })}</p>
                                {revision.correction_reason && <p className="mt-2 text-body" data-i18n-skip="true">{revision.correction_reason}</p>}
                                <p className="mt-2 rounded-lg bg-surface-soft px-3 py-2 text-xs text-body">
                                    <strong className="text-ink">{revision.before_total === null ? formatMeters(revision.after_total ?? 0) : `${formatMeters(revision.before_total)} → ${formatMeters(revision.after_total ?? 0)}`}</strong>
                                    {' · '}{text('historyCounts', { entered: revision.entered_count ?? 0, zero: revision.zero_count ?? 0, absent: revision.absent_count ?? 0 })}
                                </p>
                            </div>
                        ))}
                    </div>
                    <DialogFooter><Button variant="outline" className="min-h-11" onClick={() => setHistoryOpen(false)}>{text('close')}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
