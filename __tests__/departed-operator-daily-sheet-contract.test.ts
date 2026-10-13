import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { BASE_PLAN_PHRASES } from '../lib/i18n/base-plan-phrases'
import { DAILY_SHEET_OPERATOR_PHRASES, DAILY_SHEET_OPERATOR_SOURCE_PHRASES } from '../lib/i18n/daily-sheet-operator-phrases'
import { supervisorText } from '../lib/i18n/supervisor-access'

// 2026-10-13 walkthrough: a worker with a last working day still held night looms, and every
// night sheet failed with "Choose an approved operator available for this date and shift."
const read = (relPath: string) => readFileSync(join(process.cwd(), relPath), 'utf8')
const sheetPath = 'app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx'
const actionsPath = 'app/(dashboard)/owner/production/actions.ts'
const supervisorPath = 'components/supervisor/SupervisorDailySheet.tsx'

function departureMigration() {
    const name = readdirSync(join(process.cwd(), 'supabase/migrations')).find(file => file.endsWith('_end_departed_worker_assignments.sql'))
    expect(name).toBeDefined()
    return read(`supabase/migrations/${name}`)
}

describe('a departed worker no longer holds looms', () => {
    it('ends their assignments in the same transaction as the worker update', () => {
        const sql = departureMigration()
        expect(sql).toContain('CREATE TRIGGER end_base_worker_assignments_on_departure')
        expect(sql).toContain('AFTER UPDATE OF end_date, is_active ON public.base_production_workers')
        expect(sql).toContain('PERFORM private.end_departed_base_worker_assignments(NEW.org_id, NEW.id)')
        // Ended, not deleted: dated rows keep past production's attribution.
        expect(sql).not.toMatch(/DELETE FROM public\.base_worker_machine_assignments/)
        expect(sql).toContain('effective_to = GREATEST(assignment.effective_from, v_last_day)')
    })

    it('follows the security-definer pattern and stays out of reach of app roles', () => {
        const sql = departureMigration()
        expect(sql.match(/SECURITY DEFINER/g)).toHaveLength(2)
        expect(sql.match(/SET search_path = ''/g)).toHaveLength(2)
        expect(sql).toContain('REVOKE ALL ON FUNCTION private.end_departed_base_worker_assignments(uuid, uuid)\n  FROM PUBLIC, anon, authenticated, service_role;')
        expect(sql).toContain('REVOKE ALL ON FUNCTION private.end_base_worker_assignments_on_departure()\n  FROM PUBLIC, anon, authenticated, service_role;')
    })

    it('repairs looms already left behind when the migration is applied', () => {
        const sql = departureMigration()
        expect(sql).toMatch(/DO \$reconcile\$[\s\S]*WHERE worker\.end_date IS NOT NULL OR NOT worker\.is_active[\s\S]*PERFORM private\.end_departed_base_worker_assignments/)
    })
})

describe('the daily sheet names the loom whose operator is unavailable', () => {
    it('leaves blank rows out of the owner save and names rows with readings, keeping the draft', () => {
        const sheet = read(sheetPath)
        expect(sheet).toContain('reviewBaseSheetOperators(')
        expect(sheet).toContain('entries: sheetWorkers.filter((worker) => !operatorReview.omittedWorkerIds.has(worker.id)).map((worker) => {')
        expect(sheet).toContain('if (operatorReview.blockedWorkerIds.length > 0) {')
        expect(sheet).toContain("tx('Not saved. The operator on {rows} is not available on this date and shift.")
        expect(sheet).toContain('unavailable={unavailableWorkerIds.has(context.workerId!)}')
        expect(sheet).toContain("tx('Not available on this date and shift')")
        // The check returns before the save, so no draft row is cleared.
        const check = sheet.indexOf('if (operatorReview.blockedWorkerIds.length > 0) {')
        expect(check).toBeGreaterThan(-1)
        expect(check).toBeLessThan(sheet.indexOf('setIsSaving(true)'))
    })

    it('names the rows the database guard refused when the page was out of date', () => {
        const actions = read(actionsPath)
        expect(actions).toContain("const OPERATOR_GUARD_MESSAGE = 'Choose an approved operator available for this date and shift.'")
        expect(actions).toContain("if (error.code === '22023' && error.message === OPERATOR_GUARD_MESSAGE) {")
        expect(actions).toContain('unavailableRows,')
        expect(read(sheetPath)).toContain('toast.error(unavailableOperatorMessage(unavailableRows))')
    })

    it('does the same on the supervisor sheet', () => {
        const supervisor = read(supervisorPath)
        expect(supervisor).toContain('blockedSupervisorRows(sheet, rows)')
        expect(supervisor).toContain("text('operatorUnavailableSave', { rows: describeBaseSheetRows(blocked) })")
        expect(supervisor).toContain("text('operatorUnavailable')")
    })

    it.each(['hi', 'gu'] as const)('ships the owner copy in %s, registered for the production pages', (language) => {
        for (const phrase of DAILY_SHEET_OPERATOR_SOURCE_PHRASES) {
            const translated = DAILY_SHEET_OPERATOR_PHRASES[language][phrase]
            expect(translated, phrase).toBeTruthy()
            expect(BASE_PLAN_PHRASES[language][phrase], phrase).toBe(translated)
            if (phrase.includes('{rows}')) expect(translated).toContain('{rows}')
        }
    })

    it.each(['en', 'hi', 'gu'] as const)('ships the supervisor copy in %s', (language) => {
        expect(supervisorText(language, 'operatorUnavailable')).toBeTruthy()
        expect(supervisorText(language, 'operatorUnavailableSave')).toContain('{rows}')
    })
})
