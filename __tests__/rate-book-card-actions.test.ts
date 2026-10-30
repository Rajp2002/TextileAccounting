import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rateBookBoardText } from '../lib/i18n/rate-book-board'

const client = readFileSync(join(process.cwd(), 'app/(dashboard)/owner/rates/RatesClient.tsx'), 'utf8')
const cardStart = client.indexOf('const renderYarnCard')
const card = client.slice(cardStart, client.indexOf('data-lite-rates=', cardStart))

describe('Rate Book yarn card actions', () => {
    it('keeps Edit rate on the yarn card and moves Activity to the page header', () => {
        const edit = card.slice(card.lastIndexOf('<Button', card.indexOf('quickEditAction')), card.indexOf("{tx('Edit rate')}"))
        expect(edit).not.toContain('variant=')
        expect(edit).toContain('cardAction')
        expect(card).not.toContain("{tx('Activity')}")
        const header = client.slice(client.indexOf('<PageHeader'), client.indexOf('data-ratebook-field="addRateAction"'))
        expect(header).toContain('data-ratebook-field="activityAction"')
        expect(header).toContain("openHistory(activityRates[0], 'trend')")
    })

    it('offers every real active yarn in the Activity modal, and ignores a stale history fetch', () => {
        expect(client).toContain("rate.category === category && !isSampleRecordId(rate.id)")
        expect(client).toContain('groups={activityGroups}')
        expect(client).toContain("onSelectRate={rate => openHistory(rate, 'trend')}")
        expect(client).toContain('if (request !== historyRequest.current) return')
        const dialog = readFileSync(join(process.cwd(), 'components/rates/RateTrendDialog.tsx'), 'utf8')
        expect(dialog).toContain('data-ratebook-field="activityYarnPicker"')
        expect(dialog).toContain('aria-pressed={selected}')
    })

    it('leaves costing updates to Saved Costings instead of offering a per-yarn propagation', () => {
        expect(card).not.toContain('propagateAction')
        expect(card).not.toContain('propagateNotice')
        expect(client).not.toContain('PropagateYarnRateDialog')
    })

    it('offers delete on every real yarn card and archive instead when a quality uses it', () => {
        expect(card).toContain('data-ratebook-field="deleteYarnAction"')
        expect(card).toContain('{!sample && (')
        expect(client).toContain('const deleteRateInUse = Boolean(deleteRate && getRateUsageNames(deleteRate).length > 0)')
        expect(client).toContain('copy.archiveInstead')
        for (const language of ['en', 'hi', 'gu'] as const) {
            expect(rateBookBoardText[language].inUseTitle).toContain('{name}')
        }
    })
})
