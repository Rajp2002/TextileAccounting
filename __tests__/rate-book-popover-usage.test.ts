import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getCostRateDisplayNotes, getCostRateDisplaySource, type CostRateRow } from '../lib/cost-rates'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Rate Book P2: Linked Qualities on each yarn card in RatesClient.tsx', () => {
    const client = read('app/(dashboard)/owner/rates/RatesClient.tsx')

    describe('Component Architecture & Radix Popover Integration', () => {
        it('imports Popover, PopoverContent, PopoverTrigger from @/components/ui/popover', () => {
            expect(client).toContain("import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'")
        })

        it('keeps ChevronDown and Tags from lucide-react', () => {
            expect(client).toContain('ChevronDown,')
            expect(client).toContain('Tags,')
            // Obsolete Calculator icon only used in old modal must be removed
            expect(client).not.toContain('Calculator,')
        })

        it('defines the usage line and the popover it opens', () => {
            expect(client).toContain('function LinkedQualitiesPopover(')
            expect(client).toContain('function YarnUsage(')
            expect(client).not.toContain('function LinkedQualitiesCell(')
        })

        it('names the first two qualities on the card and puts the rest behind the popover', () => {
            const usage = client.slice(client.indexOf('function YarnUsage('), client.indexOf('function PriceTrailSpark('))
            expect(usage).toContain("usageNames.slice(0, 2).join(', ')")
            expect(usage).toContain('<LinkedQualitiesPopover rate={rate} usageNames={usageNames} label={fillCopy(copy.moreNames, { n: rest })} />')
            expect(client).toContain('<div data-ratebook-field="linkedQualitiesPopover"><YarnUsage rate={rate} loading={usageLoading} copy={copy} /></div>')
        })
    })

    describe('Popover Trigger Button Design & Accessibility', () => {
        it('opens from a quiet underlined text trigger, not a saffron pill', () => {
            const popover = client.slice(client.indexOf('function LinkedQualitiesPopover('), client.indexOf('function YarnUsage('))
            expect(popover).toContain('<PopoverTrigger asChild>')
            expect(popover).toContain('underline decoration-hairline-strong underline-offset-4')
            expect(popover).not.toContain('bg-saffron-soft')
            expect(popover).not.toContain('border-saffron/30')
        })

        it('provides accessible aria-label on the trigger button', () => {
            expect(client).toContain('aria-label={`View ${count} linked ${qualityWord} for ${rate.name}`}')
        })
    })

    describe('Popover Content Card Layout & Reassurance', () => {
        it('renders clear eyebrow distinguishing saved costings vs linked qualities', () => {
            expect(client).toContain("isCosting ? 'Saved Costings' : 'Linked Qualities'")
        })

        it('displays active fabric count title', () => {
            expect(client).toContain('Used in {count} active {fullWord}')
        })

        it('renders a scrollable list of linked fabric names', () => {
            expect(client).toContain('max-h-48 space-y-1 overflow-y-auto')
            expect(client).toContain('usageNames.map((name, index) => (')
        })

        it('shows source and notes in the popover if recorded', () => {
            expect(client).toContain('<span className="font-semibold text-ink">Source:</span> {rate.source}')
            expect(client).toContain('<span className="font-semibold text-ink">Notes:</span> {rate.notes}')
        })

        it('includes the reassuring one-line reminder about future estimates', () => {
            expect(client).toContain('Future estimates for these fabrics will use this rate.')
        })
    })

    describe('Fallback for Unassigned Yarns (No Linked Usages)', () => {
        it('says the yarn is not used yet, with the owner-recorded source, without a popover', () => {
            const usage = client.slice(client.indexOf('function YarnUsage('), client.indexOf('function PriceTrailSpark('))
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
