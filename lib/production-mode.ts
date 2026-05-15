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
    | 'archive'

export const DEFAULT_PRODUCTION_MODE: ProductionMode = 'market_run'

export function isMarketRunOnlyMode(mode: unknown) {
    return normalizeProductionMode(mode) === 'market_run'
}

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
        archive: true,
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
        archive: true,
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
        archive: true,
    },
}

export function normalizeProductionMode(mode: unknown): ProductionMode {
    return PRODUCTION_MODES.includes(mode as ProductionMode)
        ? (mode as ProductionMode)
        : DEFAULT_PRODUCTION_MODE
}

type MaybeSupabaseError = {
    code?: string
    message?: string
}

type ProductionModeQueryClient = {
    from: (table: 'organizations') => {
        select: (columns: string) => {
            eq: (column: string, value: string) => {
                maybeSingle: () => PromiseLike<{
                    data: { production_mode?: string | null } | null
                    error: MaybeSupabaseError | null
                }>
            }
        }
    }
}

function isMissingProductionModeColumn(error: MaybeSupabaseError | null | undefined) {
    return error?.code === '42703'
        || error?.code === 'PGRST204'
        || /production_mode/i.test(error?.message ?? '') && /does not exist|schema cache|could not find/i.test(error?.message ?? '')
}

export async function getOrganizationProductionMode(
    supabase: unknown,
    orgId: string
): Promise<{ productionMode: ProductionMode; error: MaybeSupabaseError | null }> {
    const client = supabase as ProductionModeQueryClient
    const { data, error } = await client
        .from('organizations')
        .select('production_mode')
        .eq('id', orgId)
        .maybeSingle()

    if (isMissingProductionModeColumn(error)) {
        return { productionMode: DEFAULT_PRODUCTION_MODE, error: null }
    }

    return {
        productionMode: normalizeProductionMode(data?.production_mode),
        error,
    }
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
