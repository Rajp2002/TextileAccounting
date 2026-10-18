import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RATE_BOOK_PHRASES } from '../lib/i18n/lite-phrases/rates'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const client = read('app/(dashboard)/owner/rates/RatesClient.tsx')
const dialog = read('components/rates/PropagateYarnRateDialog.tsx')
const actions = read('app/(dashboard)/owner/rates/propagation-actions.ts')

describe('Rate Book Propagate pill', () => {
    it('shows the pill only on active, non-due cards that have costings to propagate', () => {
        expect(client).toContain('data-ratebook-field="propagateAction"')
        expect(client).toMatch(/const propagateCount = !due && !archived \? propagationCounts\[rate\.id\] \?\? 0 : 0/)
        expect(client).toMatch(/propagateCount > 0 &&/)
    })

    it('is an explicit button that opens the review, not a row click or a menu item', () => {
        const start = client.indexOf('data-ratebook-field="propagateAction"')
        const button = client.slice(client.lastIndexOf('<Button', start), client.indexOf('</Button>', start))
        expect(button).toContain('onClick={() => setPropagateRate(rate)}')
        expect(button).toContain('secondaryAction')
        expect(button).not.toContain('DropdownMenu')
    })

    it('reads the counts with the usage effect and again after every successful rate save', () => {
        expect(client).toContain('getYarnRatePropagationCounts')
        expect(client.match(/refreshPropagationCounts\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    })

    it('keeps the existing save toast copy', () => {
        expect(client).toContain('Costings you already saved did not change.')
    })

    it('mounts the review dialog once and lowers the card count when it finishes', () => {
        expect(client.match(/<PropagateYarnRateDialog/g)?.length).toBe(1)
        expect(client).toContain('onApplied')
    })
})

describe('PropagateYarnRateDialog', () => {
    it('is a shared Dialog with a footer, not a popover or a row menu', () => {
        expect(dialog).toContain('<Dialog ')
        expect(dialog).toContain('<DialogFooter')
        expect(dialog).not.toContain('PopoverContent')
        expect(dialog).not.toMatch(/<li[^>]*onClick/)
    })

    it('saves in batches of PROPAGATION_BATCH_SIZE and only the ticked costings', () => {
        expect(dialog).toContain('chunkIds(')
        expect(dialog).toContain('PROPAGATION_BATCH_SIZE')
        expect(dialog).toContain('applyYarnRatePropagation(')
        expect(dialog).toContain('expectedRateUpdatedAt')
        expect(dialog).toContain('summarizeOutcomes(')
    })

    it('has the loading, empty, error, skipped and retry states', () => {
        expect(dialog).toContain('Loader2')
        expect(dialog).toContain('Nothing to propagate: every costing already uses this rate')
        expect(dialog).toContain('Skipped')
        expect(dialog).toContain('Retry')
        expect(dialog).toContain('Review before saving')
    })

    it('keeps long Hindi and Gujarati copy readable on a phone', () => {
        expect(dialog).toContain('min-h-[44px]')
        expect(dialog).toContain('whitespace-normal')
    })

    it('remembers which costings the owner unticked, so Retry never re-selects them', () => {
        expect(dialog).toContain('tickedAfterReload(')
        expect(dialog).toContain('untickedRef')
    })

    it('offers Retry when a save ends with an error, not only when rows failed', () => {
        const start = dialog.indexOf('{saveError && ')
        expect(start).toBeGreaterThan(-1)
        expect(dialog.slice(start, dialog.indexOf('<DialogFooter', start))).toContain("{tx('Retry')}")
    })

    it('takes the costings that were saved out of the list after a run', () => {
        expect(dialog).toContain('resolvedIds')
        expect(dialog).toMatch(/items: current\.items\.filter\(item => !resolvedIds\.has\(item\.id\)\)/)
    })

    it('reads a batch result even when the batch ended early with an error', () => {
        expect(dialog).toMatch(/result\.data\?\.outcomes/)
    })
})

describe('propagation actions and migrations', () => {
    it('checks the owner role and the Rate Book plan in every action', () => {
        expect(actions.match(/requireRole\(\['owner'\]\)/g)?.length).toBe(3)
        expect(actions.match(/await requireBaseTier\(profile\.org_id\)/g)?.length).toBe(3)
    })

    it('adds no migration', () => {
        const migrations = readdirSync(join(root, 'supabase/migrations'))
        expect(migrations.filter(name => /propagat/i.test(name))).toEqual([])
    })
})

describe('propagation copy', () => {
    const NEW_STRINGS = [
        'Propagate · {0}',
        'Propagate {0} at {1}',
        'Review before saving',
        'Saving {0} of {1}…',
        'Create {0} new versions',
        'Create {0} new version',
        '{0} created, {1} skipped',
        '{0} new versions created',
        'Nothing to propagate: every costing already uses this rate',
        "This costing can't be priced with the new rate.",
        'This rate changed since you opened the review. Reopen Propagate.',
    ]

    it('has a Hindi and a Gujarati row, in script and with the same placeholders, for each new string', () => {
        const rows = new Map(RATE_BOOK_PHRASES.map(([english, hindi, gujarati]) => [english, { hindi, gujarati }]))
        for (const english of NEW_STRINGS) {
            const row = rows.get(english)
            expect(row, english).toBeDefined()
            expect(row!.hindi, english).toMatch(/\p{Script=Devanagari}/u)
            expect(row!.gujarati, english).toMatch(/\p{Script=Gujarati}/u)
            for (const token of english.match(/\{\d+\}/g) ?? []) {
                expect(row!.hindi, english).toContain(token)
                expect(row!.gujarati, english).toContain(token)
            }
        }
    })

    it('adds the Propagate topic to the Rate Book help in all three languages', () => {
        const tutorial = read('components/rates/RateBookTutorial.tsx')
        expect(tutorial.match(/"propagate": \{/g)?.length).toBe(3)
    })
})
