import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    getRatePriceDelta,
    type CostRateRow,
} from '../lib/cost-rates'
import { getSuratTodayString } from '../lib/time'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Rate Book P3: Quick Inline Rate Edit Popover in RatesClient.tsx', () => {
    const client = read('app/(dashboard)/owner/rates/RatesClient.tsx')

    describe('Component Architecture & Popover Setup', () => {
        it('defines QuickRateEditPopover component', () => {
            expect(client).toContain('function QuickRateEditPopover(')
        })

        it('tracks quick edit state in RatesClient', () => {
            expect(client).toContain('const [quickEditRate, setQuickEditRate] = useState<CostRateRow | null>(null)')
            expect(client).toContain("const [quickEditValue, setQuickEditValue] = useState<number | string>('')")
            expect(client).toContain("const [quickEditSource, setQuickEditSource] = useState('')")
            expect(client).toContain('const [quickEditError, setQuickEditError] = useState<string | null>(null)')
        })

        it('includes quickEditRate in isModalOpen to prevent shortcut interference while editing', () => {
            expect(client).toContain('reviewRate || archiveRate || deleteRate || showConflicts || quickEditRate')
        })

        it('wires QuickRateEditPopover in desktop table column 5', () => {
            expect(client).toContain('<QuickRateEditPopover')
            expect(client).toContain('isOpen={quickEditRate?.id === rate.id}')
            expect(client).toContain('onSave={handleQuickSave}')
            expect(client).toContain('onOpenAdvanced={openAdvancedDraft}')
        })

        it('wires QuickRateEditPopover in mobile card actions', () => {
            const mobileMatchCount = (client.match(/<QuickRateEditPopover/g) || []).length
            expect(mobileMatchCount).toBe(2) // Once in desktop table, once in mobile card
        })

        it('provides "Advanced edit" in row overflow dropdown menu', () => {
            expect(client).toContain("<Pencil /> {tx('Advanced edit')}")
        })
    })

    describe('Popover Content & Ergonomics', () => {
        it('renders yarn name and category indicator in popover header', () => {
            expect(client).toContain('{rate.category === \'yarn_warp\' ? \'Warp yarn\' : \'Weft yarn\'}')
            expect(client).toContain('Current: <span className="font-mono font-semibold text-ink">{formatRateValue(rate.current_value, rate.unit)}</span>')
        })

        it('formats rate input with currency prefix (₹) and /kg suffix', () => {
            expect(client).toContain('id={`quick-rate-${rate.id}`}')
            expect(client).toContain('font-mono text-sm font-bold text-subtle">')
            expect(client).toContain('₹')
            expect(client).toContain('/kg')
        })

        it('integrates real-time PriceDeltaBadge preview', () => {
            expect(client).toContain("{tx('Trend preview:')}")
            expect(client).toContain('<PriceDeltaBadge')
            expect(client).toContain('currentValue={previewVal}')
            expect(client).toContain('previousValue={Number(rate.current_value)}')
        })

        it('provides optional source / broker note field', () => {
            expect(client).toContain("{tx('Source / Broker note (optional)')}")
            expect(client).toContain('placeholder="Broker note, email..."')
        })

        it('renders impact reminder regarding future estimates and unchanged snapshots', () => {
            expect(client).toContain('Updates future estimates for ${savedQualityCount} saved')
            expect(client).toContain('Past snapshots unchanged.')
        })

        it('supports auto-focus and text selection on popover open', () => {
            expect(client).toContain('onOpenAutoFocus=')
            expect(client).toContain('inputRef.current?.focus()')
            expect(client).toContain('inputRef.current?.select()')
        })

        it('submits on Enter key in rate input and source input', () => {
            expect(client).toContain("if (e.key === 'Enter') {")
            expect(client).toContain('handleSubmit()')
        })

        it('provides link to Advanced settings (dates, review interval)', () => {
            expect(client).toContain("{tx('Advanced settings (dates, review interval)...')}")
            expect(client).toContain('onClick={() => onOpenAdvanced(rate)}')
        })
    })

    describe('Live Delta Preview Engine Integration', () => {
        const baseline = 140

        it('calculates price hike preview when broker increases rate', () => {
            const previewHike = getRatePriceDelta(146, baseline, 'per_kg')
            expect(previewHike.direction).toBe('increased')
            expect(previewHike.difference).toBe(6)
            expect(previewHike.formattedDifference).toBe('+₹6.00/kg')
            expect(previewHike.formattedPercent).toBe('+4.3%')
        })

        it('calculates price drop preview when broker discounts rate', () => {
            const previewDrop = getRatePriceDelta(135, baseline, 'per_kg')
            expect(previewDrop.direction).toBe('decreased')
            expect(previewDrop.difference).toBe(-5)
            expect(previewDrop.formattedDifference).toBe('-₹5.00/kg')
            expect(previewDrop.formattedPercent).toBe('-3.6%')
        })

        it('shows unchanged status if re-entering the same price', () => {
            const previewSame = getRatePriceDelta(140, baseline, 'per_kg')
            expect(previewSame.direction).toBe('unchanged')
            expect(previewSame.formattedDifference).toBe('Unchanged')
            expect(previewSame.formattedPercent).toBeNull()
        })
    })

    describe('Quick Save Mutation & Concurrency', () => {
        const sampleRate: CostRateRow = {
            id: 'aaaaaaaa-1111-4111-8111-111111111111',
            name: '80/72 Roto Polyester',
            category: 'yarn_weft',
            unit: 'per_kg',
            current_value: 140,
            previous_value: 135,
            effective_date: '2026-06-01',
            last_reviewed_at: '2026-06-01',
            review_interval_days: 60,
            source: 'Previous Broker',
            notes: 'Standard weft',
            apply_as_default: false,
            updated_at: '2026-06-01T10:00:00Z',
            fabric_names: ['Poly Twill'],
            saved_quality_count: 3,
        }

        it('constructs correct payload for saveCostRate with optimistic concurrency check', () => {
            const today = getSuratTodayString()
            const newPrice = 146
            const newSource = 'WhatsApp broker message'

            const payload = {
                id: sampleRate.id,
                expectedUpdatedAt: sampleRate.updated_at,
                name: sampleRate.name,
                category: sampleRate.category,
                unit: sampleRate.unit,
                currentValue: newPrice,
                effectiveDate: today,
                lastReviewedAt: today,
                reviewIntervalDays: Number(sampleRate.review_interval_days),
                source: newSource.trim() || (sampleRate.source ?? ''),
                notes: sampleRate.notes ?? '',
                applyAsDefault: sampleRate.apply_as_default,
            }

            expect(payload.id).toBe(sampleRate.id)
            expect(payload.expectedUpdatedAt).toBe('2026-06-01T10:00:00Z')
            expect(payload.currentValue).toBe(146)
            expect(payload.source).toBe('WhatsApp broker message')
            expect(payload.effectiveDate).toBe(today)
            expect(payload.lastReviewedAt).toBe(today)
        })

        it('bridges quick edit inputs into full Sheet draft without losing typed values', () => {
            expect(client).toContain('const openAdvancedDraft = (rate: CostRateRow) => {')
            expect(client).toContain('const nextDraft = rowToDraft(rate)')
            expect(client).toContain('nextDraft.currentValue = parsed')
            expect(client).toContain('nextDraft.source = quickEditSource.trim()')
            expect(client).toContain('setDraft(nextDraft)')
        })
    })
})
