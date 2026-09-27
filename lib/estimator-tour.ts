import type { TutorialField } from './i18n/cost-estimate-tutorial'

export type EstimatorTourContext = {
    freePlan: boolean
    existingCosting: boolean
    productionPipeline: boolean
    overheadMode: 'direct' | 'monthly_expenses'
}

export function buildEstimatorCoreTour(context: EstimatorTourContext) {
    const saveCopy = context.freePlan ? 'saveFree'
        : context.existingCosting ? 'saveVersion' : 'saveCosting'
    return [
        { field: 'liveCostShortcut', copy: 'purpose' },
        { field: context.freePlan ? 'qualityLabel' : 'savedQualityPicker', copy: context.freePlan ? 'qualityFree' : 'quality' },
        { field: 'warpComponentCount', copy: 'warp' },
        { field: 'weftComponentCount', copy: 'weft' },
        { field: 'weavingRateMode', copy: 'manufacturing' },
        { field: context.overheadMode === 'direct' ? 'overheadOverridePerM' : 'monthlyOverhead', copy: context.overheadMode === 'direct' ? 'overheadDirect' : 'overheadMonthly' },
        { field: 'liveCostMetrics', copy: context.freePlan ? 'reviewFree' : 'review' },
        { field: 'liveCostActions', copy: saveCopy },
        ...context.freePlan ? [] : [{ field: 'liveCostActions', copy: 'recipe' } as const],
        { field: context.freePlan ? 'qualityLabel' : 'savedQualities', copy: !context.freePlan && context.productionPipeline ? 'nextProduction' : 'next' },
    ] as const satisfies ReadonlyArray<{ field: TutorialField; copy: string }>
}

export type EstimatorCoreCopyKey = ReturnType<typeof buildEstimatorCoreTour>[number]['copy']
