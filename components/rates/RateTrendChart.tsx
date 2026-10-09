'use client'

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { CostRateUnit } from '@/app/(dashboard)/owner/rates/actions'
import { formatRateValue, getRatePriceDelta } from '@/lib/cost-rates'
import { useTranslation } from '@/lib/i18n/context'
import {
    buildStepPath,
    buildTimeTicks,
    buildYAxis,
    timeFraction,
    type RateTrend,
    type RateTrendPoint,
} from '@/lib/rate-trend'
import { cn } from '@/lib/utils'

const HEIGHT = 264
const MARGIN = { top: 16, right: 16, bottom: 34, left: 52 }
/** Keeps the first and last markers clear of the plot edge. */
const PAD_X = 10
const DRAW_MS = 1700
const LOCALES = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' } as const

/** True on the server too, so server markup is always the finished chart. */
function prefersReducedMotion() {
    return typeof window === 'undefined' || Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/**
 * The price history of one yarn as a step chart: the rate holds until it
 * changes. The time axis is fitted to the history (first entry to today), so
 * three months and a year both fill the plot. Opening it draws the line on
 * from the first entry, following it up and down, then leaves it static.
 */
export function RateTrendChart({ trend, unit, yarnName }: { trend: RateTrend; unit: CostRateUnit; yarnName: string }) {
    const { tx, language } = useTranslation()
    const locale = LOCALES[language]
    const wrapRef = useRef<HTMLDivElement>(null)
    const pathRef = useRef<SVGPathElement>(null)
    const headRef = useRef<SVGCircleElement>(null)
    const clipRef = useRef<SVGRectElement>(null)
    const pointRefs = useRef<Array<SVGCircleElement | null>>([])
    const clipId = `rate-trend-clip-${useId().replace(/:/g, '')}`

    const [width, setWidth] = useState<number | null>(null)
    const [animating, setAnimating] = useState(() => !prefersReducedMotion() && trend.spanDays > 0)
    const [revealed, setRevealed] = useState(1)
    const [activeId, setActiveId] = useState<string | null>(null)
    const [focusIndex, setFocusIndex] = useState(0)

    useLayoutEffect(() => {
        const element = wrapRef.current
        if (!element) return
        const measure = () => setWidth(Math.max(240, Math.floor(element.clientWidth)))
        measure()
        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [])

    const w = width ?? 560
    const plotLeft = MARGIN.left
    const plotRight = w - MARGIN.right
    const plotTop = MARGIN.top
    const plotBottom = HEIGHT - MARGIN.bottom

    const geometry = useMemo(() => {
        const xMin = plotLeft + PAD_X
        const xMax = plotRight - PAD_X
        const axis = buildYAxis(trend.points.map(point => point.value))
        const xOf = (time: number) => xMin + timeFraction(trend, time) * (xMax - xMin)
        const yOf = (value: number) => plotBottom - ((value - axis.min) / (axis.max - axis.min)) * (plotBottom - plotTop)
        const coords = trend.points.map(point => ({ x: xOf(point.time), y: yOf(point.value) }))
        // A history that starts today has nothing to run along: show the point, not a line to the edge.
        const xEnd = trend.spanDays === 0 ? coords[coords.length - 1].x : xMax
        const step = buildStepPath(coords, xEnd)
        return {
            axis,
            coords,
            step,
            areaD: `${step.d} V${plotBottom} H${coords[0].x} Z`,
            xMax: xEnd,
            xTicks: buildTimeTicks(trend.startTime, trend.endTime).map(tick => ({ ...tick, x: xOf(tick.time) })),
            yTicks: axis.ticks.map(value => ({ value, y: yOf(value) })),
            endY: coords[coords.length - 1].y,
        }
    }, [trend, plotLeft, plotRight, plotTop, plotBottom])
    const { axis, coords, step, xMax } = geometry

    const ready = width !== null
    useEffect(() => {
        if (!animating || !ready) return
        const path = pathRef.current
        const head = headRef.current
        const clip = clipRef.current
        if (!path || !head || !clip) return

        const total = step.length
        let shown = 1
        let frame = 0
        const startedAt = performance.now()
        const tick = (now: number) => {
            const progress = Math.min(1, (now - startedAt) / DRAW_MS)
            const distance = easeInOutCubic(progress) * total
            path.style.strokeDashoffset = String(total - distance)
            const tip = path.getPointAtLength(distance)
            head.setAttribute('cx', String(tip.x))
            head.setAttribute('cy', String(tip.y))
            clip.setAttribute('width', String(Math.max(0, tip.x - plotLeft)))
            let next = shown
            while (next < step.stops.length && distance >= step.stops[next]) next += 1
            if (next !== shown) {
                shown = next
                setRevealed(next)
            }
            if (progress < 1) {
                frame = requestAnimationFrame(tick)
                return
            }
            path.style.strokeDasharray = 'none'
            path.style.strokeDashoffset = '0'
            setAnimating(false)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [animating, ready, step, plotLeft])

    const formatters = useMemo(() => {
        const base = { timeZone: 'UTC' } as const
        return {
            day: new Intl.DateTimeFormat(locale, { ...base, day: 'numeric', month: 'short' }),
            month: new Intl.DateTimeFormat(locale, { ...base, month: 'short', year: 'numeric' }),
            full: new Intl.DateTimeFormat(locale, { ...base, day: 'numeric', month: 'short', year: 'numeric' }),
        }
    }, [locale])

    const tickStep = axis.ticks.length > 1 ? axis.ticks[1] - axis.ticks[0] : 1
    const formatAxisValue = (value: number) => {
        const digits = tickStep >= 1 ? 0 : 2
        const text = value.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
        return unit === 'percent' ? `${text}%` : `₹${text}`
    }

    const kindLabel = (point: RateTrendPoint, index: number) =>
        point.kind === 'opening' ? tx('Rate before first change')
            : index === 0 ? tx('First entry')
                : point.kind === 'reviewed' ? tx('Reviewed, price unchanged') : tx('Price changed')
    const hasReviews = trend.points.some(point => point.kind === 'reviewed')

    const moveFocus = (event: KeyboardEvent, index: number) => {
        const last = trend.points.length - 1
        const next = event.key === 'ArrowRight' ? Math.min(index + 1, last)
            : event.key === 'ArrowLeft' ? Math.max(index - 1, 0)
                : event.key === 'Home' ? 0
                    : event.key === 'End' ? last
                        : null
        if (next === null) return
        event.preventDefault()
        setFocusIndex(next)
        pointRefs.current[next]?.focus()
    }

    const activeIndex = trend.points.findIndex(point => point.id === activeId)
    const active = activeIndex >= 0 ? trend.points[activeIndex] : null
    const activeDelta = active && activeIndex > 0 && active.kind === 'changed'
        ? getRatePriceDelta(active.value, trend.points[activeIndex - 1].value, unit)
        : null
    const activeCoord = activeIndex >= 0 ? coords[activeIndex] : null

    return (
        <div>
            <div ref={wrapRef} className="relative" data-slot="rate-trend-chart">
                <svg
                    width={w}
                    height={HEIGHT}
                    viewBox={`0 0 ${w} ${HEIGHT}`}
                    role="group"
                    aria-label={`${tx('Price history chart')}: ${yarnName}`}
                    className={cn('block max-w-full select-none', !ready && 'invisible')}
                >
                    <defs>
                        <clipPath id={clipId}>
                            <rect ref={clipRef} x={plotLeft} y={0} width={animating ? 0 : plotRight - plotLeft} height={HEIGHT} />
                        </clipPath>
                    </defs>

                    {geometry.yTicks.map(tick => (
                        <g key={tick.value}>
                            <line x1={plotLeft} x2={plotRight} y1={tick.y} y2={tick.y} className="stroke-hairline" strokeWidth={1} />
                            <text x={plotLeft - 8} y={tick.y} textAnchor="end" dominantBaseline="middle" className="fill-subtle font-mono text-[11px] tabular-nums">
                                {formatAxisValue(tick.value)}
                            </text>
                        </g>
                    ))}
                    {geometry.xTicks.map(tick => (
                        <g key={tick.time}>
                            <line x1={tick.x} x2={tick.x} y1={plotBottom} y2={plotBottom + 4} className="stroke-hairline-strong" strokeWidth={1} />
                            <text x={tick.x} y={plotBottom + 18} textAnchor="middle" className="fill-subtle text-[11px]">
                                {(tick.granularity === 'month' ? formatters.month : formatters.day).format(tick.time)}
                            </text>
                        </g>
                    ))}

                    <path d={geometry.areaD} className="fill-ink/5" clipPath={animating ? `url(#${clipId})` : undefined} />
                    <path
                        ref={pathRef}
                        d={step.d}
                        fill="none"
                        className="stroke-ink"
                        strokeWidth={2.25}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        style={animating ? { strokeDasharray: step.length, strokeDashoffset: step.length } : undefined}
                    />

                    {trend.points.map((point, index) => {
                        const { x, y } = coords[index]
                        const shown = !animating || index < revealed
                        const review = point.kind === 'reviewed'
                        return (
                            <g key={point.id} className={cn('transition-opacity duration-200 motion-reduce:transition-none', shown ? 'opacity-100' : 'pointer-events-none opacity-0')}>
                                {active?.id === point.id && <circle cx={x} cy={y} r={10} className="fill-none stroke-ink/25" strokeWidth={2} />}
                                <circle
                                    cx={x}
                                    cy={y}
                                    r={review ? 4 : 5.5}
                                    strokeWidth={2}
                                    className={review ? 'fill-surface stroke-ink' : 'fill-ink stroke-surface'}
                                />
                                <circle
                                    ref={element => { pointRefs.current[index] = element }}
                                    cx={x}
                                    cy={y}
                                    r={16}
                                    role="button"
                                    tabIndex={shown && index === focusIndex ? 0 : -1}
                                    aria-label={`${formatters.full.format(point.time)}, ${formatRateValue(point.value, unit)}, ${kindLabel(point, index)}`}
                                    className="cursor-pointer fill-transparent outline-none focus-visible:stroke-saffron focus-visible:stroke-2"
                                    onMouseEnter={() => setActiveId(point.id)}
                                    onMouseLeave={() => setActiveId(null)}
                                    onFocus={() => { setFocusIndex(index); setActiveId(point.id) }}
                                    onBlur={() => setActiveId(null)}
                                    onClick={() => setActiveId(current => (current === point.id ? null : point.id))}
                                    onKeyDown={event => moveFocus(event, index)}
                                />
                            </g>
                        )
                    })}

                    <circle
                        ref={headRef}
                        cx={animating ? coords[0].x : xMax}
                        cy={animating ? coords[0].y : geometry.endY}
                        r={5}
                        strokeWidth={2}
                        className="pointer-events-none fill-saffron stroke-surface"
                    />
                </svg>

                {active && activeCoord && (
                    <div
                        role="status"
                        className="pointer-events-none absolute z-10 w-56 rounded-xl border border-hairline bg-surface p-3 text-xs shadow-[var(--shadow-panel)]"
                        style={{
                            left: Math.min(Math.max(activeCoord.x, 116), w - 116),
                            top: activeCoord.y,
                            transform: activeCoord.y > 130 ? 'translate(-50%, calc(-100% - 14px))' : 'translate(-50%, 14px)',
                        }}
                    >
                        <p className="font-mono text-sm font-bold text-ink">{formatRateValue(active.value, unit)}</p>
                        <p className="mt-0.5 text-subtle">{formatters.full.format(active.time)}</p>
                        <p className="mt-1.5 font-semibold text-body">{kindLabel(active, activeIndex)}</p>
                        {activeDelta && (activeDelta.direction === 'increased' || activeDelta.direction === 'decreased') && (
                            <p className="mt-0.5 font-mono text-[11px] text-body">
                                {activeDelta.formattedDifference}{activeDelta.formattedPercent && ` (${activeDelta.formattedPercent})`}
                            </p>
                        )}
                        {active.source && <p className="mt-1 break-words text-subtle">{active.source}</p>}
                    </div>
                )}
            </div>

            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-subtle">
                <li className="flex items-center gap-1.5">
                    <svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" className="fill-ink" /></svg>
                    {tx('Price changed')}
                </li>
                {hasReviews && (
                    <li className="flex items-center gap-1.5">
                        <svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="3.25" strokeWidth={1.5} className="fill-surface stroke-ink" /></svg>
                        {tx('Reviewed, price unchanged')}
                    </li>
                )}
                <li className="flex items-center gap-1.5">
                    <svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" className="fill-saffron" /></svg>
                    {tx('Current')}
                </li>
            </ul>
        </div>
    )
}
