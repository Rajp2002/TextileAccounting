import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const guard = vi.hoisted(() => vi.fn())
const readers = vi.hoisted(() => ({
    getGrievances: vi.fn(), getNoticeRegistry: vi.fn(), getExportLogs: vi.fn(),
    getDpaTemplates: vi.fn(), getFactoryDpaStatus: vi.fn(), getBreachReports: vi.fn(), getSecurityIncidents: vi.fn(),
}))
vi.mock('@/lib/admin/founder', () => ({ requireFounderPage: guard }))
vi.mock('@/lib/actions/compliance', () => readers)
vi.mock('@/lib/sign-in-telemetry.server', () => ({ createSignInServerTimerFromCookie: async () => ({ measure: async (_stage: string, load: () => Promise<unknown>) => load(), log: () => undefined }) }))
import LegacyPage from '@/app/(admin-console)/admin/legacy/page'

beforeEach(() => {
    vi.resetAllMocks()
    guard.mockResolvedValue({ userId: 'synthetic-founder' })
    Object.values(readers).forEach(reader => reader.mockResolvedValue([{ id: 'synthetic', description: 'Private record content' }]))
    vi.stubEnv('WEAVLY_ADMIN_LEGACY_READS_ENABLED', '')
    vi.stubEnv('WEAVLY_ADMIN_LEGACY_OPERATIONS_ENABLED', '')
})
afterEach(() => vi.unstubAllEnvs())

describe('retained formal fallback gates', () => {
    it('default closed gate does not query any legacy source', async () => {
        const html = renderToStaticMarkup(await LegacyPage())
        expect(guard).toHaveBeenCalledOnce()
        Object.values(readers).forEach(reader => expect(reader).not.toHaveBeenCalled())
        expect(html).toContain('Fallback access is awaiting review')
    })
    it('enabled read gate still verifies founder before all source reads', async () => {
        vi.stubEnv('WEAVLY_ADMIN_LEGACY_READS_ENABLED', 'true')
        guard.mockRejectedValueOnce(new Error('Founder denied'))
        await expect(LegacyPage()).rejects.toThrow('Founder denied')
        Object.values(readers).forEach(reader => expect(reader).not.toHaveBeenCalled())
    })
    it.each(['', 'true'])('read inventory has no mutation/export controls regardless of operation flag %s', async (operationFlag) => {
        vi.stubEnv('WEAVLY_ADMIN_LEGACY_READS_ENABLED', 'true')
        vi.stubEnv('WEAVLY_ADMIN_LEGACY_OPERATIONS_ENABLED', operationFlag)
        const html = renderToStaticMarkup(await LegacyPage())
        expect(readers.getSecurityIncidents).toHaveBeenCalledOnce()
        expect(html).toContain('Security incident records')
        expect(html).not.toContain('Private record content')
        expect(html).not.toContain('<form')
        expect(html).not.toContain('<button')
        expect(html).not.toContain('Operational</')
    })
    it('missing source is unavailable rather than zero/healthy', async () => {
        vi.stubEnv('WEAVLY_ADMIN_LEGACY_READS_ENABLED', 'true')
        readers.getSecurityIncidents.mockResolvedValueOnce(null)
        const html = renderToStaticMarkup(await LegacyPage())
        expect(html).toContain('Unavailable')
        expect(html).not.toContain('Operational</')
    })
})
