'use client'

import { useTranslation } from '@/lib/i18n/context'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { useTourSample } from '@/lib/tours/sample-context'

/** "Sample: nothing here is saved or sent." Renders only while a real page is showing tour sample data. */
export function TourSampleBanner() {
    const sample = useTourSample()
    const { language } = useTranslation()
    if (!sample) return null
    return <p data-tour-sample-banner="true" data-i18n-skip="true" lang={language}
        className="rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm font-semibold text-ink">{tourCommonCopy[language].sampleBanner}</p>
}
