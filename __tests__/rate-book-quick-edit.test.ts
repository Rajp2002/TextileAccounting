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

describe('Rate Book P3: Quick Rate Edit Dialog in RatesClient.tsx', () => {
    const client = read('app/(dashboard)/owner/rates/RatesClient.tsx')

    describe('Component Architecture & Dialog Setup', () => {
        it('defines QuickRateEditDialog on the shared Dialog primitive, not a Popover', () => {
            const component = client.slice(client.indexOf('function QuickRateEditDialog('), client.indexOf('function PriceDeltaBadge('))
            expect(component).toContain('<Dialog open={Boolean(rate)} onOpenChange={onOpenChange}>')
            expect(component).toContain('<DialogContent')
            expect(component).toContain('<DialogFooter>')
            expect(component).not.toContain('PopoverContent')
            expect(client).not.toContain('QuickRateEditPopover')
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

        it('mounts one QuickRateEditDialog for the page so desktop and mobile rows never open two overlays', () => {
            expect((client.match(/<QuickRateEditDialog/g) || []).length).toBe(1)
            expect(client).toContain('rate={quickEditRate}')
            expect(client).toContain('onSave={handleQuickSave}')
            expect(client).toContain('onOpenAdvanced={openAdvancedDraft}')
            expect(client).not.toContain('quickEditIsMobile')
        })

        it('puts the review action before "Edit rate" in a due card\'s actions', () => {
            const card = client.slice(client.indexOf('const renderYarnCard = '), client.indexOf('<PlanAnalyticsBeacon'))
            expect(card).toContain("aria-label={tx(`${reviewLabel} for ${rate.name}`)}")
            expect(card).toContain("aria-label={`Edit rate for ${rate.name}`}")
            expect(card).toContain("{tx('Edit rate')}")
            expect(card.indexOf('data-ratebook-field="quickReviewAction"')).toBeLessThan(card.indexOf('data-ratebook-field="quickEditAction"'))
        })

        it('renders the "Edit rate" trigger once, in the one yarn card every width shares', () => {
            expect((client.match(/data-ratebook-field="quickEditAction"/g) || []).length).toBe(1)
            expect(client).toContain('<Pencil className="h-4 w-4" aria-hidden="true" />{tx(\'Edit rate\')}')
        })

        it('opens the quick edit dialog from the card button and blocks closing while a save is pending', () => {
            expect(client).toContain('const openQuickEdit = (rate: CostRateRow) => {')
            expect((client.match(/openQuickEdit\(rate\)/g) || []).length).toBe(1)
            expect(client).toContain('if (!open && !quickEditPending) {')
        })

        it('has no row overflow menu: "Advanced edit" opens from the quick edit dialog', () => {
            expect(client).not.toContain('DropdownMenu')
            expect(client).not.toContain('MoreHorizontal')
            const component = client.slice(client.indexOf('function QuickRateEditDialog('), client.indexOf('function PriceDeltaBadge('))
            expect(component).toContain("{tx('Advanced edit')}")
        })
    })

    describe('Dialog Content & Ergonomics', () => {
        it('renders yarn name and category indicator in the dialog header', () => {
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

        it('supports auto-focus and text selection on dialog open', () => {
            expect(client).toContain('onOpenAutoFocus=')
            expect(client).toContain('inputRef.current?.focus()')
            expect(client).toContain('inputRef.current?.select()')
        })

        it('submits on Enter key in rate input and source input', () => {
            expect(client).toContain("if (e.key === 'Enter') {")
            expect(client).toContain('handleSubmit()')
        })

        it('provides the Advanced edit link for dates, review interval and archive', () => {
            expect(client).toContain("{tx('Advanced edit')}")
            expect(client).toContain('onClick={() => onOpenAdvanced(rate)}')
        })
    })

    describe('Add / advanced rate form uses the shared modal', () => {
        const dialogStart = client.indexOf('<Dialog open={Boolean(draft)}')
        const dialogEnd = client.indexOf('<QuickRateEditDialog\n', dialogStart)
        const addDialog = client.slice(dialogStart, dialogEnd)

        it('opens the Add Yarn Rate form in a Dialog instead of a side Sheet', () => {
            expect(dialogStart).toBeGreaterThan(-1)
            expect(addDialog).toContain('<DialogContent data-ratebook-field="rateDrawerFields"')
            expect(addDialog).toContain("tx(draft?.id ? `Change ${draft.name}` : 'Add Yarn Rate')")
            expect(addDialog).toContain('<DialogFooter className="sm:justify-between">')
            expect(addDialog).not.toContain('SheetContent')
        })

        it('keeps archive, and delete for an unused yarn, in the advanced form instead of a row menu', () => {
            expect(addDialog).toContain("{tx('Archive rate')}")
            expect(addDialog).toContain("{tx('Delete unused rate')}")
            expect(addDialog).toContain('(!draftRate.fabric_names?.length && draftRate.saved_quality_count === 0 && !draftRate.apply_as_default)')
        })

        it('keeps the save guards: no close while pending and a name hint wired to Save', () => {
            expect(addDialog).toContain('if (!open && !isPending) { setDraft(null); setSaveError(null) }')
            expect(addDialog).toContain('id="cost-rate-save-hint"')
            expect(addDialog).toContain("aria-describedby={!draft?.name.trim() ? 'cost-rate-save-hint' : undefined}")
        })

        it('keeps the Sheet only for the rate activity history', () => {
            expect((client.match(/<Sheet open=/g) || []).length).toBe(1)
            expect(client).toContain("<Sheet open={Boolean(historyRate) && historyMode === 'activity'}")
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

        it('bridges quick edit inputs into full Add/Edit dialog draft without losing typed values', () => {
            expect(client).toContain('const openAdvancedDraft = (rate: CostRateRow) => {')
            expect(client).toContain('const nextDraft = rowToDraft(rate)')
            expect(client).toContain('nextDraft.currentValue = parsed')
            expect(client).toContain('nextDraft.source = quickEditSource.trim()')
            expect(client).toContain('setDraft(nextDraft)')
        })
    })
})
