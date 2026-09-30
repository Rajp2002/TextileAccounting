'use client'
import type { FabricStockTourStep, StockTourKind, StockTourStep } from '@/lib/stock-tour'
import YarnStockTourPreview from './YarnStockTourPreview'
import FabricStockTourPreview from './FabricStockTourPreview'
export default function StockTourPreview({ kind, step }: { kind: StockTourKind; step: StockTourStep }) {
    return kind === 'fabric-stock' ? <FabricStockTourPreview step={step as FabricStockTourStep} /> : <YarnStockTourPreview step={step} />
}
