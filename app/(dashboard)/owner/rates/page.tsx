import RatesClient from './RatesClient'
import { getCostRates } from './actions'
import type { CostRateRow } from '@/lib/cost-rates'
import type { YarnRateConflict } from '@/lib/yarn-rate-reconciliation'

export default async function RatesPage() {
    const result = await getCostRates({ includeArchived: true })
    return (
        <RatesClient
            initialRates={(result.data ?? []) as CostRateRow[]}
            initialConflicts={(result.conflicts ?? []) as YarnRateConflict[]}
            defaultReviewIntervalDays={result.yarnReviewIntervalDays ?? 90}
        />
    )
}
