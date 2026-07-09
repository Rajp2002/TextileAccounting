import CommercialsClient from './CommercialsClient'
import { getCommercialsData, getCommercialReceivables, getCollectedThisMonth, getCommercialPartyInsights } from './actions'
import { createPerfTimer } from '@/lib/perf'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Commercials | Owner Dashboard',
    description: 'Gross profit, receivables, and payment tracking.',
}

export default async function CommercialsPage() {
    const perf = createPerfTimer('/owner/commercials')
    const [commercialsRes, receivablesRes, collectedRes, partyInsightsRes] = await perf.measure(
        'businessData',
        () => Promise.all([
            getCommercialsData(),
            getCommercialReceivables(),
            getCollectedThisMonth(),
            getCommercialPartyInsights(),
        ]),
        7
    )
    perf.log({ note: 'business call count includes conditional receivables enrichment query' })

    if ('error' in commercialsRes) {
        return (
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-rose-600">Unable to load commercials</h1>
                <p className="text-sm text-muted-foreground">{commercialsRes.error}</p>
            </div>
        )
    }

    const receivables = 'error' in receivablesRes ? [] : (receivablesRes.data ?? [])
    const collectedThisMonth = 'error' in collectedRes ? 0 : (collectedRes.data ?? 0)
    const partyInsights = 'error' in partyInsightsRes
        ? { leaderboards: { '7d': [], '30d': [], year: [], all: [] }, parties: [] }
        : partyInsightsRes.data

    return <CommercialsClient initialData={commercialsRes.data} initialReceivables={receivables} collectedThisMonth={collectedThisMonth} partyInsights={partyInsights} />
}
