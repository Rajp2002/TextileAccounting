'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import type { BaseProductionJob, BaseProductionMachine } from '@/lib/base-production-core'
import { setBaseMachineJobContext, switchBaseMachineQuality } from './actions'

/**
 * Picks which active quality a loom weaves. A loom with no quality gets one; a loom
 * that already weaves one is switched, and the workers assigned to it stay assigned.
 */
export default function MachineQualityDialog({
    machine,
    open,
    onOpenChange,
    jobs,
    currentJobId,
    loomsByJob,
    today,
    productionHref,
    onSaved,
}: {
    machine: BaseProductionMachine | null
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Planned and active qualities only. */
    jobs: readonly BaseProductionJob[]
    currentJobId: string | null
    loomsByJob: ReadonlyMap<string, number>
    today: string
    /** Where to activate a quality when there is none to choose. */
    productionHref: string
    onSaved: () => void
}) {
    const { tx } = useTranslation()
    const listLabelId = useId()
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    // Every opening starts from what the loom weaves now.
    const [syncedOpen, setSyncedOpen] = useState(open)
    if (syncedOpen !== open) {
        setSyncedOpen(open)
        setSelectedJobId(open ? currentJobId : null)
    }

    const machineName = machine ? machine.custom_label || machine.name : ''
    const unchanged = selectedJobId === null || selectedJobId === currentJobId

    async function save() {
        if (!machine || !selectedJobId || unchanged || saving) return
        setSaving(true)
        try {
            const result = currentJobId
                ? await switchBaseMachineQuality({ machineId: machine.id, toJobId: selectedJobId, effectiveFrom: today })
                : await setBaseMachineJobContext({ machineId: machine.id, jobId: selectedJobId, effectiveFrom: today })
            if ('error' in result && result.error) {
                toast.error(result.error)
                return
            }
            toast.success(tx('Quality saved for {machine}.', { machine: machineName }))
            onOpenChange(false)
            onSaved()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : tx('Could not save the quality. Try again.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next) }}>
            <DialogContent data-machine-quality-dialog className="max-w-lg gap-0 overflow-hidden rounded-2xl p-0 sm:p-0">
                <DialogHeader className="border-b border-hairline bg-surface-soft/40 p-5 pb-3 pr-14">
                    <DialogTitle className="text-base font-bold text-ink">
                        {tx('Quality for {machine}', { machine: machineName })}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-body">
                        {currentJobId
                            ? tx('Choose another quality for this loom. Workers on this loom stay assigned.')
                            : tx('Choose which active quality this loom should weave.')}
                    </DialogDescription>
                </DialogHeader>

                {jobs.length === 0 ? (
                    <div className="space-y-3 p-5 text-center">
                        <p className="text-sm font-semibold text-ink">{tx('No active qualities yet')}</p>
                        <p className="text-xs text-body">{tx('Activate a saved costing in Production, then choose it here.')}</p>
                        <Button asChild variant="outline" className="h-11 rounded-xl sm:h-10">
                            <Link href={productionHref}>{tx('Open Production')}</Link>
                        </Button>
                    </div>
                ) : (
                    <div role="radiogroup" aria-labelledby={listLabelId} className="min-w-0 space-y-2 p-5">
                        <p id={listLabelId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx('Active qualities')}</p>
                        <div className="max-h-[min(24rem,50dvh)] space-y-2 overflow-y-auto pr-1">
                            {jobs.map((job) => {
                                const selected = selectedJobId === job.id
                                const looms = loomsByJob.get(job.id) ?? 0
                                return (
                                    <label
                                        key={job.id}
                                        className={cn(
                                            'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-loom/30',
                                            selected ? 'border-loom bg-loom/5' : 'border-hairline bg-surface hover:bg-surface-soft/40',
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="machine-quality"
                                            value={job.id}
                                            checked={selected}
                                            disabled={saving}
                                            onChange={() => setSelectedJobId(job.id)}
                                            className="size-4 shrink-0 accent-loom"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2">
                                                <span className="truncate text-sm font-bold text-ink" title={job.quality_label}>{job.quality_label}</span>
                                                <span className="shrink-0 rounded-md bg-surface-soft px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">v{job.costing_version || 1}</span>
                                            </span>
                                            <span className="mt-0.5 block text-xs text-muted-foreground">
                                                {looms === 0
                                                    ? tx('Not running on any loom yet')
                                                    : looms === 1
                                                        ? tx('Running on 1 loom')
                                                        : tx('Running on {count} looms', { count: looms })}
                                            </span>
                                        </span>
                                        {job.id === currentJobId && <Badge variant="success" className="shrink-0 text-xs">{tx('Current')}</Badge>}
                                    </label>
                                )
                            })}
                        </div>
                    </div>
                )}

                {jobs.length > 0 && (
                    <DialogFooter className="items-center gap-2 border-t border-hairline bg-surface-soft/20 p-4 sm:justify-between">
                        <p className="text-xs text-muted-foreground">{tx('Takes effect from today.')}</p>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" className="h-11 rounded-xl sm:h-10" disabled={saving} onClick={() => onOpenChange(false)}>
                                {tx('Cancel')}
                            </Button>
                            <Button className="h-11 rounded-xl sm:h-10" disabled={unchanged || saving} onClick={() => void save()}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                                {currentJobId ? tx('Switch quality') : tx('Assign quality')}
                            </Button>
                        </div>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
