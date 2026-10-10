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
import { StartTrialButton } from '@/components/plans/StartTrialButton'
import { useTranslation } from '@/lib/i18n/context'
import { liteTrialText } from '@/lib/i18n/lite-trial'
import { upgradeText } from '@/lib/upgrade-wall'
import { useFreeWorkspace } from '../FreeWorkspace'
import { freeSupportingText } from '@/lib/i18n/free-supporting'
import { freeBillingPresentation } from '@/lib/free-billing-presentation'
import styles from './free-billing.module.css'

interface FreeBillingClientProps {
  organizationName: string
  initialTier?: string
  grantState?: string
  billingHistory?: BillingHistoryEntry[]
  /** Base is named only for organizations that may see it. Defaults to hidden. */
  baseVisible?: boolean
  /** Offers the Lite trial from this page to an organization that may still start it. Defaults to hidden. */
  liteTrialEligible?: boolean
}

export default function FreeBillingClient({
  organizationName,
  initialTier,
  grantState,
  billingHistory = [],
  baseVisible = false,
  liteTrialEligible = false,
}: FreeBillingClientProps) {
  const { language } = useTranslation()
  const { tier } = useFreeWorkspace()
  const access = freeBillingPresentation(tier === 'lite' || tier === 'base' ? tier : initialTier ?? tier, grantState)
  const text = (key: Parameters<typeof freeSupportingText>[1], values: Record<string, string | number> = {}) => freeSupportingText(language, key, values)

  return (
    <div className={`mx-auto space-y-6 pb-16 ${styles.root}`}>
      <PageHeader
        title={text('billingTitle')}
      />

      {access.noticeKey && <p role="status" className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-ink">{text(access.noticeKey)}</p>}

      {/* 1. Active Workspace Section */}
      <section aria-labelledby="active-workspace-heading" className="space-y-3">
        <h3 id="active-workspace-heading" className="text-sm font-semibold text-ink">
          {access.freeActive ? text('workspace') : text('currentPlan')}
        </h3>
        <Card className={`overflow-hidden border-hairline bg-surface shadow-[var(--shadow-card)] ${styles.workspace}`}>
          <div className="flex flex-col gap-4 border-b border-hairline px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-loom text-saffron">
                  <Calculator className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold tracking-tight text-ink">{access.planName === 'Weavly Free' ? text('freeWorkspace') : access.planName}</h2>
                    <StatusBadge status={access.status} label={text(access.statusKey)} />
                  </div>
                  <p className="mt-0.5 text-xs text-subtle">{text('organization', { name: organizationName || text('nameUnavailable') })}</p>
                </div>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">{text('currentPlan')}</p>
              <p className="text-sm font-semibold text-ink">{access.planName}</p>
              {access.planName === 'Weavly Free' && <p className="mt-0.5 text-xs text-subtle">{text('noPayment')}</p>}
            </div>
          </div>
          <CardContent className="p-0">
            <div className={`grid grid-cols-1 divide-y divide-hairline sm:grid-cols-2 sm:divide-x sm:divide-y-0 ${styles.facts}`}>
              <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-saffron-soft text-saffron-deep">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                   <p className="text-sm font-semibold text-ink">{text(access.planName === 'Weavly Free' ? 'allowance' : 'costingAllowance')}</p>
                   <p className="mt-0.5 text-sm leading-relaxed text-body">{access.planName === 'Weavly Free' ? <><span className="font-medium text-ink">{text('allowanceCount')}</span> {text('allowanceReset')}</> : text('unlimited')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 px-5 py-4 sm:px-6">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{text('saved')}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-body">{text('savedBody')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 2. View Plans Section (redirects to standalone upgrade wall page) */}
      <section aria-labelledby="view-plans-heading" className="space-y-3">
        <Card className={`flex flex-col items-start justify-between gap-4 rounded-2xl border-hairline bg-surface p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:px-6 ${styles.compare}`}>
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="view-plans-heading" className="text-base font-semibold tracking-tight text-ink">{text('compare')}</h2>
              {baseVisible && (
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-body">
                  {text('compareBody')}
                </p>
              )}
              <p className="mt-1.5 text-xs text-subtle">{text('commercial')}</p>
              {liteTrialEligible && tier !== 'lite' && tier !== 'base' && (
                <div className="mt-3 max-w-md space-y-2">
                  <StartTrialButton className="w-full sm:w-auto" />
                  <p className="text-xs leading-relaxed text-body">{liteTrialText(language, 'trialDisclosure')}</p>
                </div>
              )}
            </div>
          </div>
          <Button asChild className="h-auto w-full shrink-0 gap-2 rounded-lg bg-loom px-4 py-2.5 text-sm font-semibold text-white shadow-none transition-colors hover:bg-loom-elevated sm:w-auto" size="default">
            <Link href="/plans?from=billing">
              <span>{tier === 'lite' && baseVisible ? 'Upgrade to Base' : upgradeText(language, 'compareAllPlans')}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </Card>
      </section>

      {/* 3. View Billing History Section (opens modal where user views their billing records) */}
      <section aria-labelledby="billing-history-heading" className="space-y-3">
        <h3 id="billing-history-heading" className="text-sm font-semibold text-ink">
          {text('receipts')}
        </h3>
        <PaymentHistoryDialog entries={billingHistory} mobileContentClassName={styles.history} />
      </section>

    </div>
  )
}
