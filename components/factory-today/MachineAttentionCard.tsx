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
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            {/* Header */}
            <div className={cn(
                'flex items-center gap-3 border-b px-4 py-3',
                allAssigned
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-amber-500/20 bg-amber-500/5'
            )}>
                <Server className={cn('h-4 w-4 shrink-0', allAssigned ? 'text-emerald-400' : 'text-amber-400')} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Looms</p>
                    <p className={cn('text-sm font-bold', allAssigned ? 'text-emerald-400' : 'text-amber-400')}>
                        {allAssigned ? 'All looms assigned' : `${machines.unassigned} loom${machines.unassigned !== 1 ? 's' : ''} unassigned`}
                    </p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-b border-white/[0.06]">
                <div className="px-4 py-3 text-center">
                    <p className="text-lg font-bold text-emerald-400">{machines.assigned}</p>
                    <p className="text-[11px] font-medium text-zinc-500">Assigned</p>
                </div>
                <div className="px-4 py-3 text-center">
                    <p className={cn('text-lg font-bold', machines.unassigned > 0 ? 'text-amber-400' : 'text-zinc-400')}>
                        {machines.unassigned}
                    </p>
                    <p className="text-[11px] font-medium text-zinc-500">Unassigned</p>
                </div>
                <div className="px-4 py-3 text-center">
                    <p className={cn('text-lg font-bold', machines.maintenance > 0 ? 'text-rose-400' : 'text-zinc-400')}>
                        {machines.maintenance}
                    </p>
                    <p className="text-[11px] font-medium text-zinc-500">Maintenance</p>
                </div>
            </div>

            {/* Unassigned Machines List */}
            {machines.unassignedMachines.length > 0 && (
                <div className="divide-y divide-white/[0.04] px-4">
                    {machines.unassignedMachines.slice(0, 4).map((m) => (
                        <div key={m.id} className="flex items-center gap-3 py-2.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                            <span className="flex-1 text-sm font-medium text-zinc-300">{m.name}</span>
                            {m.loomType && (
                                <span className="text-[11px] text-zinc-500">{m.loomType}</span>
                            )}
                        </div>
                    ))}
                    {machines.unassignedMachines.length > 4 && (
                        <p className="py-2 text-xs text-zinc-500">
                            +{machines.unassignedMachines.length - 4} more unassigned
                        </p>
                    )}
                </div>
            )}

            {allAssigned && (
                <div className="flex items-center gap-2 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <p className="text-sm text-zinc-400">All {machines.totalActive} looms are assigned and active.</p>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
                <Link
                    href="/owner/machines"
                    className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
                >
                    <Wrench className="h-3 w-3" />
                    Manage Looms
                </Link>
            </div>
        </div>
    )
}
