'use client'

import type { FabricWeight } from '@/lib/fabric-weight'
import { useTranslation } from '@/lib/i18n/context'

const formatWeight = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 1 })

/** Grey fabric weight next to the live cost: how the cloth is specified and traded. */
export function FabricWeightSummary({ weight }: { weight: FabricWeight }) {
    const { tx } = useTranslation()
    return (
        <div
            data-testid="fabric-weight-summary"
            className="mb-2.5 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border border-[var(--color-hairline)] px-3 py-2.5 sm:px-4"
        >
            <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--color-ink)]">{tx('Fabric weight')}</p>
                <p className="mt-0.5 text-xs leading-4 text-[var(--color-muted)]">{tx('Grey cloth from the yarn above, before waste')}</p>
            </div>
            <p className="text-right font-mono text-sm font-semibold tabular-nums text-[var(--color-ink)]">
                {weight.gsm != null && <span className="block">{formatWeight(weight.gsm)} GSM</span>}
                <span className={weight.gsm != null ? 'block text-xs font-medium text-[var(--color-muted)]' : 'block'}>{formatWeight(weight.gramsPerMetre)} g/m</span>
            </p>
        </div>
    )
}
