import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getCostRateDisplayNotes, getCostRateDisplaySource, type CostRateRow } from '../lib/cost-rates'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Rate Book P2: Compact Popover for Linked Qualities in RatesClient.tsx', () => {
    const client = read('app/(dashboard)/owner/rates/RatesClient.tsx')

    describe('Component Architecture & Radix Popover Integration', () => {
        it('imports Popover, PopoverContent, PopoverTrigger from @/components/ui/popover', () => {
            expect(client).toContain("import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'")
        })

        it('imports ChevronDown and keeps ChevronRight and Tags from lucide-react', () => {
            expect(client).toContain('ChevronDown,')
            expect(client).toContain('ChevronRight,')
            expect(client).toContain('Tags,')
            // Obsolete Calculator icon only used in old modal must be removed
            expect(client).not.toContain('Calculator,')
        })

        it('defines LinkedQualitiesPopover and LinkedQualitiesCell components', () => {
            expect(client).toContain('function LinkedQualitiesPopover(')
            expect(client).toContain('function LinkedQualitiesCell(')
        })

        it('wires LinkedQualitiesCell in desktop table and LinkedQualitiesPopover in mobile cards', () => {
            expect(client).toContain('<LinkedQualitiesCell rate={rate} />')
            expect(client).toContain('<LinkedQualitiesPopover rate={rate} usageNames={usageNames} />')
        })
    })

    describe('Popover Trigger Button Design & Accessibility', () => {
        it('renders a compact pill trigger with Tags icon, quality count, and ChevronDown', () => {
            expect(client).toContain('<PopoverTrigger asChild>')
            expect(client).toContain('<Tags className="h-3.5 w-3.5 shrink-0 text-saffron-deep/80 group-hover:text-saffron-deep"')
            expect(client).toContain('<span>{label}</span>')
            expect(client).toContain('<ChevronDown className="h-3.5 w-3.5 shrink-0 text-saffron-deep/70 transition-transform duration-200 group-data-[state=open]:rotate-180 group-hover:text-saffron-deep"')
        })

        it('applies subtle saffron-tinted background styling to the trigger pill', () => {
            expect(client).toContain('border-saffron/30 bg-saffron-soft/60')
            expect(client).toContain('hover:border-saffron/50 hover:bg-saffron-soft')
            expect(client).toContain('text-saffron-deep')
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

        it('renders scrollable list of linked fabric names with subtle saffron bullet indicators', () => {
            expect(client).toContain('max-h-48 space-y-1.5 overflow-y-auto')
            expect(client).toContain('bg-surface-soft/60 px-2.5 py-1.5 text-xs font-medium text-body')
            expect(client).toContain('h-1.5 w-1.5 shrink-0 rounded-full bg-saffron')
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
        it('renders clean source and notes text directly without a popover button when usageNames is empty', () => {
            expect(client).toContain("getCostRateDisplaySource(rate) || 'No source recorded'")
            expect(client).toContain("getCostRateDisplayNotes(rate) || 'No notes'")
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
