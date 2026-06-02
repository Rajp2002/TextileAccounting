import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('P1 production and dispatch regressions', () => {
    it('surfaces structured production validation messages to supervisors', () => {
        const page = readProjectFile('app/(dashboard)/supervisor/dashboard/page.tsx')
        expect(page).toContain('res?.message || res?.error')
        expect(page).toContain('toast.error(error.message')
        expect(page).not.toContain("toast.error('Could not save production log. Your entry is still saved as a draft. Check your connection and try again.')")
    })

    it('refreshes payroll caches after shift meters are saved', () => {
        const page = readProjectFile('app/(dashboard)/supervisor/dashboard/page.tsx')
        const action = readProjectFile('app/(dashboard)/supervisor/actions.ts')

        expect(page).toContain("invalidateQueries({ queryKey: ['payroll_meter'] })")
        expect(action).toContain("revalidatePath('/owner/payroll')")
    })

    it('keeps factory today on the factory timezone calendar day', () => {
        const action = readProjectFile('app/(dashboard)/owner/today/actions.ts')

        expect(action).toContain('getSuratTodayString')
        expect(action).not.toContain("const today = new Date().toISOString().split('T')[0]")
    })

    it('forces payroll production data to refetch instead of trusting persisted stale rows', () => {
        const page = readProjectFile('app/(dashboard)/owner/payroll/page.tsx')

        expect(page).toContain('PAYROLL_QUERY_VERSION')
        expect(page).toContain("refetchOnMount: 'always'")
        expect(page).toContain("table: 'production_logs'")
    })

    it('keeps third-party dispatch verification deferred', () => {
        const action = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        const dispatchModal = readProjectFile('components/dispatches/DispatchModals.tsx')
        const ordersClient = readProjectFile('app/(dashboard)/owner/orders/OrdersClient.tsx')
        const dispatchesClient = readProjectFile('app/(dashboard)/owner/dispatches/DispatchesClient.tsx')
        const stockClient = readProjectFile('app/(dashboard)/owner/stock/StockClient.tsx')
        const proxy = readProjectFile('proxy.ts')
        const trackingPage = readProjectFile('app/(public)/track/[token]/page.tsx')
        const activeDispatchClients = [dispatchModal, ordersClient, dispatchesClient, stockClient].join('\n')

        expect(action).toContain('trackingUrl: null')
        expect(action).not.toContain('`/track/${dispatchMeta.tracking_token}`')
        expect(existsSync(join(root, 'lib/generate-challan.ts'))).toBe(false)
        expect(dispatchModal).toContain('Challan Number')
        expect(dispatchModal).toContain('Create Dispatch')
        expect(activeDispatchClients).not.toContain('generateChallan')
        expect(activeDispatchClients).not.toContain('Failed to generate invoice PDF')
        expect(activeDispatchClients).not.toContain('Create & Download Invoice')
        expect(activeDispatchClients).not.toContain('Re-print Invoice')
        expect(proxy).not.toContain("pathname.startsWith('/track')")
        expect(trackingPage).toContain('notFound()')
    })

    it('keeps dispatches page usable when stock discrepancy migration is pending', () => {
        const action = readProjectFile('app/(dashboard)/owner/orders/actions.ts')
        expect(action).toContain('isMissingStockDiscrepanciesTable')
        expect(action).toContain("error?.code === '42P01'")
        expect(action).toContain("error?.code === 'PGRST205'")
        expect(action).toContain('const discrepancies = discrepanciesRes.error ? []')
    })
})
