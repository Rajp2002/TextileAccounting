'use client'

import { useMemo } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { productionSampleData } from '@/lib/tours/sample-data/production'
import BaseProductionClient from '@/app/(dashboard)/owner/production/BaseProductionClient'

/** The real Production page fed sample data. The tour context tells its real dialogs which step to open. */
export default function ProductionSampleWorkspace() {
    const { language } = useTranslation()
    const initialData = useMemo(() => productionSampleData(language), [language])
    return <BaseProductionClient initialData={initialData} view="production" />
}
