'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  UPGRADE_FEATURE_IMAGES,
  upgradeFeatureBullets,
  upgradeText,
  type UpgradeFeature,
  type UpgradePlan,
} from '@/lib/upgrade-wall'
import { useTranslation } from '@/lib/i18n/context'

interface PlanPreviewModalProps {
  feature: UpgradeFeature | null
  planTier: UpgradePlan
  onClose: () => void
}

export function PlanPreviewModal({ feature, planTier, onClose }: PlanPreviewModalProps) {
  const { language } = useTranslation()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!feature) return

    // Save previous focus
    previousFocusRef.current = document.activeElement as HTMLElement | null

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }

      // Focus trap within modal
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    // Focus the close button or modal container
    const closeBtn = dialogRef.current?.querySelector<HTMLButtonElement>('button[data-modal-close]')
    closeBtn?.focus()

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [feature, onClose])

  if (!feature) return null

  const imageMeta = UPGRADE_FEATURE_IMAGES[feature]
  const featureName = upgradeText(language, feature)
  const bullets = upgradeFeatureBullets(planTier, feature)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-modal-title"
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-saffron-deep">
              {upgradeText(language, 'sample')}
            </span>
            <h2 id="preview-modal-title" className="text-xl font-bold text-ink">
              {featureName}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-modal-close
            onClick={onClose}
            aria-label={upgradeText(language, 'close')}
            className="h-9 w-9 rounded-full text-subtle hover:bg-black/5 hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-4">
          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-hairline bg-surface-soft">
            <Image
              src={imageMeta.src}
              alt={upgradeText(language, 'picture', { feature: featureName })}
              width={imageMeta.width}
              height={imageMeta.height}
              className="max-h-full max-w-full object-contain p-2"
              priority
            />
          </div>

          <div className="space-y-2 rounded-xl bg-surface-soft/60 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-subtle">
              {upgradeText(language, 'intro')}
            </h3>
            <ul className="space-y-2">
              {bullets.map((bulletKey) => (
                <li key={bulletKey} className="flex items-start gap-2 text-sm text-body">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-saffron/15 text-saffron-deep">
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                  <span>{upgradeText(language, bulletKey)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-hairline bg-surface-soft/40 px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {upgradeText(language, 'close')}
          </Button>
        </div>
      </div>
    </div>
  )
}
