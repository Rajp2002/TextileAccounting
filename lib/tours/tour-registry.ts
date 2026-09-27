import type { TourDefinition, TourId } from './tour-types'

export const TOUR_REGISTRY: Record<TourId, TourDefinition> = {
    'yarn-stock': {
        id: 'yarn-stock', contentVersion: 'v1', invitationPolicyVersion: 'v1',
        allowedPlans: ['base'], allowedRoles: ['owner'],
        copyKeys: { benefit: 'yarnStockBenefit', replayTitle: 'replayYarnStock' },
    },
    'fabric-stock': {
        id: 'fabric-stock', contentVersion: 'v1', invitationPolicyVersion: 'v1',
        allowedPlans: ['base'], allowedRoles: ['owner'],
        copyKeys: { benefit: 'fabricStockBenefit', replayTitle: 'replayFabricStock' },
    },
    dispatch: {
        id: 'dispatch', contentVersion: 'v1', invitationPolicyVersion: 'v1',
        allowedPlans: ['base'], allowedRoles: ['owner'],
        copyKeys: { benefit: 'dispatchBenefit', replayTitle: 'replayDispatch' },
    },
    'daily-sheet': {
        id: 'daily-sheet', contentVersion: 'v1', invitationPolicyVersion: 'v1',
        allowedPlans: ['base'], allowedRoles: ['owner'],
        copyKeys: { benefit: 'dailySheetBenefit', replayTitle: 'replayDailySheet' },
    },
    production: {
        id: 'production', contentVersion: 'v1', invitationPolicyVersion: 'v1',
        allowedPlans: ['base'], allowedRoles: ['owner'],
        copyKeys: { benefit: 'productionBenefit', replayTitle: 'replayProduction' },
    },
    payroll: {
        id: 'payroll', contentVersion: 'v1', invitationPolicyVersion: 'v1',
        allowedPlans: ['base'], allowedRoles: ['owner'],
        copyKeys: { benefit: 'payrollBenefit', replayTitle: 'replayPayroll' },
    },
    machines: {
        id: 'machines', contentVersion: 'v1', invitationPolicyVersion: 'v1',
        allowedPlans: ['base'], allowedRoles: ['owner'],
        copyKeys: { benefit: 'machinesBenefit', replayTitle: 'replayMachines' },
    },
    workers: {
        id: 'workers', contentVersion: 'v1', invitationPolicyVersion: 'v1',
        allowedPlans: ['base'], allowedRoles: ['owner'],
        copyKeys: { benefit: 'workersBenefit', replayTitle: 'replayWorkers' },
    },
    configuration: {
        id: 'configuration', contentVersion: 'v1', invitationPolicyVersion: 'v1',
        allowedPlans: ['base'], allowedRoles: ['owner'],
        copyKeys: { benefit: 'configurationBenefit', replayTitle: 'replayConfiguration' },
    },
    'cost-estimate': {
        id: 'cost-estimate',
        contentVersion: 'v1',
        invitationPolicyVersion: 'v1',
        allowedPlans: ['free', 'lite', 'base'],
        allowedRoles: ['owner'],
        copyKeys: {
            benefit: 'estimatorBenefit',
            replayTitle: 'replayEstimator',
        },
    },
    'rate-book': {
        id: 'rate-book',
        contentVersion: 'v1',
        invitationPolicyVersion: 'v1',
        allowedPlans: ['lite', 'base'],
        allowedRoles: ['owner'],
        copyKeys: {
            benefit: 'rateBookBenefit',
            replayTitle: 'replayRateBook',
        },
    },
    'saved-costings': {
        id: 'saved-costings',
        contentVersion: 'v1',
        invitationPolicyVersion: 'v1',
        allowedPlans: ['free', 'lite', 'base'],
        allowedRoles: ['owner'],
        copyKeys: {
            benefit: 'savedCostingsBenefit',
            replayTitle: 'replaySavedCostings',
        },
    },
}

export const tourRegistry = TOUR_REGISTRY
export const supportedTours: TourId[] = ['cost-estimate', 'rate-book', 'saved-costings', 'configuration', 'workers', 'machines', 'payroll', 'production', 'fabric-stock', 'yarn-stock', 'dispatch', 'daily-sheet']

export function getTourDefinition(tourId: TourId): TourDefinition {
    return TOUR_REGISTRY[tourId]
}

export function isTourEligible(tourId: TourId, planTier?: string, role?: string): boolean {
    const def = TOUR_REGISTRY[tourId]
    if (!def) return false
    if (role && !def.allowedRoles.includes(role)) return false
    if (planTier && !def.allowedPlans.includes(planTier as TourDefinition['allowedPlans'][number])) return false
    return true
}
