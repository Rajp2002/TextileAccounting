'use client'

import { useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FEATURE_DEMOS } from '@/lib/feature-demos'
import { upgradeFeatureBullets, upgradeText, type UpgradeFeature, type UpgradePlan } from '@/lib/upgrade-wall'
import { useTranslation } from '@/lib/i18n/context'

interface PlanPreviewModalProps {
  feature: UpgradeFeature | null
  planTier: UpgradePlan
  onClose: () => void
}

function FeatureVideo({ feature }: { feature: UpgradeFeature }) {
  const { language } = useTranslation()
  const [failed, setFailed] = useState(false)
  const demo = FEATURE_DEMOS[feature]
  return (
    <>
      <video
        className="mx-auto max-h-[65dvh] w-full rounded-xl border border-hairline bg-black"
        src={demo.src}
        poster={demo.poster}
        controls
        playsInline
        autoPlay
        preload="metadata"
        aria-label={upgradeText(language, 'watchFeatureDemo', { feature: upgradeText(language, feature) })}
        onError={() => setFailed(true)}
      >
        <track kind="captions" src={demo.captions} srcLang="en" label="English" />
        <a href={demo.src}>{upgradeText(language, 'openVideo')}</a>
      </video>
      {failed && (
        <p role="alert" className="text-sm text-body">
          {upgradeText(language, 'demoUnavailable')}{' '}
          <a className="font-semibold text-saffron-deep underline" href={demo.src}>
            {upgradeText(language, 'openVideo')}
          </a>
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-subtle">
        <span>{upgradeText(language, 'demoHelp')}</span>
        <a href={demo.transcript} target="_blank" rel="noopener noreferrer" className="font-semibold text-saffron-deep underline underline-offset-2">
          {upgradeText(language, 'demoTranscript')}
        </a>
      </div>
    </>
  )
}

export function PlanPreviewModal({ feature, planTier, onClose }: PlanPreviewModalProps) {
  const { language } = useTranslation()
  const previousFocusRef = useRef<HTMLElement | null>(null)

  return (
    <Dialog open={feature !== null} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent
        className="gap-4 p-4 sm:max-w-6xl sm:p-6"
        mobilePresentation="center"
        showCloseButton={false}
        onOpenAutoFocus={() => { previousFocusRef.current = document.activeElement as HTMLElement | null }}
        onCloseAutoFocus={event => {
          event.preventDefault()
          previousFocusRef.current?.focus()
        }}
      >
        {feature && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-saffron-deep">
                  {upgradeText(language, 'sample')}
                </p>
                <DialogTitle className="text-xl font-bold text-ink">{upgradeText(language, feature)}</DialogTitle>
                <DialogDescription className="text-xs">{upgradeText(language, 'demoPlanNote')}</DialogDescription>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={upgradeText(language, 'closePreview')}>
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
            {/* Unmounting on close stops playback; changing feature resets media and errors. */}
            <FeatureVideo key={feature} feature={feature} />
            <ul className="grid gap-2 rounded-xl bg-surface-soft/60 p-4 text-sm text-body sm:grid-cols-3">
              {upgradeFeatureBullets(planTier, feature).map(bullet => (
                <li key={bullet} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  <span>{upgradeText(language, bullet)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
