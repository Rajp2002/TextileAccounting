'use client'

import { useMemo } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { productionSampleData } from '@/lib/tours/sample-data/production'
import BaseProductionClient from '@/app/(dashboard)/owner/production/BaseProductionClient'

/** The real Daily Sheet page fed sample data. Its readings, draft state and dialogs follow the tour step. */
export default function DailySheetSampleWorkspace() {
    const { language } = useTranslation()
    const initialData = useMemo(() => productionSampleData(language, 'daily'), [language])
    return <BaseProductionClient initialData={initialData} view="production" />
}
