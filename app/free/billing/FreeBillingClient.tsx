'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  Calculator,
  Check,
  Clock,
  CreditCard,
  FileText,
  Lock,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
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
  const { language, tx } = useTranslation()
  const { paid, tier, activatePaid } = useFreeWorkspace()

  const formatAmount = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

  const paidAction = (planTier: PurchasablePlanTier) => {
    const plan = BILLING_PLANS[planTier]
    const price = getBillingPrice(planTier, 'initial_purchase')
    const renewalPrice = getBillingPrice(planTier, 'renewal')
    const total = formatAmount(price.totalPaise)

    return (
      <div className="space-y-4">
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
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      <PageHeader
        title="Subscription & Billing"
        description="View your current plan allowance and explore upgrades to Weavly Lite or Base."
        meta={<StatusBadge status="active" label="Weavly Free" />}
        actions={
          billingHistory.length > 0 ? (
            <PaymentHistoryDialog entries={billingHistory} />
          ) : undefined
        }
      />

      {/* Current Workspace Summary */}
      <Card className="overflow-hidden border-hairline bg-surface shadow-[var(--shadow-card)]">
        <div className="border-b border-hairline bg-surface-soft/60 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-loom text-saffron shadow-xs">
                <Calculator className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight text-ink">Weavly Free workspace</h2>
                  <StatusBadge status="active" label="Active" />
                </div>
                <p className="text-xs text-subtle">Organization: {organizationName}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">Plan Type</p>
              <p className="text-xs font-semibold text-ink">Free Tier · 2 costings / week</p>
            </div>
          </div>
        </div>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-hairline bg-surface-soft/70 p-4 transition-colors hover:bg-surface-soft">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <Clock className="h-4 w-4 text-saffron" />
                <span>Weekly Allowance</span>
              </div>
              <p className="mt-2 text-2xl font-black text-ink">
                2 <span className="text-xs font-normal text-subtle">costings / wk</span>
              </p>
              <p className="mt-1 text-xs text-subtle">
                Resets weekly. Calculations save automatically as permanent snapshots.
              </p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface-soft/70 p-4 transition-colors hover:bg-surface-soft">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <FileText className="h-4 w-4 text-info" />
                <span>Saved Costings</span>
              </div>
              <p className="mt-2 text-2xl font-black text-ink">
                Unlimited <span className="text-xs font-normal text-subtle">view & export</span>
              </p>
              <p className="mt-1 text-xs text-subtle">
                Fixed snapshots are retained indefinitely. 0 quota used to view or export PDF.
              </p>
            </div>
            <div className="rounded-xl border border-hairline bg-surface-soft/70 p-4 transition-colors hover:bg-surface-soft">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <Zap className="h-4 w-4 text-saffron-deep" />
                <span>Paid Upgrades</span>
              </div>
              <p className="mt-2 text-2xl font-black text-ink">
                Lite & Base <span className="text-xs font-normal text-subtle">available</span>
              </p>
              <p className="mt-1 text-xs text-subtle">
                Unlock saved quality recipes, dynamic yarn rate books, and production payroll.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UpgradeWall: 3-column plan comparison cards (Free / Lite / Base) */}
      <div className="space-y-4">
        <UpgradeWall
          currentPlan="free"
          actions={{
            free: (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p>
                    <span className="text-3xl font-bold tracking-tight text-ink">₹0</span>
                  </p>
                  <p className="text-sm text-body">{upgradeText(language, 'freePrice')}</p>
                  <p className="text-xs text-subtle">{freeText(language, 'freeSavedPolicy')}</p>
                </div>
                <Button
                  variant="outline"
                  disabled
                  className="w-full border-hairline bg-surface-soft font-semibold text-subtle"
                >
                  {upgradeText(language, 'current')}
                </Button>
              </div>
            ),
            lite: paidAction('lite'),
            base: paidAction('base'),
          }}
        />
        <div className="flex justify-center pt-2">
          <Link
            href="/plans?from=billing"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-saffron-deep hover:text-saffron transition-colors"
          >
            {upgradeText(language, 'compareAllPlans')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Value Proposition Highlights */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-start gap-3.5 rounded-2xl border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <h4 className="text-sm font-bold text-ink">Instant Plan Activation</h4>
            <p className="mt-1 text-xs leading-relaxed text-body">
              Upgrading to Lite or Base activates instantly in your account. All your existing saved costing snapshots are seamlessly retained.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5 rounded-2xl border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info">
            <CreditCard className="h-5 w-5" />
          </span>
          <div>
            <h4 className="text-sm font-bold text-ink">Official GST Invoices</h4>
            <p className="mt-1 text-xs leading-relaxed text-body">
              All prices are 18% GST-inclusive. Official GST tax invoices with your business details are generated immediately upon checkout.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5 rounded-2xl border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h4 className="text-sm font-bold text-ink">Secure Razorpay Processing</h4>
            <p className="mt-1 text-xs leading-relaxed text-body">
              Enterprise-grade 256-bit encrypted checkout supporting UPI, net banking, debit cards, and credit cards across India.
            </p>
          </div>
        </div>
      </div>

      {/* Trust & Policy Footer Banner */}
      <div className="flex items-center justify-center gap-2 rounded-xl border border-hairline bg-surface-soft p-3.5 text-center shadow-xs">
        <Lock className="h-4 w-4 text-subtle" aria-hidden="true" />
        <p className="text-xs font-medium text-body">
          Secure Razorpay payment gateway · Transparent flat pricing · No lock-in, cancel or upgrade anytime
        </p>
      </div>
    </div>
  )
}
