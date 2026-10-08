'use client'

import React, { useId, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, Compass } from 'lucide-react'
import type { TourId } from '@/lib/tours/tour-types'
import { useTranslation } from '@/lib/i18n/context'
import { tourInvitationCopy } from '@/lib/i18n/tour-invitations'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { usePhoneViewport } from '@/lib/phone-viewport'
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

/**
 * Tours are not offered on the phone. Gating here, before `useTourInvitation` runs, means a phone
 * records no "first shown" impression for a card nobody saw, and the account's tour state stays
 * exactly as it was for the next desktop visit. `.phone-guidance` hides the markup on first paint.
 */
export function TourInvitation(props: TourInvitationProps) {
    const phone = usePhoneViewport()
    if (phone) return null
    return <TourInvitationContent {...props} />
}

function TourInvitationContent({ tourId, userId, userMetadata, orgId, onLaunch, className = '', dataTestId }: TourInvitationProps) {
    const { language } = useTranslation()
    const copy = tourInvitationCopy[language]
    const common = tourCommonCopy[language]
    const benefitId = useId()
    const detailsId = useId()
    const [detailsExpanded, setDetailsExpanded] = useState(false)
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
            className={cn('phone-guidance mobile-guide-card @container p-4 text-ink', railGuideSurface, className)}
        >
            <div className="mobile-guide-layout grid grid-cols-1 items-center gap-3.5">
                <div className="mobile-guide-heading order-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <span className={cn(railGuideIcon, 'mobile-guide-icon')} aria-hidden="true"><Compass className="h-5 w-5" /></span>
                        <h2 className="min-w-0 text-base font-bold leading-snug text-ink">
                            <button
                                type="button"
                                onClick={() => setDetailsExpanded(value => !value)}
                                aria-expanded={detailsExpanded}
                                aria-controls={detailsId}
                                aria-label={`${title} · ${common.moreDetail}`}
                                className="mobile-guide-title-toggle mobile-touch-target hidden w-full items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"
                            >
                                <span>{title}</span>
                                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none', detailsExpanded && 'rotate-180')} aria-hidden="true" />
                            </button>
                            <span className="mobile-guide-desktop-title">{title}</span>
                        </h2>
                    </div>
                </div>
                <div className="mobile-guide-launch order-3 min-w-0">
                    <button
                        ref={launcherRef}
                        type="button"
                        onClick={() => void handleLaunch()}
                        disabled={isStarting}
                        aria-describedby={benefitId}
                        aria-label={launcherAria}
                        data-testid="tour-invitation-launch"
                        data-tour-control="take-tour"
                        className={cn(railPrimaryAction, 'mobile-touch-target inline-flex min-h-12 min-w-[44px] w-full items-center justify-center gap-2 whitespace-normal transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50')}
                    >
                        <span>{isStarting ? copy.loading : common.startGuide}</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
                <div id={detailsId} data-expanded={detailsExpanded} className="mobile-guide-details order-2">
                    <p id={benefitId} className="text-sm leading-relaxed text-body">{copy.benefits[tourId]}</p>
                    <div className="mt-1">{dismiss}</div>
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
        className={cn('phone-guidance estimator-touch-target', railGuideButton, className)}
    >
        <span className="flex min-w-0 items-center gap-3">
            <span className={railGuideIcon} aria-hidden="true"><Compass className="h-5 w-5" /></span>
            <span className="min-w-0">{isStarting ? copy.loading : title}</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-saffron-deep transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
    </button>
}
