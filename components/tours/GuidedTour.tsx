'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/lib/i18n/context'
import { useGuidedTourModal, useTourStep, type TourNavigation } from '@/hooks/use-guided-tour'
import { acquireTour, releaseTour } from '@/lib/tours/active-tour'
import { persistTourCompleted } from '@/lib/tours/tour-preferences'
import { restoreScroll, type ScrollRecord } from '@/lib/tours/tour-scroll'
import { resolveTourTarget } from '@/lib/tours/target-readiness'
import { isTourTargetVisible } from '@/lib/tutorial-target'
import type { TourId, TourStepSpec } from '@/lib/tours/tour-types'
import { TourPanel } from './TourPanel'
import { TourSpotlight } from './TourSpotlight'

type Props<S extends string> = {
    tourId: TourId; steps: readonly TourStepSpec<S>[]; step: S
    copy: (id: S) => { title: string; body: string; detail?: string; unavailable?: string }
    onStepChange: (next: S | null) => void; onDone?: () => void
    launcher: RefObject<HTMLElement | null>; returnFocus?: RefObject<HTMLElement | null>
    recordCompletion?: boolean; userId?: string; extra?: ReactNode
}

function ActiveGuidedTour<S extends string>({ tourId, steps, step, copy, onStepChange, onDone, launcher, returnFocus, recordCompletion = true, userId, extra }: Props<S>) {
    const { language } = useTranslation()
    const index = steps.findIndex(spec => spec.id === step)
    const spec = steps[index]
    const content = copy(step)
    const panel = useRef<HTMLDivElement>(null)
    const portal = useRef<HTMLDivElement>(null)
    const launchFocus = useRef<HTMLElement | null>(null)
    const handoff = useRef<HTMLElement | null>(null)
    const [initialScroll] = useState(() => ({ x: window.scrollX, y: window.scrollY }))
    const returnScroll = useRef(initialScroll)
    const record = useMemo<ScrollRecord>(() => new Map(), [])
    const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 767px), (max-height: 500px) and (pointer: coarse)').matches)
    useLayoutEffect(() => { launchFocus.current = returnFocus?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : launcher.current) }, [launcher, returnFocus])
    useEffect(() => {
        const media = window.matchMedia('(max-width: 767px), (max-height: 500px) and (pointer: coarse)')
        const change = () => setCompact(media.matches)
        media.addEventListener('change', change)
        return () => media.removeEventListener('change', change)
    }, [])
    const result = useTourStep({ tourId, step, spec, panel, compact, language, unavailable: content.unavailable, scrollRecord: record })
    const close = useCallback(() => onStepChange(null), [onStepChange])
    const next = () => {
        if (index < steps.length - 1) { onStepChange(steps[index + 1].id); return }
        if (spec.kind === 'handoff') {
            const target = resolveTourTarget(spec.anchor, spec.context)
            if (isTourTargetVisible(target) && !target.matches(':disabled, [aria-disabled="true"]')) handoff.current = target
        }
        if (recordCompletion) void persistTourCompleted(tourId, userId)
        onDone?.()
        onStepChange(null)
    }
    const back = () => { if (index > 0) onStepChange(steps[index - 1].id) }
    const navigation = useRef<TourNavigation>({ close, next, back })
    useLayoutEffect(() => { navigation.current = { close, next, back } })
    useGuidedTourModal({ panel, portal, navigation, launcher, returnScroll, returnFocus: launchFocus, focusReturn: 'return-focus-at-close' })
    useEffect(() => () => {
        restoreScroll(record)
        const fallback = launcher.current
        const target = handoff.current ?? (isTourTargetVisible(launchFocus.current) ? launchFocus.current : fallback?.matches('button') ? fallback : fallback?.querySelector<HTMLElement>('[data-tour-control="take-tour"], [data-tour-control="quiet-tour"]'))
        if (target && isTourTargetVisible(target) && !target.matches(':disabled, [aria-disabled="true"]')) target.focus({ preventScroll: true })
    }, [launcher, record])
    const style = compact ? undefined : { left: result.placement?.left ?? 16, top: result.placement?.top ?? 16 }
    return createPortal(<div ref={portal} className="guided-tour-portal fixed inset-0 z-[100]" data-i18n-skip="true" lang={language}>
        <TourSpotlight rect={result.rect} animate={result.status === 'ready'} />
        <TourPanel tourId={tourId} stepId={step} {...content} extra={extra} index={index} total={steps.length} sample={spec.kind === 'sample'} status={result.status} statusText={result.statusText} isLast={index === steps.length - 1} onExit={close} onBack={back} onNext={next} panelRef={panel} style={style} language={language} />
    </div>, document.body)
}

/** Mounted only while the page owns a non-null step. No listeners run when inactive. */
export function GuidedTour<S extends string>(props: Props<S>) {
    const [acquired, setAcquired] = useState(false)
    useEffect(() => {
        if (!acquireTour(props.tourId)) return
        const frame = requestAnimationFrame(() => setAcquired(true))
        return () => { cancelAnimationFrame(frame); releaseTour(props.tourId) }
    }, [props.tourId])
    return acquired ? <ActiveGuidedTour {...props} /> : null
}
