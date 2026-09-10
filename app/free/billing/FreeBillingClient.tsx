'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Calculator,
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
import { PaymentHistoryDialog, type BillingHistoryEntry } from '@/components/billing/PaymentHistoryDialog'
import { useTranslation } from '@/lib/i18n/context'
import { upgradeText } from '@/lib/upgrade-wall'
import { useFreeWorkspace } from '../FreeWorkspace'

interface FreeBillingClientProps {
  organizationName: string
  initialTier?: string
  grantState?: string
  billingHistory?: BillingHistoryEntry[]
}

export default function FreeBillingClient({
  organizationName,
  billingHistory = [],
}: FreeBillingClientProps) {
  const { language, tx } = useTranslation()
  const { tier } = useFreeWorkspace()

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      <PageHeader
        title={tx('Subscription & Billing')}
        description={tx('View your active workspace status, explore available plans, and manage billing history.')}
        meta={<StatusBadge status="active" label={tier === 'free' ? 'Weavly Free' : 'Active'} />}
      />

      {/* 1. Active Workspace Section */}
      <section aria-labelledby="active-workspace-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 id="active-workspace-heading" className="text-xs font-bold uppercase tracking-wider text-subtle">
            {tx('Active Workspace')}
          </h3>
        </div>
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
                  <span>Plan Status</span>
                </div>
                <p className="mt-2 text-2xl font-black text-ink">
                  Free Tier <span className="text-xs font-normal text-subtle">active</span>
                </p>
                <p className="mt-1 text-xs text-subtle">
                  Upgrade anytime to unlock saved quality recipes, dynamic rate books, and production.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 2. View Plans Section (redirects to standalone upgrade wall page) */}
      <section aria-labelledby="view-plans-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 id="view-plans-heading" className="text-xs font-bold uppercase tracking-wider text-subtle">
            Available Plans & Upgrades
          </h3>
        </div>
        <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 p-6 border-hairline bg-surface shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-saffron/15 text-saffron-deep">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-ink">Explore Weavly Plans</h2>
                <Link
                  href="/plans?from=billing"
                  className="rounded-full bg-saffron-soft px-2.5 py-0.5 text-[10px] font-bold text-saffron-deep hover:bg-saffron/25 transition-colors cursor-pointer"
                >
                  Recommended
                </Link>
              </div>
              <p className="mt-1 text-sm text-body leading-relaxed max-w-2xl">
                Compare Weavly Free, Lite, and Base with full interactive feature previews, instant activation, and GST tax invoices on our standalone plans page.
              </p>
            </div>
          </div>
          <Button asChild variant="saffron" className="shrink-0 font-semibold gap-2 px-5 py-2.5 h-auto text-sm" size="default">
            <Link href="/plans?from=billing">
              <span>{upgradeText(language, 'compareAllPlans')}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </Card>
      </section>

      {/* 3. View Billing History Section (opens modal where user views their billing records) */}
      <section aria-labelledby="billing-history-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 id="billing-history-heading" className="text-xs font-bold uppercase tracking-wider text-subtle">
            Billing & Invoices
          </h3>
        </div>
        <div className="rounded-xl border border-hairline bg-surface p-1 shadow-[var(--shadow-card)]">
          <PaymentHistoryDialog entries={billingHistory} />
        </div>
      </section>

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
