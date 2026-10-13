import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase/migrations/20261014160000_base_staff_days_off.sql', 'utf8')
const rpc = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.set_base_staff_day_off'), migration.indexOf('REVOKE ALL ON FUNCTION public.set_base_staff_day_off'))

describe('Fixed-salary days-off migration contract', () => {
    it('writes days off only through a hardened owner RPC', () => {
        expect(rpc).toContain('SECURITY DEFINER')
        expect(rpc).toContain("SET search_path = ''")
        expect(rpc).toContain('auth.uid()')
        expect(rpc).toContain('is_locked_down')
        expect(migration).toContain('REVOKE ALL ON FUNCTION public.set_base_staff_day_off(uuid, date, boolean) FROM PUBLIC, anon, authenticated, service_role;')
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.set_base_staff_day_off(uuid, date, boolean) TO authenticated;')
        expect(migration).toContain('GRANT SELECT ON TABLE public.base_staff_days_off TO authenticated;')
        expect(migration).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*base_staff_days_off/)
    })
    it('locks in the same order as payment and refuses paid or completed days', () => {
        expect(rpc.indexOf(":base-incentives'")).toBeLessThan(rpc.indexOf(":base-payroll:'"))
        expect(rpc).toContain("status = 'paid' AND period_end >= p_off_date")
        expect(rpc).toContain("status = 'settled'")
        expect(rpc).toContain('p_off_date > v_today')
    })
    it('switches the payroll writer and snapshot to the days-off lines, failing loudly on drift', () => {
        expect(migration).toContain("RAISE EXCEPTION 'Unexpected fixed-salary payroll gross'")
        expect(migration).toContain("RAISE EXCEPTION 'Unexpected fixed-salary snapshot source'")
        expect(migration).toContain("RAISE EXCEPTION 'Unexpected fixed-salary snapshot label'")
        expect(migration).toContain('round(line.monthly_salary * (line.paid_days - off.days) / line.month_days, 2)')
    })
})
