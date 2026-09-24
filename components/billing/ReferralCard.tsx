'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    BadgeCheck,
    CheckCircle2,
    Clock3,
    Copy,
    Gift,
    History,
    Share2,
    Sparkles,
} from 'lucide-react'
import { ReferralRewardButton } from '@/components/billing/ReferralRewardButton'

type ReferralHistoryItem = {
    id?: string
    factoryName?: string
    status?: 'used' | 'active' | 'redeemed' | 'capped' | 'revoked' | string
    date?: string | null
    amountPaise?: number
    year?: number | null
}

type ReferralStats = {
    eligible?: boolean
    code?: string | null
    total?: number
    converted?: number
    usedReferrals?: number
    activeReferrals?: number
    availableCredits?: number
    redeemedCredits?: number
    cap?: number
    currentYear?: number
    currentYearCredits?: number
    rewardAmountPaise?: number
    canRedeem?: boolean
    // Compatibility with the pre-staged referral card response.
    canRedeemNextYear?: boolean
    history?: ReferralHistoryItem[]
}

function formatAmount(paise: number): string {
    return `₹${(paise / 100).toLocaleString('en-IN')}`
}

function formatShortDate(iso: string | null | undefined): string {
    if (!iso) return 'Date unavailable'
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    })
}

function statusPresentation(status: ReferralHistoryItem['status']) {
    switch (status) {
        case 'active':
            return {
                label: 'Active',
                detail: 'Payment received — ready to redeem',
                icon: BadgeCheck,
                className: 'border-saffron/40 bg-saffron/15 text-saffron',
            }
        case 'redeemed':
            return {
                label: 'Redeemed',
                detail: 'Free renewal reserved',
                icon: CheckCircle2,
                className: 'border-success/30 bg-success/10 text-success',
            }
        case 'capped':
            return {
                label: 'Capped',
                detail: 'Annual five-referral limit reached',
                icon: Clock3,
                className: 'border-warning/30 bg-warning/10 text-warning',
            }
        case 'revoked':
            return {
                label: 'Revoked',
                detail: 'Reward is no longer available',
                icon: Clock3,
                className: 'border-risk/30 bg-risk/10 text-risk',
            }
        case 'used':
        default:
            return {
                label: 'Used',
                detail: 'Code used — waiting for initial payment',
                icon: Clock3,
                className: 'border-white/15 bg-white/5 text-surface-muted',
            }
    }
}

export function ReferralCard({ stats }: { stats: ReferralStats | null }) {
    const [copied, setCopied] = useState(false)
    const [copyFailed, setCopyFailed] = useState(false)

    // The server intentionally returns no code for unpaid accounts,
    // expired Base accounts and retained legacy operations accounts.
    if (!stats || !stats.eligible || !stats.code) return null

    const referralCode = stats.code
    const cap = stats.cap ?? 5
    const usedReferrals = stats.usedReferrals ?? 0
    const activeCredits = stats.activeReferrals ?? stats.availableCredits ?? 0
    const redeemedCredits = stats.redeemedCredits ?? 0
    const currentYear = stats.currentYear ?? new Date().getFullYear()
    const currentYearCredits = stats.currentYearCredits ?? Math.min(cap, stats.converted ?? 0)
    const rewardAmountPaise = stats.rewardAmountPaise ?? 236000
    const history = stats.history ?? []
    const canRedeem = stats.canRedeem ?? stats.canRedeemNextYear ?? activeCredits > 0
    const progress = cap > 0 ? Math.min(100, (currentYearCredits / cap) * 100) : 0
    const activeValuePaise = activeCredits * rewardAmountPaise

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
        const text = `Join Weavly with my referral link: ${signupUrl}. When you pay the initial Weavly Base year, I receive one free annual renewal.`
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
    }

    return (
        <Card className="ui-surface overflow-hidden border-loom-elevated bg-loom text-white shadow-[var(--shadow-panel)]">
            <CardHeader className="border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                        <Gift className="h-5 w-5 text-saffron" />
                    </div>
                    <div>
                        <CardTitle className="text-lg text-white">Referral rewards</CardTitle>
                        <p className="mt-0.5 text-xs text-surface-muted">
                            Each paid referral gives one free Base renewal worth {formatAmount(rewardAmountPaise)}. Rewards are capped at five each India calendar year.
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3.5">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-surface-muted">Used</p>
                        <p className="text-2xl font-bold leading-none text-white">{usedReferrals}</p>
                        <p className="mt-1 text-[11px] text-surface-muted">Awaiting initial payment</p>
                    </div>
                    <div className="rounded-lg bg-saffron p-3.5 text-ink">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider">Active</p>
                        <p className="text-2xl font-bold leading-none">{activeCredits}</p>
                        <p className="mt-1 text-[11px]">{formatAmount(activeValuePaise)} ready</p>
                    </div>
                </div>

                <div className="relative pt-1">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-surface-muted">{currentYear} referral limit</span>
                        <div className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-surface-muted">
                            {currentYearCredits}/{cap}
                        </div>
                    </div>
                    <div
                        className="h-2.5 w-full overflow-hidden rounded-full bg-white/10 p-0.5"
                        role="progressbar"
                        aria-label={`${currentYear} referral limit`}
                        aria-valuemin={0}
                        aria-valuemax={cap}
                        aria-valuenow={Math.min(currentYearCredits, cap)}
                    >
                        <div
                            className="ui-progress-fill relative h-full w-full origin-left rounded-full bg-saffron"
                            style={{ transform: `scaleX(${progress / 100})` }}
                        >
                            <div className="absolute inset-0 bg-white/20" />
                        </div>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-surface-muted">
                        Used referrals stay pending until the new member pays the initial Weavly Base year. Your initial Weavly Base payment is required before any free renewal can be used. Active referrals are eligible to redeem; redeeming them reserves consecutive future renewals.
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
                                    {copied ? <CheckCircle2 className="ui-success-pop h-4.5 w-4.5" /> : <Copy className="h-4.5 w-4.5 opacity-60" />}
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

                    {canRedeem && activeCredits > 0 && (
                        <div className="space-y-3 rounded-xl border border-saffron/30 bg-white/5 p-4">
                            <div className="flex items-start gap-3">
                                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-saffron" aria-hidden="true" />
                                <div>
                                    <p className="text-sm font-semibold text-white">
                                        {activeCredits} active {activeCredits === 1 ? 'referral' : 'referrals'} ready to redeem
                                    </p>
                                    <p className="mt-1 text-xs leading-relaxed text-surface-muted">
                                        Redeem all now to reserve {activeCredits} future Base renewals free of charge ({formatAmount(activeValuePaise)} total value).
                                    </p>
                                </div>
                            </div>
                            <ReferralRewardButton />
                        </div>
                    )}

                    <div className="space-y-3 border-t border-white/10 pt-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <History className="h-4 w-4 text-saffron" aria-hidden="true" />
                                <p className="text-sm font-semibold text-white">Referral activity</p>
                            </div>
                            <p className="text-[11px] text-surface-muted">{redeemedCredits} redeemed</p>
                        </div>
                        {history.length > 0 ? (
                            <div className="divide-y divide-white/10 rounded-xl border border-white/10">
                                {history.map((item, index) => {
                                    const presentation = statusPresentation(item.status)
                                    const Icon = presentation.icon
                                    const amountPaise = item.amountPaise ?? rewardAmountPaise
                                    return (
                                        <div key={item.id ?? `${item.factoryName}-${index}`} className="flex items-start gap-3 p-3">
                                            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${presentation.className}`}>
                                                <Icon className="h-4 w-4" aria-hidden="true" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="truncate text-xs font-semibold text-white">{item.factoryName ?? 'Factory'}</p>
                                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${presentation.className}`}>
                                                        {presentation.label}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-[11px] leading-relaxed text-surface-muted">{presentation.detail}</p>
                                                <p className="mt-1 text-[10px] font-medium text-surface-muted/80">
                                                    {formatAmount(amountPaise)} free renewal · {formatShortDate(item.date)}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="rounded-xl border border-dashed border-white/15 p-3 text-xs leading-relaxed text-surface-muted">
                                No one has used your referral code yet. Share it to start earning free Base renewals.
                            </p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
