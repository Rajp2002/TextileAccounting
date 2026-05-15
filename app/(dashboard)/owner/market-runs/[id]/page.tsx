import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { notFound } from 'next/navigation'
import MarketRunDetailClient from './MarketRunDetailClient'
import { getMarketRunDetail } from '../../estimator/actions'

export const metadata = {
    title: 'Market Run Detail — Weavly',
    description: 'Track speculative production, stock position, and run P&L',
}

export default async function MarketRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const { data, error } = await getMarketRunDetail(id)

    if (error || !data) {
        notFound()
    }

    return (
        <Suspense fallback={
            <div className="flex items-center justify-center p-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
            </div>
        }>
            <MarketRunDetailClient 
                run={data.run} 
                quote={data.quote}
                initialSales={data.sales} 
            />
        </Suspense>
    )
}
