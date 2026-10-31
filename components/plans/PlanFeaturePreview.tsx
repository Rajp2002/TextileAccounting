'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowUpRight, Play } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LiquidSegmented } from '@/components/ui/liquid-segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FEATURE_DEMOS } from '@/lib/feature-demos'
import { useTranslation } from '@/lib/i18n/context'
import { freeMobileEntryText } from '@/lib/i18n/free-mobile-entry'
import { planSelectionText } from '@/lib/i18n/plan-selection'
import { upgradeText, type UpgradeFeature, type UpgradePlan } from '@/lib/upgrade-wall'
import { cn } from '@/lib/utils'
import styles from './plan-selection.module.css'

interface PlanFeaturePreviewProps {
  planTier: UpgradePlan
  features: readonly UpgradeFeature[]
  onOpenPreview: (feature: UpgradeFeature, tier: UpgradePlan, trigger?: HTMLElement) => void
}

export function PlanFeaturePreview({ planTier, features, onOpenPreview }: PlanFeaturePreviewProps) {
  const { language } = useTranslation()
  const [activeFeature, setActiveFeature] = useState<UpgradeFeature>(features[0])

  return (
    <Tabs value={activeFeature} onValueChange={value => setActiveFeature(value as UpgradeFeature)} className="min-h-0 flex-1 gap-2">
      <div className="shrink-0 md:hidden">
        <Select value={activeFeature} onValueChange={value => setActiveFeature(value as UpgradeFeature)}>
          <SelectTrigger aria-label={freeMobileEntryText(language, 'previewFeatures')} className="min-h-[44px] w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{features.map(feature => <SelectItem key={feature} value={feature} className="min-h-[44px]">{upgradeText(language, feature)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {features.length <= 4 ? (
        <LiquidSegmented
          role="tablist"
          size="sm"
          fullWidth
          aria-label={`${planTier} · ${freeMobileEntryText(language, 'previewFeatures')}`}
          value={activeFeature}
          onValueChange={setActiveFeature}
          className="hidden shrink-0 md:grid"
          optionClassName="min-h-11 px-2 text-sm"
          options={features.map(feature => ({ value: feature, label: upgradeText(language, feature) }))}
        />
      ) : (
        <TabsList
          aria-label={`${planTier} · ${freeMobileEntryText(language, 'previewFeatures')}`}
          className={cn('hidden h-auto w-full shrink-0 gap-1 rounded-lg border-0 bg-surface-soft p-1 group-data-[orientation=horizontal]/tabs:h-auto md:grid', features.length > 4 ? 'grid-cols-3' : features.length > 2 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2')}
        >
          {features.map(feature => (
            <TabsTrigger key={feature} value={feature} className="h-auto min-h-[44px] whitespace-normal px-2 py-2 text-sm leading-snug shadow-none transition-colors duration-150 data-[state=active]:shadow-xs motion-reduce:transition-none">
              {upgradeText(language, feature)}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      {features.map(feature => {
        const featureName = upgradeText(language, feature)
        return (
          <TabsContent key={feature} value={feature} className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
            <button
              type="button"
              onClick={event => onOpenPreview(feature, planTier, event.currentTarget)}
              aria-label={upgradeText(language, 'watchFeatureDemo', { feature: featureName })}
              className={cn(styles.previewButton, 'group flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-hairline bg-surface text-left transition-colors duration-150 hover:border-hairline-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-saffron-deep motion-reduce:transition-none')}
            >
              <span className={cn(styles.previewPoster, 'flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-surface-soft')}>
                <Image
                  src={FEATURE_DEMOS[feature].poster}
                  alt={upgradeText(language, 'picture', { feature: featureName })}
                  width={FEATURE_DEMOS[feature].posterSize[0]}
                  height={FEATURE_DEMOS[feature].posterSize[1]}
                  sizes="(min-width: 1280px) 460px, (min-width: 768px) 45vw, 90vw"
                  className="h-full min-h-0 w-full object-contain"
                />
              </span>
              <span className="flex min-h-[44px] shrink-0 items-center justify-between gap-3 border-t border-hairline px-3 py-2 text-sm font-semibold text-ink group-hover:bg-surface-soft">
                <span className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-surface">
                    <Play className="size-3 fill-current" aria-hidden="true" />
                  </span>
                  {featureName}
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-subtle" aria-hidden="true" />
              </span>
            </button>
            <p className={styles.previewDescription}>{planSelectionText(language, `${feature}Description`)}</p>
          </TabsContent>
        )
      })}
    </Tabs>
  )
}
