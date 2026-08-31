import type { calculateRateImpact } from '@/lib/estimator-rate-impact'

export function RateImpactSummary({ impact, hasSavedAssumptions, tx }: {
  impact: ReturnType<typeof calculateRateImpact>
  hasSavedAssumptions: boolean
  tx: (text: string) => string
}) {
  return <section aria-label={tx('Rate change impact')} className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-4 space-y-3">
    <h3 className="text-sm font-semibold">{tx('Rate change impact')}</h3>
    <p className="text-xs text-[var(--color-muted)]">{tx(hasSavedAssumptions
      ? 'Uses this quality’s saved costing assumptions. Only yarn rates change in this comparison.'
      : 'Uses this recipe with your working costing assumptions. Only yarn rates change in this comparison.')}</p>
    {impact.comparison ? <dl className="space-y-2 text-xs tabular-nums">
      {([
        ['Production cost /m', impact.comparison.production],
        ['Suggested selling price /m', impact.comparison.selling],
      ] as const).map(([label, amounts]) => {
        const delta = Math.round((amounts.after - amounts.before) * 100) / 100
        return <div key={label} className="flex flex-wrap justify-between gap-1">
          <dt>{tx(label)}</dt>
          <dd className="font-medium">₹{amounts.before.toFixed(2)} → ₹{amounts.after.toFixed(2)} <span className="text-[var(--color-muted)]">({delta > 0 ? '+' : ''}₹{delta.toFixed(2)})</span></dd>
        </div>
      })}
    </dl> : <p className="text-xs">{tx('Complete the recipe and costing assumptions to see the price impact.')}</p>}
    <p className="text-xs text-[var(--color-muted)]">{tx(impact.changedCount === 0
      ? 'No yarn rate changes.'
      : 'Saving updates this recipe’s rates for future use. Saved costing versions stay unchanged.')}</p>
  </section>
}
