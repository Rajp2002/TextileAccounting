'use client'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/lib/i18n/context'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { acquireTour, releaseTour } from '@/lib/tours/active-tour'
import { restoreScroll, type ScrollRecord } from '@/lib/tours/tour-scroll'
import type { TourId, TourStepSpec } from '@/lib/tours/tour-types'
import { persistTourCompleted } from '@/lib/tours/tour-preferences'
import { useGuidedTourModal, useTourStep, type TourNavigation } from '@/hooks/use-guided-tour'
import { TourPanel } from './TourPanel'
import { TourSpotlight } from './TourSpotlight'

export function GuidedTour<S extends string>({ tourId, steps, step, copy, onStepChange, onDone, launcher, returnFocus, recordCompletion = true, userId }: { tourId: TourId; steps: TourStepSpec<S>[]; step: S; copy: (id: S) => { title: string; body: string; detail?: string; unavailable?: string }; onStepChange: (next: S | null) => void; onDone?: () => void; launcher: RefObject<HTMLElement | null>; returnFocus?: RefObject<HTMLElement | null>; recordCompletion?: boolean; userId?: string }) {
  const { language } = useTranslation(); const panel = useRef<HTMLDivElement>(null); const portal = useRef<HTMLDivElement>(null); const scroll = useMemo<ScrollRecord>(() => new Map(), []); const returnScroll = useRef({ x: 0, y: 0 })
  const index = Math.max(0, steps.findIndex(item => item.id === step)); const spec = steps[index]; const content = copy(step)
  const compact = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px), (max-height: 500px) and (pointer: coarse)').matches
  const runtime = useTourStep({ tourId, step, spec, panel, compact, language, unavailable: content.unavailable, scrollRecord: scroll })
  const close = () => onStepChange(null); const next = () => { if (index < steps.length - 1) onStepChange(steps[index + 1].id); else { if (recordCompletion) void persistTourCompleted(tourId, userId); onDone?.(); onStepChange(null) } }; const back = () => { if (index > 0) onStepChange(steps[index - 1].id) }
  const navigation = useRef<TourNavigation>({ close, next, back }); useEffect(() => { navigation.current = { close, next, back } })
  useGuidedTourModal({ panel, portal, navigation, launcher, returnScroll, returnFocus })
  useEffect(() => { returnScroll.current = { x: window.scrollX, y: window.scrollY }; if (!acquireTour(tourId)) onStepChange(null); return () => { releaseTour(tourId); restoreScroll(scroll) } }, [tourId, onStepChange, scroll])
  const portalNode = useMemo(() => { if (typeof document === 'undefined') return null; const node = document.createElement('div'); node.className = 'guided-tour-portal'; return node }, [])
  useEffect(() => { if (!portalNode) return; document.body.appendChild(portalNode); portal.current = portalNode; return () => portalNode.remove() }, [portalNode])
  if (!portalNode || !spec) return null
  const common = tourCommonCopy[language]; const announcement = common.announce.replace('{n}', String(index + 1)).replace('{total}', String(steps.length)).replace('{title}', content.title)
  return createPortal(<><TourSpotlight rect={runtime.rect} animate={!runtime.reducedMotion} /><TourPanel tourId={tourId} stepId={step} title={content.title} body={content.body} detail={content.detail} index={index} total={steps.length} sample={spec.kind === 'sample'} status={runtime.status} statusText={runtime.statusText} isLast={index === steps.length - 1} onExit={close} onBack={back} onNext={next} panelRef={panel} style={runtime.placement ? { left: runtime.placement.left, top: runtime.placement.top } : undefined} language={language} /><span className="sr-only" aria-live="polite">{runtime.status === 'preparing' ? '' : announcement}</span></>, portalNode)
}
