export type BaseProductionNavigation = {
    date?: string
    shift?: 'day' | 'night'
    entry?: string
    worker?: string
    job?: string
    tab?: 'production' | 'jobs'
    returnTo?: string
}

export function validBaseDate(value: string | null | undefined): value is string {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function safeBaseReturnPath(value: string | null | undefined) {
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return undefined
    const path = value.split('?')[0]
    return ['/owner/production', '/owner/payroll', '/owner/operations'].includes(path) ? value : undefined
}

export function readBaseProductionNavigation(params: Pick<URLSearchParams, 'get'>): BaseProductionNavigation {
    const id = (key: string) => {
        const value = params.get(key)
        return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : undefined
    }
    const date = params.get('date')
    return {
        date: validBaseDate(date) ? date : undefined,
        shift: params.get('shift') === 'night' ? 'night' : params.get('shift') === 'day' ? 'day' : undefined,
        entry: id('entry'), worker: id('worker'), job: id('job'),
        tab: params.get('tab') === 'jobs' ? 'jobs' : undefined,
        returnTo: safeBaseReturnPath(params.get('returnTo')),
    }
}

export function baseProductionHref(context: BaseProductionNavigation) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(context)) if (value) params.set(key, value)
    return `/owner/production${params.size ? `?${params}` : ''}`
}
