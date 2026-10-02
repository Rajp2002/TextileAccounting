'use client'

import { useId, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { getFeatureDemo, isNarrationLanguage, NARRATION_LANGUAGES, NARRATION_LANGUAGE_LABELS, type NarrationLanguage } from '@/lib/feature-demos'
import { upgradeFeatureBullets, upgradeText, type UpgradeFeature, type UpgradePlan } from '@/lib/upgrade-wall'
import { useTranslation } from '@/lib/i18n/context'

interface PlanPreviewModalProps {
  feature: UpgradeFeature | null
  planTier: UpgradePlan
  onClose: () => void
}

const NARRATION_STORAGE_KEY = 'weavly_demo_narration_language'

interface PlaybackPosition {
  time: number
  playing: boolean
  muted: boolean
  volume: number
  rate: number
  captions: boolean
}

function readNarrationPreference(): NarrationLanguage | null {
  try {
    const stored = localStorage.getItem(NARRATION_STORAGE_KEY)
    return isNarrationLanguage(stored) ? stored : null
  } catch {
    return null
  }
}

function FeatureVideo({ feature }: { feature: UpgradeFeature }) {
  const { language } = useTranslation()
  const [failed, setFailed] = useState(false)
  const [preference, setPreference] = useState(readNarrationPreference)
  const [playback, setPlayback] = useState<PlaybackPosition | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const selectorId = useId()
  const narrationLanguage = preference ?? language
  const demo = getFeatureDemo(feature, narrationLanguage)

  function changeNarration(next: string) {
    if (!isNarrationLanguage(next) || next === narrationLanguage) return
    const video = videoRef.current
    // A second selection can arrive before the replacement video has metadata.
    // Keep the previous snapshot in that case instead of resetting to time zero.
    if (video && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      setPlayback({
        time: video.currentTime,
        playing: !video.paused && !video.ended,
        muted: video.muted,
        volume: video.volume,
        rate: video.playbackRate,
        captions: video.textTracks[0]?.mode === 'showing',
      })
    }
    video?.pause()
    setFailed(false)
    setPreference(next)
    try {
      localStorage.setItem(NARRATION_STORAGE_KEY, next)
    } catch {
      // Selection still works when browser storage is unavailable.
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={selectorId} className="text-sm font-semibold text-ink">
          {upgradeText(language, 'demoNarrationLanguage')}
        </label>
        <select
          id={selectorId}
          className="min-h-11 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron-deep"
          value={narrationLanguage}
          onChange={event => changeNarration(event.target.value)}
          data-i18n-skip="true"
          translate="no"
        >
          {NARRATION_LANGUAGES.map(option => (
            <option key={option} value={option} lang={option}>{NARRATION_LANGUAGE_LABELS[option]}</option>
          ))}
        </select>
      </div>
      <video
        key={narrationLanguage}
        ref={videoRef}
        className="mx-auto max-h-[65dvh] w-full rounded-xl border border-hairline bg-black"
        src={demo.src}
        poster={demo.poster}
        controls
        playsInline
        autoPlay={playback?.playing ?? true}
        preload="metadata"
        aria-label={upgradeText(language, 'watchFeatureDemo', { feature: upgradeText(language, feature) })}
        onError={() => setFailed(true)}
        onLoadedMetadata={event => {
          if (!playback) return
          const video = event.currentTarget
          video.currentTime = Math.min(playback.time, video.duration)
          video.muted = playback.muted
          video.volume = playback.volume
          video.playbackRate = playback.rate
          if (video.textTracks[0]) video.textTracks[0].mode = playback.captions ? 'showing' : 'disabled'
          if (playback.playing) void video.play().catch(() => { /* Native controls remain available if autoplay is blocked. */ })
        }}
      >
        <track kind="captions" src={demo.captions} srcLang={narrationLanguage} label={NARRATION_LANGUAGE_LABELS[narrationLanguage]} />
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
        <span>{upgradeText(language, 'demoHelp', { language: NARRATION_LANGUAGE_LABELS[narrationLanguage] })}</span>
        <a href={demo.transcript} target="_blank" rel="noopener noreferrer" className="font-semibold text-saffron-deep underline underline-offset-2">
          {upgradeText(language, 'demoTranscript')}
        </a>
      </div>
      {narrationLanguage !== 'en' && <p className="text-xs text-subtle">{upgradeText(language, 'demoScreenLanguage')}</p>}
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
