import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { notFound } from 'next/navigation'
import MarketRunDetailClient from './MarketRunDetailClient'
import { getMarketRunDetail } from '../../estimator/actions'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export const metadata = {
    title: 'Market Run Detail — Weavly',
    description: 'Track speculative production and per-trader sales P&L',
}

export default async function MarketRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { profile } = await requireRole(['owner'])
    const supabase = await createClient()

    const { id } = await params
    const { data, error } = await getMarketRunDetail(id)

    if (error || !data) {
        notFound()
    }

    // Fetch active parties for the sale dialog
    const { data: parties } = await supabase
        .from('parties')
        .select('id, name')
        .eq('org_id', profile.org_id)
        .eq('is_active', true)
        .order('name')

    return (
        <Suspense fallback={
            <div className="flex items-center justify-center p-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
            </div>
        }>
            <MarketRunDetailClient 
                run={data.run} 
                initialSales={data.sales} 
                parties={parties ?? []}
            />
        </Suspense>
    )
}

