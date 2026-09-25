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
    userMetadata?: Record<string, unknown> | null
    orgId?: string
    onLaunch?: () => void | Promise<void>
    className?: string
    align?: 'start' | 'end' | 'full'
    /** Optional test locator */
    dataTestId?: string
    guideCard?: { title: string; actionLabel: string }
}

function getGuideTitle(tourId: TourId, lang: 'en' | 'gu' | 'hi'): string {
    const name = tourInvitationCopy[lang]?.tourNames[tourId] || 'Tour'
    switch (lang) {
        case 'gu': return `${name} માર્ગદર્શિકા`
        case 'hi': return `${name} मार्गदर्शिका`
        default: return `${name} guide`
    }
}

function getGuideAction(lang: 'en' | 'gu' | 'hi'): string {
    switch (lang) {
        case 'gu': return 'માર્ગદર્શિકા શરૂ કરો'
        case 'hi': return 'मार्गदर्शिका शुरू करें'
        default: return 'Start guide'
    }
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
    guideCard,
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

    const effectiveGuideCard = guideCard ?? (align === 'full' ? {
        title: getGuideTitle(tourId, language),
        actionLabel: getGuideAction(language),
    } : null)

    if (effectiveGuideCard) {
        return (
            <section
                data-testid={dataTestId ?? `tour-guide-${tourId}`}
                data-tour-id={tourId}
                className={`rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/95 via-amber-50/80 to-amber-100/40 p-4 text-slate-800 shadow-[var(--shadow-card)] backdrop-blur-sm transition-all hover:border-amber-300 hover:shadow-md ${className}`}
            >
                <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-200/80 text-amber-900 shadow-2xs border border-amber-300/60">
                        <Compass className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h2 className="text-sm font-bold tracking-tight text-slate-900 leading-tight">
                        {effectiveGuideCard.title}
                    </h2>
                </div>
                <p id={benefitId} className="mt-2 text-xs leading-relaxed text-slate-700/95 font-medium">
                    {copy.benefits[tourId]}
                </p>
                <button
                    ref={launcherRef}
                    type="button"
                    onClick={() => void handleLaunch()}
                    disabled={isStarting}
                    aria-describedby={benefitId}
                    aria-label={`${effectiveGuideCard.actionLabel} · ${tourAriaLabel}`}
                    data-tour-control={presentation === 'invitation' ? 'take-tour' : 'quiet-tour'}
                    className={`mt-3.5 inline-flex min-h-11 min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-xs sm:text-[0.8125rem] font-bold text-amber-950 shadow-xs transition-all hover:bg-amber-400 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron active:scale-[0.99] disabled:opacity-50 ${isHaloActive ? 'tour-halo-active' : ''}`}
                >
                    <span>{isStarting ? copy.loading : effectiveGuideCard.actionLabel}</span>
                    <Sparkles className="h-4 w-4 text-amber-950" aria-hidden="true" />
                </button>
            </section>
        )
    }

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
