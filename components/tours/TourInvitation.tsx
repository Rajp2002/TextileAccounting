'use client'

import React, { useId, useRef } from 'react'
import { Compass, Sparkles } from 'lucide-react'
import type { TourId } from '@/lib/tours/tour-types'
import { useTranslation } from '@/lib/i18n/context'
import { tourInvitationCopy } from '@/lib/i18n/tour-invitations'
import { useTourInvitation } from '@/hooks/use-tour-invitation'

export interface TourInvitationProps {
    tourId: TourId
    userId?: string
    userMetadata?: Record<string, any> | null
    orgId?: string
    onLaunch?: () => void | Promise<void>
    className?: string
    align?: 'start' | 'end' | 'full'
    /** Optional test locator */
    dataTestId?: string
}

export function TourInvitation({
    tourId,
    userId,
    userMetadata,
    orgId,
    onLaunch,
    className = '',
    align = 'start',
    dataTestId,
}: TourInvitationProps) {
    const { language } = useTranslation()
    const copy = tourInvitationCopy[language] ?? tourInvitationCopy.en
    const benefitId = useId()
    const launcherRef = useRef<HTMLButtonElement>(null)

    const {
        presentation,
        isHaloActive,
        isStarting,
        handleDismiss,
        handleLaunch,
    } = useTourInvitation({
        tourId,
        userId,
        userMetadata,
        orgId,
        onLaunch,
    })

    const onDismissClick = () => {
        handleDismiss()
        // Ensure focus moves to surviving launcher
        window.setTimeout(() => {
            launcherRef.current?.focus()
        }, 0)
    }

    const tourName = copy.tourNames[tourId] || 'Tour'
    const tourAriaLabel = copy.tourAriaLabel.replace('{name}', tourName)

    if (presentation === 'invitation') {
        return (
            <div
                data-testid={dataTestId ?? `tour-invitation-${tourId}`}
                data-tour-invitation="true"
                data-tour-id={tourId}
                className={`tour-invitation-container flex flex-wrap items-center gap-2.5 rounded-xl border border-amber-200/90 bg-amber-50/80 p-2.5 sm:px-3.5 sm:py-2 text-slate-800 ${className}`}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                        <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <p id={benefitId} className="text-xs font-medium text-slate-800 leading-snug">
                        {copy.benefits[tourId]}
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
                    <button
                        ref={launcherRef}
                        type="button"
                        onClick={() => void handleLaunch()}
                        disabled={isStarting}
                        aria-describedby={benefitId}
                        aria-label={`${copy.takeTour} · ${tourAriaLabel}`}
                        data-testid="tour-invitation-launch"
                        data-tour-control="take-tour"
                        className={`estimator-touch-target min-h-[44px] min-w-[44px] relative inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-200/70 px-3 py-1.5 text-xs font-bold text-amber-950 shadow-xs transition-all hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron disabled:opacity-50 ${
                            isHaloActive ? 'tour-halo-active' : ''
                        }`}
                    >
                        <span>{isStarting ? copy.loading : copy.takeTour}</span>
                        <Sparkles className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                    </button>

                    <span className="text-xs text-amber-400 select-none" aria-hidden="true">·</span>

                    <button
                        type="button"
                        onClick={onDismissClick}
                        aria-label={copy.dismissAriaLabel}
                        data-testid="tour-invitation-dismiss"
                        data-tour-control="dismiss"
                        className="estimator-touch-target min-h-[44px] min-w-[44px] text-xs font-medium text-slate-600 hover:text-slate-900 underline px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron rounded inline-flex items-center justify-center"
                    >
                        {copy.dismiss}
                    </button>
                </div>
            </div>
        )
    }

    // Quiet Tour state
    return (
        <button
            ref={launcherRef}
            type="button"
            onClick={() => void handleLaunch()}
            disabled={isStarting}
            aria-label={tourAriaLabel}
            data-testid={dataTestId ?? `tour-launcher-${tourId}`}
            data-tour-control="quiet-tour"
            data-costing-tour={tourId === 'saved-costings' ? 'launcher' : undefined}
            className={`estimator-touch-target group flex items-center justify-between gap-2.5 rounded-xl border border-amber-200/90 bg-amber-50/75 px-3 py-2 text-left text-xs font-semibold text-slate-800 shadow-xs transition-all duration-150 hover:border-amber-300 hover:bg-amber-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 ${
                align === 'full' ? 'w-full' : ''
            } ${className}`}
        >
            <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 transition-colors group-hover:bg-amber-200">
                    <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="truncate text-xs font-bold text-slate-900">
                    {isStarting ? copy.loading : copy.tour}
                </span>
            </div>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-100/90 text-amber-700 transition-colors group-hover:bg-amber-200">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
            </span>
        </button>
    )
}
