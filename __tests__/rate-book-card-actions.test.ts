import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rateBookBoardText } from '../lib/i18n/rate-book-board'

const client = readFileSync(join(process.cwd(), 'app/(dashboard)/owner/rates/RatesClient.tsx'), 'utf8')
const cardStart = client.indexOf('const renderYarnCard')
const card = client.slice(cardStart, client.indexOf('data-lite-rates=', cardStart))

describe('Rate Book yarn card actions', () => {
    it('keeps Edit rate and Activity on the yarn card', () => {
        const edit = card.slice(card.lastIndexOf('<Button', card.indexOf('quickEditAction')), card.indexOf("{tx('Edit rate')}"))
        expect(edit).not.toContain('variant=')
        expect(edit).toContain('cardAction')
        const activity = card.slice(card.lastIndexOf('<Button', card.indexOf("{tx('Activity')}")), card.indexOf("{tx('Activity')}"))
        expect(activity).not.toContain('variant=')
        expect(activity).toContain('cardAction')
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
