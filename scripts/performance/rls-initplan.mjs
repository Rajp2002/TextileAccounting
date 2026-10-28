#!/usr/bin/env node
// Row-level-security policies that call auth.uid() bare are evaluated once per
// row; wrapped as (select auth.uid()) Postgres evaluates it once per query (an
// "initplan"). This script measures what that costs on the disposable
// PostgreSQL that `npm run test:db` uses (scripts/test-db/cluster.mjs: local,
// loopback only, every migration replayed). It never connects anywhere else.
//
// 1. Lists the policies, after all migrations, whose expressions call
//    auth.uid(), auth.jwt(), auth.role() or current_setting() outside any
//    sub-select (a call inside an uncorrelated sub-select already runs once).
// 2. Times Saved Costings' library read (the Lite page that reads through
//    row-level security) as a signed-in Lite owner with EXPLAIN ANALYZE: a
//    plain Lite org and one that came from Free, with 200 and --rows costings
//    per org (another org holds as many), first with the policies as they are,
//    then with the tier and Free-boundary checks evaluated once per query
//    (ONCE_PER_QUERY), in the same database. Seed rows take generic values,
//    with triggers and foreign keys off while seeding.
//
//   node scripts/performance/rls-initplan.mjs <output.json> [--rows 3000] [--runs 7]
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect, createSupabaseRoles, installSupabaseStubs, replayMigrations, startDisposableCluster } from '../test-db/cluster.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const outputPath = args.find(arg => !arg.startsWith('--') && !/^\d+$/.test(arg))
const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`)
    return index >= 0 ? Number(args[index + 1]) : fallback
}
const rows = option('rows', 3000)
const runs = option('runs', 7)

// Supabase's own definition (reads the sub claim, else the claims JSON), so a
// per-row call costs what it costs in production; the test stub is simpler.
const SUPABASE_AUTH_FUNCTIONS = `
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;`

const CALL = /auth\.(uid|jwt|role)\(\)|current_setting\(/

// A deparsed policy expression with every parenthesised sub-select removed.
function outsideSubselects(text) {
    let out = ''
    for (let index = 0; index < text.length; index += 1) {
        if (text.startsWith('( SELECT', index) || text.startsWith('(SELECT', index)) {
            let depth = 0
            for (; index < text.length; index += 1) {
                if (text[index] === '(') depth += 1
                else if (text[index] === ')' && --depth === 0) break
            }
            out += '(…)'
        } else {
            out += text[index]
        }
    }
    return out
}
const perRowCall = text => CALL.test(outsideSubselects(text ?? ''))

const OWNER = { userId: '11111111-1111-4111-8111-111111111111', orgId: 'aaaaaaaa-1111-4111-8111-111111111111' }
const OTHER_ORG = 'bbbbbbbb-2222-4222-8222-222222222222'

// Saved Costings' library read (getEstimatorQuotes): the owner's costings,
// newest first, one 500-row page.
const SAVED_COSTINGS_QUERY = `SELECT id, status, party_name, quality_label, quote_price_per_meter, landed_cost_per_meter, created_at, updated_at, costing_group_id, version_number, is_archived, is_favorite, record_kind, template_id
    FROM public.estimator_quotes WHERE org_id = '${OWNER.orgId}' ORDER BY created_at DESC, id DESC LIMIT 500`

// The once-per-query form of the two per-row checks on the costing tables, as
// migration 20261028120000_rls_checks_once_per_query.sql writes them (applied
// on top of the replayed migrations, so it is a no-op once that is replayed).
// The read policy already requires org_id to be the caller's org (from the
// JWT), so the tier check can take that org instead of each row's; and
// free_business_restricted(org) can only be true for the caller's own org, so
// the restrictive policy can compare org_id with that one org.
const ONCE_PER_QUERY = `
CREATE OR REPLACE FUNCTION weavly_private.free_business_restricted_org() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT membership.org_id FROM public.profiles AS membership
  WHERE membership.id = auth.uid() AND weavly_private.free_business_restricted(membership.org_id)
$$;
GRANT EXECUTE ON FUNCTION weavly_private.free_business_restricted_org() TO authenticated;
ALTER POLICY "Owners Read Estimator Quotes" ON public.estimator_quotes USING (
  ((( SELECT auth.jwt() AS jwt) ->> 'user_role'::text) = 'owner'::text)
  AND (org_id = (NULLIF((( SELECT auth.jwt() AS jwt) ->> 'org_id'::text), ''::text))::uuid)
  AND ( SELECT org_has_subscription_tier((NULLIF((auth.jwt() ->> 'org_id'::text), ''::text))::uuid, 'base'::text) )
);
ALTER POLICY free_business_boundary ON public.estimator_quotes
  USING (NOT coalesce(org_id = ( SELECT weavly_private.free_business_restricted_org() ), false))
  WITH CHECK (NOT coalesce(org_id = ( SELECT weavly_private.free_business_restricted_org() ), false));`

// A value for every NOT NULL column without a default, plus the given ones.
async function seed(db, table, count, overrides = {}) {
    const { rows: columns } = await db.query(`
        SELECT c.column_name, c.udt_name, c.is_nullable, c.column_default, c.is_identity, c.is_generated,
               (SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = c.udt_name ORDER BY e.enumsortorder LIMIT 1) AS first_label
        FROM information_schema.columns c WHERE c.table_schema = $1 AND c.table_name = $2 ORDER BY c.ordinal_position`, table.split('.'))
    const names = []
    const values = []
    for (const column of columns) {
        if (column.column_name in overrides) { names.push(column.column_name); values.push(overrides[column.column_name]); continue }
        if (column.is_nullable === 'YES' || column.column_default !== null || column.is_identity === 'YES' || column.is_generated === 'ALWAYS') continue
        names.push(column.column_name)
        values.push(column.first_label ? `'${column.first_label}'`
            : column.udt_name === 'uuid' ? 'gen_random_uuid()'
                : /int|numeric|float|double|real/.test(column.udt_name) ? '1'
                    : column.udt_name === 'date' ? 'current_date - (n % 365)'
                        : /timestamp/.test(column.udt_name) ? 'now() - make_interval(mins => n)'
                            : column.udt_name === 'bool' ? 'false'
                                : /json/.test(column.udt_name) ? "'{}'"
                                    : `'seed-' || n`)
    }
    await db.query(`INSERT INTO ${table} (${names.join(', ')}) SELECT ${values.join(', ')} FROM generate_series(1, ${count}) AS n`)
}

// One fresh database per scenario, cloned from the migrated template.
async function scenario(cluster, template, name, { costingsPerOrg, cameFromFree }) {
    const admin = connect(cluster)
    await admin.connect()
    await admin.query(`CREATE DATABASE ${name} TEMPLATE ${template}`)
    await admin.end()
    const db = connect({ ...cluster, database: name })
    db.on('error', () => {})
    await db.connect()
    try {
        // Seed as the superuser with triggers and foreign keys off.
        await db.query('SET session_replication_role = replica')
        await seed(db, 'auth.users', 1, { id: `'${OWNER.userId}'` }).catch(() => db.query(`INSERT INTO auth.users (id) VALUES ('${OWNER.userId}')`))
        for (const orgId of [OWNER.orgId, OTHER_ORG]) await seed(db, 'public.organizations', 1, { id: `'${orgId}'`, owner_id: `'${OWNER.userId}'` })
        await seed(db, 'public.profiles', 1, { id: `'${OWNER.userId}'`, org_id: `'${OWNER.orgId}'`, role: "'owner'" })
        await seed(db, 'public.org_subscriptions', 1, {
            org_id: `'${OWNER.orgId}'`, status: "'active'", plan_tier: "'lite'", current_start: "now() - interval '30 days'", current_end: "now() + interval '300 days'",
        })
        if (cameFromFree) {
            await seed(db, 'public.free_account_subjects', 1, { id: `'${OWNER.userId}'` })
            await seed(db, 'public.free_account_grants', 1, { org_id: `'${OWNER.orgId}'`, subject_id: `'${OWNER.userId}'` })
        }
        await seed(db, 'public.estimator_quotes', costingsPerOrg * 2, {
            org_id: `CASE WHEN n % 2 = 0 THEN '${OWNER.orgId}'::uuid ELSE '${OTHER_ORG}'::uuid END`,
            record_kind: "'costing'", created_at: 'now() - make_interval(mins => n)', updated_at: 'now() - make_interval(mins => n)',
        })
        await db.query('SET session_replication_role = origin')
        await db.query('ANALYZE public.estimator_quotes')
        const asIs = await timeOwnerRead(db, SAVED_COSTINGS_QUERY)
        await db.query(ONCE_PER_QUERY)
        const oncePerQuery = await timeOwnerRead(db, SAVED_COSTINGS_QUERY)
        return { name, costingsPerOrg, cameFromFree, asIs, oncePerQuery }
    } finally {
        await db.end()
    }
}

async function timeOwnerRead(db, query) {
    const claims = JSON.stringify({ sub: OWNER.userId, org_id: OWNER.orgId, user_role: 'owner', role: 'authenticated' })
    const times = []
    let plan = null
    let returned = null
    for (let index = 0; index < runs + 1; index += 1) {
        await db.query('BEGIN')
        await db.query(`SELECT set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [claims, OWNER.userId])
        await db.query('SET LOCAL ROLE authenticated')
        const { rows: explain } = await db.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`)
        await db.query('ROLLBACK')
        const root = explain[0]['QUERY PLAN'][0]
        if (index === 0) continue // warm-up
        times.push(root['Execution Time'])
        plan = root.Plan
        returned = root.Plan['Actual Rows']
    }
    times.sort((a, b) => a - b)
    const flatten = (node, depth = 0) => [`${'  '.repeat(depth)}${node['Node Type']}${node['Index Name'] ? ` (${node['Index Name']})` : ''} rows=${node['Actual Rows']}${node.Filter ? ` filter ${node.Filter.slice(0, 200)}` : ''}`, ...(node.Plans ?? []).flatMap(child => flatten(child, depth + 1))]
    return { medianMs: Math.round(times[Math.floor(times.length / 2)] * 100) / 100, rowsReturned: returned, plan: flatten(plan) }
}

async function main() {
    if (!outputPath) throw new Error('Pass an output JSON path')
    const cluster = await startDisposableCluster()
    const result = { generatedAt: new Date().toISOString(), rows, runs }
    try {
        const admin = connect(cluster)
        await admin.connect()
        await createSupabaseRoles(admin)
        await admin.query('CREATE DATABASE weavly_rls')
        await admin.end()
        const db = connect({ ...cluster, database: 'weavly_rls' })
        db.on('error', () => {})
        await db.connect()
        await installSupabaseStubs(db)
        const migrations = await replayMigrations(db, path.resolve(here, '../../supabase/migrations'))
        result.migrations = migrations
        await db.query(SUPABASE_AUTH_FUNCTIONS)

        const { rows: policies } = await db.query(`
            SELECT schemaname, tablename, policyname, cmd, roles::text AS roles, qual, with_check
            FROM pg_policies ORDER BY schemaname, tablename, policyname`)
        const perRow = policies.filter(policy => perRowCall(policy.qual) || perRowCall(policy.with_check))
        result.policyCount = policies.length
        result.perRowPolicies = perRow.map(({ schemaname, tablename, policyname, cmd, roles, qual, with_check: withCheck }) => ({ table: `${schemaname}.${tablename}`, policy: policyname, cmd, roles, qual, withCheck }))
        const byTable = {}
        for (const policy of perRow) byTable[`${policy.schemaname}.${policy.tablename}`] = (byTable[`${policy.schemaname}.${policy.tablename}`] ?? 0) + 1
        result.perRowByTable = byTable
        console.log(`${perRow.length} of ${policies.length} policies make an auth call per row, on ${Object.keys(byTable).length} tables:`)
        console.log(`  ${Object.entries(byTable).map(([table, count]) => `${table.replace('public.', '')} (${count})`).join(', ')}`)

        await db.end()

        // Saved Costings as a Lite owner, at two library sizes, for a plain Lite
        // org and for one that came from Free (it keeps a Free grant).
        result.savedCostings = []
        const sizes = [...new Set([200, rows])]
        for (const costingsPerOrg of sizes) {
            for (const cameFromFree of [false, true]) {
                const entry = await scenario(cluster, 'weavly_rls', `lite_${costingsPerOrg}_${cameFromFree ? 'free' : 'lite'}`, { costingsPerOrg, cameFromFree })
                result.savedCostings.push(entry)
                console.log(`Saved Costings, ${costingsPerOrg} costings per org, ${cameFromFree ? 'came from Free' : 'Lite only'}: ${entry.asIs.medianMs} ms -> ${entry.oncePerQuery.medianMs} ms (${entry.asIs.rowsReturned} -> ${entry.oncePerQuery.rowsReturned} rows)`)
            }
        }
        console.log('as-is plan (last scenario):'); for (const line of result.savedCostings.at(-1).asIs.plan) console.log(`  ${line}`)
        console.log('once-per-query plan:'); for (const line of result.savedCostings.at(-1).oncePerQuery.plan) console.log(`  ${line}`)

    } finally {
        cluster.stop()
    }
    writeFileSync(outputPath, JSON.stringify(result, null, 2))
    console.log(`wrote ${outputPath}`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
