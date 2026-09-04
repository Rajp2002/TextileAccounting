'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { dismissCostEstimateTutorial } from '@/app/(dashboard)/owner/estimator/tutorial-actions'
import { Button } from '@/components/ui/button'

const sections = ['Quality basics', 'Warp yarn', 'Weft yarn', 'Weaving cost', 'Warping and sizing', 'Factory overhead', 'Selling price and quantity']

const fieldTitles: Record<string, string> = {
    warpingMode: 'Warping: in-house or outsourced',
    sizingMode: 'Sizing: in-house or outsourced',
    directOverheadMethod: 'Direct overhead',
    monthlyOverheadMethod: 'Monthly overhead',
    monthlyOverhead: 'Monthly expenses and output',
    weavingRateMode: 'Weaving rate unit',
}

const guidance: Record<string, string> = {
    partyName: 'Enter the customer or party name for this quotation or party order.',
    warpingMode: 'Is your warping done in-house or outsourced? Choose In-house if you do it at your factory and include its expenses in factory overhead. Choose Outsourced if someone else does it; then enter their warping charge in ₹/kg in the rate field that appears.',
    sizingMode: 'Is your sizing done in-house or outsourced? Choose In-house if you do it at your factory and include its expenses in factory overhead. Choose Outsourced if someone else does it; then enter their sizing charge in ₹/kg in the rate field that appears.',
    directOverheadMethod: 'Already know your factory overhead cost per metre? Choose Direct overhead rate, then enter that amount in ₹/m in the field below. Use this method when you already have a calculated overhead rate.',
    monthlyOverheadMethod: 'Want help calculating overhead? Choose Monthly expenses ÷ output, then open Edit monthly overhead details. Enter your monthly factory expenses and typical monthly production in metres; we divide the total expenses by that output to calculate overhead per metre.',
    weavingRateMode: 'Choose the unit for your weaving charge: rupees per metre or paisa per pick. Then enter the charge in the next field using that unit.',
    monthlyOverhead: 'After the tour, open these details to review each monthly expense and your typical production in metres. Total monthly expenses divided by production gives overhead per metre.',
    qualityLabel: 'Enter a recognisable name for this fabric quality, such as 60g Georgette or Japan Satin. This is how you will find it again.',
    warpComponentCount: 'Enter how many different warp yarn components this quality uses. Each component gets its own row; this is not the number of individual threads.',
    weftComponentCount: 'Enter how many different weft yarn components this quality uses. Each component gets its own row.',
    warpCrimpPct: 'Enter the extra warp length taken up as yarn bends around the weft, as a percentage. Review the default for this fabric.',
    yarnShortagePct: 'Enter the default yarn wastage percentage. It applies to yarn rows unless you enter a row-specific waste value.',
    tapeLengthM: 'Enter the yarn length on one beam in metres. This supports beam planning and party orders.',
    calculationMode: 'Formula calculates consumption from fabric construction. Manual kg lets you enter known yarn consumption per 100 metres.',
    label: 'Name this yarn component so you can distinguish it from the other yarns in the quality.',
    calcDenier: 'Enter yarn denier: the weight in grams of 9,000 metres of yarn. Use the denier specified by your yarn supplier.',
    beamEnds: 'Enter the number of warp threads on the beam for this component.',
    manualKgPer100m: 'Enter kilograms of this yarn needed to make 100 metres of fabric. This is consumption, not metres produced per kilogram.',
    shortagePct: 'Enter wastage for this component. Leave blank to use the quality default; enter 0 to explicitly apply no waste.',
    yarnRate: 'Enter the current purchase price of this yarn in rupees per kilogram, before the GST entered separately.',
    gstPct: 'Enter the yarn GST percentage used in this estimate.',
    picks: 'Enter picks per inch (PPI): the number of weft threads in one inch of fabric for this component.',
    effectiveCostingWidthCm: 'Enter the finished fabric width in the displayed unit (cm or inches). Use finished width, not reed width.',
    perPickCostPaisa: 'Enter the weaving charge in the selected unit: rupees per metre or paisa per pick. Check the unit before entering the number.',
    warpingRatePerKg: 'Enter the outsourced warping charge in rupees per kilogram of warp yarn.',
    sizingRatePerKg: 'Enter the outsourced sizing charge in rupees per kilogram of warp yarn.',
    overheadOverridePerM: 'Enter your factory overhead allocation in rupees per metre. This covers factory expenses beyond yarn and separately entered process charges.',
    profitPct: 'Enter your target margin percentage. The estimate uses this to calculate the suggested selling price.',
    commissionPct: 'Enter the broker or agent commission as a percentage of the selling price.',
    transportPerM: 'Enter the delivery cost to include for each metre of fabric, in rupees.',
    orderQuantityM: 'Optionally enter the total fabric quantity in metres to see order-level totals. Quantity is needed for quotations.',
}

type Step = { section: number; target: HTMLElement; card: HTMLElement; title: string; description: string }

export function CostEstimateTutorial({ enabled, orgId, userId, accountDismissed, onPrepare }: {
    accountDismissed: boolean; enabled: boolean; orgId: string; userId: string; onPrepare: () => void
}) {
    const [steps, setSteps] = useState<Step[]>([])
    const [index, setIndex] = useState(0)
    const [requested, setRequested] = useState(false)
    const [rects, setRects] = useState<{ field: DOMRect; card: DOMRect } | null>(null)
    const panel = useRef<HTMLDivElement>(null)
    const tutorialRows = useRef<HTMLElement[]>([])
    const key = `weavly:cost-estimate-tutorial:v1:${orgId}:${userId}`
    const active = steps[index]
    const dismissed = useRef(accountDismissed)
    const syncing = useRef(false)
    const autoStarted = useRef(false)
    const [syncFailed, setSyncFailed] = useState(false)

    const syncDismissal = useCallback(async () => {
        if (syncing.current) return
        syncing.current = true
        try {
            const result = await dismissCostEstimateTutorial()
            setSyncFailed(!result.success)
            if (result.success) {
                try { localStorage.removeItem(key) } catch { /* Optional retry cache. */ }
            }
        } catch {
            setSyncFailed(true)
        } finally {
            syncing.current = false
        }
    }, [key])

    useEffect(() => {
        if (!enabled || autoStarted.current) return
        const timer = window.setTimeout(() => {
            if (accountDismissed || dismissed.current) return
            // Migrate old browser-only completions and retry unconfirmed account saves.
            try {
                if (localStorage.getItem(key) === 'done') {
                    dismissed.current = true
                    void syncDismissal()
                    return
                }
            } catch { /* Account state still works without browser storage. */ }
            autoStarted.current = true
            setRequested(true)
        }, 0)
        return () => window.clearTimeout(timer)
    }, [enabled, key, accountDismissed, syncDismissal])

    useEffect(() => {
        const retry = () => { if (syncFailed) void syncDismissal() }
        window.addEventListener('online', retry)
        return () => window.removeEventListener('online', retry)
    }, [syncFailed, syncDismissal])

    useEffect(() => {
        return () => {
            tutorialRows.current.forEach(row => row.dispatchEvent(new CustomEvent('tutorial-expand-row', { detail: false })))
        }
    }, [])

    useEffect(() => {
        if (!requested || !enabled) return
        onPrepare()
        let observer: MutationObserver | undefined
        // Quick view can change on replay. Wait for its commit, then expand rows
        // and observe their actual DOM mount rather than guessing a render delay.
        const timer = window.setTimeout(() => {
            const root = document.querySelector('[data-costing-tutorial-root]')
            if (!root) { setRequested(false); return }
            tutorialRows.current = Array.from(root.querySelectorAll<HTMLElement>('[data-estimator-row]'))
            const collect = () => {
                if (tutorialRows.current.some(row => row.querySelector('[aria-expanded]')?.getAttribute('aria-expanded') !== 'true')) return
                const next: Step[] = []
                root.querySelectorAll<HTMLElement>('[data-tutorial-section]').forEach(header => {
                    const section = Number(header.dataset.tutorialSection) - 1
                    const card = header.closest<HTMLElement>('[data-slot="card"]')
                    if (!card || !sections[section]) return
                    card.querySelectorAll<HTMLElement>('[data-estimator-field]').forEach(target => {
                        const field = target.dataset.estimatorField!
                        if (!guidance[field] || !target.getClientRects().length) return
                        const label = fieldTitles[field] || target.querySelector('label')?.textContent || target.getAttribute('aria-label') || target.closest('div.space-y-1\\.5')?.querySelector('label')?.textContent || field
                        next.push({ section, card, target, title: label.replace(/ — REQUIRED/g, ''), description: guidance[field] })
                    })
                })
                observer?.disconnect()
                setIndex(0)
                setSteps(next)
                setRequested(false)
            }
            observer = new MutationObserver(collect)
            observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded'] })
            tutorialRows.current.forEach(row => row.dispatchEvent(new CustomEvent('tutorial-expand-row', { detail: true })))
            collect()
        }, 150)
        return () => { window.clearTimeout(timer); observer?.disconnect() }
    }, [requested, enabled, onPrepare])

    function close() {
        tutorialRows.current.forEach(row => row.dispatchEvent(new CustomEvent('tutorial-expand-row', { detail: false })))
        tutorialRows.current = []
        dismissed.current = true
        // Only a retry marker: the account flag is the source of truth.
        try { localStorage.setItem(key, 'done') } catch { /* Still allow dismissal. */ }
        void syncDismissal()
        setSteps([])
        setRects(null)
    }

    useEffect(() => {
        if (!active) return
        const previousFocus = document.activeElement as HTMLElement | null
        const siblings = Array.from(document.body.children).filter((el): el is HTMLElement => el instanceof HTMLElement && !el.contains(panel.current))
        const prior = siblings.map(el => el.inert)
        siblings.forEach(el => { el.inert = true })
        panel.current?.focus({ preventScroll: true })
        return () => {
            siblings.forEach((el, i) => { el.inert = prior[i] })
            previousFocus?.focus({ preventScroll: true })
        }
    }, [active])

    useEffect(() => {
        if (!active) return
        const update = () => setRects({ field: active.target.getBoundingClientRect(), card: active.card.getBoundingClientRect() })
        active.target.scrollIntoView({ block: 'center', behavior: 'instant' })
        const target = active.target.getBoundingClientRect()
        window.scrollBy({ top: target.top - 100, behavior: 'instant' })
        update()
        const observer = new ResizeObserver(update)
        observer.observe(active.card)
        window.addEventListener('scroll', update, true)
        window.addEventListener('resize', update)
        return () => { observer.disconnect(); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
    }, [active])

    return <>
        {syncFailed && <div role="status" className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
            <span>Tutorial dismissed. We couldn’t save this to your account yet.</span>
            <Button type="button" variant="ghost" onClick={() => void syncDismissal()}>Retry saving preference</Button>
        </div>}
        {enabled && <Button type="button" variant="ghost" onClick={() => setRequested(true)}>How to estimate · Guided tour</Button>}
        {active && createPortal(<div className="fixed inset-0 z-[100]" data-testid="cost-estimate-tutorial">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" style={rects ? { clipPath: `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${rects.card.left}px ${rects.card.top}px, ${rects.card.left}px ${rects.card.bottom}px, ${rects.card.right}px ${rects.card.bottom}px, ${rects.card.right}px ${rects.card.top}px, ${rects.card.left}px ${rects.card.top}px)` } : undefined} />
            {rects && <div className="pointer-events-none fixed rounded-lg border-2 border-orange-500 ring-4 ring-orange-400/25" style={{ left: rects.field.left - 4, top: rects.field.top - 4, width: rects.field.width + 8, height: rects.field.height + 8 }} />}
            <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="cost-tour-title" aria-describedby="cost-tour-description" tabIndex={-1}
                className="absolute bottom-4 left-4 right-4 mx-auto max-h-[45dvh] max-w-xl overflow-y-auto rounded-2xl border border-orange-200 bg-[var(--color-surface)] p-5 text-[var(--color-ink)] shadow-2xl outline-none"
                onKeyDown={event => {
                    if (event.key === 'Escape') { event.preventDefault(); close() }
                    if (event.key === 'Tab') {
                        const buttons = Array.from(panel.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
                        const first = buttons[0], last = buttons[buttons.length - 1]
                        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus() }
                        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
                    }
                }}>
                <div aria-live="polite">
                    <p className="text-xs font-semibold text-orange-600">Section {active.section + 1} of 7 · {sections[active.section]}</p>
                    <h2 id="cost-tour-title" className="mt-2 text-lg font-semibold">{active.title}</h2>
                    <p id="cost-tour-description" className="mt-2 text-sm leading-relaxed">{active.description}</p>
                </div>
                <p className="mt-3 text-xs text-[var(--color-muted)]">Take a look first. You can enter your numbers after the tour.</p>
                <progress className="mt-4 h-1 w-full accent-orange-500" max={steps.length} value={index + 1} aria-label="Tutorial progress" />
                <div className="mt-3 flex items-center justify-between gap-2">
                    <Button variant="ghost" onClick={close}>Skip tour</Button>
                    <span className="text-xs text-[var(--color-muted)]">{index + 1}/{steps.length}</span>
                    <div className="flex gap-2"><Button variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}>Back</Button><Button onClick={() => index === steps.length - 1 ? close() : setIndex(index + 1)}>{index === steps.length - 1 ? 'Finish' : 'Next'}</Button></div>
                </div>
            </div>
        </div>, document.body)}
    </>
}
