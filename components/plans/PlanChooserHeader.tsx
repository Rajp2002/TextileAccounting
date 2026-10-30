'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import LogoutButton from '@/components/auth/logout-button'
import { useTranslation } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { upgradeText } from '@/lib/upgrade-wall'

interface PlanChooserHeaderProps {
  effectiveTier?: string
  isUnassigned?: boolean
}

export function PlanChooserHeader({ effectiveTier = 'unassigned', isUnassigned = false }: PlanChooserHeaderProps) {
  const searchParams = useSearchParams()
  const { language } = useTranslation()
  const from = searchParams.get('from')

  const isFree = effectiveTier === 'free'
  const mobileCompact = isFree || effectiveTier === 'lite' || isUnassigned || effectiveTier === 'unassigned'

  let backHref: string | null = null
  let backLabel = upgradeText(language, 'backToWorkspace')

  if (from === 'billing') {
    backHref = isFree ? '/free/billing' : '/owner/billing'
    backLabel = upgradeText(language, 'backToBilling')
  } else if (from === 'estimator') {
    backHref = isFree ? '/free' : '/owner/estimator'
    backLabel = upgradeText(language, 'backToEstimator')
  } else if (from === 'workspace') {
    backHref = isFree ? '/free' : '/owner/estimator'
    backLabel = upgradeText(language, 'backToWorkspace')
  } else if (from && from.startsWith('/') && !from.startsWith('//') && !from.includes(':')) {
    if (from.startsWith('/owner') || from.startsWith('/free')) {
      backHref = from
      backLabel = upgradeText(language, 'backToWorkspace')
    }
  } else if (!isUnassigned && effectiveTier !== 'unassigned') {
    // Direct navigation by an existing user with active workspace
    backHref = isFree ? '/free' : '/owner/estimator'
    backLabel = upgradeText(language, 'backToWorkspace')
  }

  return (
    <header className={cn("flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline/60 py-1", mobileCompact && "max-sm:gap-2")}>
      <div className="flex shrink-0 items-center">
        <Link href={backHref ?? '/'} className="group flex h-16 w-32 min-h-[44px] items-center justify-center overflow-hidden rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron">
          <Image
            src="/images/WeavlyLogo.png"
            alt="Weavly"
            width={130}
            height={108}
            priority
            className="h-auto w-32 max-w-none object-contain transition-opacity duration-150 group-hover:opacity-90 motion-reduce:transition-none"
          />
        </Link>
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-1 sm:gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-xs font-semibold text-body hover:border-saffron/40 hover:bg-surface-soft hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{backLabel}</span>
          </Link>
        ) : (
          <LogoutButton variant="header" className="min-h-[44px] px-2.5 text-sm text-subtle hover:text-ink" />
        )}

        <LanguageSwitcher align={mobileCompact ? "mobile-right" : "left"} placement="bottom" className="min-h-[44px] bg-surface border border-hairline text-sm" />
      </div>
    </header>
  )
}
