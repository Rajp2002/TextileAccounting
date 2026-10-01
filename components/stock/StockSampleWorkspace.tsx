'use client'

import { useMemo } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import type { FabricStockTourStep, StockTourKind, StockTourStep, YarnStockTourStep } from '@/lib/stock-tour'
import { fabricStockPhase, fabricStockSample, yarnStockPhase, yarnStockSample } from '@/lib/tours/sample-data/stock'
import QualityStockClient from '@/app/(dashboard)/owner/stock/QualityStockClient'
import YarnStockClient from '@/app/(dashboard)/owner/stock/YarnStockClient'

/**
 * The real Fabric Stock or Yarn Stock page fed sample stock. The board follows the story the steps tell (before the
 * opening balance, after it, after a correction), and the real dialogs open from the tour context.
 */
export default function StockSampleWorkspace({ kind, step }: { kind: StockTourKind; step: StockTourStep }) {
    const { language } = useTranslation()
    const fabric = useMemo(() => kind === 'fabric-stock' ? fabricStockSample(language, fabricStockPhase(step as FabricStockTourStep)) : null, [kind, language, step])
    const yarnPhase = kind === 'yarn-stock' ? yarnStockPhase(step as YarnStockTourStep) : null
    const yarn = useMemo(() => yarnPhase ? yarnStockSample(language, yarnPhase, step !== 'ys-link') : null, [yarnPhase, language, step])
    // The yarn page copies its data into state once, so a new phase of the story remounts it.
    return fabric ? <QualityStockClient initialData={fabric} /> : yarn ? <YarnStockClient key={`${yarnPhase}:${step === 'ys-link'}`} initialData={yarn} /> : null
}
