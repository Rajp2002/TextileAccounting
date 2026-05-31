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
                ? 'border-success/30 bg-success-soft text-success'
                : 'border-warning/30 bg-warning-soft text-warning'
        )}>
            <Icon className="h-3.5 w-3.5" />
            <span>{shift} Shift</span>
            <span className={cn(
                'ml-auto text-xs font-semibold',
                logged ? 'text-success' : 'text-warning'
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
    const statusColor = bothLogged ? 'text-success' : noneLogged ? 'text-risk' : 'text-warning'
    const headerColor = bothLogged
        ? 'border-success/20 bg-success-soft'
        : noneLogged
            ? 'border-risk/20 bg-risk-soft'
            : 'border-warning/20 bg-warning-soft'

    const statusLabel = bothLogged
        ? 'Production logged today'
        : noneLogged
            ? 'No production logged today'
            : 'Shifts partially logged'

    return (
        <div className="rounded-2xl border border-hairline bg-surface overflow-hidden">
            {/* Header */}
            <div className={cn('flex items-center gap-3 border-b px-4 py-3', headerColor)}>
                <StatusIcon className={cn('h-4 w-4 shrink-0', statusColor)} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink">Production Status</p>
                    <p className={cn('text-sm font-bold', statusColor)}>{statusLabel}</p>
                </div>
                {noneLogged && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF3B30] text-xs font-bold text-white">
                        1
                    </span>
                )}
                {production.hasLogsToday && (
                    <p className="text-right text-xs text-muted">
                        <span className="text-lg font-bold text-ink">
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
                    <p className="flex-1 text-xs text-muted">
                        Last log: {new Date(production.lastLogAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Kolkata'
                        })}
                    </p>
                )}
                <Link
                    href="/owner/machines"
                    className="flex h-11 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 text-sm font-semibold text-ink transition hover:bg-surface-soft lg:h-9 lg:text-xs"
                >
                    <ExternalLink className="h-4 w-4 lg:h-3 lg:w-3" />
                    View Looms
                </Link>
            </div>
        </div>
    )
}
