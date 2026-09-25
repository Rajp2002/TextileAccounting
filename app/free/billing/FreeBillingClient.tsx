'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Calculator,
  Clock,
  FileText,
  Sparkles,
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
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <PageHeader
        title={tx('Subscription & Billing')}
      />

      {/* 1. Active Workspace Section */}
      <section aria-labelledby="active-workspace-heading" className="space-y-3">
        <h3 id="active-workspace-heading" className="text-sm font-semibold text-ink">
          {tx('Active workspace')}
        </h3>
        <Card className="overflow-hidden border-hairline bg-surface shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-4 border-b border-hairline px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-loom text-saffron">
                  <Calculator className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold tracking-tight text-ink">Weavly Free workspace</h2>
                    <StatusBadge status="active" label="Active" />
                  </div>
                  <p className="mt-0.5 text-xs text-subtle">Organization: {organizationName}</p>
                </div>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Current plan</p>
              <p className="text-sm font-semibold text-ink">Weavly Free</p>
              <p className="mt-0.5 text-xs text-subtle">No subscription payment required</p>
            </div>
          </div>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 divide-y divide-hairline sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-saffron-soft text-saffron-deep">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">Monthly allowance</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-body"><span className="font-medium text-ink">2 new costings per month.</span> The allowance resets on the first.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">Saved costings</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-body">Saved snapshots stay available to reopen or export without using the monthly allowance.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 2. View Plans Section (redirects to standalone upgrade wall page) */}
      <section aria-labelledby="view-plans-heading" className="space-y-3">
        <Card className="flex flex-col items-start justify-between gap-4 rounded-2xl border-hairline bg-surface p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="view-plans-heading" className="text-base font-semibold tracking-tight text-ink">Compare plan options</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-body">
                Compare features and pricing for Weavly Free, Lite, and Base.
              </p>
              <p className="mt-1.5 text-xs text-subtle">GST included · Annual renewals are manual · Secure Razorpay checkout</p>
            </div>
          </div>
          <Button asChild className="h-auto w-full shrink-0 gap-2 rounded-lg bg-loom px-4 py-2.5 text-sm font-semibold text-white shadow-none transition-colors hover:bg-loom-elevated sm:w-auto" size="default">
            <Link href="/plans?from=billing">
              <span>{tier === 'lite' ? 'Upgrade to Base' : upgradeText(language, 'compareAllPlans')}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </Card>
      </section>

      {/* 3. View Billing History Section (opens modal where user views their billing records) */}
      <section aria-labelledby="billing-history-heading" className="space-y-3">
        <h3 id="billing-history-heading" className="text-sm font-semibold text-ink">
          Billing &amp; invoices
        </h3>
        <PaymentHistoryDialog entries={billingHistory} />
      </section>

    </div>
  )
}
