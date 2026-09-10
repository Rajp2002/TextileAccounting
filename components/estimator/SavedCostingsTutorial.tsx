'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Compass, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
import { rateBookTutorialCopy } from '@/lib/i18n/rate-book-tutorial'
import { savedCostingsTutorialCopy } from '@/lib/i18n/saved-costings-tutorial'
import { savedCostingTourSteps, type SavedCostingStep } from '@/lib/saved-costings-tour'
import { findTourTarget } from '@/lib/tutorial-target'
import { useMobileTour } from '@/hooks/use-mobile-tour'
import { lockTourViewport } from '@/lib/tutorial-viewport-lock'
import { TourInvitation } from '@/components/tours/TourInvitation'
import { persistTourCompleted } from '@/lib/tours/tour-preferences'

const selectors: Partial<Record<SavedCostingStep, string>> = {
 find: '#saved-costings-search', filters: '[data-costing-tour="filters"]',
 select: '[data-costing-tour="sample"]', versions: '[data-costing-tour="versions"]',
 breakdown: '[data-costing-tour="breakdown"]', economics: '[data-costing-tour="economics"]', reuse: '[data-costing-tour="reuse"]',
 organize: '[data-costing-tour="versions"]', production: '[data-costing-tour="production"]',
 internal: '[data-costing-tour="export-modes"]', customer: '[data-costing-tour="export-modes"]',
 share: '[data-costing-tour="export-actions"]', compareSelect: '[data-costing-tour="versions"]',
 comparisonDetails: '[data-costing-tour="comparison-details"]', comparison: '[data-costing-tour="comparison"]', snapshots: '[data-free-costing]',
 searchAndFilters: '[data-costing-tour="search-and-filters"]', search: '#saved-costings-search', freeFilters: '[data-costing-tour="free-filters"]',
 freeSelect: '[data-costing-tour="free-sample"]',
}
function resolveTarget(step: SavedCostingStep) {
 const target = findTourTarget(selectors[step] ?? '[data-costing-tour="launcher"]')
 return { target, card: target }
}

/** Controlled navigation lets the page derive sample dialogs without async data writes. */
export function SavedCostingsTutorial({step, onStepChange, free = false, production = false, quotations = false, inline = false, userId, orgId, userMetadata}: {
 step: SavedCostingStep | null; onStepChange: (step: SavedCostingStep | null) => void
 free?: boolean; production?: boolean; quotations?: boolean; inline?: boolean
 userId?: string; orgId?: string; userMetadata?: Record<string, any> | null
}) {
 const {language, languageStatus} = useTranslation()
 const copy = savedCostingsTutorialCopy[language]
 const controls = rateBookTutorialCopy[language]
 const steps = savedCostingTourSteps(free, production, quotations)
 const index = step ? steps.indexOf(step) : -1
 const panel = useRef<HTMLDivElement>(null)
 const launcher = useRef<HTMLButtonElement>(null)
 const portal = useRef<HTMLDivElement>(null)
 const navigation = useRef({steps, index, onStepChange})
 useEffect(() => { navigation.current = {steps, index, onStepChange} })
 const [rect, setRect] = useState<{step: SavedCostingStep; bounds: DOMRect} | null>(null)
 const resolve = useCallback((current: SavedCostingStep) => selectors[current] ? resolveTarget(current) : {target: launcher.current, card: launcher.current}, [])
 const mobile = useMobileTour(step ?? undefined, panel, resolve)
 const close = useCallback(() => onStepChange(null), [onStepChange])
 const active = step !== null

 useEffect(() => {
  if (!active || !panel.current) return
  const trigger = launcher.current
  const originalScroll = {x: window.scrollX, y: window.scrollY}
  const prior = new Map<HTMLElement, boolean>()
  const makeInert = () => {
   for (const el of Array.from(document.body.children)) {
    if (!(el instanceof HTMLElement) || el === portal.current || el.contains(portal.current)) continue
    if (!prior.has(el)) prior.set(el, el.inert)
    el.inert = true
   }
  }
  makeInert()
  const observer = new MutationObserver(makeInert)
  observer.observe(document.body, {childList: true})
  const unlock = lockTourViewport(panel.current)
  const block = (event: Event) => {
   if (event.target instanceof Node && panel.current?.contains(event.target)) return
   event.preventDefault(); event.stopImmediatePropagation()
  }
  const focus = () => {
   if (!panel.current?.contains(document.activeElement)) panel.current?.focus({preventScroll: true})
  }
  const keyboard = (event: KeyboardEvent) => {
   if (event.ctrlKey || event.metaKey || event.altKey) return
   const {steps: currentSteps, index: currentIndex, onStepChange: change} = navigation.current
   if (event.key === 'Escape') {event.preventDefault(); event.stopImmediatePropagation(); return}
   if (['Enter', 'ArrowRight', 'ArrowLeft'].includes(event.key)) {
    if (event.key === 'Enter' && event.target instanceof HTMLButtonElement && ['skip', 'back'].includes(event.target.dataset.tourControl ?? '')) return
    event.preventDefault(); event.stopImmediatePropagation()
    change(event.key === 'ArrowLeft' ? currentSteps[Math.max(0, currentIndex - 1)] : currentSteps[currentIndex + 1] ?? null)
   }
   if (event.key === 'Tab') {
    const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    event.preventDefault(); event.stopImmediatePropagation()
    buttons[(i + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
   }
  }
  const events = ['pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu', 'touchstart']
  events.forEach(name => document.addEventListener(name, block, {capture: true, passive: false}))
  document.addEventListener('keydown', keyboard, true)
  document.addEventListener('focusin', focus, true)
  panel.current.focus({preventScroll: true})
  return () => {
   observer.disconnect(); unlock()
   events.forEach(name => document.removeEventListener(name, block, true))
   document.removeEventListener('keydown', keyboard, true)
   document.removeEventListener('focusin', focus, true)
   prior.forEach((value, el) => {el.inert = value})
   window.scrollTo({left: originalScroll.x, top: originalScroll.y, behavior: 'instant'})
   trigger?.focus({preventScroll: true})
   // Radix restores focus as its closing portal unmounts; restore the launcher after it.
   window.setTimeout(() => { if (trigger?.isConnected && document.activeElement === document.body) trigger.focus({preventScroll: true}) }, 300)
  }
 }, [active])

 useEffect(() => {
  if (!step || mobile.mobile) return
  let frame = 0
  const start = performance.now()
  let positioned: HTMLElement | null = null
  const measure = () => {
   const {target} = resolve(step)
   if (target) {
    if (target !== positioned) {target.scrollIntoView({block: 'start', inline: 'nearest', behavior: 'instant'}); positioned = target}
    setRect({step, bounds: target.getBoundingClientRect()})
   }
   // Bounded mount/animation tracking: navigation remains available if a target is missing.
   if (performance.now() - start < 1800) frame = requestAnimationFrame(measure)
  }
  const update = () => {const {target} = resolve(step); if (target) setRect({step, bounds: target.getBoundingClientRect()})}
  frame = requestAnimationFrame(measure)
  window.addEventListener('resize', update)
  window.addEventListener('scroll', update, true)
  return () => {cancelAnimationFrame(frame); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true)}
 }, [step, mobile.mobile, resolve])
 const spotlight = mobile.mobile ? mobile.rects?.field : rect?.step === step ? rect.bounds : null
 const bottom = spotlight && spotlight.top < 380 && spotlight.right > window.innerWidth - 300
 return <>
  <div className={inline ? 'mb-4' : 'saved-costings-tour-launcher mb-4'}>
    <TourInvitation
      tourId="saved-costings"
      userId={userId}
      orgId={orgId}
      userMetadata={userMetadata}
      onLaunch={() => onStepChange(steps[0])}
      align="full"
      className="border-amber-200/90 bg-amber-50/75 hover:bg-amber-100/70 shadow-xs"
    />
  </div>
  {step && createPortal(<div ref={portal} data-testid="saved-costings-tutorial" data-i18n-skip="true" lang={language} className="fixed inset-0 z-[100]" style={{pointerEvents: 'auto'}}>
   <div aria-hidden="true" className="guided-tour-backdrop absolute inset-0 bg-black/55 backdrop-blur-xs" style={spotlight ? {clipPath: `polygon(evenodd, 0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${spotlight.left}px ${spotlight.top}px,${spotlight.left}px ${spotlight.bottom}px,${spotlight.right}px ${spotlight.bottom}px,${spotlight.right}px ${spotlight.top}px,${spotlight.left}px ${spotlight.top}px)`} : undefined}/>
   {spotlight && <div className="guided-tour-highlight pointer-events-none fixed rounded-lg border-2 border-saffron ring-4 ring-saffron/30" style={{left: spotlight.left - 4, top: spotlight.top - 4, width: spotlight.width + 8, height: spotlight.height + 8}}/>}
   <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="saved-costings-tour-title" aria-describedby="saved-costings-tour-description" tabIndex={-1} className={`guided-tour-panel fixed right-4 z-[101] flex w-[260px] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] flex-col rounded-2xl border border-amber-200/90 bg-surface p-4 text-ink shadow-2xl outline-none ${bottom ? 'bottom-4' : 'top-4'}`}>
    <div data-tour-description-scroll><div aria-live="polite"><span className="text-[11px] font-bold text-saffron-deep">{copy.sample}</span><h2 id="saved-costings-tour-title" className="mt-3 text-[17px] font-bold">{copy.fields[step][0]}</h2><p id="saved-costings-tour-description" className="mt-3 text-[13.5px] leading-relaxed">{copy.fields[step][1]}</p></div></div>
    <div role="progressbar" aria-label={controls.progress} aria-valuenow={index + 1} aria-valuemin={1} aria-valuemax={steps.length} className="mt-4 h-1.5 rounded-full bg-amber-100"><div className="h-full rounded-full bg-saffron" style={{width: `${(index + 1) / steps.length * 100}%`}}/></div>
    <div className="guided-tour-controls mt-3 flex items-center justify-between gap-1">
      <Button variant="ghost" size="sm" data-tour-control="skip" onClick={close}>{controls.skip}</Button>
      <span className="text-xs">{index + 1}/{steps.length}</span>
      <Button variant="outline" size="sm" data-tour-control="back" disabled={index === 0} onClick={() => onStepChange(steps[index - 1])}>{controls.back}</Button>
      <Button size="sm" data-tour-control="next" className="bg-saffron text-white" onClick={() => {
        if (index === steps.length - 1) {
          if (userId) void persistTourCompleted('saved-costings', userId)
          onStepChange(null)
        } else {
          onStepChange(steps[index + 1] ?? null)
        }
      }}>{index === steps.length - 1 ? controls.finish : controls.next}</Button>
    </div>
   </div>
  </div>, document.body)}
 </>
}
