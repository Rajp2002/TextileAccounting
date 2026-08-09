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
        <Card className="overflow-hidden border-loom-elevated bg-loom text-white shadow-[var(--shadow-panel)]">
            <CardHeader className="border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                        <Gift className="h-5 w-5 text-saffron" />
                    </div>
                    <div>
                        <CardTitle className="text-lg text-white">Refer & Earn</CardTitle>
                        <p className="mt-0.5 text-xs text-surface-muted">
                            Get 10% off your next annual plan payment per paid referral.
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
                
                {/* Stats Grid - more compact and informative */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col justify-center rounded-lg border border-white/10 bg-white/5 p-3.5">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-saffron">Total referrals</p>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold leading-none text-white">{stats.total || 0}</span>
                            <span className="text-xs font-medium text-surface-muted">{stats.converted || 0} converted</span>
                        </div>
                    </div>
                    <div className="flex flex-col justify-center rounded-lg bg-saffron p-3.5 text-ink">
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
                        <span className="text-xs font-medium text-surface-muted">Journey to 100% free</span>
                        <div className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-surface-muted">
                            {stats.currentDiscountPct || 0}% / 100%
                        </div>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10 p-0.5">
                        <div 
                            className="relative h-full rounded-full bg-saffron transition-all duration-700 ease-out"
                            style={{ width: `${Math.min(100, stats.currentDiscountPct || 0)}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20" />
                        </div>
                    </div>
                </div>

                {/* Code & Share - Compact grouping */}
                <div className="space-y-4 pt-2">
                    <div className="relative group">
                        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-saffron">
                            Your Unique Code
                        </label>
                        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-1.5 transition-colors focus-within:border-saffron">
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
                                    className="h-10 w-10 rounded-lg text-saffron hover:bg-white/10 hover:text-white"
                                    onClick={copyToClipboard}
                                    title="Copy Code"
                                >
                                    {copied ? <CheckCircle2 className="h-4.5 w-4.5" /> : <Copy className="h-4.5 w-4.5 opacity-60" />}
                                </Button>
                                <Button 
                                    onClick={shareWhatsApp}
                                    className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-saffron px-4 text-[11px] font-semibold uppercase tracking-wider text-white shadow-none hover:bg-saffron-deep"
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
                    <div className="border-t border-white/10 pt-2">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-surface-muted">Active schedule</p>
                        <div className="space-y-2">
                            {stats.activeWindows.slice(0, 3).map((w, i: number) => {
                                const isFuture = Date.parse(w.valid_from) > getCurrentTimestampMs()
                                const expiryDate = formatToSurat(w.valid_until, 'MMM yyyy')
                                return (
                                    <div key={i} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px]">
                                        <div className="flex items-center gap-2">
                                            <div className={`h-1.5 w-1.5 rounded-full ${isFuture ? 'bg-warning' : 'bg-success'}`} />
                                            <span className="font-semibold text-white">10% Off</span>
                                            {isFuture && <span className="ml-1 text-[9px] font-semibold uppercase text-warning">Pending</span>}
                                        </div>
                                        <div className="font-medium text-surface-muted">Till {expiryDate}</div>
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
