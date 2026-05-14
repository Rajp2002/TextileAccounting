export const PRODUCTION_MODES = ['market_run', 'order_based', 'both'] as const

export type ProductionMode = (typeof PRODUCTION_MODES)[number]

export type WorkflowKey =
    | 'estimator'
    | 'quotes'
    | 'orders'
    | 'marketRuns'
    | 'productionLogging'
    | 'stock'
    | 'dispatches'
    | 'commercials'
    | 'payroll'
    | 'ownerAnalytics'
    | 'workers'
    | 'advances'
    | 'looms'
    | 'settings'
    | 'billing'

export const DEFAULT_PRODUCTION_MODE: ProductionMode = 'market_run'

export const PRODUCTION_MODE_OPTIONS: Array<{
    value: ProductionMode
    label: string
    settingsLabel: string
    description: string
}> = [
    {
        value: 'market_run',
        label: 'Market Run Production',
        settingsLabel: 'Market Run only',
        description: 'We produce fabric first, store it in stock, and sell/dispatch later.',
    },
    {
        value: 'order_based',
        label: 'Order-Based Production',
        settingsLabel: 'Order-Based only',
        description: 'We produce fabric against confirmed customer orders or job requirements.',
    },
    {
        value: 'both',
        label: 'Both',
        settingsLabel: 'Both',
        description: 'We handle both market runs and customer-specific orders.',
    },
]

export const workflowVisibility: Record<ProductionMode, Record<WorkflowKey, boolean>> = {
    market_run: {
        estimator: false,
        quotes: false,
        orders: false,
        marketRuns: true,
        productionLogging: true,
        stock: true,
        dispatches: true,
        commercials: true,
        payroll: true,
        ownerAnalytics: true,
        workers: true,
        advances: true,
        looms: true,
        settings: true,
        billing: true,
    },
    order_based: {
        estimator: true,
        quotes: true,
        orders: true,
        marketRuns: false,
        productionLogging: true,
        stock: true,
        dispatches: true,
        commercials: true,
        payroll: true,
        ownerAnalytics: true,
        workers: true,
        advances: true,
        looms: true,
        settings: true,
        billing: true,
    },
    both: {
        estimator: true,
        quotes: true,
        orders: true,
        marketRuns: true,
        productionLogging: true,
        stock: true,
        dispatches: true,
        commercials: true,
        payroll: true,
        ownerAnalytics: true,
        workers: true,
        advances: true,
        looms: true,
        settings: true,
        billing: true,
    },
}

export function normalizeProductionMode(mode: unknown): ProductionMode {
    return PRODUCTION_MODES.includes(mode as ProductionMode)
        ? (mode as ProductionMode)
        : DEFAULT_PRODUCTION_MODE
}

export function hasExplicitProductionMode(mode: unknown): mode is ProductionMode {
    return PRODUCTION_MODES.includes(mode as ProductionMode)
}

export function getWorkflowVisibility(mode: unknown) {
    return workflowVisibility[normalizeProductionMode(mode)]
}

export function isWorkflowVisible(mode: unknown, workflow: WorkflowKey) {
    return getWorkflowVisibility(mode)[workflow]
}

export function getProductionModeOption(mode: unknown) {
    const normalized = normalizeProductionMode(mode)
    return PRODUCTION_MODE_OPTIONS.find((option) => option.value === normalized) ?? PRODUCTION_MODE_OPTIONS[0]
}
