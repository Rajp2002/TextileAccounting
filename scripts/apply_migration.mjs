// Apply the machine_assignments unique constraint migration via Supabase Management API
// This directly executes DDL against the database.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vzhwahudircrpgtitwzd.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
    throw new Error('Set SUPABASE_SERVICE_ROLE_KEY before running this script.')
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

async function runBrowserMigration() {
    // Try to use the Supabase REST API to run SQL via pg_dump / pg endpoint
    // The service role can call the /sql endpoint on some Supabase plans
    const sql = `
    -- Fix machine_assignments unique constraint
    ALTER TABLE machine_assignments
        DROP CONSTRAINT IF EXISTS machine_assignments_machine_id_shift_key;

    ALTER TABLE machine_assignments
        ADD CONSTRAINT machine_assignments_org_machine_shift_unique
        UNIQUE (org_id, machine_id, shift);
  `

    console.log('Attempting to apply migration via Management API...')
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
    })
    const data = await res.json()
    console.log('Management API response status:', res.status)
    console.log('Response:', JSON.stringify(data, null, 2))
}

// Alternative: Use supabase's internal pg endpoint if management API fails
async function runViaSupabaseRPC() {
    // We can create a helper function that we immediately drop after use
    // This is a workaround when exec_sql doesn't exist
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    })

    // Step 1: Create a temporary SQL execution function
    const createFnRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_migration`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey': SERVICE_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    })
    console.log('RPC status:', createFnRes.status)

    // Last resort: Check if we can check existing constraints to confirm the problem
    console.log('\nVerifying current constraint state on machine_assignments...')
    const { error } = await supabase
        .from('machine_assignments')
        .select('id')
        .limit(1)

    if (error) {
        console.log('Select error:', error.message)
    } else {
        console.log('Table accessible. Testing upsert with (machine_id, shift) conflict target...')

        // Test existing constraint (machine_id, shift only)
        const testRes = await supabase
            .from('machine_assignments')
            .upsert({
                org_id: '7217fb16-e45c-4c6b-aad2-c74f9092c6d1',
                machine_id: '00000000-0000-0000-0000-000000000001', // fake
                worker_id: 1, // fake
                shift: 'day'
            }, { onConflict: 'machine_id,shift' })

        // Expected to fail due to FK constraint, not constraint issue
        console.log('Old onConflict (machine_id,shift) error:', testRes.error?.code, testRes.error?.message)

        // Test new constraint target
        const testRes2 = await supabase
            .from('machine_assignments')
            .upsert({
                org_id: '7217fb16-e45c-4c6b-aad2-c74f9092c6d1',
                machine_id: '00000000-0000-0000-0000-000000000001',
                worker_id: 1,
                shift: 'day'
            }, { onConflict: 'org_id,machine_id,shift' })

        console.log('New onConflict (org_id,machine_id,shift) error:', testRes2.error?.code, testRes2.error?.message)
        console.log('(If new one says "no unique constraint" the migration is still needed; if FK/other error, the constraint now exists)')
    }
}

runBrowserMigration().then(() => runViaSupabaseRPC()).catch(console.error)
