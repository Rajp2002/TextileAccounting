import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { freshDatabase, seedOwnerOrg, type Db } from './helpers'

let db: Db
const reset = readFileSync('docs/admin-console/FOUNDER_ACCOUNT_RESET.sql', 'utf8')
type Fixture = { userId: string; orgId: string; paymentId: string; machineId: string }
function sql(fixture: Fixture, rollback = false) {
    const value = reset.replaceAll('d0e56517-29f9-474f-b368-9e63e84da25a', fixture.userId)
        .replaceAll('2420a5a8-d231-4ed2-b9ce-9db986e38879', fixture.orgId)
        .replaceAll('f63d700b-53a0-4de9-ab07-4751ce18ce7b', fixture.paymentId)
        .replaceAll('rajpatel86420@gmail.com', `synthetic-reset-${fixture.userId}@example.test`)
        .replaceAll('pay_TBKE6J8xxIQLZO', `synthetic_payment_${fixture.paymentId}`)
        .replaceAll('order_TBKDj1hedLSQdK', `synthetic_order_${fixture.paymentId}`)
        .replaceAll('1770000', '123400')
    return rollback ? value.replace(/COMMIT;/g, 'ROLLBACK;') : value
}
async function fixture(): Promise<Fixture> {
    const owner = await seedOwnerOrg(db, { tier: null, name: 'test' })
    await db.query('UPDATE auth.users SET email=$2,email_confirmed_at=now() WHERE id=$1', [owner.userId, `synthetic-reset-${owner.userId}@example.test`])
    await db.query("SELECT set_config('app.account_deletion','true',false)")
    for (const table of ['machine_type_pay_defaults', 'quality_stock_cutover', 'payroll_configs']) {
        await db.query(`DELETE FROM public.${table} WHERE org_id=$1`, [owner.orgId])
    }
    await db.query('DELETE FROM public.factory_cost_profile WHERE factory_id=$1', [owner.orgId])
    const machineId = randomUUID()
    await db.query("INSERT INTO public.machines(id,org_id,name) VALUES($1,$2,'Synthetic machine')", [machineId, owner.orgId])
    await db.query("INSERT INTO public.machines(org_id,name) SELECT $1,'Synthetic machine '||i::text FROM generate_series(2,5)i", [owner.orgId])
    await db.query("INSERT INTO public.machine_type_pay_defaults(org_id,machine_type,default_pay_mode) SELECT $1,t,'per_meter' FROM unnest(ARRAY['jacquard','power_loom','rapier','water_jet','other'])t", [owner.orgId])
    await db.query("INSERT INTO public.workers(org_id,name,date_of_birth,age_verification_method,age_verification_reference,age_verified_at,age_verified_by) VALUES($1,'Synthetic worker','1990-01-01','other','synthetic-age-reference',now(),$2)", [owner.orgId, owner.userId])
    await db.query('INSERT INTO public.payroll_configs(org_id) VALUES($1)', [owner.orgId])
    await db.query('INSERT INTO public.quality_stock_cutover(org_id,historical_production_meters,legacy_lot_count) VALUES($1,0,0)', [owner.orgId])
    await db.query('INSERT INTO public.factory_cost_profile(factory_id) VALUES($1)', [owner.orgId])
    await db.query("INSERT INTO public.cost_rate_book(org_id,name,category,unit,current_value) SELECT $1,'Synthetic rate '||i::text,'yarn_warp','per_kg',0 FROM generate_series(1,3)i", [owner.orgId])
    await db.query('INSERT INTO public.referral_codes(org_id,code) VALUES($1,$2)', [owner.orgId, `SYNTHETIC-${owner.orgId}`])
    const term = randomUUID()
    await db.query("INSERT INTO public.org_subscriptions(id,org_id,plan_tier,status) VALUES($1,$2,'base','active')", [term, owner.orgId])
    await db.query("INSERT INTO public.org_subscriptions(org_id,plan_tier,status) SELECT $1,'lite','created' FROM generate_series(1,3)", [owner.orgId])
    const paymentId = randomUUID()
    await db.query("INSERT INTO public.subscription_payments(id,org_id,subscription_id,amount_paise,status,razorpay_payment_id,razorpay_order_id) VALUES($1,$2,$3,123400,'captured',$4,$5)", [paymentId, owner.orgId, term, `synthetic_payment_${paymentId}`, `synthetic_order_${paymentId}`])
    await db.query('DELETE FROM public.profiles WHERE id=$1', [owner.userId])
    await db.query('DELETE FROM public.audit_log WHERE org_id=$1', [owner.orgId])
    await db.query("INSERT INTO public.audit_log(org_id,table_name,record_id,action) SELECT $1,'synthetic_setup',i::text,'INSERT' FROM generate_series(1,18)i", [owner.orgId])
    await db.query("SELECT set_config('app.account_deletion','false',false)")
    return { ...owner, paymentId, machineId }
}
async function rejected(fixture: Fixture, pattern: RegExp) {
    const auditCount = (await db.query('SELECT count(*)::integer AS n FROM public.audit_log WHERE org_id=$1', [fixture.orgId])).rows[0].n
    await expect(db.query(sql(fixture))).rejects.toThrow(pattern)
    await db.query('ROLLBACK')
    expect((await db.query('SELECT id FROM auth.users WHERE id=$1', [fixture.userId])).rowCount).toBe(1)
    expect((await db.query('SELECT id FROM public.organizations WHERE id=$1', [fixture.orgId])).rowCount).toBe(1)
    expect((await db.query('SELECT id FROM public.subscription_payments WHERE id=$1', [fixture.paymentId])).rowCount).toBe(1)
    expect((await db.query('SELECT id FROM public.machines WHERE org_id=$1', [fixture.orgId])).rowCount).toBe(5)
    expect((await db.query('SELECT id FROM public.audit_log WHERE org_id=$1', [fixture.orgId])).rowCount).toBe(auditCount)
}
async function restrictedOperator() {
    const role = `synthetic_reset_${randomUUID().replaceAll('-', '')}`
    // Hosted postgres is not a superuser. This role models ordinary table
    // privileges and RLS bypass without access to the provider migration ledger.
    await db.query(`CREATE ROLE ${role} NOSUPERUSER BYPASSRLS`)
    const schemas = (await db.query("SELECT nspname FROM pg_namespace WHERE nspname IN('public','private','weavly_private','auth','storage')")).rows
    for (const { nspname } of schemas) {
        await db.query(`GRANT USAGE ON SCHEMA ${nspname} TO ${role}`)
        if (nspname !== 'auth') {
            await db.query(`GRANT ALL ON ALL TABLES IN SCHEMA ${nspname} TO ${role}`)
            await db.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA ${nspname} TO ${role}`)
        }
    }
    await db.query(`GRANT ALL ON auth.users,auth.sessions,auth.mfa_factors TO ${role}`)
    return {
        role,
        run: (target: Fixture) => db.query(sql(target).replace("current_user <> 'postgres'", `current_user <> '${role}'`)),
        cleanup: async () => {
            await db.query('ROLLBACK; RESET ROLE')
            await db.query(`DROP OWNED BY ${role}; DROP ROLE ${role}`)
        },
    }
}
beforeAll(async () => {
    db = await freshDatabase()
    // Hosted Auth has managed session/factor cascades; local generic stubs do
    // not. Model this explicitly rather than claiming real-provider acceptance.
    await db.query('ALTER TABLE auth.sessions DROP CONSTRAINT sessions_user_id_fkey; ALTER TABLE auth.sessions ADD FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE')
    await db.query('ALTER TABLE auth.mfa_factors DROP CONSTRAINT mfa_factors_user_id_fkey; ALTER TABLE auth.mfa_factors ADD FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE')
})
afterAll(async () => { await db?.end() })

describe('explicit old founder account reset, synthetic fixtures only', () => {
    it('removes exactly the selected factory data and old identity, including local captured-payment history and managed sessions/factors; preserves another tenant', async () => {
        const target = await fixture()
        const other = await seedOwnerOrg(db, { tier: null })
        await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$2,'aal2'),($3,$4,'aal1')", [randomUUID(), target.userId, randomUUID(), other.userId])
        await db.query("INSERT INTO auth.mfa_factors(id,user_id,status,factor_type) VALUES($1,$2,'verified','totp'),($3,$4,'verified','totp')", [randomUUID(), target.userId, randomUUID(), other.userId])
        const otherBefore = (await db.query('SELECT row_to_json(o) AS value FROM public.organizations o WHERE id=$1', [other.orgId])).rows[0].value
        await db.query(sql(target))
        for (const [table, column, id] of [['auth.users', 'id', target.userId], ['public.organizations', 'id', target.orgId], ['public.subscription_payments', 'id', target.paymentId], ['auth.sessions', 'user_id', target.userId], ['auth.mfa_factors', 'user_id', target.userId]]) {
            expect((await db.query(`SELECT 1 FROM ${table} WHERE ${column}=$1`, [id])).rowCount).toBe(0)
        }
        expect((await db.query('SELECT row_to_json(o) AS value FROM public.organizations o WHERE id=$1', [other.orgId])).rows[0].value).toEqual(otherBefore)
        expect((await db.query('SELECT id FROM auth.users WHERE id=$1', [other.userId])).rowCount).toBe(1)
        expect((await db.query('SELECT id FROM auth.sessions WHERE user_id=$1', [other.userId])).rowCount).toBe(1)
        expect((await db.query('SELECT id FROM auth.mfa_factors WHERE user_id=$1', [other.userId])).rowCount).toBe(1)
        expect((await db.query('SELECT id FROM public.audit_log WHERE org_id=$1', [target.orgId])).rowCount).toBe(0)
        const audit = (await db.query("SELECT org_id,changed_by,new_data FROM public.audit_log WHERE table_name='founder_account_reset' AND record_id=$1", [target.orgId])).rows
        expect(audit).toEqual([{ org_id: null, changed_by: null, new_data: { status: 'completed', deletedAuthUsers: 1, deletedFactories: 1 } }])
    })
    it('supports rollback rehearsal with every old row preserved', async () => {
        const target = await fixture()
        await db.query(sql(target, true))
        expect((await db.query('SELECT id FROM auth.users WHERE id=$1', [target.userId])).rowCount).toBe(1)
        expect((await db.query('SELECT id FROM public.subscription_payments WHERE id=$1', [target.paymentId])).rowCount).toBe(1)
        expect((await db.query('SELECT id FROM public.machines WHERE org_id=$1', [target.orgId])).rowCount).toBe(5)
        expect((await db.query("SELECT id FROM public.audit_log WHERE table_name='founder_account_reset' AND record_id=$1", [target.orgId])).rowCount).toBe(0)
    })
    it('rejects wrong identity and new membership before deletion', async () => {
        const wrong = await fixture()
        await db.query('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1', [wrong.userId])
        await rejected(wrong, /Exact confirmed old Auth identity not found/)
        const member = await fixture()
        await db.query("INSERT INTO public.profiles(id,org_id,role) VALUES($1,$2,'owner')", [member.userId, member.orgId])
        await rejected(member, /Ownership\/membership changed/)
    })
    it('rejects unexpected target rows and child references even when child org_id is NULL or belongs to another tenant', async () => {
        const extra = await fixture()
        await db.query("INSERT INTO public.machines(org_id,name) VALUES($1,'New synthetic machine')", [extra.orgId])
        await expect(db.query(sql(extra))).rejects.toThrow(/Reviewed row count changed/)
        await db.query('ROLLBACK')
        await db.query('CREATE TABLE public.synthetic_machine_child(id uuid PRIMARY KEY,org_id uuid,machine_id uuid REFERENCES public.machines(id) ON DELETE CASCADE)')
        try {
            for (const orgId of [null, randomUUID()]) {
                const target = await fixture()
                const child = randomUUID()
                await db.query('INSERT INTO public.synthetic_machine_child(id,org_id,machine_id) VALUES($1,$2,$3)', [child, orgId, target.machineId])
                await rejected(target, /Additional\/cross-factory child/)
                expect((await db.query('SELECT id FROM public.synthetic_machine_child WHERE id=$1', [child])).rowCount).toBe(1)
            }
        } finally { await db.query('DROP TABLE public.synthetic_machine_child') }
    })
    it('rejects external-schema Auth cascades/detaches, including text and compound FKs, and rolls prior deletes back', async () => {
        await db.query('CREATE SCHEMA synthetic_external; ALTER TABLE auth.users ADD UNIQUE(id,email); ALTER TABLE auth.users ADD UNIQUE(email)')
        await db.query('CREATE TABLE synthetic_external.cascade_ref(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE)')
        await db.query('CREATE TABLE synthetic_external.null_ref(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL)')
        await db.query('CREATE TABLE synthetic_external.text_ref(id uuid PRIMARY KEY,email text REFERENCES auth.users(email) ON DELETE CASCADE)')
        await db.query('CREATE TABLE synthetic_external.compound_ref(id uuid PRIMARY KEY,user_id uuid,email text,FOREIGN KEY(user_id,email) REFERENCES auth.users(id,email) ON DELETE CASCADE)')
        try {
            for (const table of ['cascade_ref', 'null_ref', 'text_ref', 'compound_ref']) {
                const target = await fixture()
                // Unique synthetic email per fixture when testing non-PK FKs.
                const email = `synthetic-reset-${target.userId}@example.test`
                await db.query('UPDATE auth.users SET email=$2 WHERE id=$1', [target.userId, email])
                const fields = table === 'text_ref' ? 'id,email' : table === 'compound_ref' ? 'id,user_id,email' : 'id,user_id'
                const args = table === 'text_ref' ? [randomUUID(), email] : table === 'compound_ref' ? [randomUUID(), target.userId, email] : [randomUUID(), target.userId]
                await db.query(`INSERT INTO synthetic_external.${table}(${fields}) VALUES(${args.map((_, i) => `$${i + 1}`).join(',')})`, args)
                const adjusted = sql(target).replaceAll('synthetic-reset@example.test', email)
                await expect(db.query(adjusted)).rejects.toThrow(/Remaining external Auth reference/)
                await db.query('ROLLBACK')
                expect((await db.query('SELECT id FROM public.subscription_payments WHERE id=$1', [target.paymentId])).rowCount).toBe(1)
                expect((await db.query(`SELECT id FROM synthetic_external.${table} WHERE id=$1`, [args[0]])).rowCount).toBe(1)
            }
        } finally {
            await db.query('DROP SCHEMA synthetic_external CASCADE; ALTER TABLE auth.users DROP CONSTRAINT users_id_email_key; ALTER TABLE auth.users DROP CONSTRAINT users_email_key')
        }
    })
    it('rejects Storage links without removing a file or account', async () => {
        const target = await fixture()
        const object = randomUUID()
        await db.query('INSERT INTO storage.objects(id,bucket_id,name,owner) VALUES($1,$2,$3,$4)', [object, 'synthetic', 'file.txt', target.userId])
        await rejected(target, /New account-owned Storage objects found/)
        expect((await db.query('SELECT id FROM storage.objects WHERE id=$1', [object])).rowCount).toBe(1)
    })
    it('rejects managed Auth child triggers before they can alter another account', async () => {
        const target = await fixture()
        const other = await seedOwnerOrg(db, { tier: null })
        await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$2,'aal2')", [randomUUID(), target.userId])
        await db.query("CREATE FUNCTION auth.synthetic_session_delete() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN UPDATE public.organizations SET name='Unexpected alteration' WHERE name='Test Weaving Works'; RETURN OLD; END$$")
        await db.query('CREATE TRIGGER synthetic_session_delete BEFORE DELETE ON auth.sessions FOR EACH ROW EXECUTE FUNCTION auth.synthetic_session_delete()')
        try {
            await rejected(target, /Unreviewed managed Auth cascade trigger\/rule/)
            expect((await db.query('SELECT name FROM public.organizations WHERE id=$1', [other.orgId])).rows[0].name).toBe('Test Weaving Works')
        } finally { await db.query('DROP TRIGGER synthetic_session_delete ON auth.sessions; DROP FUNCTION auth.synthetic_session_delete()') }
    })
    it('rejects an external reference through a managed Auth session, preserving every row', async () => {
        const target = await fixture()
        const session = randomUUID()
        await db.query("INSERT INTO auth.sessions(id,user_id,aal) VALUES($1,$2,'aal2')", [session, target.userId])
        await db.query('CREATE SCHEMA synthetic_deep_external; CREATE TABLE synthetic_deep_external.session_ref(id uuid PRIMARY KEY,session_id uuid REFERENCES auth.sessions(id) ON DELETE CASCADE)')
        const child = randomUUID()
        try {
            await db.query('INSERT INTO synthetic_deep_external.session_ref VALUES($1,$2)', [child, session])
            await rejected(target, /Remaining external Auth cascade reference/)
            expect((await db.query('SELECT id FROM synthetic_deep_external.session_ref WHERE id=$1', [child])).rowCount).toBe(1)
            expect((await db.query('SELECT id FROM auth.sessions WHERE id=$1', [session])).rowCount).toBe(1)
        } finally { await db.query('DROP SCHEMA synthetic_deep_external CASCADE') }
    })
    it('rolls back if a provider schema leaves non-FK UUID or legacy text runtime owner records', async () => {
        await db.query('CREATE TABLE auth.synthetic_flow_state(id uuid PRIMARY KEY,user_id uuid); CREATE TABLE auth.synthetic_refresh_tokens(id uuid PRIMARY KEY,user_id varchar)')
        try {
            for (const table of ['synthetic_flow_state', 'synthetic_refresh_tokens']) {
                const target = await fixture()
                const runtime = randomUUID()
                await db.query(`INSERT INTO auth.${table}(id,user_id) VALUES($1,$2)`, [runtime, target.userId])
                await rejected(target, /Remaining managed Auth runtime reference/)
                expect((await db.query(`SELECT id FROM auth.${table} WHERE id=$1`, [runtime])).rowCount).toBe(1)
            }
        } finally { await db.query('DROP TABLE auth.synthetic_flow_state,auth.synthetic_refresh_tokens') }
    })
    it('refuses managed Auth children that would be detached instead of erased', async () => {
        await db.query('CREATE TABLE auth.synthetic_detached_runtime(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL)')
        try {
            const target = await fixture()
            const child = randomUUID()
            await db.query('INSERT INTO auth.synthetic_detached_runtime VALUES($1,$2)', [child, target.userId])
            await rejected(target, /Managed Auth detach\/default requires review/)
            expect((await db.query('SELECT user_id FROM auth.synthetic_detached_runtime WHERE id=$1', [child])).rows[0].user_id).toBe(target.userId)
        } finally { await db.query('DROP TABLE auth.synthetic_detached_runtime') }
    })
    it('rejects same-OID trigger-body drift', async () => {
        const definition = (await db.query("SELECT pg_get_functiondef('public.log_settings_audit_event()'::regprocedure) AS value")).rows[0].value
        try {
            const target = await fixture()
            await db.query('CREATE OR REPLACE FUNCTION public.log_settings_audit_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$BEGIN RETURN OLD; END$$')
            await rejected(target, /Unreviewed DELETE trigger definition/)
        } finally { await db.query(definition) }
    })
    it('rejects silent suppression of the required operator audit before deleting anything', async () => {
        const target = await fixture()
        await db.query("CREATE FUNCTION public.synthetic_reset_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NULL; END$$")
        await db.query('CREATE TRIGGER synthetic_reset_audit_failure BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.synthetic_reset_audit_failure()')
        try { await rejected(target, /Unreviewed operator audit INSERT behavior/) }
        finally { await db.query('DROP TRIGGER synthetic_reset_audit_failure ON public.audit_log; DROP FUNCTION public.synthetic_reset_audit_failure()') }
    })
    it('rolls factory/payment/Auth deletion back if the required operator audit fails', async () => {
        const target = await fixture()
        await db.query("ALTER TABLE public.audit_log ADD CONSTRAINT synthetic_reset_audit_unavailable CHECK(table_name<>'founder_account_reset') NOT VALID")
        try { await rejected(target, /synthetic_reset_audit_unavailable/) }
        finally { await db.query('ALTER TABLE public.audit_log DROP CONSTRAINT synthetic_reset_audit_unavailable') }
    })
    it('runs with non-superuser privileges while the unrelated provider migration ledger remains inaccessible and unchanged', async () => {
        const target = await fixture()
        const other = await seedOwnerOrg(db, { tier: null })
        await db.query("CREATE TABLE auth.schema_migrations(version varchar PRIMARY KEY); INSERT INTO auth.schema_migrations VALUES('synthetic_provider_version'); ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin")
        const operator = await restrictedOperator()
        try {
            await db.query(`SET ROLE ${operator.role}`)
            expect((await db.query('SELECT rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0].rolsuper).toBe(false)
            await expect(db.query('SELECT 1 FROM auth.schema_migrations')).rejects.toThrow(/permission denied/)
            await db.query('BEGIN')
            await expect(db.query('LOCK TABLE auth.schema_migrations IN SHARE ROW EXCLUSIVE MODE')).rejects.toThrow(/permission denied/)
            await db.query('ROLLBACK')
            await operator.run(target)
            await db.query('RESET ROLE')
            expect((await db.query('SELECT id FROM auth.users WHERE id=$1', [target.userId])).rowCount).toBe(0)
            expect((await db.query('SELECT id FROM public.organizations WHERE id=$1', [target.orgId])).rowCount).toBe(0)
            expect((await db.query('SELECT id FROM auth.users WHERE id=$1', [other.userId])).rowCount).toBe(1)
            expect((await db.query('SELECT version FROM auth.schema_migrations')).rows).toEqual([{ version: 'synthetic_provider_version' }])
        } finally {
            await operator.cleanup()
            await db.query('DROP TABLE auth.schema_migrations')
        }
    })
    it('never skips a protected migration ledger if it has unexpected identity columns or foreign-key edges', async () => {
        for (const shape of ['identity_column', 'foreign_key', 'unknown_identity_type', 'uuid_domain']) {
            const target = await fixture()
            if (shape === 'uuid_domain') await db.query('CREATE DOMAIN auth.synthetic_reset_identity AS uuid')
            const extra = shape === 'identity_column' ? ',user_id uuid'
                : shape === 'foreign_key' ? ',session_id uuid REFERENCES auth.sessions(id)'
                    : shape === 'unknown_identity_type' ? ',user_id bigint' : ',subject_id auth.synthetic_reset_identity'
            await db.query(`CREATE TABLE auth.schema_migrations(version varchar PRIMARY KEY${extra}); ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin`)
            const operator = await restrictedOperator()
            try {
                await db.query(`SET ROLE ${operator.role}`)
                await expect(operator.run(target)).rejects.toThrow(/permission denied for table schema_migrations/)
                await db.query('ROLLBACK; RESET ROLE')
                expect((await db.query('SELECT id FROM auth.users WHERE id=$1', [target.userId])).rowCount).toBe(1)
                expect((await db.query('SELECT id FROM public.subscription_payments WHERE id=$1', [target.paymentId])).rowCount).toBe(1)
                expect((await db.query('SELECT id FROM public.machines WHERE org_id=$1', [target.orgId])).rowCount).toBe(5)
            } finally {
                await operator.cleanup()
                await db.query('DROP TABLE auth.schema_migrations')
                if (shape === 'uuid_domain') await db.query('DROP DOMAIN auth.synthetic_reset_identity')
            }
        }
    })
})
