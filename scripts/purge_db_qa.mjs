import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vzhwahudircrpgtitwzd.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY before running this script.')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function purge() {
    console.log('🗑️  Starting full data purge...')

    // Workers has bigint ID — delete it first (child of organizations)
    const { error: wErr } = await supabase.from('workers').delete().gte('id', 0)
    if (wErr) console.error(`  ❌ workers: ${wErr.message}`)
    else console.log(`  ✅ workers cleared`)

    // All other tables have UUID IDs or created_at — clear children before parents
    const uuidTables = [
        'daily_brief_logs',
        'payroll_payments',
        'attendance',
        'production_logs',
        'machine_assignments',
        'machines',
        'fixed_workers',
        'profiles',
        'organizations',
    ]

    for (const table of uuidTables) {
        const { error } = await supabase.from(table).delete().gte('created_at', '2000-01-01')
        if (error) {
            // Fallback: try UUID id filter
            const { error: e2 } = await supabase.from(table).delete().gte('id', '00000000-0000-0000-0000-000000000000')
            if (e2) console.error(`  ❌ ${table}: ${e2.message}`)
            else console.log(`  ✅ ${table} cleared`)
        } else {
            console.log(`  ✅ ${table} cleared`)
        }
    }

    // Delete all auth users via admin API
    const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers()
    if (listErr) { console.error('❌ Could not list auth users:', listErr.message); return }

    const users = usersData.users
    console.log(`\n🔐 Deleting ${users.length} auth user(s)...`)
    for (const user of users) {
        const { error } = await supabase.auth.admin.deleteUser(user.id)
        if (error) console.error(`  ❌ ${user.email}: ${error.message}`)
        else console.log(`  ✅ Deleted: ${user.email}`)
    }

    console.log('\n✅ Purge complete! Database is clean.')
}

purge().catch(console.error)
