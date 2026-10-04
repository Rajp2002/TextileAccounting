// Vite-only DAL alias: loopback synthetic DTOs, never product authentication.
import type * as Factories from '../../../lib/admin/factories'
import type * as Payments from '../../../lib/admin/payments'
import type * as Overview from '../../../lib/admin/overview'
import type * as System from '../../../lib/admin/system'
import type * as Audit from '../../../lib/admin/audit'
async function read<T>(path: string, input: unknown = {}): Promise<T> {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) if (value !== undefined) query.set(key, String(value))
    const scenario = new URLSearchParams(window.location.search).get('scenario')
    if (scenario) query.set('scenario', scenario)
    const response = await fetch(`/__admin_fixture__/${path}?${query}`, { cache: 'no-store', credentials: 'omit' })
    if (!response.ok) throw new Error('Synthetic source unavailable')
    return response.json() as Promise<T>
}
export const listFactories: typeof Factories.listFactories = input => read('factories', input)
export const getFactoryDetail: typeof Factories.getFactoryDetail = orgId => read('factory-detail', { orgId })
export const getFactorySummary: typeof Factories.getFactorySummary = () => read('factory-summary')
export const getPaymentsReport: typeof Payments.getPaymentsReport = input => read('payments', input)
export const getAdminOverview: typeof Overview.getAdminOverview = () => read('overview')
export const getAdminSystem: typeof System.getAdminSystem = () => read('system')
export const getAdminAudit: typeof Audit.getAdminAudit = input => read('audit', input)
