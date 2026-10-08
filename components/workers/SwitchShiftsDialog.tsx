'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { rotateBaseWorkerShifts } from '@/app/(dashboard)/owner/production/actions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listRotatableWorkers, planShiftRotation, type RotationAssignment, type ShiftClash } from '@/lib/base-shift-rotation'
import { useTranslation } from '@/lib/i18n/context'
import { trackPlanEvent } from '@/lib/plan-analytics'
import type { BaseProductionWorkerWithOperational } from '@/lib/worker-operational'

export type ShiftRotationData = {
  assignments: RotationAssignment[]
  machineNames: Record<string, string>
}

type PanelProps = ShiftRotationData & {
  workers: BaseProductionWorkerWithOperational[]
  onClose: () => void
}

export function SwitchShiftsDialog({ open, onOpenChange, ...panel }: Omit<PanelProps, 'onClose'> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { tx } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto" data-workers-switch-shifts-dialog>
        <DialogHeader>
          <DialogTitle>{tx('Switch shifts')}</DialogTitle>
          <DialogDescription>
            {tx('Day workers move to night and night workers move to day. Their looms move with them, starting today.')}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts with everyone selected. */}
        <SwitchShiftsPanel {...panel} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

export function SwitchShiftsPanel({ workers, assignments, machineNames, onClose }: PanelProps) {
  const { tx } = useTranslation()
  const router = useRouter()
  const rotatable = useMemo(() => listRotatableWorkers(workers), [workers])
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rotatable.map(worker => worker.id)))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plan = useMemo(() => planShiftRotation({
    workers,
    assignments,
    machineNames: new Map(Object.entries(machineNames)),
    selectedIds: selected,
  }), [workers, assignments, machineNames, selected])

  const loomCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const assignment of assignments) counts.set(assignment.worker_id, (counts.get(assignment.worker_id) ?? 0) + 1)
    return counts
  }, [assignments])
  const clashesByWorker = useMemo(() => {
    const byWorker = new Map<string, ShiftClash[]>()
    for (const clash of plan.clashes) byWorker.set(clash.workerId, [...(byWorker.get(clash.workerId) ?? []), clash])
    return byWorker
  }, [plan.clashes])

  const allSelected = rotatable.length > 0 && selected.size === rotatable.length
  const count = plan.moves.length
  const blocked = pending || count === 0 || plan.clashes.length > 0

  function toggle(workerId: string) {
    setError(null)
    setSelected(previous => {
      const next = new Set(previous)
      if (next.has(workerId)) next.delete(workerId)
      else next.add(workerId)
      return next
    })
  }

  async function confirm() {
    if (blocked) return
    setPending(true)
    setError(null)
    try {
      const result = await rotateBaseWorkerShifts({ workerIds: plan.moves.map(move => move.workerId) })
      if ('error' in result && result.error) { setError(tx(String(result.error))); return }
      if ('conflict' in result && result.conflict) { setError(tx('A loom changed since this list loaded. Close this window and try again.')); return }
      if (!('success' in result)) { setError(tx('Shifts could not be switched. Please try again.')); return }
      toast.success(tx('Shifts switched: {workers} workers, {looms} looms.', { workers: result.workersMoved, looms: result.loomsMoved }))
      trackPlanEvent('production_activity', { action: 'worker-shift-switch' })
      router.refresh()
      onClose()
    } catch {
      setError(tx('Shifts could not be switched. Please try again.'))
    } finally {
      setPending(false)
    }
  }

  if (rotatable.length === 0) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-lg border border-hairline bg-surface-soft px-3 py-3 text-sm text-ink">
          {tx('No piece-rate workers on a single shift to switch.')}
        </p>
        <p className="text-sm text-subtle">{tx('Workers set to Day & night and fixed-salary staff are not included.')}</p>
        <DialogFooter>
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={onClose}>{tx('Cancel')}</Button>
        </DialogFooter>
      </div>
    )
  }

  const groups = [
    { id: 'day', title: tx('Day → Night'), members: rotatable.filter(worker => worker.shift_availability === 'day') },
    { id: 'night', title: tx('Night → Day'), members: rotatable.filter(worker => worker.shift_availability === 'night') },
  ].filter(group => group.members.length > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-subtle" aria-live="polite">
          {tx('{selected} of {total} selected', { selected: selected.size, total: rotatable.length })}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px] sm:min-h-9"
          onClick={() => setSelected(allSelected ? new Set() : new Set(rotatable.map(worker => worker.id)))}
        >
          {allSelected ? tx('Clear all') : tx('Select all')}
        </Button>
      </div>

      {groups.map(group => (
        <section key={group.id} role="group" aria-labelledby={`switch-shifts-${group.id}`} className="space-y-1">
          <h3 id={`switch-shifts-${group.id}`} className="px-1 text-xs font-semibold uppercase tracking-wide text-subtle">{group.title}</h3>
          <ul className="divide-y divide-hairline rounded-lg border border-hairline">
            {group.members.map(worker => {
              const looms = loomCounts.get(worker.id) ?? 0
              const clashes = clashesByWorker.get(worker.id) ?? []
              return (
                <li key={worker.id}>
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-soft">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 cursor-pointer accent-ink"
                      checked={selected.has(worker.id)}
                      onChange={() => toggle(worker.id)}
                      aria-label={tx('Switch shift for {name}', { name: worker.name })}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{worker.name}</span>
                    <span className="shrink-0 text-sm text-subtle">
                      {looms === 0 ? tx('No looms') : looms === 1 ? tx('1 loom') : tx('{count} looms', { count: looms })}
                    </span>
                  </label>
                  {clashes.length > 0 && (
                    <ul className="space-y-1 px-3 pb-2 pl-11 text-sm text-destructive">
                      {clashes.map(clash => (
                        <li key={`${clash.machineId}-${clash.shift}`}>
                          {tx('{machine} ({shift}) is held by {holder}, who is not switching.', {
                            machine: clash.machineName,
                            shift: clash.shift === 'day' ? tx('Day shift') : tx('Night shift'),
                            holder: clash.heldByWorkerName,
                          })}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {plan.clashes.length > 0 && <p role="alert" className="text-sm font-medium text-ink">{tx('Fix these before switching:')}</p>}
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <p className="text-xs text-subtle">{tx('Workers set to Day & night and fixed-salary staff are not included.')}</p>

      <DialogFooter>
        <Button type="button" variant="outline" className="min-h-[44px]" onClick={onClose} disabled={pending}>{tx('Cancel')}</Button>
        <Button type="button" className="min-h-[44px]" onClick={confirm} disabled={blocked}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? tx('Switching…') : count === 1 ? tx('Switch 1 worker') : tx('Switch {count} workers', { count })}
        </Button>
      </DialogFooter>
    </div>
  )
}
