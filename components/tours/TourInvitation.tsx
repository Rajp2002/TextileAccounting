'use client'

import React, { createContext, useContext, useRef, useState, type ElementType, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ChevronRight, Compass } from 'lucide-react'
import type { TourId } from '@/lib/tours/tour-types'
import { useTranslation } from '@/lib/i18n/context'
import { tourInvitationCopy } from '@/lib/i18n/tour-invitations'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { usePhoneViewport } from '@/lib/phone-viewport'
import { GUIDE_SUPPRESSED } from '@/lib/tours/guide-availability'
import { useTourInvitation } from '@/hooks/use-tour-invitation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { railButton, railGuideIcon, railGuideSurface, railIcon, railPrimaryAction, railSurface } from '@/components/ui/rail'
import { cn } from '@/lib/utils'

/**
 * One entry in a page's Guide. A topic with `content` opens as its own view inside the Guide
 * modal; a topic with `onSelect` is an action (another tour, for example) that runs once the
 * modal has closed. Nothing in the Guide expands in place and no dialog opens over another.
 */
export interface GuideTopic {
    id: string
    icon: ElementType
    title: string
    /** Short line under the title in the topic list. */
    summary?: string
    /** A count shown at the end of the topic row, such as the number of glossary terms. */
    count?: number
    content?: ReactNode
    onSelect?: () => void
    /** Topic copy already written in the active language: the DOM translator must leave it alone. */
    lang?: string
    i18nSkip?: boolean
    /** Optional locator, for tours and tests. */
    control?: string
}

export interface TourInvitationProps {
    tourId: TourId
    userId?: string
    userMetadata?: Record<string, unknown> | null
    orgId?: string
    onLaunch?: () => void | Promise<void>
    /** The page's help, listed under the tour in the Guide modal. */
    topics?: readonly GuideTopic[]
    /** The page cannot start its tour right now (it is saving, or not set up yet); the Guide still opens. */
    launchDisabled?: boolean
    className?: string
    /** Retained for callers; the Guide has one layout. */
    align?: 'full'
    /** Optional test locator */
    dataTestId?: string
}

/**
 * The route's tour, handed down by a tour wrapper (ReplicaGuidedTour) to the page it wraps, so the
 * page header can show the Guide for a tour it does not own. Its `topics` come before the page's
 * own. `sample` marks the sample copy of the page a tour shows: it draws the same button but never
 * starts anything.
 */
export type PageTour = Omit<TourInvitationProps, 'className' | 'align' | 'dataTestId'> & {
    /** Receives the element that wraps the Guide, the tour's focus fallback. */
    launcher?: (element: HTMLDivElement | null) => void
    sample?: boolean
}
const PageTourContext = createContext<PageTour | null>(null)
export const PageTourProvider = PageTourContext.Provider
export const usePageTour = () => useContext(PageTourContext)

/**
 * The Guide for a page header. It reads the page's tour from `PageTourProvider` when a tour wrapper
 * supplies one; otherwise it lists the page's help topics on their own.
 */
export function PageGuide({ topics, className }: { topics?: readonly GuideTopic[]; className?: string }) {
    const tour = usePageTour()
    if (GUIDE_SUPPRESSED) return null
    if (tour?.sample) return <GuideTrigger className={className} sample />
    if (tour) return <LauncherFrame launcher={tour.launcher}>
        <TourInvitation tourId={tour.tourId} userId={tour.userId} orgId={tour.orgId} userMetadata={tour.userMetadata}
            onLaunch={tour.onLaunch} topics={[...(tour.topics ?? []), ...(topics ?? [])]} className={className} />
    </LauncherFrame>
    if (!topics?.length) return null
    return <HelpGuide topics={topics} className={className} />
}

function LauncherFrame({ launcher, children }: { launcher?: (element: HTMLDivElement | null) => void; children: ReactNode }) {
    return <div ref={launcher} className="contents">{children}</div>
}

/**
 * Tours are not offered on the phone. Gating here, before `useTourInvitation` runs, means a phone
 * records no "first shown" impression for a guide nobody saw, and the account's tour state stays
 * exactly as it was for the next desktop visit. `.phone-guidance` hides the markup on first paint.
 */
export function TourInvitation(props: TourInvitationProps) {
    const phone = usePhoneViewport()
    if (GUIDE_SUPPRESSED || phone) return null
    return <TourInvitationContent {...props} />
}

function HelpGuide({ topics, className }: { topics: readonly GuideTopic[]; className?: string }) {
    const phone = usePhoneViewport()
    if (phone) return null
    return <GuideDialog topics={topics} className={className} />
}

function TourInvitationContent({ tourId, userId, userMetadata, orgId, onLaunch, topics, launchDisabled = false, className, dataTestId }: TourInvitationProps) {
    const { language } = useTranslation()
    const copy = tourInvitationCopy[language]
    const common = tourCommonCopy[language]
    const { presentation, isStarting, handleDismiss, handleLaunch } = useTourInvitation({ tourId, userId, userMetadata, orgId, onLaunch })
    const tourName = copy.tourNames[tourId]

    return <GuideDialog
        topics={topics}
        className={className}
        title={common.guideTitle.replace('{name}', tourName)}
        isNew={presentation === 'invite'}
        busy={isStarting}
        dataTestId={dataTestId ?? `page-guide-${tourId}`}
        tourId={tourId}
        tour={{
            tourId,
            invite: presentation === 'invite',
            benefit: copy.benefits[tourId],
            startLabel: isStarting ? copy.loading : common.startGuide,
            startAria: common.launcherAria.replace('{name}', tourName),
            startDisabled: isStarting || launchDisabled,
            onStart: handleLaunch,
            onDismiss: handleDismiss,
        }}
    />
}

type GuideTour = {
    tourId: TourId
    invite: boolean
    benefit: string
    startLabel: string
    startAria: string
    startDisabled: boolean
    onStart: () => void | Promise<void>
    onDismiss: () => void
}

/** The header button. `sample` is the inert copy drawn on a tour's sample page. */
function GuideTrigger({ className, isNew = false, busy = false, sample = false, dataTestId, tourId, ...props }: React.ComponentProps<'button'> & {
    isNew?: boolean; busy?: boolean; sample?: boolean; dataTestId?: string; tourId?: TourId
}) {
    const { language } = useTranslation()
    const common = tourCommonCopy[language]
    return <Button
        type="button"
        variant="outline"
        data-tour-control={sample ? undefined : 'guide'}
        data-testid={dataTestId}
        data-guide-tour={tourId}
        data-guide-new={isNew ? 'true' : undefined}
        data-i18n-skip="true"
        lang={language}
        aria-label={sample ? undefined : `${common.guideOpen}${isNew ? ` · ${common.guideNew}` : ''}`}
        aria-busy={busy || undefined}
        aria-hidden={sample || undefined}
        // The sample copy is disabled like every control on a tour's sample page, but keeps the live look.
        disabled={sample || undefined}
        className={cn('phone-guidance relative h-10 gap-2 rounded-lg border-hairline bg-surface px-3.5 text-ink shadow-xs hover:border-hairline-strong hover:bg-surface-soft', sample && 'disabled:opacity-100', className)}
        {...props}
    >
        <Compass className="size-4 text-saffron-deep" aria-hidden="true" />
        <span>{common.guide}</span>
        {isNew && <span aria-hidden="true" className="absolute -right-1 -top-1 size-2.5 rounded-full bg-saffron ring-2 ring-surface" />}
    </Button>
}

function GuideDialog({ topics = [], className, title, isNew, busy, dataTestId, tourId, tour }: {
    topics?: readonly GuideTopic[]
    className?: string
    title?: string
    isNew?: boolean
    busy?: boolean
    dataTestId?: string
    tourId?: TourId
    tour?: GuideTour
}) {
    const { language } = useTranslation()
    const common = tourCommonCopy[language]
    const [open, setOpen] = useState(false)
    const [topicId, setTopicId] = useState<string | null>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    // An action chosen inside the modal (a tour) runs after the modal has closed and focus is back
    // on the Guide button, so the tour's own focus handling starts from the header.
    const pending = useRef<(() => void | Promise<void>) | null>(null)
    const startRef = useRef<HTMLButtonElement>(null)
    const launch = (run: () => void | Promise<void>) => { pending.current = run; setOpen(false) }
    const topic = topics.find(item => item.id === topicId && item.content !== undefined)
    // The tour card names the tour, so the modal itself is just the page's Guide.
    const heading = topic?.title ?? (tour ? common.guide : title ?? common.pageHelp)

    return <Dialog open={open} onOpenChange={next => { setOpen(next); if (!next) setTopicId(null) }}>
        <DialogTrigger asChild>
            <GuideTrigger ref={trigger} className={className} isNew={isNew} busy={busy} dataTestId={dataTestId} tourId={tourId} />
        </DialogTrigger>
        <DialogContent
            aria-describedby={undefined}
            data-page-guide="true"
            className="max-h-[85vh] overflow-y-auto sm:max-w-xl"
            onCloseAutoFocus={event => {
                const run = pending.current
                if (!run) return
                pending.current = null
                event.preventDefault()
                trigger.current?.focus({ preventScroll: true })
                void run()
            }}
        >
            <DialogHeader className="pr-9">
                {topic && <button
                    type="button"
                    onClick={() => setTopicId(null)}
                    data-i18n-skip="true"
                    lang={language}
                    className="-ml-1 mb-1 inline-flex min-h-10 w-fit items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-body hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />{common.helpBack}
                </button>}
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface-soft text-saffron-deep">
                        {topic ? <topic.icon className="h-5 w-5" aria-hidden="true" /> : <Compass className="h-5 w-5" aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                        <DialogTitle data-i18n-skip={topic ? (topic.i18nSkip ? 'true' : undefined) : 'true'} lang={topic ? topic.lang : language} className="text-lg font-bold leading-snug text-ink">{heading}</DialogTitle>
                        {!topic && tour && <DialogDescription data-i18n-skip="true" lang={language} className="mt-0.5 text-sm text-body">{common.guideIntro}</DialogDescription>}
                    </div>
                </div>
            </DialogHeader>
            {topic
                ? <div data-guide-topic={topic.id} data-i18n-skip={topic.i18nSkip ? 'true' : undefined} lang={topic.lang} className="space-y-3">{topic.content}</div>
                : <div className="space-y-5">
                    {tour && <section
                        data-testid={tour.invite ? `tour-guide-${tour.tourId}` : `tour-launcher-${tour.tourId}`}
                        data-tour-id={tour.tourId}
                        data-tour-invitation={tour.invite ? 'true' : undefined}
                        data-i18n-skip="true"
                        lang={language}
                        className={cn('p-4 text-ink', tour.invite ? railGuideSurface : railSurface)}
                    >
                        <div className="flex items-start gap-3">
                            <span className={railGuideIcon} aria-hidden="true"><Compass className="h-5 w-5" /></span>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-base font-bold leading-snug text-ink">{title}</h3>
                                <p className="mt-1 text-sm leading-relaxed text-body">{tour.benefit}</p>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                                ref={startRef}
                                type="button"
                                onClick={() => launch(tour.onStart)}
                                disabled={tour.startDisabled}
                                aria-label={tour.startAria}
                                data-testid="tour-invitation-launch"
                                data-tour-control={tour.invite ? 'take-tour' : 'quiet-tour'}
                                className={cn(railPrimaryAction, 'inline-flex min-h-11 min-w-[44px] flex-1 items-center justify-center gap-2 whitespace-normal transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 sm:flex-none')}
                            >
                                <span>{tour.startLabel}</span>
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </button>
                            {tour.invite && <Button
                                type="button"
                                variant="ghost"
                                onClick={() => { tour.onDismiss(); startRef.current?.focus({ preventScroll: true }) }}
                                data-testid="tour-invitation-dismiss"
                                data-tour-control="dismiss"
                                className="min-h-[44px] min-w-[44px] shrink-0"
                            >{common.notNow}</Button>}
                        </div>
                    </section>}
                    {topics.length > 0 && <section aria-labelledby="page-guide-help" className="space-y-2">
                        {tour && <h3 id="page-guide-help" data-i18n-skip="true" lang={language} className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">{common.pageHelp}</h3>}
                        <ul className="space-y-2">
                            {topics.map(item => <li key={item.id}>
                                <button
                                    type="button"
                                    data-guide-topic-trigger={item.id}
                                    data-tour-control={item.control}
                                    data-i18n-skip={item.i18nSkip ? 'true' : undefined}
                                    lang={item.lang}
                                    onClick={() => item.content !== undefined ? setTopicId(item.id) : item.onSelect && launch(item.onSelect)}
                                    className={cn(railButton, 'h-auto')}
                                >
                                    <span className="flex min-w-0 items-start gap-2.5">
                                        <item.icon className={cn(railIcon, 'mt-0.5')} aria-hidden="true" />
                                        <span className="min-w-0">
                                            <span className="block">{item.title}</span>
                                            {item.summary && <span className="mt-0.5 block text-xs font-normal leading-relaxed text-body">{item.summary}</span>}
                                        </span>
                                    </span>
                                    {item.count !== undefined
                                        ? <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{item.count}</span>
                                        : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                                </button>
                            </li>)}
                        </ul>
                    </section>}
                </div>}
        </DialogContent>
    </Dialog>
}

/** One titled block of guidance inside a Guide topic. */
export function GuideSection({ title, children }: { title: ReactNode; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-hairline bg-surface-soft/60 p-3.5">
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            <div className="mt-1.5 text-sm leading-relaxed text-body">{children}</div>
        </section>
    )
}
