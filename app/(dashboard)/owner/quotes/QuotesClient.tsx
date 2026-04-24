'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { updateQuoteStatus } from '../estimator/actions'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
    History,
    CheckCircle2,
    XCircle,
    Send,
    FileText,
    ArrowRight,
    Loader2
} from 'lucide-react'

const STATUS_CONFIG = {
    draft:    { label: 'Draft',    color: 'bg-slate-100 text-slate-700 border-slate-200' },
    sent:     { label: 'Sent',     color: 'bg-blue-50 text-blue-700 border-blue-200' },
    accepted: { label: 'Accepted', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200' },
}

export default function QuotesClient({ initialQuotes, initialStatus, orgId, userId }: { initialQuotes: any[], initialStatus?: string, orgId: string, userId: string }) {
    const { t } = useTranslation()
    const router = useRouter()
    const [quotes, setQuotes] = useState(initialQuotes)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<string>(initialStatus || 'all')

    const filteredQuotes = filterStatus === 'all' 
        ? quotes 
        : quotes.filter(q => q.status === filterStatus)

    const handleStatusChange = async (id: string, newStatus: 'draft' | 'sent' | 'accepted' | 'rejected') => {
        setUpdatingId(id)
        const res = await updateQuoteStatus(id, newStatus)
        setUpdatingId(null)
        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success(`Quote marked as ${newStatus}`)
            setQuotes(prev => prev.map(q => q.id === id ? { ...q, status: newStatus } : q))
        }
    }

    const handleReEstimate = (quote: any) => {
        if (!quote.snapshot_data) {
            toast.error('No snapshot data found for this quote.')
            return
        }
        
        try {
            const draftKey = `weavly-estimator-draft-${orgId}-${userId}`
            const newDraft = {
                state: quote.snapshot_data,
                partyName: quote.party_name || '',
                qualityLabel: quote.quality_label || '',
                warpInstruction: quote.orders?.warp_instruction || '',
                weftInstruction: quote.orders?.weft_instruction || '',
                savedAt: Date.now()
            }
            localStorage.setItem(draftKey, JSON.stringify(newDraft))
            toast.success('Quote snapshot restored')
            router.push('/owner/estimator')
        } catch (e) {
            toast.error('Failed to restore snapshot')
            console.error(e)
        }
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <History className="h-6 w-6 text-indigo-500" />
                        Quote History
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">Track and manage sent estimates</p>
                </div>
                <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-lg shadow-sm w-full sm:w-auto overflow-x-auto">
                    {['all', 'draft', 'sent', 'accepted', 'rejected'].map(s => (
                        <button
                            key={s}
                            onClick={() => {
                                setFilterStatus(s)
                                router.replace(`/owner/quotes${s !== 'all' ? `?status=${s}` : ''}`)
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md capitalize whitespace-nowrap transition-all ${
                                filterStatus === s
                                    ? 'bg-slate-900 text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {filteredQuotes.length === 0 ? (
                <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
                    <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="p-3 bg-white rounded-full shadow-sm shadow-slate-200/50">
                            <FileText className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-bold text-slate-600">No quotes found</p>
                        <p className="text-xs text-slate-500 max-w-xs">{
                            filterStatus === 'all' 
                                ? "You haven't saved any quotes from the estimator yet." 
                                : `No quotes with status "${filterStatus}".`
                        }</p>
                        {filterStatus !== 'all' && (
                            <Button variant="link" size="sm" onClick={() => setFilterStatus('all')} className="mt-2 text-indigo-600 font-bold">
                                Clear filters
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredQuotes.map(quote => (
                        <Card key={quote.id} className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative group">
                            <CardContent className="p-5 flex flex-col h-full">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="space-y-1 w-full min-w-0 pr-2">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none truncate">
                                            {quote.party_name}
                                        </p>
                                        <h3 className="font-bold text-slate-900 truncate">
                                            {quote.quality_label}
                                        </h3>
                                    </div>
                                    <Badge variant="outline" className={`${STATUS_CONFIG[quote.status as keyof typeof STATUS_CONFIG]?.color} capitalize font-bold`}>
                                        {quote.status}
                                    </Badge>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quote</p>
                                        <p className="text-base font-black font-mono text-indigo-600">₹{Number(quote.quote_price_per_meter).toFixed(2)}/m</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Margin</p>
                                        <p className="text-base font-black font-mono text-emerald-600">
                                            {Number(quote.intended_margin_percent).toFixed(1)}%
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cost</p>
                                        <p className="text-xs font-bold font-mono text-slate-600">₹{Number(quote.landed_cost_per_meter).toFixed(2)}/m</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Date</p>
                                        <p className="text-xs font-bold text-slate-600">{format(new Date(quote.created_at), 'MMM d, yyyy')}</p>
                                    </div>
                                </div>

                                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                        {updatingId === quote.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                        ) : (
                                            <>
                                                {quote.status === 'draft' && (
                                                    <button onClick={() => handleStatusChange(quote.id, 'sent')} className="p-1.5 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Mark as Sent">
                                                        <Send className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {quote.status === 'sent' && (
                                                    <>
                                                        <button onClick={() => handleStatusChange(quote.id, 'accepted')} className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors" title="Mark as Accepted">
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => handleStatusChange(quote.id, 'rejected')} className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Mark as Rejected">
                                                            <XCircle className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    {quote.orders && (
                                        <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
                                            Order #{quote.orders.order_number || quote.orders.id.split('-')[0]}
                                            {quote.orders.status === 'completed' && <CheckCircle2 className="h-3 w-3 ml-1" />}
                                        </Badge>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2 ml-auto"
                                        onClick={() => handleReEstimate(quote)}
                                    >
                                        Re-estimate
                                        <ArrowRight className="h-3 w-3 ml-1" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
