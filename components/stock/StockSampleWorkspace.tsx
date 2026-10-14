'use client'

import { useMemo } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { FabricStockTourStep } from '@/lib/stock-tour'
import { fabricStockPhase, fabricStockSample } from '@/lib/tours/sample-data/stock'
import QualityStockClient from '@/app/(dashboard)/owner/stock/QualityStockClient'

/**
 * The real Fabric Stock page fed sample stock. The board follows the story the steps tell (before the opening
 * balance, after it, after a correction), and the real dialogs open from the tour context.
 */
export default function StockSampleWorkspace({ step }: { step: FabricStockTourStep }) {
    const { language } = useTranslation()
    const fabric = useMemo(() => fabricStockSample(language, fabricStockPhase(step)), [language, step])
    return <QualityStockClient initialData={fabric} />
}
