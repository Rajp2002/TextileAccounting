import RatesClient from './RatesClient'
import { getCostRates } from './actions'
import type { CostRateRow } from '@/lib/cost-rates'

export default async function RatesPage() {
    const result = await getCostRates()
    return <RatesClient initialRates={(result.data ?? []) as CostRateRow[]} />
}
