import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChallanNumber } from '@/app/(dashboard)/owner/dispatches/DispatchDetailDialog'
import { en } from '@/lib/i18n/locales/en'
import { hi } from '@/lib/i18n/locales/hi'
import { gu } from '@/lib/i18n/locales/gu'
import { yarnStockText } from '@/lib/i18n/yarn-stock'

const read = (file: string) => readFileSync(file, 'utf8')
const fabric = read('app/(dashboard)/owner/stock/QualityStockClient.tsx')
const yarn = read('app/(dashboard)/owner/stock/YarnStockClient.tsx')
const challans = read('app/(dashboard)/owner/dispatches/ChallansClient.tsx')
const detail = read('app/(dashboard)/owner/dispatches/DispatchDetailDialog.tsx')

describe('Fabric stock', () => {
    it('shows the on-hand band, a card per quality and the last seven days', () => {
        expect(fabric).toContain('data-stock-tour="balance"')
        expect(fabric).toContain('<CompositionBar')
        expect(fabric).toContain('<StockTrend')
        expect(fabric).toContain('<DayGroupList')
        // Trends and week totals appear only with the server's activity window; a tour sample has none.
        expect(fabric).toContain('const trail = activity ? balanceTrail(')
        expect(fabric).toContain("const recent = activity ? activity.filter(row => Date.parse(row.created_at) >= Date.parse(since)) : data.movements.slice(0, 12)")
    })

    it("hands a card's Dispatch to a new challan for that quality", () => {
        expect(fabric).toContain('href={`/owner/dispatches?quality=${quality.id}`}')
        expect(challans).toContain("new URLSearchParams(window.location.search).get('quality')")
        expect(challans).toContain("window.history.replaceState(null, '', window.location.pathname)")
        expect(challans).toContain('setDraft({ ...blank(), quality_id: qualityId })')
    })
})

describe('Yarn stock', () => {
    it('leads with the yarn that runs out first and says how long each lasts', () => {
        expect(yarn).toContain('const yarns = activity ? [...ranked].sort((a, b) => (daysLeft(a) - daysLeft(b)) || Number(b.weight_kg) - Number(a.weight_kg)) : ranked')
        expect(yarn).toContain('lastsFor(Number(yarn.weight_kg), perDay(yarn.id))')
        expect(yarn).toContain('yarnFeeds(yarn.yarn_key, data.qualities)')
        // A dated audit view describes the past, so it drops today's pace and trends.
        expect(yarn).toContain('const activity = current ? data.activity : undefined')
    })

    it('reads weights to two decimals but keeps full precision for entry and export', () => {
        expect(yarn).toContain("const kg2 = (n: number) => Number(n).toLocaleString(`${language}-IN`, { minimumFractionDigits: 2, maximumFractionDigits: 2 })")
        expect(yarn).toContain("weight_kg ?? '')")
        expect(yarn).not.toMatch(/\{kg\(totalYarnKg/)
    })

    it('has every new label in all three languages', () => {
        for (const key of ['intro', 'lastsDays', 'lastsWeeks', 'perDay', 'notInRecipe', 'recent', 'fullHistory', 'yarnCountOne'] as const) {
            for (const language of ['en', 'hi', 'gu'] as const) expect(yarnStockText[language][key], `${language} ${key}`).toBeTruthy()
        }
        for (const locale of [en, hi, gu]) for (const key of ['intro', 'onHand', 'woven', 'dispatchAction', 'recent', 'qualityCountOne'] as const) {
            expect((locale.qualityStock as Record<string, string>)[key], key).toBeTruthy()
        }
    })
})

describe('Delivery challans', () => {
    it('keeps the list beside the open challan on wide screens and opens it as a dialog elsewhere', () => {
        expect(challans).toContain("const SPLIT_QUERY = '(min-width: 1280px)'")
        expect(challans).toContain('<DispatchDetailPanel')
        expect(challans).toContain('open={!split && !!selected && (detailOpen || !!tourSelectedId) && !draft && !(tourSample && operation)}')
        expect(detail).toContain('export function DispatchDetailPanel(')
        expect(detail).toContain('<DispatchDetailBody {...props} challan={props.challan} panel />')
    })

    it('never lets a challan loading into the panel sit behind a new draft', () => {
        // A draft saves under `selected?.id ?? draftId`, so a late panel load would turn a new challan into an edit.
        expect(challans).toMatch(/function beginDraft\(\) \{\s*\/\/[^\n]*\n\s*viewRequest\.current\+\+/)
        expect(challans).toMatch(/viewRequest\.current\+\+\s*setEventsLoading\(false\)\s*setSelected\(null\)\s*setDraft\(\{ \.\.\.blank\(\), quality_id: qualityId \}\)/)
        expect(challans).toMatch(/if \(reveal\) \{\s*setDraft\(null\)\s*setDetailOpen\(true\)\s*\}/)
        // Panel actions wait for the challan's own history.
        expect(challans).toContain('locked={busy || !!pending || eventsLoading || !selected}')
    })

    it('quiets the padding zeros of a challan number', () => {
        expect(renderToStaticMarkup(<ChallanNumber value="DC000000000002" />)).toContain('DC<span class="opacity-55">00000000000</span>2')
        expect(renderToStaticMarkup(<ChallanNumber value="DC0000" />)).toContain('DC<span class="opacity-55">000</span>0')
        expect(renderToStaticMarkup(<ChallanNumber value="SAMPLE-1" />)).toContain('SAMPLE-<span class="opacity-55"></span>1')
    })
})
