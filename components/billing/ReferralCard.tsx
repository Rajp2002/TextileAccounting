'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Gift, CheckCircle2, Share2 } from 'lucide-react'
import { ReferralRewardButton } from '@/components/billing/ReferralRewardButton'

type ReferralStats = {
    eligible?: boolean
    code?: string | null
    total?: number
    converted?: number
    availableCredits?: number
    redeemedCredits?: number
    cap?: number
    canRedeemNextYear?: boolean
    renewalEligibleAt?: string | null
}

function formatShortDate(iso: string | null | undefined): string {
    if (!iso) return 'the final 30 days of your current year'
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    })
}

export function ReferralCard({ stats }: { stats: ReferralStats | null }) {
    const [copied, setCopied] = useState(false)
    const [copyFailed, setCopyFailed] = useState(false)

    // The server intentionally returns no code for trials, unpaid accounts,
    // expired Base accounts, and Full Suite accounts.
    if (!stats || !stats.eligible || !stats.code) return null

    const referralCode = stats.code
    const converted = Math.min(stats.cap ?? 5, stats.converted ?? 0)
    const cap = stats.cap ?? 5
    const availableCredits = stats.availableCredits ?? 0
    const redeemedCredits = stats.redeemedCredits ?? 0
    const progress = cap > 0 ? Math.min(100, (converted / cap) * 100) : 0

    const copyToClipboard = async () => {
        try {
            let copiedToClipboard = false
            if (navigator.clipboard?.writeText) {
                try {
                    await navigator.clipboard.writeText(referralCode)
                    copiedToClipboard = true
                } catch {
                    // Permission-restricted embedded browsers use the
                    // selection fallback below.
                }
            }
            if (!copiedToClipboard) {
                const fallback = document.createElement('textarea')
                fallback.value = referralCode
                fallback.setAttribute('readonly', '')
                fallback.style.position = 'fixed'
                fallback.style.opacity = '0'
                document.body.appendChild(fallback)
                fallback.select()
                copiedToClipboard = document.execCommand('copy')
                fallback.remove()
                if (!copiedToClipboard) throw new Error('Clipboard copy was not available')
            }
            setCopyFailed(false)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            setCopied(false)
            setCopyFailed(true)
        }
    }

    const shareWhatsApp = () => {
        const signupUrl = `${window.location.origin}/signup?ref=${encodeURIComponent(referralCode)}`
        const text = `Join Weavly with my referral link: ${signupUrl}. Pay the initial Base Plan year and I earn one free annual year.`
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
    }

    return (
        <Card className="premium-surface overflow-hidden border-loom-elevated bg-loom text-white shadow-[var(--shadow-panel)]">
            <CardHeader className="border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                        <Gift className="h-5 w-5 text-saffron" />
                    </div>
                    <div>
                        <CardTitle className="text-lg text-white">Refer & earn free years</CardTitle>
                        <p className="mt-0.5 text-xs text-surface-muted">
                            One free Base Plan year per successful paid referral, capped at five.
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col justify-center rounded-lg border border-white/10 bg-white/5 p-3.5">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-saffron">Successful referrals</p>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold leading-none text-white">{converted}/{cap}</span>
                            <span className="text-xs font-medium text-surface-muted">earned</span>
                        </div>
                    </div>
                    <div className="flex flex-col justify-center rounded-lg bg-saffron p-3.5 text-ink">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider">Free years ready</p>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold leading-none">{availableCredits}</span>
                            <span className="text-xs font-medium">available</span>
                        </div>
                    </div>
                </div>

                <div className="relative pt-1">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-surface-muted">Progress to the five-year cap</span>
                        <div className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-surface-muted">
                            {converted}/{cap}
                        </div>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10 p-0.5" role="progressbar" aria-label="Referral reward progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
                        <div
                            className="premium-progress-fill relative h-full w-full rounded-full bg-saffron"
                            style={{ transform: `scaleX(${progress / 100})` }}
                        >
                            <div className="absolute inset-0 bg-white/20" />
                        </div>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-surface-muted">
                        A referral is earned only after the new member pays the initial Base Plan year. Your initial Base Plan payment is required before any free renewal can be used.
                    </p>
                </div>

                <div className="space-y-4 border-t border-white/10 pt-4">
                    <div className="relative group">
                        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-saffron">
                            Your referral code
                        </label>
                        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-1.5 transition-colors focus-within:border-saffron">
                            <input
                                readOnly
                                value={referralCode}
                                className="h-10 min-w-0 flex-1 bg-transparent pl-3 text-sm font-bold uppercase tracking-[0.2em] text-white outline-none"
                                onClick={(event) => event.currentTarget.select()}
                                aria-label="Referral code"
                            />
                            <div className="flex shrink-0 items-center gap-1.5 px-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 rounded-lg text-saffron hover:bg-white/10 hover:text-white"
                                    onClick={() => void copyToClipboard()}
                                    title={copied ? 'Copied' : 'Copy referral code'}
                                    aria-label={copied ? 'Referral code copied' : 'Copy referral code'}
                                >
                                    {copied ? <CheckCircle2 className="premium-success-pop h-4.5 w-4.5" /> : <Copy className="h-4.5 w-4.5 opacity-60" />}
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
                        <p role="status" aria-atomic="true" className={`mt-2 min-h-4 text-[11px] font-semibold ${copyFailed ? 'text-warning' : 'text-success'}`}>
                            {copied ? 'Referral code copied.' : copyFailed ? 'Copy unavailable. Select the code and copy it manually.' : ''}
                        </p>
                    </div>

                    {availableCredits > 0 && (
                        <div className="space-y-3 rounded-xl border border-saffron/30 bg-white/5 p-4">
                            <div>
                                <p className="text-sm font-semibold text-white">
                                    {availableCredits} free annual {availableCredits === 1 ? 'year is' : 'years are'} ready
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-surface-muted">
                                    {stats.canRedeemNextYear
                                        ? 'Redeem the oldest credit when your next renewal is due.'
                                        : `Redeem from ${formatShortDate(stats.renewalEligibleAt)}. Credits stay available until then.`}
                                </p>
                            </div>
                            {stats.canRedeemNextYear && <ReferralRewardButton />}
                        </div>
                    )}

                    {redeemedCredits > 0 && (
                        <p className="text-[11px] text-surface-muted">
                            {redeemedCredits} free annual {redeemedCredits === 1 ? 'year has' : 'years have'} already been redeemed.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
