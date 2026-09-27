import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const client = readFileSync(join(process.cwd(), 'app/(dashboard)/owner/quotes/QuotesClient.tsx'), 'utf8')

describe('Saved Costings plan-specific panels', () => {
    it('shows the costing breakdown on every plan and no production-usage panel', () => {
        const breakdownPanel = '<section className="rounded-xl border border-slate-200 bg-white p-4">\n                                                <div className="flex flex-wrap items-start justify-between gap-3">'

        expect(client).toContain('<p className="text-sm font-black text-slate-950">{tx(\'Latest Saved Costing breakdown\')}</p>')
        expect(client).toContain(breakdownPanel)
        expect(client).not.toContain(`{canUseProduction && ${breakdownPanel}`)
        // Phase 3H removed the Full Suite "Applied production" panel.
        expect(client).not.toContain('Applied production')
        expect(client).not.toMatch(/\bcanUseProduction\b/)
    })
})
