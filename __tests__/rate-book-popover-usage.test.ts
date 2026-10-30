import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getCostRateDisplayNotes, getCostRateDisplaySource, type CostRateRow } from '../lib/cost-rates'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Rate Book P2: Linked Qualities on each yarn card in RatesClient.tsx', () => {
    const client = read('app/(dashboard)/owner/rates/RatesClient.tsx')

    describe('One fitted line and the modal it opens', () => {
        const usage = client.slice(client.indexOf('function YarnUsageDialog('), client.indexOf('function PriceChange('))

        it('replaces the popover with a modal listing every quality', () => {
            expect(client).not.toContain("from '@/components/ui/popover'")
            expect(client).not.toContain('function LinkedQualitiesPopover(')
            expect(client).toContain('function YarnUsageDialog(')
            expect(client).toContain('function YarnUsage(')
            expect(usage).toContain('<DialogContent data-ratebook-field="yarnUsageDialog"')
            expect(usage).toContain('usageNames.map((name, index) => (')
            expect(usage).toContain('max-h-[50vh]')
        })

        it('fits as many names as the line holds, then +N more, measured on resize', () => {
            expect(usage).toContain('function fittingNameCount(available: number, measure: HTMLElement)')
            expect(usage).toContain('setShown(fittingNameCount(line.clientWidth, measure))')
            expect(usage).toContain('new ResizeObserver(fit)')
            expect(usage).toContain('usageNames.slice(0, visible).join(\', \')')
            expect(usage).toContain('fillCopy(copy.moreNames, { n: rest })')
            expect(usage).toContain('min-w-0 truncate font-medium text-ink')
            expect(client).toContain('<div data-ratebook-field="linkedQualitiesPopover"><YarnUsage rate={rate} loading={usageLoading} copy={copy} /></div>')
        })

        it('opens the modal from the whole line only when names are cut', () => {
            expect(usage).toContain('{rest > 0 ? (')
            expect(usage).toContain('onClick={() => setOpen(true)}')
            expect(usage).toContain('aria-label={fillCopy(copy.usageAll, { n: usageNames.length, name: rate.name })}')
            expect(usage).toContain('underline decoration-hairline-strong underline-offset-4')
            expect(usage).not.toContain('bg-saffron')
        })

        it('uses translated copy for the modal, with source and notes when recorded', () => {
            expect(usage).toContain('{copy.sourceLabel}:</span> {rate.source}')
            expect(usage).toContain('{copy.notesLabel}:</span> {rate.notes}')
            expect(usage).toContain('{copy.usageNote}')
            expect(usage).not.toContain('Future estimates for these fabrics will use this rate.')
        })
    })

    describe('Fallback for Unassigned Yarns (No Linked Usages)', () => {
        it('says the yarn is not used yet, with the owner-recorded source, without a popover', () => {
            const usage = client.slice(client.indexOf('function YarnUsage('), client.indexOf('function PriceChange('))
            expect(usage).toContain('const ownSource = rate.discovery_source ? null : rate.source?.trim()')
            expect(usage).toContain('{loading ? copy.usageLoading : copy.notUsed}')
        })
    })

    describe('Cleanup Verification (Modal Elimination)', () => {
        it('completely removes SavedQualityUsageDialog and usageRate state', () => {
            expect(client).not.toContain('SavedQualityUsageDialog')
            expect(client).not.toContain('const [usageRate, setUsageRate]')
            expect(client).not.toContain('usageRate')
            // Old 640px modal container must be gone
            expect(client).not.toContain('sm:max-w-[640px]')
            // Old View X linked records button must be gone
            expect(client).not.toContain('View {usageNames.length} linked')
        })
    })

    describe('Data Logic & Source Resolution', () => {
        it('resolves source attribution correctly for discovery source and custom source', () => {
            const manualRate = {
                source: 'Surat Yarn Market',
                discovery_source: null,
            } as Pick<CostRateRow, 'source' | 'discovery_source'>
            expect(getCostRateDisplaySource(manualRate)).toBe('Surat Yarn Market')

            const costingRate = {
                source: null,
                discovery_source: 'saved_costing',
            } as Pick<CostRateRow, 'source' | 'discovery_source'>
            expect(getCostRateDisplaySource(costingRate)).toBe('Saved costing')
        })

        it('resolves notes correctly when fabric names are present or empty', () => {
            const withFabrics = {
                notes: 'Custom notes',
                fabric_names: ['54" Roto Satin', '44" Twill'],
            } as Pick<CostRateRow, 'notes' | 'fabric_names'>
            expect(getCostRateDisplayNotes(withFabrics)).toContain('54" Roto Satin')

            const withoutFabrics = {
                notes: 'Direct mill pricing',
                fabric_names: [],
            } as Pick<CostRateRow, 'notes' | 'fabric_names'>
            expect(getCostRateDisplayNotes(withoutFabrics)).toBe('Direct mill pricing')
        })
    })
})
