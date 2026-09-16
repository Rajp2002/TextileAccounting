export type BaseProductionNavigation = {
    date?: string
    shift?: 'day' | 'night'
    entry?: string
    machine?: string
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
    if (!value || /[\\#\r\n]/.test(value)) return undefined
    const [path, query = ''] = value.split('?')
    if (!['/owner/production', '/owner/payroll', '/owner/assignments', '/owner/workers', '/owner/machines', '/owner/operations', '/owner/setup'].includes(path)) return undefined
    const params = new URLSearchParams(query)
    const safe = new URLSearchParams()
    for (const key of ['worker', 'machine', 'job', 'entry']) {
        const id = params.get(key)
        if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) safe.set(key, id)
    }
    if (validBaseDate(params.get('date'))) safe.set('date', params.get('date')!)
    if (params.get('shift') === 'day' || params.get('shift') === 'night') safe.set('shift', params.get('shift')!)
    if (params.get('tab') === 'jobs') safe.set('tab', 'jobs')
    if (params.get('register') === 'base') safe.set('register', 'base')
    if (path === '/owner/setup' && params.get('section') === 'machines') safe.set('register', 'base')
    const canonical = path === '/owner/operations' ? '/owner/assignments' : path === '/owner/setup' ? params.get('section') === 'machines' ? '/owner/machines' : '/owner/workers' : path
    return `${canonical}${safe.size ? `?${safe}` : ''}`
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
        entry: id('entry'), machine: id('machine'), worker: id('worker'), job: id('job'),
        tab: params.get('tab') === 'jobs' ? 'jobs' : params.get('tab') === 'production' ? 'production' : undefined,
        returnTo: safeBaseReturnPath(params.get('returnTo')),
    }
}

export function baseProductionHref(context: BaseProductionNavigation) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(context)) if (value) params.set(key, value)
    return `/owner/production${params.size ? `?${params}` : ''}`
}
