import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trailPath, type TrendPoint } from '@/lib/stock-activity'

/**
 * Presentation for the Fabric stock page: one colour per item, the composition bar, the trend line and the
 * day-by-day movement list. Domain behaviour (labels, actions, what a movement means) stays in the page.
 */

/** Chart colours for the largest items, in order; everything else shares the muted colour. */
const SWATCHES = ['var(--wv-viz-1)', 'var(--wv-viz-5)', 'var(--wv-viz-3)', 'var(--wv-viz-2)']
export const OTHER_SWATCH = 'var(--wv-viz-4)'
export const swatchFor = (rank: number) => SWATCHES[rank] ?? OTHER_SWATCH
export const COMPOSITION_SLOTS = SWATCHES.length

export function Swatch({ color, className }: { color: string; className?: string }) {
    return <span aria-hidden="true" className={cn('inline-block size-2.5 shrink-0 rounded-[3px]', className)} style={{ background: color }} />
}

/** One bar split by share, largest first; items beyond the coloured slots merge into one muted segment. */
export function CompositionBar({ segments, label }: { segments: { key: string; value: number; color: string }[]; label: string }) {
    const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0)
    if (total <= 0) return null
    const visible = segments.filter(segment => segment.value > 0)
    return (
        <div role="img" aria-label={label} className="flex h-3.5 gap-[3px] overflow-hidden rounded-[5px]">
            {visible.map(segment => (
                <div key={segment.key} className="ui-meter-fill h-full min-w-[3px]" style={{ width: `${(segment.value / total) * 100}%`, background: segment.color }} />
            ))}
        </div>
    )
}

/** A stepped balance line with a soft fill, drawn in the item's colour. */
export function StockTrend({ points, color, label, className }: { points: TrendPoint[]; color: string; label: string; className?: string }) {
    const { line, area } = trailPath(points, 300, 56)
    if (!line) return null
    return (
        <svg role="img" aria-label={label} viewBox="0 0 300 56" preserveAspectRatio="none" className={cn('block h-14 w-full max-w-[220px]', className)} style={{ color }}>
            <path d={area} fill="currentColor" fillOpacity={0.1} />
            <path d={line} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
    )
}

/**
 * The Recent movements panel, folded until its header is pressed. Open, the list scrolls inside the panel and the
 * scroll stops at its ends, so a long week never stretches or scrolls the page.
 */
export function RecentMovementsSection({ id, title, help, open, onToggle, action, children }: {
    id: string; title: ReactNode; help?: ReactNode; open: boolean; onToggle: () => void; action: ReactNode; children: ReactNode
}) {
    const body = `${id}-list`
    return (
        <section aria-labelledby={id} className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
            {/* The toggle's hit area stretches over the whole header; the header's own action sits above it. */}
            <div className="relative flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                    <h2 id={id} className="text-base font-semibold text-ink">
                        <button
                            type="button"
                            aria-expanded={open}
                            aria-controls={body}
                            aria-describedby={help ? `${id}-help` : undefined}
                            onClick={onToggle}
                            className="group flex cursor-pointer items-center gap-2 text-left outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-inset focus-visible:after:ring-ring/25"
                        >
                            {title}
                            <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:text-ink motion-reduce:transition-none', open && 'rotate-180')} />
                        </button>
                    </h2>
                    {help && <p id={`${id}-help`} className="mt-0.5 text-sm text-muted-foreground">{help}</p>}
                </div>
                <div className="relative">{action}</div>
            </div>
            {open && (
                <div id={body} role="region" aria-labelledby={id} tabIndex={0} className="max-h-[min(32rem,60vh)] overflow-y-auto overscroll-contain outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/25">
                    {children}
                </div>
            )}
        </section>
    )
}

/** A movement list grouped by day: the day and its net change on the left, its movements on the right. */
export function DayGroupList<T>({ days, renderRow }: { days: { key: string; label: ReactNode; net: ReactNode; rows: T[] }[]; renderRow: (row: T) => ReactNode }) {
    return (
        <div>
            {days.map(day => (
                <div key={day.key} className="grid gap-2 border-t border-hairline px-5 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6 sm:px-6">
                    <div>
                        <p className="text-sm font-semibold text-ink">{day.label}</p>
                        <p className="mt-0.5 text-[13px] tabular-nums text-muted-foreground">{day.net}</p>
                    </div>
                    <ul className="min-w-0 space-y-1">{day.rows.map(renderRow)}</ul>
                </div>
            ))}
        </div>
    )
}

/** A signed quantity: additions in the success colour, reductions in ink, with a true minus sign. */
export function SignedQuantity({ value, unit, format, className }: { value: number; unit: string; format: (value: number) => string; className?: string }) {
    const sign = value > 0 ? '+' : value < 0 ? '−' : ''
    return (
        <span className={cn('font-semibold tabular-nums', value > 0 ? 'text-success' : 'text-ink', className)}>
            {sign}{format(Math.abs(value))} {unit}
        </span>
    )
}

/** "Fri 9 Oct" in the reader's language, read as an India calendar date. */
export function formatIndiaDay(date: string, language: string) {
    return new Date(`${date}T12:00:00+05:30`).toLocaleDateString(`${language}-IN`, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
}
