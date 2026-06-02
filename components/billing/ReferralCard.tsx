'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Gift, CheckCircle2, Share2 } from 'lucide-react'
import { formatToSurat, getCurrentTimestampMs } from '@/lib/time'

type ReferralWindow = {
    valid_from: string
    valid_until: string
}

type ReferralStats = {
    code?: string | null
    total?: number
    converted?: number
    currentDiscountPct?: number
    activeWindows?: ReferralWindow[]
}

export function ReferralCard({ stats }: { stats: ReferralStats | null }) {
    const [copied, setCopied] = useState(false)

    if (!stats || !stats.code) {
        return null
    }
    const referralCode = stats.code

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(referralCode)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy text:', err)
        }
    }

    const shareWhatsApp = () => {
        const text = `Join Weavly using my referral code %2a${referralCode}%2a to manage your textile factory!`
        window.open(`https://wa.me/?text=${text}`, '_blank')
    }

    return (
        <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-emerald-100 overflow-hidden bg-white">
            <CardHeader className="bg-gradient-to-br from-emerald-50/80 to-transparent pb-4 border-b border-emerald-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <Gift className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <CardTitle className="text-emerald-900 text-lg">Refer & Earn</CardTitle>
                        <p className="text-xs text-emerald-700/70 mt-0.5">
                            Get 10% off your monthly bill per paid referral.
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-5 space-y-6 text-emerald-950">
                
                {/* Stats Grid - more compact and informative */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-emerald-100/50 bg-emerald-50/30 p-3.5 flex flex-col justify-center">
                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Total Referrals</p>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-emerald-900 leading-none">{stats.total || 0}</span>
                            <span className="text-xs text-emerald-600/70 font-medium">{stats.converted || 0} converted</span>
                        </div>
                    </div>
                    <div className="rounded-2xl bg-emerald-600 p-3.5 flex flex-col justify-center shadow-lg shadow-emerald-200">
                        <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider mb-1">Current Reward</p>
                        <div className="flex items-baseline gap-0.5">
                            <span className="text-2xl font-black text-white leading-none">{stats.currentDiscountPct || 0}%</span>
                            <span className="text-xs text-emerald-100 font-medium">OFF</span>
                        </div>
                    </div>
                </div>

                {/* Journey to 100% Free - Simplified progress */}
                <div className="relative pt-1">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-emerald-900/80 uppercase tracking-tighter">Journey to 100% Free</span>
                        <div className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {stats.currentDiscountPct || 0}% / 100%
                        </div>
                    </div>
                    <div className="h-3 w-full bg-emerald-50 rounded-full p-0.5 overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000 ease-out relative shadow-sm"
                            style={{ width: `${Math.min(100, stats.currentDiscountPct || 0)}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Code & Share - Compact grouping */}
                <div className="space-y-4 pt-2">
                    <div className="relative group">
                        <label className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-black text-emerald-600 uppercase tracking-widest z-10">
                            Your Unique Code
                        </label>
                        <div className="flex items-center gap-2 p-1.5 rounded-2xl border border-emerald-100 bg-emerald-50/20 group-focus-within:border-emerald-400 transition-all shadow-sm">
                            <input 
                                readOnly 
                                value={referralCode}
                                className="flex-1 min-w-0 bg-transparent text-emerald-900 font-black text-sm tracking-[0.25em] outline-none pl-3 uppercase h-10"
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <div className="flex items-center gap-1.5 shrink-0 px-1">
                                <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-10 w-10 rounded-xl hover:bg-emerald-100/50 text-emerald-600 transition-colors"
                                    onClick={copyToClipboard}
                                    title="Copy Code"
                                >
                                    {copied ? <CheckCircle2 className="h-4.5 w-4.5" /> : <Copy className="h-4.5 w-4.5 opacity-60" />}
                                </Button>
                                <Button 
                                    onClick={shareWhatsApp}
                                    className="h-10 px-5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-md shadow-emerald-500/10 shrink-0 font-black text-[11px] uppercase tracking-wider flex items-center gap-2"
                                >
                                    <Share2 className="h-4 w-4" />
                                    Share
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Active & Upcoming Windows - more compact */}
                {stats.activeWindows && stats.activeWindows.length > 0 && (
                    <div className="pt-2 border-t border-emerald-50">
                        <p className="text-[10px] font-black text-emerald-900/40 uppercase tracking-widest mb-3">Active Schedule</p>
                        <div className="space-y-2">
                            {stats.activeWindows.slice(0, 3).map((w, i: number) => {
                                const isFuture = Date.parse(w.valid_from) > getCurrentTimestampMs()
                                const expiryDate = formatToSurat(w.valid_until, 'MMM yyyy')
                                return (
                                    <div key={i} className="flex items-center justify-between bg-emerald-50/50 rounded-xl px-3 py-2 border border-emerald-100/50 text-[11px]">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${isFuture ? 'bg-amber-400' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`} />
                                            <span className="text-emerald-900 font-bold">10% Off</span>
                                            {isFuture && <span className="text-[9px] text-amber-600 font-black uppercase ml-1">Pending</span>}
                                        </div>
                                        <div className="text-emerald-700/60 font-medium">Till {expiryDate}</div>
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
