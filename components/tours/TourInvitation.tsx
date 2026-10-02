'use client'

import React, { useId, useLayoutEffect, useRef } from 'react'
import { ArrowRight, Compass } from 'lucide-react'
import type { TourId } from '@/lib/tours/tour-types'
import { useTranslation } from '@/lib/i18n/context'
import { tourInvitationCopy } from '@/lib/i18n/tour-invitations'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { useTourInvitation } from '@/hooks/use-tour-invitation'
import { Button } from '@/components/ui/button'
import { railGuideButton, railGuideIcon, railGuideSurface, railPrimaryAction } from '@/components/ui/rail'
import { cn } from '@/lib/utils'

export interface TourInvitationProps {
    tourId: TourId
    userId?: string
    userMetadata?: Record<string, unknown> | null
    orgId?: string
    onLaunch?: () => void | Promise<void>
    className?: string
    /** The full-width guide card is the only invitation layout; callers keep passing it. */
    align?: 'full'
    /** Optional test locator */
    dataTestId?: string
}

export function TourInvitation({ tourId, userId, userMetadata, orgId, onLaunch, className = '', dataTestId }: TourInvitationProps) {
    const { language } = useTranslation()
    const copy = tourInvitationCopy[language]
    const common = tourCommonCopy[language]
    const benefitId = useId()
    const launcherRef = useRef<HTMLButtonElement>(null)
    const focusAfterDismiss = useRef(false)
    const { presentation, isStarting, handleDismiss, handleLaunch } = useTourInvitation({ tourId, userId, userMetadata, orgId, onLaunch })
    const tourName = copy.tourNames[tourId]
    const title = common.guideTitle.replace('{name}', tourName)
    const launcherAria = common.launcherAria.replace('{name}', tourName)

    useLayoutEffect(() => {
        if (presentation === 'replay' && focusAfterDismiss.current) {
            focusAfterDismiss.current = false
            launcherRef.current?.focus({ preventScroll: true })
        }
    }, [presentation])

    const dismiss = <Button
        type="button"
        variant="ghost"
        onClick={() => { focusAfterDismiss.current = true; handleDismiss() }}
        data-testid="tour-invitation-dismiss"
        data-tour-control="dismiss"
        className="min-h-[44px] min-w-[44px] shrink-0"
    >{common.notNow}</Button>

    if (presentation === 'invite') {
        return <section
            data-testid={dataTestId ?? `tour-guide-${tourId}`}
            data-tour-id={tourId}
            data-tour-invitation="true"
            className={cn('@container p-4 text-ink', railGuideSurface, className)}
        >
            <div className="flex flex-col gap-3.5 @lg:flex-row @lg:items-center @lg:gap-6">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                        <span className={railGuideIcon} aria-hidden="true"><Compass className="h-5 w-5" /></span>
                        <h2 className="min-w-0 text-base font-bold leading-snug text-ink">{title}</h2>
                    </div>
                    <p id={benefitId} className="mt-2.5 text-sm leading-relaxed text-body">{copy.benefits[tourId]}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 @lg:shrink-0">
                    <button
                        ref={launcherRef}
                        type="button"
                        onClick={() => void handleLaunch()}
                        disabled={isStarting}
                        aria-describedby={benefitId}
                        aria-label={launcherAria}
                        data-testid="tour-invitation-launch"
                        data-tour-control="take-tour"
                        className={cn(railPrimaryAction, 'inline-flex min-h-12 min-w-[44px] w-full items-center justify-center gap-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 @lg:w-auto')}
                    >
                        <span>{isStarting ? copy.loading : common.startGuide}</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {dismiss}
                </div>
            </div>
        </section>
    }

    return <button
        ref={launcherRef}
        type="button"
        onClick={() => void handleLaunch()}
        disabled={isStarting}
        aria-label={launcherAria}
        data-testid={dataTestId ?? `tour-launcher-${tourId}`}
        data-tour-control="quiet-tour"
        data-costing-tour={tourId === 'saved-costings' ? 'launcher' : undefined}
        className={cn('estimator-touch-target', railGuideButton, className)}
    >
        <span className="flex min-w-0 items-center gap-3">
            <span className={railGuideIcon} aria-hidden="true"><Compass className="h-5 w-5" /></span>
            <span className="min-w-0">{isStarting ? copy.loading : title}</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-saffron-deep transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
    </button>
}
