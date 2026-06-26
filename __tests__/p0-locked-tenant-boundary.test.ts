import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

const migration = readProjectFile('supabase/migrations/20260626051352_harden_locked_tenant_writes.sql')
const auth = readProjectFile('lib/auth.ts')
const supervisorActions = readProjectFile('app/(dashboard)/supervisor/actions.ts')
const ownerActions = readProjectFile('app/(dashboard)/owner/actions.ts')

function compact(sql: string) {
    return sql.replace(/\s+/g, ' ').trim()
}

describe('Batch 1B-B AUTH-016 locked-tenant write boundary', () => {
    it('uses RLS/RPC/server guards without trigger-primary enforcement or data cleanup', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.check_org_lockdown')
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.assert_org_not_locked')
        expect(migration).toContain('SET search_path = public')
        expect(migration).not.toMatch(/\bCREATE\s+TRIGGER\b/i)
        expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i)
        expect(migration).not.toMatch(/\bTRUNCATE\b/i)
        expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i)
        expect(migration).not.toMatch(/\bUPDATE\s+public\.(organizations|production_logs|workers|attendance|orders|dispatches|fabric_stock_lots|fabric_stock_sales)\b/i)
    })

    it('hardens every required protected pilot write table with a lockdown predicate', () => {
        const requiredTables = [
            'production_logs',
            'workers',
            'attendance',
            'orders',
            'dispatches',
            'fabric_stock_lots',
            'fabric_stock_movements',
            'fabric_stock_sales',
            'payroll_settlements',
            'worker_advances',
            'commercial_receivables',
            'commercial_payment_receipts',
            'parties',
            'party_invoices',
            'party_receipts',
            'party_adjustments',
            'payment_allocations',
        ]

        for (const table of requiredTables) {
            const tableSegment = new RegExp(`ON public\\.${table}[\\s\\S]{0,700}check_org_lockdown\\(org_id\\)`, 'i')
            expect(migration, table).toMatch(tableSegment)
        }
    })

    it('drops known legacy permissive write policies before recreating lockdown-aware policies', () => {
        const sql = compact(migration)

        for (const policy of [
            'Supervisor/Owner Insert',
            'Supervisor/Owner Update',
            'Owner Delete',
            'Supervisors and Owners Insert Workers',
            'Supervisors and Owners Update Workers',
            'Owner Delete Workers',
            'Supervisor/Owner Insert Attendance',
            'Supervisor/Owner Update Attendance',
            'Owners Manage Orders',
            'dispatches_org_insert',
            'fabric_stock_lots_owner_insert',
            'Owners Manage Settlements',
            'Owners Create Advances',
        ]) {
            expect(sql).toContain(`DROP POLICY IF EXISTS "${policy}"`)
        }
    })

    it('injects explicit guards into SECURITY DEFINER mutating RPCs', () => {
        const rpcIdentities = [
            'public.replace_shift_production_logs(jsonb,boolean,boolean)',
            'public.record_fabric_stock_sale(uuid,numeric,numeric,date,text)',
            'public.adjust_fabric_stock_lot(uuid,text,numeric,text)',
            'public.create_market_run_sale(uuid,uuid,numeric,numeric,date,text,text,date)',
            'public.create_party_stock_sale_dispatch_v1(text,uuid,text,text,text,text,numeric,numeric,numeric,integer,date,boolean,numeric,date,text,text,text,text,uuid)',
            'public.confirm_party_stock_sale_dispatch_v1(uuid,date,text,text,text,numeric,numeric,text)',
            'public.confirm_party_stock_sale_received_v1(uuid,date,text,text,text,numeric,text)',
            'public.confirm_stock_sale_dispatch_receipt_v1(uuid,numeric)',
            'public.record_commercial_payment_v1(uuid,numeric,date,text,text,text,date,text,text)',
            'public.convert_accepted_quote_to_order(uuid,numeric,date,text,text)',
            'public.create_stock_sale_dispatch(uuid,uuid,uuid[],numeric[],numeric[],date,text,text,text,text,text,numeric,timestamp with time zone,uuid)',
            'public.settle_worker_payroll(uuid,text,bigint,date,numeric,boolean,numeric,uuid,text)',
            'public.unsettle_worker_payroll(uuid,text,bigint,text,uuid)',
            'public.create_or_refresh_stock_inward_draft(uuid,date,text)',
            'public.confirm_fabric_dispatch_receipt_by_number(integer,text,numeric)',
        ]

        for (const identity of rpcIdentities) {
            expect(migration, identity).toContain(identity)
        }

        expect(migration).toContain('pg_get_functiondef')
        expect(migration).toContain('public.assert_org_not_locked(v_org_id)')
        expect(migration).toContain('public.assert_org_not_locked(p_org_id)')
        expect(migration).toContain('SELECT o.org_id FROM public.orders o WHERE o.id = p_order_id')
        expect(migration).toContain('SELECT d.org_id FROM public.dispatches d WHERE d.id = v_dispatch_id')
    })

    it('adds a central server-side write guard and applies it to service-role write paths', () => {
        expect(auth).toContain('export async function assertOrgWritable')
        expect(auth).toContain('export async function requireWritableOrg')
        expect(auth).toContain(".from('organizations')")
        expect(auth).toContain(".select('is_locked_down')")
        expect(auth).toContain('ORG_LOCKED_WRITE_MESSAGE')

        expect(supervisorActions).toContain('async function getWritableServiceClient')
        expect(supervisorActions).toContain('await assertOrgWritable(orgId)')
        expect(supervisorActions).not.toContain('serviceClient = getServiceClient()')

        expect(ownerActions).toContain('await assertOrgWritable(orgId)')
    })
})
