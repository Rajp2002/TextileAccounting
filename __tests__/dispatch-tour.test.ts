import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dispatchTourSteps, dispatchTourSpecs, dispatchTourSelector } from '../lib/dispatch-tour'
import { DISPATCH_SAMPLE as s, dispatchSampleChallans, dispatchSampleDraft, dispatchSampleSelectedId } from '../lib/tours/sample-data/dispatch'
import { dispatchTutorialCopy, dispatchStepCopy, dispatchTourControlLabels } from '../lib/i18n/dispatch-tutorial'
import { supportedTours, isTourEligible, getTourDefinition } from '../lib/tours/tour-registry'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'

const locales = { en, gu, hi }
const read = (file: string) => readFileSync(file, 'utf8')
const approved = read('docs/guided-tours/pages/dispatches.md').split('## F. Copy')[1].split('### Control tokens')[0]
    .split('\n').filter(line => line.startsWith('| `')).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))

describe('Dispatch tour', () => {
    it('follows the approved ten steps, surfaces, contexts and live handoff', () => {
        expect(dispatchTourSteps).toEqual(['overview', 'quality', 'parties', 'lots', 'saveDraft', 'confirm', 'receipt', 'difference', 'payment', 'handoff'])
        expect(new Set(dispatchTourSteps).size).toBe(10)
        for (const spec of dispatchTourSpecs) {
            expect(spec.anchor).toBe(dispatchTourSelector(spec.id))
            expect(spec.anchor).toBe(spec.id === 'handoff' ? '[data-tour-anchor="dispatch.new"]' : `[data-dispatch-tour="${spec.id}"]`)
            expect(spec.kind).toBe(spec.id === 'handoff' ? 'handoff' : 'sample')
            expect(spec.context).toBe(['overview', 'difference', 'handoff'].includes(spec.id) ? undefined : '[data-tour-surface="true"]')
            expect(Boolean(spec.detail)).toBe(['confirm', 'payment'].includes(spec.id))
        }
    })
    it.each(['en', 'gu', 'hi'] as const)('preserves exact approved %s copy, native script, tokens and limits', language => {
        const copy = dispatchTutorialCopy[language]
        expect(Object.keys(copy)).toEqual(Object.keys(dispatchTutorialCopy.en))
        const dictionary = locales[language].challan as Record<string, string>
        const controls = dispatchTourControlLabels(key => dictionary[key.replace('challan.', '')])
        expect(Object.values(controls).every(value => typeof value === 'string' && value.length > 0)).toBe(true)
        for (const [section, fields] of Object.entries(copy)) for (const [key, text] of Object.entries(fields)) {
            expect(text).toBe(approved.find(row => row[0] === `\`${section}.${key}\``)?.[['en', 'gu', 'hi'].indexOf(language) + 1])
            if (language !== 'en') {
                expect(text).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
                expect(text.replace(/\{c:[^}]+\}|PDF/g, '')).not.toMatch(/[A-Za-z]/)
            }
        }
        for (const step of dispatchTourSteps) {
            const resolved = dispatchStepCopy(language, step, controls)
            expect(Object.values(resolved).join(' ')).not.toMatch(/\{[^}]+\}/)
            if (language === 'en') {
                expect(resolved.title.length).toBeLessThanOrEqual(48)
                expect(resolved.body.length).toBeLessThanOrEqual(190)
                expect(resolved.detail?.length ?? 0).toBeLessThanOrEqual(260)
            }
        }
        expect(dispatchStepCopy(language, 'saveDraft', controls).body).toContain(`“${dictionary.saveDraft}”`)
        expect(copy.guide.benefit).toBe(tourInvitationCopy[language].benefits.dispatch)
        expect(tourInvitationCopy[language].tourNames.dispatch).toBeTruthy()
    })
    it('explains fabric-only confirmation and removes the erroneous yarn/help claims in all languages', () => {
        expect(dispatchTutorialCopy.en.confirm.body).toContain('takes 100 m out of fabric stock. Yarn was already counted when the fabric was produced.')
        expect(dispatchTutorialCopy.gu.confirm.body).toContain('કાપડના સ્ટોકમાંથી 100 મીટર ઘટાડે છે. યાર્ન તો કાપડ બન્યું ત્યારે જ ગણાઈ ગયું હતું.')
        expect(dispatchTutorialCopy.hi.confirm.body).toContain('कपड़े के स्टॉक से 100 मीटर घटाता है। धागा तो कपड़ा बनते समय ही गिना जा चुका है।')
        const source = read('lib/i18n/dispatch-tutorial.ts')
        expect(source).not.toMatch(/linked costing weights|production itself does not deduct yarn|10 kg|10 કિગ્રા|10 किलो|Earlier dispatch records|dispatchTourHelp|moreHelp|legacy/)
        expect(read('lib/dispatch-tour.ts')).not.toMatch(/dispatchTourHelp|dispatchTourSection|yarnKgPer100|yarnDeduction/)
        expect(dispatchTutorialCopy.en.difference.body).toContain('do not return to stock')
        expect(dispatchTutorialCopy.en.difference.body).toContain('₹3,920')
        expect(dispatchTutorialCopy.en.payment.body).toContain('₹1,920')
    })
    it('reconciles the fabric, receipt and payment example on the real sample dispatches, without yarn fields', () => {
        const draft = dispatchSampleDraft('en')
        expect(draft.lines.reduce((total, line) => total + line.meters, 0)).toBe(s.sent)
        expect(draft.lines.map(line => line.meters)).toEqual([60, 40])
        const value = s.sent * s.rate, accepted = s.received * s.rate
        expect(value).toBe(4000) // "worth ₹4,000 at ₹40/m"
        expect(accepted).toBe(3920) // "The amount due becomes ₹3,920"
        expect(accepted - s.payment).toBe(1920) // "₹1,920" after a ₹2,000 payment
        expect(value - accepted).toBe(80)
        const challans = dispatchSampleChallans('en')
        expect(challans.map(row => row.delivery_status)).toEqual(['received', 'received', 'sent', 'draft'])
        expect(challans.find(row => row.difference_status === 'review')).toMatchObject({ sent_meters: 100, acknowledged_meters: 98 })
        expect(challans.find(row => row.difference_status === 'accepted')?.balance).toBe(accepted)
        expect(challans.every(row => row.id.startsWith('tour-'))).toBe(true)
        for (const step of dispatchTourSteps) { const id = dispatchSampleSelectedId(step); if (id) expect(challans.some(row => row.id === id)).toBe(true) }
        expect(Object.keys(s).some(key => /yarn/i.test(key))).toBe(false)
    })
    it('resolves control labels from the exact live keys and anchors both button instances', () => {
        expect(dispatchTourControlLabels(key => key)).toEqual({ saveDraft: 'challan.saveDraft', confirmLeft: 'challan.confirm', print: 'challan.print', receivedAsSent: 'challan.receivedAsSent', recordPayment: 'challan.payment', reverseEntry: 'challan.reverse_entry', newDispatch: 'challan.new' })
        const page = read('app/(dashboard)/owner/dispatches/ChallansClient.tsx')
        expect(page).toContain('<Button data-tour-anchor={tourAnchor} disabled={disabled} onClick={onClick} className={railPrimaryAction}>')
        expect(page.match(/<NewDispatchButton tourAnchor="dispatch.new" onClick=\{beginDraft\}/g)).toHaveLength(2)
        for (const key of ['confirm', 'print', 'receivedAsSent', 'reverse_entry', 'new']) expect(page).toContain(`tx('${key}')`)
        expect(page).toContain("'payment',")
        expect(read('app/(dashboard)/owner/dispatches/ChallanDraftEditor.tsx')).toContain("tx('saveDraft')")
        const wrapper = read('components/dispatches/DispatchGuidedTour.tsx')
        expect(wrapper).toContain("dynamic(() => import('./DispatchSampleWorkspace'), { ssr: false })")
        expect(wrapper).toContain("await import('@/lib/i18n/dispatch-tutorial')")
        expect(read('components/tours/ReplicaGuidedTour.tsx')).toContain("dynamic(() => import('./GuidedTour')")
    })
    it('registers v2 only for eligible Base owners', () => {
        expect(supportedTours).toContain('dispatch')
        expect(getTourDefinition('dispatch').contentVersion).toBe('v2')
        expect(isTourEligible('dispatch', 'base', 'owner')).toBe(true)
        expect(isTourEligible('dispatch', 'premium', 'owner')).toBe(false)
        expect(isTourEligible('dispatch', 'lite', 'owner')).toBe(false)
        expect(isTourEligible('dispatch', 'base', 'supervisor')).toBe(false)
    })
})
