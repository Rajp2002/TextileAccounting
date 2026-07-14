import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    countRestoredUnsavedDraftMeters,
    getProductionMetersDraftKey,
    parseProductionMetersDraft,
} from '../lib/production-drafts'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

function sourceBlock(source: string, startNeedle: string, endNeedle: string) {
    const start = source.indexOf(startNeedle)
    expect(start).toBeGreaterThanOrEqual(0)
    const end = source.indexOf(endNeedle, start + startNeedle.length)
    expect(end).toBeGreaterThan(start)
    return source.slice(start, end)
}

describe('Batch 24D EST-017 estimator double-submit guard', () => {
    const estimatorClient = readProjectFile('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const saveHandler = sourceBlock(
        estimatorClient,
        'const handleSaveQuote = async',
        '    if (loading) {'
    )

    it('uses a synchronous ref lock before invoking quote or market-run server actions', () => {
        expect(estimatorClient).toContain('const saveQuoteLockRef = useRef(false)')
        expect(saveHandler).toContain('if (saveQuoteLockRef.current || savingQuote) return')
        expect(saveHandler).toContain('saveQuoteLockRef.current = true')
        expect(saveHandler.indexOf('saveQuoteLockRef.current = true')).toBeLessThan(saveHandler.indexOf('createMarketRunFromEstimator({'))
        expect(saveHandler.indexOf('saveQuoteLockRef.current = true')).toBeLessThan(saveHandler.indexOf('saveEstimatorQuoteV3({'))
    })

    it('releases the submit lock after success or failure so a later normal submit still works', () => {
        expect(saveHandler).toContain('try {')
        expect(saveHandler).toContain('} catch (error) {')
        expect(saveHandler).toContain('} finally {')
        expect(saveHandler).toContain('setSavingQuote(false)')
        expect(saveHandler).toContain('saveQuoteLockRef.current = false')
        expect(saveHandler).toContain("toast.error(error instanceof Error ? error.message : 'Failed to save quote')")
    })

    it('keeps the normal quote and market-run submit paths intact behind the guard', () => {
        expect(saveHandler).toContain('const res = await createMarketRunFromEstimator({')
        expect(saveHandler).toContain('fabricLabel:             resolvedPartyName')
        expect(saveHandler).toContain('router.push(`/owner/market-runs/${res.marketRunId}`)')

        expect(saveHandler).toContain('const res = await saveEstimatorQuoteV3({')
        expect(saveHandler).toContain('partyName:               resolvedPartyName')
        expect(saveHandler).toContain('status:                  status')
        expect(saveHandler).toContain("router.push('/owner/quotes')")
    })

    it('keeps all estimator submit buttons disabled while the guarded submit is pending', () => {
        expect(estimatorClient).toContain('disabled={savingQuote || !hasOrderQty || !partyName.trim() || !qualityLabel.trim()')
        expect(estimatorClient).toContain('disabled={savingQuote || !orderQuote?.isValid}')
        expect(estimatorClient).toContain('disabled={savingQuote}')
    })
})

describe('Batch 24D PROD-022 production draft date/shift isolation', () => {
    const supervisorPage = readProjectFile('app/(dashboard)/supervisor/dashboard/page.tsx')
    const submitHandler = sourceBlock(
        supervisorPage,
        'const handleBulkSubmit = async',
        '    const handleRequestCode = async'
    )

    it('draft keys include org, user, selected date, and selected shift', () => {
        expect(getProductionMetersDraftKey({
            orgId: 'org-1',
            userId: 'user-1',
            date: '2026-06-22',
            shift: 'day',
        })).toBe('production_meters_org-1_user-1_2026-06-22_day')
        expect(getProductionMetersDraftKey({
            orgId: 'org-1',
            userId: 'user-1',
            date: '2026-06-22',
            shift: 'night',
        })).toBe('production_meters_org-1_user-1_2026-06-22_night')
        expect(getProductionMetersDraftKey({
            orgId: 'org-1',
            userId: 'user-1',
            date: '2026-06-23',
            shift: 'day',
        })).toBe('production_meters_org-1_user-1_2026-06-23_day')
    })

    it('separates same date and shift drafts by org and user', () => {
        const base = getProductionMetersDraftKey({
            orgId: 'org-1',
            userId: 'user-1',
            date: '2026-06-22',
            shift: 'day',
        })
        const otherOrg = getProductionMetersDraftKey({
            orgId: 'org-2',
            userId: 'user-1',
            date: '2026-06-22',
            shift: 'day',
        })
        const otherUser = getProductionMetersDraftKey({
            orgId: 'org-1',
            userId: 'user-2',
            date: '2026-06-22',
            shift: 'day',
        })
        const otherDate = getProductionMetersDraftKey({
            orgId: 'org-1',
            userId: 'user-1',
            date: '2026-06-23',
            shift: 'day',
        })
        const otherShift = getProductionMetersDraftKey({
            orgId: 'org-1',
            userId: 'user-1',
            date: '2026-06-22',
            shift: 'night',
        })

        expect(new Set([base, otherOrg, otherUser, otherDate, otherShift]).size).toBe(5)
        expect(base).not.toBe('production_meters_2026-06-22_day')
        expect(getProductionMetersDraftKey({
            orgId: null,
            userId: null,
            date: '2026-06-22',
            shift: 'day',
        })).toBe('production_meters_unknownOrg_unknownUser_2026-06-22_day')
    })

    it('restores only the draft matching the selected date and shift', () => {
        const storage = new Map<string, string>([
            [getProductionMetersDraftKey({ orgId: 'org-1', userId: 'user-1', date: '2026-06-22', shift: 'day' }), JSON.stringify({ loomA: 120 })],
            [getProductionMetersDraftKey({ orgId: 'org-1', userId: 'user-1', date: '2026-06-22', shift: 'night' }), JSON.stringify({ loomA: 240 })],
            [getProductionMetersDraftKey({ orgId: 'org-1', userId: 'user-1', date: '2026-06-23', shift: 'day' }), JSON.stringify({ loomA: 360 })],
            [getProductionMetersDraftKey({ orgId: 'org-2', userId: 'user-1', date: '2026-06-22', shift: 'day' }), JSON.stringify({ loomA: 999 })],
            [getProductionMetersDraftKey({ orgId: 'org-1', userId: 'user-2', date: '2026-06-22', shift: 'day' }), JSON.stringify({ loomA: 888 })],
        ])

        const restore = (orgId: string, userId: string, date: string, shift: 'day' | 'night') => {
            const cached = storage.get(getProductionMetersDraftKey({ orgId, userId, date, shift }))
            return cached ? parseProductionMetersDraft(cached) : {}
        }

        expect(restore('org-1', 'user-1', '2026-06-22', 'day')).toEqual({ loomA: 120 })
        expect(restore('org-1', 'user-1', '2026-06-22', 'night')).toEqual({ loomA: 240 })
        expect(restore('org-1', 'user-1', '2026-06-23', 'day')).toEqual({ loomA: 360 })
        expect(restore('org-2', 'user-1', '2026-06-22', 'day')).toEqual({ loomA: 999 })
        expect(restore('org-1', 'user-2', '2026-06-22', 'day')).toEqual({ loomA: 888 })
        expect(restore('org-1', 'user-1', '2026-06-22', 'day')).toEqual({ loomA: 120 })
    })

    it('changes date or shift by clearing visible meter values and rebinding the draft key', () => {
        expect(supervisorPage).toContain('const profileOrgId = userProfile?.org_id ?? null')
        expect(supervisorPage).toContain('const profileUserId = userProfile?.userId ?? null')
        expect(supervisorPage).toContain('getProductionMetersDraftKey({ orgId: profileOrgId, userId: profileUserId, date, shift })')
        expect(supervisorPage).toContain("const resetShiftDraftState = (nextDate: string, nextShift: 'day' | 'night') => {")
        expect(supervisorPage).toContain('setProductionMeters({})')
        expect(supervisorPage).toContain('getProductionMetersDraftKey({ orgId: profileOrgId, userId: profileUserId, date: nextDate, shift: nextShift })')
        expect(supervisorPage).toContain('resetShiftDraftState(nextDate, shift)')
        expect(supervisorPage).toContain('resetShiftDraftState(date, nextShift)')
    })

    it('offers explicit dated-shift navigation without relying on a native calendar interaction', () => {
        expect(supervisorPage).toContain('function moveDateByDays(date: string, days: number)')
        expect(supervisorPage).toContain('aria-label="Production date"')
        expect(supervisorPage).toContain('aria-label="Previous production day"')
        expect(supervisorPage).toContain('handleDateChange(moveDateByDays(date, -1))')
        expect(supervisorPage).toContain('aria-label="Next production day"')
        expect(supervisorPage).toContain('disabled={date >= getTodayString()}')
        expect(supervisorPage).toContain('handleDateChange(moveDateByDays(date, 1))')
    })

    it('ignores stale date/shift fetch completions before they can hydrate the current screen', () => {
        expect(supervisorPage).toContain('const fetchRequestRef = useRef(0)')
        expect(supervisorPage).toContain('const selectedDraftKeyRef = useRef(selectedDraftKey)')
        expect(supervisorPage).toContain('selectedDraftKeyRef.current = selectedDraftKey')
        expect(supervisorPage).toContain('const requestedDraftKey = selectedDraftKey')
        expect(supervisorPage).toContain('if (fetchRequestRef.current !== requestId) return')
        expect(supervisorPage).toContain('if (selectedDraftKeyRef.current !== requestedDraftKey) return')
    })

    it('persists and clears localStorage only for the active selected date/shift key', () => {
        expect(supervisorPage).toContain('if (!selectedDraftKey) return')
        expect(supervisorPage).toContain('if (productionMetersDraftKey !== selectedDraftKey) return')
        expect(supervisorPage).toContain('localStorage.setItem(selectedDraftKey, JSON.stringify(productionMeters))')
        expect(supervisorPage).toContain('localStorage.removeItem(selectedDraftKey)')
        expect(supervisorPage).toContain('localStorage.getItem(draftKey)')
        expect(supervisorPage).toContain('setProductionMetersDraftKey(draftKey)')
    })

    it('submits production rows with the currently selected date and shift', () => {
        expect(submitHandler).toContain('shift,')
        expect(submitHandler).toContain('date,')
        expect(submitHandler).toContain('runMutationWithTimeout(() => bulkLogProduction(entries, code))')
        expect(submitHandler).toContain('if (selectedDraftKey) localStorage.removeItem(selectedDraftKey)')
    })

    it('keeps Batch 24B restored-draft indicator behavior compatible', () => {
        expect(countRestoredUnsavedDraftMeters({ loomA: 120, loomB: 80 }, { loomA: 120, loomB: 70 })).toBe(1)
        expect(supervisorPage).toContain('countRestoredUnsavedDraftMeters(restoredMeters, existingProductionMeters)')
        expect(supervisorPage).toContain('Restored unsaved draft')
        expect(supervisorPage).toContain('restored from this device and have not been saved yet')
        expect(supervisorPage).toContain('Confirm large shift production')
        expect(supervisorPage).toContain('confirmedLargeMeters: true')
    })

    it('does not add migration, RPC, or database-work artifacts for Batch 24D', () => {
        const migrationNames = readdirSync(join(root, 'supabase/migrations'))
        expect(migrationNames.some((name) => name.toLowerCase().includes('batch_24d'))).toBe(false)
        expect(readProjectFile('app/(dashboard)/owner/estimator/actions.ts')).not.toContain('batch_24d')
        expect(readProjectFile('app/(dashboard)/supervisor/actions.ts')).not.toContain('batch_24d')
    })
})
