'use client'

import Link from 'next/link'
import type { FactoryTodayData } from '@/app/(dashboard)/owner/today/actions'
import { CheckCircle2, AlertCircle, XCircle, Sun, Moon, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProductionStatusCardProps {
    production: FactoryTodayData['production']
}

function ShiftBadge({ shift, logged }: { shift: 'Day' | 'Night'; logged: boolean }) {
    const Icon = shift === 'Day' ? Sun : Moon
    return (
        <div className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
            logged
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        )}>
            <Icon className="h-3.5 w-3.5" />
            <span>{shift} Shift</span>
            <span className={cn(
                'ml-auto text-[11px] font-semibold',
                logged ? 'text-emerald-500' : 'text-amber-500'
            )}>
                {logged ? 'Logged' : 'Pending'}
            </span>
        </div>
    )
}

export function ProductionStatusCard({ production }: ProductionStatusCardProps) {
    const bothLogged = production.dayShiftLogged && production.nightShiftLogged
    const noneLogged = !production.hasLogsToday

    const StatusIcon = bothLogged ? CheckCircle2 : noneLogged ? XCircle : AlertCircle
    const statusColor = bothLogged ? 'text-emerald-400' : noneLogged ? 'text-rose-400' : 'text-amber-400'
    const headerColor = bothLogged
        ? 'border-emerald-500/20 bg-emerald-500/5'
        : noneLogged
            ? 'border-rose-500/20 bg-rose-500/5'
            : 'border-amber-500/20 bg-amber-500/5'

    const statusLabel = bothLogged
        ? 'Production logged today'
        : noneLogged
            ? 'No production logged today'
            : 'Shifts partially logged'

    return (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
            {/* Header */}
            <div className={cn('flex items-center gap-3 border-b px-4 py-3', headerColor)}>
                <StatusIcon className={cn('h-4 w-4 shrink-0', statusColor)} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Production Status</p>
                    <p className={cn('text-sm font-bold', statusColor)}>{statusLabel}</p>
                </div>
                {production.hasLogsToday && (
                    <p className="text-right text-xs text-zinc-500">
                        <span className="text-lg font-bold text-zinc-200">
                            {production.totalMetersToday.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>m
                    </p>
                )}
            </div>

            {/* Shift Status */}
            <div className="grid grid-cols-2 gap-2 p-4">
                <ShiftBadge shift="Day" logged={production.dayShiftLogged} />
                <ShiftBadge shift="Night" logged={production.nightShiftLogged} />
            </div>

            {/* Footer Actions */}
            <div className="flex items-center gap-2 border-t border-white/[0.06] px-4 py-3">
                {production.lastLogAt && (
                    <p className="flex-1 text-xs text-zinc-500">
                        Last log: {new Date(production.lastLogAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </p>
                )}
                <Link
                    href="/owner/machines"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10"
                >
                    <ExternalLink className="h-3 w-3" />
                    View Looms
                </Link>
            </div>
        </div>
    )
}
