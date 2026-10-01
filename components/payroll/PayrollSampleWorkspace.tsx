'use client'

import { useMemo } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { payrollSampleData } from '@/lib/tours/sample-data/production'
import BaseProductionClient from '@/app/(dashboard)/owner/production/BaseProductionClient'

/** The real Payroll page fed sample data. Its settlement, payment, advance and records surfaces follow the tour step. */
export default function PayrollSampleWorkspace() {
    const { language } = useTranslation()
    const initialData = useMemo(() => payrollSampleData(language), [language])
    return <BaseProductionClient initialData={initialData} view="payroll" />
}
