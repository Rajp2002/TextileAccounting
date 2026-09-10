'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Calculator, Check, CreditCard, ShieldCheck, Sparkles, Star, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader, StatusBadge } from '@/components/ui/page-header'
import { UpgradeWall } from '@/components/billing/UpgradeWall'
import { SubscribeButton } from '@/components/billing/SubscribeButton'
import { PaymentHistoryDialog, type BillingHistoryEntry } from '@/components/billing/PaymentHistoryDialog'
import { BILLING_PLANS, getBillingPrice, type PurchasablePlanTier } from '@/lib/billing-constants'
import { useTranslation } from '@/lib/i18n/context'
import { freeText } from '@/lib/i18n/free-tier'
import { upgradeText } from '@/lib/upgrade-wall'
import { useFreeWorkspace } from '../FreeWorkspace'

interface FreeBillingClientProps {
    organizationName: string
    initialTier: string
    grantState?: string
    billingHistory?: BillingHistoryEntry[]
}

export default function FreeBillingClient({
    organizationName,
    initialTier,
    grantState = 'active',
    billingHistory = [],
}: FreeBillingClientProps) {
    const router = useRouter()
    const { language } = useTranslation()
    const { paid, tier, activatePaid } = useFreeWorkspace()

    const formatAmount = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

    const paidAction = (planTier: PurchasablePlanTier) => {
        const plan = BILLING_PLANS[planTier]
        const price = getBillingPrice(planTier, 'initial_purchase')
        const renewalPrice = getBillingPrice(planTier, 'renewal')
        const total = formatAmount(price.totalPaise)

        return (
            <>
                <div className="space-y-1">
                    <p>
                        <span className="text-3xl font-bold tracking-tight text-ink">{total}</span>
                        <span className="ml-2 text-sm text-subtle">/{upgradeText(language, 'firstYear')}</span>
                    </p>
                    <p className="text-xs text-body">
                        {formatAmount(price.basePaise)} + {formatAmount(price.gstPaise)} GST (18%)
                    </p>
                    <p className="text-sm text-body">
                        {upgradeText(language, 'renewal', { amount: formatAmount(renewalPrice.totalPaise) })}
                    </p>
                    <p className="text-xs text-subtle">{upgradeText(language, 'tax')}</p>
                </div>
                <SubscribeButton
                    planTier={planTier}
                    tierName={plan.name}
                    displayAmount={total}
                    buttonLabel={freeText(language, planTier === 'lite' ? 'upgradeButton' : 'upgradeBaseButton')}
                    successHref="/owner/estimator"
                    successLabel="Start your first Cost Estimate"
                    onSuccess={() => {
                        activatePaid(planTier)
                        router.refresh()
                    }}
                />
            </>
        )
    }

    return (
        <div className="space-y-6 pb-12">
            <PageHeader
                title="Subscription & Billing"
                description="View your current plan allowance and upgrade to Weavly Lite or Base."
                meta={<StatusBadge status="active" label="Weavly Free" />}
                actions={
                    billingHistory.length > 0 ? (
                        <PaymentHistoryDialog entries={billingHistory} />
                    ) : undefined
                }
            />

            {/* Current Workspace Card */}
            <Card className="min-w-0 gap-4 p-5 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-subtle">Current Workspace</p>
                        <p className="mt-1 text-xs text-body">The product experience currently enabled for your account.</p>
                    </div>
                    <StatusBadge status="active" label="Enabled" />
                </div>
                <div className="flex items-start gap-3 mt-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-loom text-saffron">
                        <Calculator className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold tracking-tight text-ink">Weavly Free workspace</h2>
                        <p className="mt-1 text-sm leading-relaxed text-body">
                            Two completed costings each week, saved for viewing and export. Upgrade below for unlimited costings, reusable qualities, and production features.
                        </p>
                    </div>
                </div>
            </Card>

            {/* Upgrade Plan Callout */}
            <Card className="border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron/15 text-saffron-deep">
                                <Sparkles className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <h3 className="text-lg font-bold text-ink">{upgradeText(language, 'upgradeToLite')} & Base</h3>
                        </div>
                        <p className="max-w-xl text-sm leading-relaxed text-body">
                            {freeText(language, 'planSummary')}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                            <span className="inline-flex items-center rounded-md bg-surface-soft px-2.5 py-1 text-xs font-medium text-ink border border-hairline">
                                ✓ Unlimited calculations
                            </span>
                            <span className="inline-flex items-center rounded-md bg-surface-soft px-2.5 py-1 text-xs font-medium text-ink border border-hairline">
                                ✓ Reusable saved qualities & Rate Book
                            </span>
                            <span className="inline-flex items-center rounded-md bg-surface-soft px-2.5 py-1 text-xs font-medium text-ink border border-hairline">
                                ✓ Production logging & automatic payroll
                            </span>
                        </div>
                    </div>
                    <div className="shrink-0 flex flex-col gap-2">
                        <Button asChild size="lg" className="bg-saffron text-white hover:bg-saffron-deep font-semibold shadow-sm">
                            <Link href="/plans?from=billing" className="gap-2">
                                <Sparkles className="h-4 w-4" aria-hidden="true" />
                                <span>{upgradeText(language, 'compareAllPlans')}</span>
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </Link>
                        </Button>
                        <p className="text-[11px] text-center text-subtle">Starting at ₹2,999/first year · GST included</p>
                    </div>
                </div>
            </Card>

            <div className="flex items-center justify-center gap-2 rounded-xl border border-hairline bg-surface-soft p-3">
                <ShieldCheck className="h-4 w-4 text-subtle" aria-hidden="true" />
                <p className="text-xs font-medium text-body">Secure Razorpay checkout · GST-inclusive totals shown</p>
            </div>
        </div>
    )
}
