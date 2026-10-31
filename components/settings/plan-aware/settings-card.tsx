'use client'

import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Factory, Lock, Smartphone, User } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

/** Who a settings section changes: only the signed-in person, the whole factory, or this device. */
export type SettingsScope = 'personal' | 'factory' | 'device'

const SCOPES: Record<SettingsScope, { icon: LucideIcon; label: string }> = {
    personal: { icon: User, label: 'Only you' },
    factory: { icon: Factory, label: 'Whole factory' },
    device: { icon: Smartphone, label: 'This device' },
}

/** The shell every settings section shares: a header band, the body, and an optional footer band. */
export const settingsCardClassName = 'flex min-w-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs'
export const settingsCardBodyClassName = 'flex-1 px-4 py-5 sm:px-6 sm:py-6'

export function SettingsCardHeader({
    icon: Icon,
    titleId,
    title,
    description,
    scope,
    tone = 'brand',
    className,
}: {
    icon: LucideIcon
    titleId: string
    title: React.ReactNode
    description?: React.ReactNode
    scope?: SettingsScope
    tone?: 'brand' | 'neutral'
    className?: string
}) {
    const { tx } = useTranslation()
    const scopeInfo = scope ? SCOPES[scope] : null
    return (
        <div className={cn('flex items-start gap-3.5 px-4 py-5 sm:px-6', className)}>
            <span data-settings-card-icon="true" className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl',
                tone === 'brand' ? 'bg-saffron-soft text-saffron-deep' : 'bg-surface-soft text-subtle',
            )}>
                <Icon className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <h2 id={titleId} data-settings-card-title="true" className="text-base font-semibold leading-tight text-ink">{title}</h2>
                    {scopeInfo && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-soft/60 px-2.5 py-1 text-xs font-medium text-subtle">
                            <scopeInfo.icon className="size-3.5" aria-hidden="true" />
                            {tx(scopeInfo.label)}
                        </span>
                    )}
                </div>
                {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
            </div>
        </div>
    )
}

/** Footer band: a short note or the unsaved marker on the left, the section's buttons on the right. */
export function SettingsCardFooter({ note, dirty = false, children }: { note?: React.ReactNode; dirty?: boolean; children: React.ReactNode }) {
    const { tx } = useTranslation()
    return (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-hairline bg-surface-soft/40 px-4 py-3.5 sm:px-6">
            <p className="min-w-0 basis-full text-xs leading-relaxed text-muted-foreground sm:basis-0 sm:flex-1">
                {dirty ? (
                    <span className="inline-flex items-center gap-2 font-medium text-warning">
                        <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
                        {tx('Unsaved changes')}
                    </span>
                ) : note}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2.5 max-sm:w-full">{children}</div>
        </div>
    )
}

/** Small heading for a group of fields inside a section body. */
export function SettingsFieldGroupLabel({ children }: { children: React.ReactNode }) {
    return <h3 className="text-[13px] font-medium text-muted-foreground">{children}</h3>
}

/**
 * Save button colours: ink while there is something to save or the Saved
 * confirmation shows; a quiet outlined button while there is nothing to save.
 */
export function settingsSaveButtonClassName(isDirty: boolean, justSaved: boolean) {
    return cn(
        'min-h-11 rounded-xl px-5 font-semibold shadow-xs transition-colors',
        justSaved && !isDirty
            ? 'disabled:opacity-100'
            : 'disabled:border disabled:border-hairline disabled:bg-surface disabled:text-subtle disabled:opacity-100 disabled:shadow-none',
    )
}

/** A value the owner can see but not edit here, shaped like a field so the grid stays aligned. */
export function ReadOnlyValue({ children, lockedLabel, className }: { children: React.ReactNode; lockedLabel: string; className?: string }) {
    return (
        <div className={cn('flex min-h-11 items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-soft/50 px-3.5 py-2 text-sm text-ink', className)}>
            <span className="min-w-0 break-all select-all">{children}</span>
            <span className="shrink-0 text-subtle" title={lockedLabel}>
                <Lock className="size-3.5" aria-hidden="true" />
                <span className="sr-only">{lockedLabel}</span>
            </span>
        </div>
    )
}
