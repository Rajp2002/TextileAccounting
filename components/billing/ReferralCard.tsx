'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Gift, CheckCircle2, Calendar, Share2, Building2, Clock } from 'lucide-react'

export function ReferralCard({ stats }: { stats: any }) {
    const [copied, setCopied] = useState(false)

    if (!stats || !stats.code) {
        return null // Will implement a "generate code" CTA if needed, but the server action ensures one exists now
    }

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(stats.code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy text:', err)
        }
    }

    const shareWhatsApp = () => {
        const text = `Join Loomi using my referral code %2a${stats.code}%2a to manage your textile factory!`
        window.open(`https://wa.me/?text=${text}`, '_blank')
    }

    return (
        <Card className="shadow-sm border-emerald-200 overflow-hidden bg-white mt-8">
            <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <CardHeader className="bg-emerald-50/50 pb-4 border-b border-emerald-100">
                <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
                    <div className="flex items-center gap-2">
                        <Gift className="h-5 w-5 text-emerald-600" />
                        <div>
                            <CardTitle className="text-emerald-900">Refer & Earn</CardTitle>
                            <p className="text-xs text-emerald-700 mt-1">
                                Get 10% off your monthly bill for 3 months per paid referral. No cap!
                            </p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                
                {/* Link Section */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Your Referral Code</label>
                    <div className="flex gap-2">
                        <Input 
                            readOnly 
                            value={stats.code} 
                            className="bg-gray-50 text-gray-600 font-mono text-sm border-gray-200 cursor-copy focus-visible:ring-emerald-500 uppercase font-bold text-center pl-2"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <Button 
                            variant="secondary" 
                            className="shrink-0 bg-white border border-gray-200 hover:bg-gray-50"
                            onClick={copyToClipboard}
                        >
                            {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-gray-600" />}
                        </Button>
                        <Button 
                            variant="default"
                            className="shrink-0 bg-[#25D366] hover:bg-[#20bd5a] text-white"
                            onClick={shareWhatsApp}
                        >
                            <Share2 className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Share</span>
                        </Button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
                        <p className="text-xs text-gray-500 font-medium">Referred</p>
                        <p className="text-xl font-bold text-gray-900">{stats.total}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-center">
                        <p className="text-xs text-emerald-600 font-medium">Converted</p>
                        <p className="text-xl font-bold text-emerald-900">{stats.converted}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-100 bg-emerald-500 text-white p-3 text-center shadow-inner">
                        <p className="text-xs font-medium text-emerald-100">Current Discount</p>
                        <p className="text-xl font-bold">{stats.currentDiscountPct}%</p>
                    </div>
                </div>

                {/* Discount Progress Bar */}
                <div className="pt-2">
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Journey to 100% Free</p>
                            <p className="text-xs text-gray-500">Every successful referral adds 10%</p>
                        </div>
                        <div className="font-bold text-emerald-600 text-lg">
                            {stats.currentDiscountPct}%<span className="text-sm font-medium text-emerald-400">/100%</span>
                        </div>
                    </div>
                    <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                        <div 
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000 ease-out relative"
                            style={{ width: `${Math.min(100, stats.currentDiscountPct)}%` }}
                        >
                            {/* Animated sheen effect */}
                            <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                </div>

                {/* Active & Upcoming Windows List */}
                {stats.activeWindows && stats.activeWindows.length > 0 && (
                    <div className="pt-4 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                            Active & Upcoming Discounts ({stats.activeWindows.length})
                        </p>
                        <div className="space-y-2">
                            {stats.activeWindows.map((w: any, i: number) => {
                                const isFuture = new Date(w.valid_from) > new Date()
                                const startDate = new Date(w.valid_from).toLocaleDateString('en-IN', {
                                    month: 'short',
                                    day: 'numeric'
                                })
                                const expiryDate = new Date(w.valid_until).toLocaleDateString('en-IN', {
                                    month: 'short',
                                    year: 'numeric'
                                })
                                return (
                                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2 border border-gray-100 text-sm">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className={`h-4 w-4 ${isFuture ? 'text-amber-500' : 'text-emerald-500'}`} />
                                            <span className="text-gray-700 font-medium">
                                                10% Discount {isFuture && <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full ml-1">Starts {startDate}</span>}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                            <Calendar className="h-3.5 w-3.5" />
                                            Valid till {expiryDate}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Referral History List */}
                {stats.history && stats.history.length > 0 && (
                    <div className="pt-4 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                            Referral History ({stats.history.length})
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {stats.history.map((h: any, i: number) => {
                                const dateStr = new Date(h.date).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                })
                                const isConverted = h.status === 'converted'
                                return (
                                    <div key={i} className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-gray-100 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-gray-400" />
                                            <span className="text-gray-700 font-medium truncate max-w-[120px] sm:max-w-[180px]" title={h.factoryName}>
                                                {h.factoryName}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${isConverted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {h.status}
                                            </span>
                                            <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                                <Clock className="h-3 w-3" />
                                                {dateStr}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

            </CardContent>
        </Card>
    )
}
