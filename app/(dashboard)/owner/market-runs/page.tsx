import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import MarketRunsClient from './MarketRunsClient'
import { getMarketRuns } from '../estimator/actions'

export const metadata = {
    title: 'Market Runs — Weavly',
    description: 'Manage speculative production runs and track sales to traders',
}

export default async function MarketRunsPage() {
    const { data: runs, error } = await getMarketRuns()

    return (
        <Suspense fallback={
            <div className="flex items-center justify-center p-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
            </div>
        }>
            <MarketRunsClient initialRuns={runs ?? []} fetchError={error} />
        </Suspense>
    )
}
