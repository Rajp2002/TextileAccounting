'use client'

import Link from 'next/link'
import type { FactoryTodayData } from '@/app/(dashboard)/owner/today/actions'
import { Server, AlertTriangle, CheckCircle2, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MachineAttentionCardProps {
    machines: FactoryTodayData['machines']
}

export function MachineAttentionCard({ machines }: MachineAttentionCardProps) {
    const allAssigned = machines.unassigned === 0

    return (
        <div className="rounded-2xl border border-hairline bg-surface overflow-hidden">
            {/* Header */}
            <div className={cn(
                'flex items-center gap-3 border-b px-4 py-3',
                allAssigned
                    ? 'border-success/20 bg-success-soft'
                    : 'border-warning/20 bg-warning-soft'
            )}>
                <Server className={cn('h-4 w-4 shrink-0', allAssigned ? 'text-success' : 'text-warning')} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink">Looms</p>
                    <p className={cn('text-sm font-bold', allAssigned ? 'text-success' : 'text-warning')}>
                        {allAssigned ? 'All looms assigned' : `${machines.unassigned} loom${machines.unassigned !== 1 ? 's' : ''} unassigned`}
                    </p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 divide-x divide-hairline border-b border-hairline">
                <div className="px-4 py-3 text-center">
                    <p className="text-lg font-bold text-success">{machines.assigned}</p>
                    <p className="text-[11px] font-medium text-body">Assigned</p>
                </div>
                <div className="px-4 py-3 text-center">
                    <p className={cn('text-lg font-bold', machines.unassigned > 0 ? 'text-warning' : 'text-muted')}>
                        {machines.unassigned}
                    </p>
                    <p className="text-[11px] font-medium text-body">Unassigned</p>
                </div>
                <div className="px-4 py-3 text-center">
                    <p className={cn('text-lg font-bold', machines.maintenance > 0 ? 'text-risk' : 'text-muted')}>
                        {machines.maintenance}
                    </p>
                    <p className="text-[11px] font-medium text-body">Maintenance</p>
                </div>
            </div>

            {/* Unassigned Machines List */}
            {machines.unassignedMachines.length > 0 && (
                <div className="divide-y divide-hairline px-4">
                    {machines.unassignedMachines.slice(0, 4).map((m) => (
                        <div key={m.id} className="flex items-center gap-3 py-2.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                            <span className="flex-1 text-sm font-medium text-body">{m.name}</span>
                            {m.loomType && (
                                <span className="text-[11px] text-muted">{m.loomType}</span>
                            )}
                        </div>
                    ))}
                    {machines.unassignedMachines.length > 4 && (
                        <p className="py-2 text-xs text-muted">
                            +{machines.unassignedMachines.length - 4} more unassigned
                        </p>
                    )}
                </div>
            )}

            {allAssigned && (
                <div className="flex items-center gap-2 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <p className="text-sm text-body">All {machines.totalActive} looms are assigned and active.</p>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-hairline px-4 py-3">
                <Link
                    href="/owner/machines"
                    className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface-soft"
                >
                    <Wrench className="h-3 w-3" />
                    Manage Looms
                </Link>
            </div>
        </div>
    )
}
