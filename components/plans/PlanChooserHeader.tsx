'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import LogoutButton from '@/components/auth/logout-button'
import { useTranslation } from '@/lib/i18n/context'
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

  let backHref: string | null = null
  let backLabel = upgradeText(language, 'backToWorkspace')

  if (from === 'billing') {
    backHref = isFree ? '/free/billing' : '/owner/billing'
    backLabel = upgradeText(language, 'backToBilling')
  } else if (from === 'estimator') {
    backHref = isFree ? '/free/estimator' : '/owner/estimator'
    backLabel = upgradeText(language, 'backToEstimator')
  } else if (from === 'workspace') {
    backHref = isFree ? '/free' : '/owner/today'
    backLabel = upgradeText(language, 'backToWorkspace')
  } else if (from && from.startsWith('/') && !from.startsWith('//') && !from.includes(':')) {
    if (from.startsWith('/owner') || from.startsWith('/free')) {
      backHref = from
      backLabel = upgradeText(language, 'backToWorkspace')
    }
  } else if (!isUnassigned && effectiveTier !== 'unassigned') {
    // Direct navigation by an existing user with active workspace
    backHref = isFree ? '/free' : '/owner/today'
    backLabel = upgradeText(language, 'backToWorkspace')
  }

  return (
    <header className="flex items-center justify-between gap-4 py-4 border-b border-hairline/60">
      <div className="flex items-center gap-4">
        <Link href={backHref ?? '/'} className="flex items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron rounded-lg">
          <Image
            src="/images/WeavlyLogo.png"
            alt="Weavly"
            width={130}
            height={60}
            priority
            className="h-10 w-auto object-contain transition-opacity group-hover:opacity-90"
          />
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-body hover:border-saffron/40 hover:bg-surface-soft hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{backLabel}</span>
          </Link>
        ) : (
          <LogoutButton variant="header" className="h-8 px-2.5 text-xs text-subtle hover:text-ink" />
        )}

        <LanguageSwitcher placement="bottom" className="bg-surface/90 border-hairline text-xs" />
      </div>
    </header>
  )
}
