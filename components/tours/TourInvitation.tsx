'use client'

import React, { useId, useRef } from 'react'
import { ArrowRight, Compass } from 'lucide-react'
import type { TourId } from '@/lib/tours/tour-types'
import { useTranslation } from '@/lib/i18n/context'
import { tourInvitationCopy } from '@/lib/i18n/tour-invitations'
import { useTourInvitation } from '@/hooks/use-tour-invitation'
import { railButton, railIcon, railSurface } from '@/components/ui/rail'
import { cn } from '@/lib/utils'

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
        // Stacks inside a rail; becomes a single row when shown inline above a page.
        return (
            <section
                data-testid={dataTestId ?? `tour-guide-${tourId}`}
                data-tour-id={tourId}
                className={cn('@container p-4 text-ink', railSurface, className)}
            >
                <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center @lg:gap-6">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <Compass className={railIcon} aria-hidden="true" />
                            <h2 className="text-sm font-semibold leading-snug text-ink">
                                {effectiveGuideCard.title}
                            </h2>
                        </div>
                        <p id={benefitId} className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
                            {copy.benefits[tourId]}
                        </p>
                    </div>
                    <button
                        ref={launcherRef}
                        type="button"
                        onClick={() => void handleLaunch()}
                        disabled={isStarting}
                        aria-describedby={benefitId}
                        aria-label={`${effectiveGuideCard.actionLabel} · ${tourAriaLabel}`}
                        data-tour-control={presentation === 'invitation' ? 'take-tour' : 'quiet-tour'}
                        className={cn(
                            'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-hairline-strong bg-surface px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50 disabled:opacity-50 @lg:w-auto @lg:shrink-0',
                            isHaloActive && 'tour-halo-active',
                        )}
                    >
                        <span>{isStarting ? copy.loading : effectiveGuideCard.actionLabel}</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            </section>
        )
    }

    if (presentation === 'invitation') {
        return (
            <div
                data-testid={dataTestId ?? `tour-invitation-${tourId}`}
                data-tour-invitation="true"
                data-tour-id={tourId}
                className={cn('tour-invitation-container flex flex-wrap items-center gap-2.5 p-2.5 text-ink sm:px-3.5 sm:py-2', railSurface, className)}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Compass className={railIcon} aria-hidden="true" />
                    <p id={benefitId} className="text-xs font-medium leading-snug text-ink">
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
                        className={cn(
                            'estimator-touch-target relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-hairline-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50 disabled:opacity-50',
                            isHaloActive && 'tour-halo-active',
                        )}
                    >
                        <span>{isStarting ? copy.loading : copy.takeTour}</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        onClick={onDismissClick}
                        aria-label={copy.dismissAriaLabel}
                        data-testid="tour-invitation-dismiss"
                        data-tour-control="dismiss"
                        className="estimator-touch-target inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded px-2 py-1 text-xs font-medium text-muted-foreground underline hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50"
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
            className={cn('estimator-touch-target', railButton, 'px-3 py-2 text-xs', align !== 'full' && 'w-auto', className)}
        >
            <span className="flex min-w-0 items-center gap-2">
                <Compass className={railIcon} aria-hidden="true" />
                <span className="truncate">
                    {isStarting ? copy.loading : copy.tour}
                </span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
    )
}
