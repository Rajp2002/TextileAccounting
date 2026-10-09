'use client'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { trackPlanEvent } from '@/lib/plan-analytics'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SwitchField } from '@/components/ui/switch-field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUnloadProtection } from '@/components/settings/plan-aware/unsaved-changes-dialog'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { BulkWorkerEntry } from '@/components/workers/BulkWorkerEntry'
import { emptyBulkWorkersDraft, evaluateBulkWorkers, isBulkWorkersDraftEmpty, type BulkWorkersDraft } from '@/lib/base-bulk-register'
import type { BaseProductionWorker, BaseWorkerShiftAvailability } from '@/lib/base-production-core'
import { createBaseProductionWorker, createBaseProductionWorkersBulk, updateBaseProductionWorker } from '../actions'

type WorkerDraft = {
    payType: 'piece_rate' | 'fixed_monthly'
    role: string
    operatorEligible: boolean
    monthlySalary: string
    startDate: string
    endDate: string
    salaryEffectiveFrom: string
    name: string
    shiftAvailability: BaseWorkerShiftAvailability
    isActive: boolean
}
function emptyWorkerDraft(): WorkerDraft {
    return { name: '', shiftAvailability: 'both', isActive: true, payType: 'piece_rate', role: '', operatorEligible: true, monthlySalary: '', startDate: '', endDate: '', salaryEffectiveFrom: '' }
}
const NO_NAMES: readonly string[] = []
const BULK_SUBMIT_ID = 'base-bulk-submit'

export default function WorkerEditor({ today, initialOpen = false, returnTo, existingNames = NO_NAMES, children, tourPreview }: {
 today: string; initialOpen?: boolean; returnTo?: string;
 /** Names already on the register, so bulk entry can flag them. */
 existingNames?: readonly string[];
 tourPreview?: { worker: BaseProductionWorker; editing: boolean };
 children: (actions: { isOpen: boolean; add: () => void; edit: (record: BaseProductionWorker) => void }) => ReactNode
}) {
 const router = useRouter()
 const pathname = usePathname()
 const params = useSearchParams()
 function clearAddIntent() {
  if (!params.has('add')) return
  const next = new URLSearchParams(params); next.delete('add')
  window.history.replaceState(null, '', `${pathname}${next.size ? `?${next}` : ''}`)
 }
 const { tx, t } = useTranslation()
 const [open, setOpen] = useState(initialOpen || Boolean(tourPreview))
 const [record, setRecord] = useState<BaseProductionWorker | null>(null)
 const [editingWorkerId, setEditingWorkerId] = useState<string | null>(tourPreview?.editing ? tourPreview.worker.id : null)
 const [workerDraft, setWorkerDraft] = useState<WorkerDraft>(() => tourPreview ? { ...emptyWorkerDraft(), name: tourPreview.worker.name, payType: tourPreview.worker.pay_type ?? 'piece_rate', role: tourPreview.worker.role ?? '', operatorEligible: tourPreview.worker.operator_eligible ?? tourPreview.worker.pay_type !== 'fixed_monthly', monthlySalary: String(tourPreview.worker.monthly_salary ?? ''), startDate: tourPreview.worker.start_date ?? '', salaryEffectiveFrom: today, shiftAvailability: tourPreview.worker.shift_availability } : emptyWorkerDraft())
 const [original, setOriginal] = useState(() => JSON.stringify(emptyWorkerDraft()))
 const [pendingAction, setPendingAction] = useState<string | null>(null)
 const [bulk, setBulk] = useState(false)
 const [bulkDraft, setBulkDraft] = useState<BulkWorkersDraft>(() => emptyBulkWorkersDraft(today))
 const bulkActive = bulk && !editingWorkerId
 const bulkEvaluation = useMemo(
   () => evaluateBulkWorkers(bulkDraft.piece, bulkDraft.staff, existingNames, bulkDraft.joiningDate),
   [bulkDraft, existingNames],
 )
 const dirty = !tourPreview && open && (JSON.stringify(workerDraft) !== original || !isBulkWorkersDraftEmpty(bulkDraft))
 useUnloadProtection(dirty)
 function closeDialog() {
   if (tourPreview) return
   if (pendingAction) return
   if (dirty && !window.confirm(tx('Discard unsaved changes?'))) return
   clearAddIntent(); setOpen(false)
 }
 function saved() { clearAddIntent(); setOpen(false); if (returnTo) router.push(returnTo) }
 async function runAction(key: string, action: () => Promise<unknown>, message: string | ((result: unknown) => string), onSuccess: () => void) {
   setPendingAction(key)
   try {
     const result = await action()
     if (result && typeof result === 'object' && 'error' in result && result.error) { toast.error(String(result.error)); return }
     toast.success(typeof message === 'function' ? message(result) : tx(message)); trackPlanEvent('production_activity', { action: key }); onSuccess(); router.refresh()
   } catch { toast.error(tx('The action could not be completed.')) } finally { setPendingAction(null) }
 }
 function resetBulk() { setBulk(false); setBulkDraft(emptyBulkWorkersDraft(today)) }
 function bulkAddedMessage(result: unknown) {
        const { added = 0 } = (result ?? {}) as { added?: number }
        return added === 1 ? tx('1 worker added.') : tx('{count} workers added.', { count: added })
 }
 const bulkSubmitLabel = bulkEvaluation.readyCount === 0 ? tx('Add workers') : bulkEvaluation.readyCount === 1 ? tx('Add 1 worker') : tx('Add {count} workers', { count: bulkEvaluation.readyCount })
 function openEditWorker(worker: BaseProductionWorker) {
        resetBulk()
        setEditingWorkerId(worker.id)
        const draft: WorkerDraft = {
            payType: worker.pay_type ?? 'piece_rate',
            role: worker.role ?? '',
            operatorEligible: worker.operator_eligible ?? worker.pay_type !== 'fixed_monthly',
            monthlySalary: String(worker.monthly_salary ?? 0),
            startDate: worker.start_date ?? '',
            endDate: worker.end_date ?? '',
            salaryEffectiveFrom: today,
            name: worker.name,
            shiftAvailability: worker.shift_availability,
            isActive: worker.is_active,
        }
        setWorkerDraft(draft)
        setOriginal(JSON.stringify(draft))
        setOpen(true)
    }
 function handleWorkerSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (tourPreview) return
        if (bulkActive) {
            if (!bulkEvaluation.valid) return
            void runAction(
                'worker-create-bulk',
                () => createBaseProductionWorkersBulk({
                    pieceRateNames: bulkEvaluation.pieceNames,
                    fixedStaff: bulkEvaluation.fixedStaff,
                    startDate: bulkDraft.joiningDate,
                }),
                bulkAddedMessage,
                saved,
            )
            return
        }
        if (!workerDraft.name.trim()) {
            toast.error('Enter a worker name.')
            return
        }

        if (editingWorkerId) {
            void runAction(
                'worker-update',
                () => updateBaseProductionWorker({
                    expectedUpdatedAt: record?.updated_at,
                    ...workerDraft,
                    monthlySalary: Number(workerDraft.monthlySalary),
                    workerId: editingWorkerId,
                    name: workerDraft.name,
                    shiftAvailability: workerDraft.shiftAvailability,
                    isActive: workerDraft.isActive,
                }),
                'Worker updated.',
                saved,
            )
            return
        }

        void runAction(
            'worker-create',
            () => createBaseProductionWorker({ ...workerDraft, monthlySalary: Number(workerDraft.monthlySalary) }),
            'Worker added.',
            saved,
        )
    }
 return <>
 {children({
   isOpen: open,
   add: () => { setRecord(null); setEditingWorkerId(null); resetBulk(); setWorkerDraft(emptyWorkerDraft()); setOriginal(JSON.stringify(emptyWorkerDraft())); setOpen(true) },
   edit: value => { setRecord(value); openEditWorker(value) },
 })}
             <Dialog modal={!tourPreview} open={open} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent data-workers-tour-preview={tourPreview ? "true" : undefined} data-tour-surface={tourPreview ? "true" : undefined} onOpenAutoFocus={event => { if (tourPreview) event.preventDefault() }} onCloseAutoFocus={event => { if (tourPreview) event.preventDefault() }} onInteractOutside={event => { if (tourPreview) event.preventDefault() }} onEscapeKeyDown={event => { if (tourPreview) event.preventDefault() }} className={cn('max-h-[90dvh] overflow-y-auto', bulkActive && 'sm:max-w-2xl')}>
                    <DialogHeader><DialogTitle>{editingWorkerId ? 'Edit worker' : bulkActive ? tx('Add workers') : 'Add worker'}</DialogTitle><DialogDescription>{bulkActive ? tx('Add several workers at once. Type a name and press Enter for the next row.') : 'Choose piece-rate or monthly pay independently of operator approval. Pay type cannot be changed later.'}</DialogDescription></DialogHeader>
                    <form onSubmit={handleWorkerSubmit}><fieldset disabled={Boolean(tourPreview)} className="space-y-4">
                        {!editingWorkerId && !tourPreview && <div data-workers-bulk-toggle>
                            <SwitchField checked={bulk} disabled={Boolean(pendingAction)} onCheckedChange={setBulk}>{tx('Add in bulk')}</SwitchField>
                        </div>}
                        {bulkActive ? <BulkWorkerEntry draft={bulkDraft} onChange={update => setBulkDraft(update)} evaluation={bulkEvaluation} joiningLabel={t('workers.joiningDate')} submitButtonId={BULK_SUBMIT_ID} /> : <>
                        <div data-workers-tour-field="name" className="space-y-2"><Label htmlFor="base-worker-name">Worker name</Label><Input id="base-worker-name" autoFocus={!tourPreview} required maxLength={120} value={workerDraft.name} onChange={(event) => setWorkerDraft((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Ramesh" /></div>
                        <div data-workers-tour-field="payType" className="space-y-2"><Label htmlFor="base-worker-pay-type">Pay type</Label><Select disabled={Boolean(editingWorkerId)} value={workerDraft.payType} onValueChange={value => setWorkerDraft(current => ({ ...current, payType: value as WorkerDraft['payType'], operatorEligible: value === 'piece_rate', startDate: current.startDate || today }))}><SelectTrigger id="base-worker-pay-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="piece_rate">Piece rate (per metre)</SelectItem><SelectItem value="fixed_monthly">{t('workers.fixedMonthlySalary')}</SelectItem></SelectContent></Select></div>
                        <div data-workers-tour-field="role" className="space-y-2"><Label htmlFor="base-staff-role">Role</Label><Input id="base-staff-role" value={workerDraft.role} maxLength={80} onChange={event => setWorkerDraft(current => ({ ...current, role: event.target.value }))} placeholder="e.g. Supervisor" /></div>
                        <div className="space-y-2">
                            <SwitchField checked={workerDraft.operatorEligible} onCheckedChange={operatorEligible => setWorkerDraft(current => ({ ...current, operatorEligible }))}>{tx('Approved loom operator')}</SwitchField>
                            <p className="text-xs text-body">{tx('Owner approval for primary loom operation in this factory. Assignments define the machine and shift. Job title and pay do not grant app permissions.')}</p>
                            {workerDraft.operatorEligible && workerDraft.payType === 'fixed_monthly' && <p className="text-xs text-body">{tx('Production is recorded without piece earnings. Monthly salary accrues once per worker.')}</p>}
                        </div>
                        {workerDraft.payType === 'fixed_monthly' && <>
                            <div data-workers-tour-field="salary" className="space-y-2"><Label htmlFor="base-staff-salary">Monthly salary (₹)</Label><Input id="base-staff-salary" type="number" min="0.01" max="10000000" step="0.01" required value={workerDraft.monthlySalary} onChange={event => setWorkerDraft(current => ({ ...current, monthlySalary: event.target.value }))} /></div>
                            <div data-workers-tour-field="joining" className="space-y-2"><Label htmlFor="base-staff-start">{t('workers.joiningDate')}</Label><Input id="base-staff-start" type="date" required disabled={Boolean(editingWorkerId)} value={workerDraft.startDate} onChange={event => setWorkerDraft(current => ({ ...current, startDate: event.target.value }))} /></div>
                            {editingWorkerId && <>
                                <div data-workers-tour-field="effective" className="space-y-2"><Label htmlFor="base-staff-effective">{t('workers.salaryEffectiveFrom')}</Label><Input id="base-staff-effective" type="date" min={today} value={workerDraft.salaryEffectiveFrom} onChange={event => setWorkerDraft(current => ({ ...current, salaryEffectiveFrom: event.target.value }))} /><p className="text-xs text-body">Used only when changing salary. Earlier earnings and paid records stay unchanged.</p></div>
                                <div data-workers-tour-field="lastDay" className="space-y-2"><Label htmlFor="base-staff-end">{t('workers.lastWorkingDay')}</Label><Input id="base-staff-end" type="date" min={workerDraft.startDate} value={workerDraft.endDate} onChange={event => setWorkerDraft(current => ({ ...current, endDate: event.target.value }))} /><p className="text-xs text-body">Salary accrues through this date. Required when deactivating staff.</p></div>
                            </>}
                        </>}
                        {workerDraft.operatorEligible && <div data-workers-tour-field="availability" className="space-y-2"><Label htmlFor="base-worker-shift">{t('workers.shiftAvailability')}</Label><Select value={workerDraft.shiftAvailability} onValueChange={(value) => setWorkerDraft((current) => ({ ...current, shiftAvailability: value as BaseWorkerShiftAvailability }))}><SelectTrigger id="base-worker-shift" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">Day shift</SelectItem><SelectItem value="night">Night shift</SelectItem><SelectItem value="both">Day & night</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">You can edit this later. The assignment board only shows workers available for the selected shift.</p></div>}
                        {editingWorkerId && <SwitchField data-workers-tour-field="active" className="font-normal" checked={workerDraft.isActive} onCheckedChange={(isActive) => setWorkerDraft((current) => ({ ...current, isActive }))}>Active worker</SwitchField>}
                        </>}
                        <DialogFooter><Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button><Button id={bulkActive ? BULK_SUBMIT_ID : undefined} type="submit" disabled={pendingAction?.startsWith('worker-') || (bulkActive && !bulkEvaluation.valid)}>{pendingAction?.startsWith('worker-') ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{returnTo ? tx('Save and return') : editingWorkerId ? 'Save changes' : bulkActive ? bulkSubmitLabel : 'Add worker'}</Button></DialogFooter>
                    </fieldset></form>
                </DialogContent>
            </Dialog>
 </>
}
