import type { LucideIcon } from 'lucide-react'
import {
    AlertCircle,
    Archive,
    CheckCircle2,
    Clock3,
    FileEdit,
    Info,
    Lock,
    RefreshCw,
    Send,
    XCircle,
} from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

type PageHeaderProps = {
    title: React.ReactNode
    description?: React.ReactNode
    eyebrow?: React.ReactNode
    icon?: LucideIcon
    actions?: React.ReactNode
    meta?: React.ReactNode
    centered?: boolean
    className?: string
    id?: string
}

/** Consistent route title block for operational dashboard screens. */
export function PageHeader({
    title,
    description,
    eyebrow,
    icon: Icon,
    actions,
    meta,
    centered = false,
    className,
    id,
}: PageHeaderProps) {
    return (
        <header id={id} className={cn('flex flex-col gap-4 border-b border-hairline/80 pb-5 sm:flex-row sm:items-end sm:justify-between', centered && 'items-center text-center sm:justify-center', className)}>
            <div className={cn('flex min-w-0 items-start gap-3', centered && 'w-full justify-center')}>
                {Icon && (
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-saffron/30 bg-saffron-soft/70 text-saffron-deep">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                )}
                <div className={cn('min-w-0', centered && 'w-full')}>
                    {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-saffron-deep">{eyebrow}</p>}
                    <h1 className={cn('text-xl font-bold leading-tight text-ink sm:text-2xl', centered && 'text-[1.75rem] tracking-tight sm:text-[2rem]')}>{title}</h1>
                    {description && <div className={cn('mt-1 max-w-3xl text-sm leading-relaxed text-body', centered && 'mx-auto')}>{description}</div>}
                </div>
            </div>
            {(meta || actions) && (
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    {meta}
                    {actions}
                </div>
            )}
        </header>
    )
}

type ToolbarProps = React.ComponentProps<'div'>

/** Shared surface for filters, search, view toggles, and compact route actions. */
export function Toolbar({ className, ...props }: ToolbarProps) {
    return (
        <div
            data-slot="toolbar"
            className={cn('min-w-0 rounded-xl border border-hairline bg-surface p-3 shadow-[var(--shadow-card)]', className)}
            {...props}
        />
    )
}

type SectionHeaderProps = {
    title: React.ReactNode
    description?: React.ReactNode
    icon?: LucideIcon
    actions?: React.ReactNode
    className?: string
}

/** Shared heading row for a section inside a route surface. */
export function SectionHeader({ title, description, icon: Icon, actions, className }: SectionHeaderProps) {
    return (
        <div className={cn('flex flex-col gap-3 border-b border-hairline/80 pb-3 sm:flex-row sm:items-start sm:justify-between', className)}>
            <div className="flex min-w-0 items-start gap-2.5">
                {Icon && (
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-saffron/25 bg-saffron-soft/60 text-saffron-deep">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                )}
                <div className="min-w-0">
                    <h2 className="text-base font-semibold leading-tight text-ink">{title}</h2>
                    {description && <p className="mt-1 text-sm leading-relaxed text-body">{description}</p>}
                </div>
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
        </div>
    )
}

type StatusBadgeProps = {
    status: string
    label?: React.ReactNode
    className?: string
    icon?: LucideIcon
}

const statusPresentation: Record<string, { label: string; variant: React.ComponentProps<typeof Badge>['variant']; icon: LucideIcon }> = {
    active: { label: 'Active', variant: 'success', icon: CheckCircle2 },
    current: { label: 'Current', variant: 'success', icon: CheckCircle2 },
    completed: { label: 'Completed', variant: 'success', icon: CheckCircle2 },
    success: { label: 'Complete', variant: 'success', icon: CheckCircle2 },
    sent: { label: 'Sent', variant: 'info', icon: Send },
    accepted: { label: 'Accepted', variant: 'success', icon: CheckCircle2 },
    pending: { label: 'Pending', variant: 'warning', icon: Clock3 },
    processing: { label: 'In progress', variant: 'info', icon: RefreshCw },
    authenticated: { label: 'Activating', variant: 'info', icon: Clock3 },
    created: { label: 'Pending payment', variant: 'warning', icon: Clock3 },
    draft: { label: 'Draft', variant: 'secondary', icon: FileEdit },
    needs_review: { label: 'Needs review', variant: 'warning', icon: AlertCircle },
    warning: { label: 'Needs attention', variant: 'warning', icon: AlertCircle },
    due_soon: { label: 'Review due', variant: 'warning', icon: Clock3 },
    overdue: { label: 'Review overdue', variant: 'risk', icon: Clock3 },
    rejected: { label: 'Rejected', variant: 'risk', icon: XCircle },
    failed: { label: 'Failed', variant: 'risk', icon: XCircle },
    halted: { label: 'Payment failed', variant: 'risk', icon: AlertCircle },
    cancelled: { label: 'Cancelled', variant: 'secondary', icon: XCircle },
    archived: { label: 'Archived', variant: 'secondary', icon: Archive },
    locked: { label: 'Locked', variant: 'risk', icon: Lock },
    expired: { label: 'Expired', variant: 'risk', icon: AlertCircle },
    info: { label: 'Information', variant: 'info', icon: Info },
}

/** Shared status terminology and semantic colors. */
export function StatusBadge({ status, label, className, icon: IconOverride }: StatusBadgeProps) {
    const presentation = statusPresentation[status.toLowerCase()] ?? statusPresentation.info
    const Icon = IconOverride ?? presentation.icon

    return (
        <Badge variant={presentation.variant} className={cn('gap-1.5', className)}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label ?? presentation.label}
        </Badge>
    )
}

type EmptyStateProps = {
    title: React.ReactNode
    description?: React.ReactNode
    icon?: LucideIcon
    action?: React.ReactNode
    className?: string
}

/** Shared no-data and no-results state with a clear next action. */
export function EmptyState({ title, description, icon: Icon = Info, action, className }: EmptyStateProps) {
    return (
        <div role="status" className={cn('flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-hairline-strong bg-surface-soft/45 px-5 py-10 text-center', className)}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline bg-surface text-subtle shadow-[var(--shadow-card)]">
                <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
            {description && <p className="mt-1 max-w-md text-sm leading-relaxed text-body">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    )
}
