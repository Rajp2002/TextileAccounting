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

            {/* Plan Comparison & Upgrade Choices */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-bold text-ink">Available plans</h3>
                        <p className="text-xs text-subtle">
                            Choose Lite for full costing with Rate Book, or Base to add production logging and payroll.
                        </p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
                        <Link href="/plans?from=billing">
                            <Sparkles className="h-3.5 w-3.5 text-saffron-deep" aria-hidden="true" />
                            <span>{upgradeText(language, 'compareAllPlans')}</span>
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                    </Button>
                </div>

                <UpgradeWall
                    currentPlan={tier === 'free' ? 'free' : tier}
                    actions={{
                        free: (
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <p>
                                        <span className="text-3xl font-bold tracking-tight text-ink">₹0</span>
                                        <span className="ml-2 text-sm text-subtle">/ free forever</span>
                                    </p>
                                    <p className="text-sm text-body">2 cost estimates / week</p>
                                    <p className="text-xs text-subtle">Single-loom costing · No payment required</p>
                                </div>
                                <Button asChild className="w-full">
                                    <Link href="/free">Open Free Workspace</Link>
                                </Button>
                            </div>
                        ),
                        lite: paidAction('lite'),
                        base: paidAction('base'),
                    }}
                />

                <div className="flex items-center justify-center gap-2 rounded-xl border border-hairline bg-surface-soft p-3">
                    <ShieldCheck className="h-4 w-4 text-subtle" aria-hidden="true" />
                    <p className="text-xs font-medium text-body">Secure Razorpay checkout · GST-inclusive totals shown</p>
                </div>
            </div>
        </div>
    )
}
