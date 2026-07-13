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
        <Card className="overflow-hidden rounded-2xl border-emerald-200 bg-emerald-950 text-white shadow-[0_8px_30px_rgba(6,78,59,0.12)]">
            <CardHeader className="border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                        <Gift className="h-5 w-5 text-emerald-300" />
                    </div>
                    <div>
                        <CardTitle className="text-lg text-white">Refer & Earn</CardTitle>
                        <p className="mt-0.5 text-xs text-emerald-200/70">
                            Get 10% off your monthly bill per paid referral.
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
                
                {/* Stats Grid - more compact and informative */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col justify-center rounded-xl border border-white/10 bg-white/5 p-3.5">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Total referrals</p>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold leading-none text-white">{stats.total || 0}</span>
                            <span className="text-xs font-medium text-emerald-200/70">{stats.converted || 0} converted</span>
                        </div>
                    </div>
                    <div className="flex flex-col justify-center rounded-xl bg-emerald-400 p-3.5 text-emerald-950">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider">Current reward</p>
                        <div className="flex items-baseline gap-0.5">
                            <span className="text-2xl font-bold leading-none">{stats.currentDiscountPct || 0}%</span>
                            <span className="text-xs font-medium">off</span>
                        </div>
                    </div>
                </div>

                {/* Journey to 100% Free - Simplified progress */}
                <div className="relative pt-1">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-emerald-100">Journey to 100% free</span>
                        <div className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                            {stats.currentDiscountPct || 0}% / 100%
                        </div>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10 p-0.5">
                        <div 
                            className="relative h-full rounded-full bg-emerald-400 transition-all duration-1000 ease-out"
                            style={{ width: `${Math.min(100, stats.currentDiscountPct || 0)}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                    </div>
                </div>

                {/* Code & Share - Compact grouping */}
                <div className="space-y-4 pt-2">
                    <div className="relative group">
                        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                            Your Unique Code
                        </label>
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1.5 transition-colors focus-within:border-emerald-400">
                            <input 
                                readOnly 
                                value={referralCode}
                                className="h-10 min-w-0 flex-1 bg-transparent pl-3 text-sm font-bold uppercase tracking-[0.2em] text-white outline-none"
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <div className="flex items-center gap-1.5 shrink-0 px-1">
                                <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-10 w-10 rounded-lg text-emerald-300 hover:bg-white/10 hover:text-white"
                                    onClick={copyToClipboard}
                                    title="Copy Code"
                                >
                                    {copied ? <CheckCircle2 className="h-4.5 w-4.5" /> : <Copy className="h-4.5 w-4.5 opacity-60" />}
                                </Button>
                                <Button 
                                    onClick={shareWhatsApp}
                                    className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-emerald-400 px-4 text-[11px] font-bold uppercase tracking-wider text-emerald-950 shadow-none hover:bg-emerald-300"
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
