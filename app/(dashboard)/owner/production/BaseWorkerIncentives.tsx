'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n/context'
import { formatINR } from '@/lib/finance'
import type { BaseProductionWorker, BaseWorkerIncentive } from '@/lib/base-production-core'
import { createBaseWorkerIncentive, reviewBaseWorkerIncentive } from './actions'

export default function BaseWorkerIncentives({ workers, incentives, today, periodStart, focusIncentiveId }: {
    workers: BaseProductionWorker[]; incentives: BaseWorkerIncentive[]; today: string; periodStart: string; focusIncentiveId?: string | null
}) {
    const { tx } = useTranslation()
    const router = useRouter()
    const focus = incentives.find(item => item.id === focusIncentiveId)
    const [open, setOpen] = useState(Boolean(focus))
    const [workerId, setWorkerId] = useState(focus?.worker_id ?? workers[0]?.id ?? '')
    const [adding, setAdding] = useState(false)
    const [start, setStart] = useState(periodStart < today ? periodStart : today)
    const [end, setEnd] = useState(today)
    const [amount, setAmount] = useState('')
    const [reference, setReference] = useState('')
    const [requestId, setRequestId] = useState('')
    const [pending, setPending] = useState(false)
    const [voidId, setVoidId] = useState<string | null>(null)
    const [reason, setReason] = useState('')
    const rows = incentives.filter(item => item.worker_id === workerId)

    async function run(operation: () => Promise<{ error?: string; success?: boolean }>, success: () => void) {
        if (pending) return
        setPending(true)
        try {
            const result = await operation()
            if (result.error) { toast.error(tx(result.error)); return }
            success()
            router.refresh()
        } catch {
            toast.error(tx('Incentive action failed. Try again with the same details.'))
        } finally { setPending(false) }
    }
    return <>
        <Button variant="outline" className="min-h-11" disabled={workers.length === 0} onClick={() => setOpen(true)}>{tx('Production incentives')}</Button>
        <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value) }}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{tx('Production incentives')}</DialogTitle>
                    <DialogDescription>{tx('Enter an accountant-reviewed amount with its service period and evidence. Owner approval is required before payment.')}</DialogDescription>
                </DialogHeader>
                <p className="text-xs text-body">{tx('Contractual production incentives are separate from statutory annual bonus.')}</p>
                <div className="space-y-2">
                    <Label htmlFor="incentive-worker">{tx('Worker')}</Label>
                    <Select value={workerId} disabled={pending || adding} onValueChange={value => { setWorkerId(value); setVoidId(null) }}>
                        <SelectTrigger id="incentive-worker" className="min-h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>{workers.map(worker => <SelectItem key={worker.id} value={worker.id}>{worker.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                {!adding && <Button className="min-h-11" disabled={pending || !workerId} onClick={() => {
                    setRequestId(crypto.randomUUID()); setStart(periodStart < today ? periodStart : today); setEnd(today)
                    setAmount(''); setReference(''); setAdding(true)
                }}>{tx('Add incentive draft')}</Button>}
                {adding && <form className="space-y-4 border-y border-hairline py-4" onSubmit={event => {
                    event.preventDefault()
                    void run(() => createBaseWorkerIncentive({ workerId, serviceStart: start, serviceEnd: end, amount: Number(amount), evidenceReference: reference, clientRequestId: requestId }), () => setAdding(false))
                }}>
                    <fieldset disabled={pending} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2"><Label htmlFor="incentive-start">{tx('Service period start')}</Label><Input id="incentive-start" className="min-h-11" type="date" max={end} required value={start} onChange={event => setStart(event.target.value)} /></div>
                            <div className="space-y-2"><Label htmlFor="incentive-end">{tx('Service period end')}</Label><Input id="incentive-end" className="min-h-11" type="date" min={start} max={today} required value={end} onChange={event => setEnd(event.target.value)} /></div>
                        </div>
                        <div className="space-y-2"><Label htmlFor="incentive-amount">{tx('Incentive amount (₹)')}</Label><Input id="incentive-amount" className="min-h-11" type="number" min="0.01" max="10000000" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} /></div>
                        <div className="space-y-2"><Label htmlFor="incentive-reference">{tx('Evidence reference')}</Label><Input id="incentive-reference" className="min-h-11" required minLength={3} maxLength={240} value={reference} onChange={event => setReference(event.target.value)} /><p className="text-xs text-body">{tx('Use a unique worksheet or agreement line reference for this worker. Keep the supporting calculation for review.')}</p></div>
                        <div className="flex flex-wrap gap-2"><Button type="submit" className="min-h-11">{pending ? tx('Saving…') : tx('Save draft')}</Button><Button type="button" variant="outline" className="min-h-11" onClick={() => setAdding(false)}>{tx('Cancel')}</Button></div>
                    </fieldset>
                </form>}
                <p className="text-xs text-body">{tx('Drafts and incomplete service periods require review before payroll can be paid. Approved amounts cannot be edited; void and replace an unpaid record with a reason.')}</p>
                {rows.length === 0 ? <p className="py-6 text-sm text-body">{tx('No incentives for this worker.')}</p> :
                    <div className="divide-y divide-hairline">{rows.map(item => <div key={item.id} className="space-y-2 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0"><p className="break-words text-sm font-semibold text-ink">{item.evidence_reference}</p><p className="text-xs text-body">{item.service_start} – {item.service_end}</p></div>
                            <p className="text-sm font-semibold text-ink">{formatINR(item.amount)}</p>
                        </div>
                        <p className="text-xs text-body">{item.settlement_id ? tx('Paid') : item.status === 'approved' ? tx('Approved') : item.status === 'voided' ? tx('Voided') : tx('Needs approval')}{item.approved_at ? ' · ' + item.approved_at.slice(0, 10) : ''}</p>
                        {item.void_reason && <p className="break-words text-xs text-body">{item.void_reason}</p>}
                        {!item.settlement_id && item.status !== 'voided' && <div className="flex flex-wrap gap-2">
                            {item.status === 'draft' && <Button className="min-h-11" disabled={pending} onClick={() => void run(() => reviewBaseWorkerIncentive({ incentiveId: item.id, expectedUpdatedAt: item.updated_at, action: 'approve' }), () => toast.success(tx('Incentive approved.')))}>{tx('Approve incentive')}</Button>}
                            <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => { setVoidId(item.id); setReason('') }}>{tx('Void incentive')}</Button>
                        </div>}
                        {voidId === item.id && <div className="space-y-2">
                            <Label htmlFor="incentive-void-reason">{tx('Reason for voiding')}</Label><Input id="incentive-void-reason" className="min-h-11" disabled={pending} maxLength={240} value={reason} onChange={event => setReason(event.target.value)} />
                            <div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" disabled={pending || reason.trim().length < 3} onClick={() => void run(() => reviewBaseWorkerIncentive({ incentiveId: item.id, expectedUpdatedAt: item.updated_at, action: 'void', reason }), () => setVoidId(null))}>{tx('Confirm void')}</Button><Button variant="ghost" className="min-h-11" disabled={pending} onClick={() => setVoidId(null)}>{tx('Cancel')}</Button></div>
                        </div>}
                    </div>)}</div>}
            </DialogContent>
        </Dialog>
    </>
}
