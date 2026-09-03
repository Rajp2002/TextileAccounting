// Isolated PostgreSQL policy regression, never connects to production.
// Install @electric-sql/pglite@0.5.8 in a temporary directory, then run:
// PGLITE_MODULE=/absolute/path/node_modules/@electric-sql/pglite/dist/index.js node scripts/qa/verify-lite-qa-migration.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

if (!process.env.PGLITE_MODULE) throw new Error('Set PGLITE_MODULE to the isolated PGlite module path')
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db = await PGlite.create()
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const org = uuid(1), otherOrg = uuid(2), owner = uuid(11), otherOwner = uuid(12), supervisor = uuid(13)
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    CREATE TABLE public.organizations(id uuid PRIMARY KEY, product_experience text DEFAULT 'full_suite', locked boolean DEFAULT false);
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, org_id uuid, role text);
    CREATE TABLE public.org_subscriptions(org_id uuid, plan_id text, plan_tier text, status text DEFAULT 'active', current_start timestamptz, current_end timestamptz, razorpay_payment_id text);
    CREATE TABLE public.subscription_payments(org_id uuid);
    CREATE TABLE public.organization_billing_profiles(org_id uuid);
    CREATE TABLE public.estimator_quotes(id uuid PRIMARY KEY, org_id uuid, source_quote_id uuid, template_id uuid, note text);
    CREATE TABLE public.estimator_templates(id uuid PRIMARY KEY, org_id uuid, note text);
    CREATE TABLE public.estimator_costing_attestations(id uuid PRIMARY KEY, org_id uuid, user_id uuid);
    CREATE FUNCTION public.get_user_org_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
      $$ SELECT org_id FROM public.profiles WHERE id = auth.uid() $$;
    CREATE FUNCTION public.check_org_lockdown(p_org_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
      $$ SELECT locked FROM public.organizations WHERE id = p_org_id $$;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
    REVOKE ALL ON public.estimator_costing_attestations FROM anon, authenticated;
    INSERT INTO public.organizations(id) VALUES ('${org}'), ('${otherOrg}'), ('${uuid(3)}'), ('${uuid(4)}'), ('${uuid(5)}'), ('${uuid(6)}');
    INSERT INTO public.profiles VALUES ('${owner}','${org}','owner'), ('${otherOwner}','${otherOrg}','owner'), ('${supervisor}','${org}','supervisor');
    INSERT INTO public.org_subscriptions(org_id,plan_tier) VALUES ('${org}','lite'), ('${otherOrg}','base'), ('${uuid(3)}','lite'), ('${uuid(3)}','premium'), ('${uuid(4)}','trial'), ('${uuid(4)}','lite'), ('${uuid(5)}',NULL), ('${uuid(5)}','lite');
    INSERT INTO public.subscription_payments VALUES ('${org}'), ('${otherOrg}');
    INSERT INTO public.organization_billing_profiles VALUES ('${org}'), ('${otherOrg}');
    INSERT INTO public.estimator_quotes(id,org_id) VALUES ('${uuid(21)}','${org}'), ('${uuid(22)}','${otherOrg}');
    INSERT INTO public.estimator_templates(id,org_id) VALUES ('${uuid(21)}','${org}'), ('${uuid(22)}','${otherOrg}');
    INSERT INTO public.estimator_costing_attestations VALUES ('${uuid(31)}','${org}','${owner}');
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Tenant Isolation" ON public.profiles FOR SELECT USING (id=auth.uid() OR org_id=(auth.jwt()->>'org_id')::uuid);
    CREATE POLICY "Users can read org profiles" ON public.profiles FOR SELECT USING (org_id=public.get_user_org_id());
    CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (id=auth.uid());
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid()=id);
    ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.organization_billing_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.estimator_costing_attestations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY owners_see_own_subscription ON public.org_subscriptions FOR SELECT USING (org_id=(SELECT profiles.org_id FROM profiles WHERE profiles.id=auth.uid() AND profiles.role='owner'));
    CREATE POLICY owners_see_own_payments ON public.subscription_payments FOR SELECT USING (org_id=(SELECT profiles.org_id FROM profiles WHERE profiles.id=auth.uid() AND profiles.role='owner'));
    CREATE POLICY billing_profile_owner_select ON public.organization_billing_profiles FOR SELECT TO authenticated USING (org_id=(SELECT profiles.org_id FROM profiles WHERE profiles.id=auth.uid() AND profiles.role='owner'));
  `)
  // Use the real entitlement implementation, not a permissive test stub.
  const restructure = readFileSync('supabase/migrations/20260831150000_lite_base_plan_restructure.sql', 'utf8')
  const entitlement = restructure.match(/CREATE OR REPLACE FUNCTION public\.org_has_subscription_tier\([\s\S]*?\$\$;/)?.[0]
  assert.ok(entitlement)
  await db.exec(entitlement)
  for (const [table, label] of [['estimator_quotes', 'Estimator Quotes'], ['estimator_templates', 'Estimator Templates']]) {
    const read = "((auth.jwt()->>'user_role')='owner' AND org_id=NULLIF(auth.jwt()->>'org_id','')::uuid AND public.org_has_subscription_tier(org_id,'base'))"
    const write = `${read} AND NOT public.check_org_lockdown(org_id)`
    await db.exec(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Owners Manage ${label}" ON public.${table} FOR ALL TO authenticated USING (${write}) WITH CHECK (${write});
      CREATE POLICY "Owners Read ${label}" ON public.${table} FOR SELECT TO authenticated USING (${read});`)
  }

  async function attempt(sql) {
    await db.exec('SAVEPOINT probe')
    try {
      const result = await db.query(sql)
      return { allowed: true, count: result.rows.length }
    } catch (error) {
      assert.equal(error.code, '42501')
      return { allowed: false, count: 0 }
    } finally {
      await db.exec('ROLLBACK TO SAVEPOINT probe')
    }
  }

  async function matrix() {
    const output = {}
    for (const [name, user, claimedOrg, userRole, dbRole, locked, expired] of [
      ['owner', owner, org, 'owner', 'authenticated', false, false],
      ['locked', owner, org, 'owner', 'authenticated', true, false],
      ['expired', owner, org, 'owner', 'authenticated', false, true],
      ['supervisor', supervisor, org, 'supervisor', 'authenticated', false, false],
      ['forged_org', owner, otherOrg, 'owner', 'authenticated', false, false],
      ['no_claims', null, null, null, 'authenticated', false, false],
      ['refresh', owner, null, 'owner', 'authenticated', false, false],
      ['anon', null, null, null, 'anon', false, false],
      ['service', null, null, null, 'service_role', false, false],
    ]) {
      await db.exec('BEGIN')
      await db.query('UPDATE organizations SET locked=$1 WHERE id=$2', [locked, org])
      if (expired) await db.exec(`UPDATE org_subscriptions SET current_end=now()-interval '2 days' WHERE org_id='${org}'`)
      await db.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, org_id: claimedOrg, user_role: userRole, role: dbRole })])
      await db.exec(`SET LOCAL ROLE ${dbRole}`)
      const probes = {}
      for (const table of ['estimator_quotes', 'estimator_templates']) {
        probes[`${table}:read`] = await attempt(`SELECT id FROM ${table}`)
        probes[`${table}:insert`] = await attempt(`INSERT INTO ${table}(id,org_id) VALUES ('${uuid(99)}','${org}') RETURNING id`)
        probes[`${table}:foreign_insert`] = await attempt(`INSERT INTO ${table}(id,org_id) VALUES ('${uuid(99)}','${otherOrg}') RETURNING id`)
        probes[`${table}:update`] = await attempt(`UPDATE ${table} SET note='changed' WHERE id='${uuid(21)}' RETURNING id`)
        probes[`${table}:reassign`] = await attempt(`UPDATE ${table} SET org_id='${otherOrg}' WHERE id='${uuid(21)}' RETURNING id`)
        probes[`${table}:delete`] = await attempt(`DELETE FROM ${table} WHERE id='${uuid(21)}' RETURNING id`)
      }
      for (const table of ['profiles', 'org_subscriptions', 'subscription_payments', 'organization_billing_profiles', 'estimator_costing_attestations']) probes[`${table}:read`] = await attempt(`SELECT * FROM ${table}`)
      probes['attestation:insert'] = await attempt(`INSERT INTO estimator_costing_attestations VALUES ('${uuid(99)}','${org}','${owner}') RETURNING id`)
      output[name] = probes
      await db.exec('ROLLBACK')
    }
    return output
  }
  const before = await matrix()
  const migration = readFileSync('supabase/migrations/20260903115520_lite_qa_metadata_and_advisor_hygiene.sql', 'utf8')
  await db.exec(migration)
  const after = await matrix()
  assert.deepEqual(after, before, 'Policy rewrite must preserve every access outcome')
  assert.deepEqual(after.owner['estimator_quotes:read'], { allowed: true, count: 1 })
  assert.deepEqual(after.owner['estimator_quotes:insert'], { allowed: true, count: 1 })
  assert.equal(after.owner['estimator_quotes:foreign_insert'].allowed, false)
  assert.equal(after.owner['estimator_quotes:reassign'].allowed, false)
  assert.equal(after.locked['estimator_quotes:read'].count, 1)
  assert.equal(after.locked['estimator_quotes:update'].count, 0)
  assert.equal(after.expired['estimator_quotes:read'].count, 0)
  assert.equal(after.supervisor['estimator_quotes:read'].count, 0)
  assert.equal(after.forged_org['estimator_quotes:read'].count, 0)
  assert.equal(after.refresh['profiles:read'].count, 2)
  assert.equal(after.owner['attestation:insert'].allowed, false)
  assert.equal(after.anon['estimator_costing_attestations:read'].allowed, false)
  assert.equal(after.service['attestation:insert'].allowed, true)
  const metadata = await db.query('SELECT product_experience FROM organizations ORDER BY id')
  assert.deepEqual(metadata.rows.map(row => row.product_experience), ['base', 'base', 'full_suite', 'full_suite', 'full_suite', 'full_suite'])
  const indexes = await db.query("SELECT count(*)::integer AS count FROM pg_indexes WHERE indexname IN ('estimator_attestations_org_idx','estimator_attestations_user_idx','estimator_quotes_source_same_org_idx','estimator_quotes_template_idx','org_subscriptions_plan_idx')")
  assert.equal(indexes.rows[0].count, 5)
  // Repo-created databases may lack both the three drift-only read policies
  // and get_user_org_id(). Verify that the profile rewrite supports that shape.
  await db.exec('DROP POLICY "Users read own or organization profiles" ON public.profiles; DROP FUNCTION public.get_user_org_id(); CREATE POLICY "Tenant Isolation" ON public.profiles FOR SELECT USING (id=auth.uid() OR org_id=(auth.jwt()->>\'org_id\')::uuid)')
  await db.exec(migration.slice(migration.indexOf('DROP POLICY IF EXISTS "Tenant Isolation"')))
  const freshPolicy = await db.query("SELECT qual FROM pg_policies WHERE tablename='profiles' AND cmd='SELECT'")
  assert.equal(freshPolicy.rows.length, 1)
  assert.ok(!freshPolicy.rows[0].qual.includes('get_user_org_id'))
  await db.exec('BEGIN')
  await db.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: owner, org_id: org, user_role: 'owner', role: 'authenticated' })])
  await db.exec('SET LOCAL ROLE authenticated')
  assert.equal((await db.query('SELECT id FROM profiles')).rows.length, 2)
  await db.exec('ROLLBACK')
  console.log('PASS: migration syntax, five indexes, conservative metadata repair; 162 before/after policy probes across nine identity/lifecycle states; fresh-schema profile fallback.')
} finally {
  await db.close()
}
