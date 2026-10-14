import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { configurationTutorialCopy } from '../lib/i18n/configuration-tutorial'
import { costEstimateTutorialCopy } from '../lib/i18n/cost-estimate-tutorial'
import { dailySheetTutorialCopy } from '../lib/i18n/daily-sheet-tutorial'
import { dispatchTutorialCopy } from '../lib/i18n/dispatch-tutorial'
import { machinesTutorialCopy } from '../lib/i18n/machines-tutorial'
import { payrollTutorialCopy } from '../lib/i18n/payroll-tutorial'
import { productionTutorialCopy } from '../lib/i18n/production-tutorial'
import { rateBookTutorialCopy } from '../lib/i18n/rate-book-tutorial'
import { savedCostingsTutorialCopy } from '../lib/i18n/saved-costings-tutorial'
import { fabricStockTutorialCopy } from '../lib/i18n/stock-tutorial'
import { workersTutorialCopy } from '../lib/i18n/workers-tutorial'

// GT-17 consistency review, made executable. It reads every tour's step copy (title, body, detail) in all three
// languages and holds the whole program to the plan's copy rules: DR-27/28/29 English limits, DR-34 length ratio for
// Gujarati and Hindi, DR-31 tone, token parity, retired names, and one shared panel. Numeric limits are measured on
// the raw copy with each control token counted as 30 characters, which is longer than any control label, so a pass
// here is conservative; per-tour tests still check the resolved text.
type Lang = 'en' | 'gu' | 'hi'
const LANGS: Lang[] = ['en', 'gu', 'hi']
const TOURS: Record<string, Record<string, unknown>> = {
    'Cost Estimator': costEstimateTutorialCopy, 'Saved Costings': savedCostingsTutorialCopy, 'Yarn Rate Book': rateBookTutorialCopy,
    Dispatches: dispatchTutorialCopy, 'Fabric Stock': fabricStockTutorialCopy, Payroll: payrollTutorialCopy,
    Production: productionTutorialCopy, 'Daily Sheet': dailySheetTutorialCopy, Machines: machinesTutorialCopy, Workers: workersTutorialCopy,
    'Machine Assignments': configurationTutorialCopy,
}
const TOKEN = /\{c:[A-Za-z0-9_]+\}/g
const measured = (text: string) => text.replace(TOKEN, 'x'.repeat(30)).length
const sentences = (text: string) => (text.replace(TOKEN, 'x').replace(/(\d)[.,](\d)/g, '$1$2').match(/[.!?।]+(\s|$)/g) ?? []).length || 1

function leaves(value: unknown, prefix = ''): [string, string][] {
    if (typeof value === 'string') return [[prefix, value]]
    if (Array.isArray(value)) return value.flatMap((item, index) => leaves(item, `${prefix}[${index}]`))
    if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key))
    return []
}
const kindOf = (key: string): 'title' | 'body' | 'detail' | null => {
    if (/(^|\.)title(\.|$)/.test(key)) return 'title'
    if (/(^|\.)body(\.|$)/.test(key)) return 'body'
    if (/(^|\.)detail(\.|$)/.test(key)) return 'detail'
    return null
}
const LIMIT = { title: 48, body: 190, detail: 260 } as const

type Entry = { key: string; kind: 'title' | 'body' | 'detail'; text: Record<Lang, string> }
function entries(copy: Record<string, unknown>): Entry[] {
    const perLang = Object.fromEntries(LANGS.map(lang => [lang, new Map(leaves(copy[lang]).filter(([key]) => kindOf(key)))])) as Record<Lang, Map<string, string>>
    return [...perLang.en.keys()].map(key => ({ key, kind: kindOf(key)!, text: { en: perLang.en.get(key)!, gu: perLang.gu.get(key) ?? '', hi: perLang.hi.get(key) ?? '' } }))
}
const all = Object.entries(TOURS).map(([tour, copy]) => ({ tour, entries: entries(copy) }))

// Findings of the GT-17 review that are recorded instead of fixed. Each is owner-approved page-spec copy that native
// review would have to rule on; none is rewritten to satisfy a check. A new violation fails the test, and an entry
// that stops being a violation fails it too, so this list cannot go stale.
const ACCEPTED: Record<string, string> = {
    'Yarn Rate Book handoff.empty.title hi': 'Approved page-spec title, 21 characters in English and 36 in Hindi (1.71x, DR-34 allows 1.60x); fits the panel at 1280x800.',
    'Payroll calculation.salary.body gu': 'Owner-approved Payroll calculation-help string (GT-10 exception): two sentences in Gujarati, one in English.',
    'Payroll calculation.salary.body hi': 'Owner-approved Payroll calculation-help string (GT-10 exception): two sentences in Hindi, one in English.',
    'Payroll calculation.recovery.body gu': 'Owner-approved Payroll calculation-help string (GT-10 exception): two sentences in Gujarati, one in English.',
    'Payroll calculation.recovery.body hi': 'Owner-approved Payroll calculation-help string (GT-10 exception): two sentences in Hindi, one in English.',
}
const accepted = (violations: { id: string; message: string }[], scope: (id: string) => boolean) => {
    const found = violations.map(v => v.id).sort()
    const expected = Object.keys(ACCEPTED).filter(scope).sort()
    return { found, expected }
}

describe('GT-17 cross-tour consistency review', () => {
    it('covers every tour with step copy in all three languages', () => {
        expect(all).toHaveLength(11)
        for (const { tour, entries: rows } of all) {
            expect(rows.length, `${tour} has step copy`).toBeGreaterThan(0)
            for (const row of rows) for (const lang of LANGS) expect(row.text[lang].trim().length, `${tour} ${row.key} ${lang}`).toBeGreaterThan(0)
        }
    })

    it('holds English titles, bodies and details to DR-27, DR-28 and DR-29', () => {
        const table: string[] = []
        const violations: { id: string; message: string }[] = []
        for (const { tour, entries: rows } of all) {
            const worst = { title: 0, body: 0, detail: 0 }
            for (const row of rows) {
                const length = measured(row.text.en)
                worst[row.kind] = Math.max(worst[row.kind], length)
                if (length > LIMIT[row.kind]) violations.push({ id: `${tour} ${row.key}`, message: `${row.kind} is ${length}, limit ${LIMIT[row.kind]}` })
            }
            table.push(`${tour.padEnd(20)} entries=${String(rows.length).padStart(3)}  longest title ${worst.title}/48  body ${worst.body}/190  detail ${worst.detail}/260`)
        }
        console.log(`\nDR-27/28/29 English limits (tokens counted as 30 characters)\n${table.join('\n')}\nRECORDED EXCEPTIONS: ${violations.map(v => `${v.id} (${v.message})`).join('; ') || 'none'}`)
        const { found, expected } = accepted(violations, id => !/( gu| hi)$/.test(id))
        expect(found).toEqual(expected)
    })

    it('keeps Gujarati and Hindi within DR-34: at most 60% longer than English, and the same number of sentences', () => {
        const table: string[] = []
        const violations: { id: string; message: string }[] = []
        for (const { tour, entries: rows } of all) {
            let ratio = 0, sentenceDrift = 0
            for (const row of rows) for (const lang of ['gu', 'hi'] as const) {
                const factor = measured(row.text[lang]) / measured(row.text.en)
                ratio = Math.max(ratio, factor)
                if (factor > 1.6) violations.push({ id: `${tour} ${row.key} ${lang}`, message: `${factor.toFixed(2)}x English (${measured(row.text.en)} -> ${measured(row.text[lang])})` })
                if (sentences(row.text[lang]) !== sentences(row.text.en)) { sentenceDrift++; violations.push({ id: `${tour} ${row.key} ${lang}`, message: `sentence count ${sentences(row.text[lang])} vs English ${sentences(row.text.en)}` }) }
            }
            table.push(`${tour.padEnd(20)} longest gu/hi ratio ${ratio.toFixed(2)}x  sentence-count differences ${sentenceDrift}`)
        }
        console.log(`\nDR-34 Gujarati/Hindi length ratio\n${table.join('\n')}\nRECORDED EXCEPTIONS: ${violations.map(v => `${v.id} (${v.message})`).join('; ') || 'none'}`)
        const { found, expected } = accepted(violations, id => / (gu|hi)$/.test(id))
        expect(found).toEqual(expected)
    })

    it('uses the same control tokens in every language for every step', () => {
        for (const { tour, entries: rows } of all) for (const row of rows) {
            const wanted = (row.text.en.match(TOKEN) ?? []).sort().join(',')
            for (const lang of ['gu', 'hi'] as const) expect((row.text[lang].match(TOKEN) ?? []).sort().join(','), `${tour} ${row.key} ${lang}`).toBe(wanted)
        }
    })

    it('keeps the plain, direct tone of DR-31 in English and never uses a retired name in any language', () => {
        for (const { tour, entries: rows } of all) for (const row of rows) {
            expect(row.text.en, `${tour} ${row.key}`).not.toMatch(/\b(simply|just|easily)\b|!/i)
            for (const lang of LANGS) for (const retired of ['Overview & Looms', 'Earlier dispatch records', 'Pending Dispatches', 'Full Suite', '“Full”', '"Full"']) {
                expect(row.text[lang], `${tour} ${row.key} ${lang} uses retired "${retired}"`).not.toContain(retired)
            }
        }
    })

    it('renders every tour through the one shared panel, so eyebrow, controls and footer are identical', () => {
        const panelFiles = ['app', 'components'].flatMap(function walk(dir: string): string[] {
            return readdirSync(dir).flatMap(name => {
                const full = path.join(dir, name)
                return statSync(full).isDirectory() ? walk(full) : /\.tsx$/.test(name) ? [full] : []
            })
        } as (dir: string) => string[]).filter(file => /data-testid="guided-tour-panel"|className="guided-tour-panel/.test(readFileSync(file, 'utf8')))
        expect(panelFiles).toEqual(['components/tours/TourPanel.tsx'])
        for (const launcher of ['components/tours/GuidedTour.tsx', 'components/tours/ReplicaGuidedTour.tsx']) expect(existsSync(launcher)).toBe(true)
        const panel = readFileSync('components/tours/TourPanel.tsx', 'utf8')
        for (const shared of ['copy.exit', 'copy.back', 'copy.next', 'copy.done', 'copy.stepOf', 'copy.sample']) expect(panel, shared).toContain(shared)
    })

    it('ends every tour on a live handoff (DR-33)', () => {
        const tourLibs = ['estimator-tour', 'saved-costings-tour', 'rate-book-tour', 'dispatch-tour', 'stock-tour', 'payroll-tour', 'production-tour', 'daily-sheet-tour', 'machines-tour', 'workers-tour', 'configuration-tour']
        for (const lib of tourLibs) expect(readFileSync(`lib/${lib}.ts`, 'utf8'), lib).toMatch(/kind:\s*['"]handoff['"]|'handoff'/)
    })
})

describe('deleted tours', () => {
    it('has no Yarn Stock tour (the feature was deleted on 2026-10-14)', async () => {
        const { supportedTours, tourRegistry } = await import('../lib/tours/tour-registry')
        expect(supportedTours).not.toContain('yarn-stock')
        expect(Object.keys(tourRegistry)).not.toContain('yarn-stock')
    })
})
