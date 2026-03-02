import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vzhwahudircrpgtitwzd.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6aHdhaHVkaXJjcnBndGl0d3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNDAxOTcsImV4cCI6MjA4NjgxNjE5N30.avKJfS24wW6jIO5B6XOPIWlkt8axj7FVAdxfc9rT25Y'

const supabase = createClient(SUPABASE_URL, ANON_KEY)

async function test() {
    // Sign in as owner
    console.log('🔐 Signing in as owner...')
    const { data: { session }, error: signInErr } = await supabase.auth.signInWithPassword({
        email: 'owner.qa.test@mailinator.com',
        password: 'TestOwner123!'
    })
    if (signInErr) { console.error('Sign in failed:', signInErr.message); return }
    console.log('✅ Signed in!')

    // Check JWT claims
    const jwt = session?.access_token
    if (jwt) {
        const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString())
        console.log('  org_id:', payload.org_id || '❌ NOT PRESENT')
        console.log('  user_role:', payload.user_role || '❌ NOT PRESENT')
    }

    // Get org_id from profile
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', session.user.id).single()
    console.log('  Profile org_id:', profile?.org_id)

    // Try inserting a meter worker
    console.log('\n👷 Inserting meter worker "Test Worker"...')
    const { data, error } = await supabase
        .from('workers')
        .insert({
            org_id: profile?.org_id,
            name: 'Test Worker',
            is_active: true,
        })
        .select()

    if (error) {
        console.error('❌ Insert error:', JSON.stringify(error, null, 2))
        console.error('  Error type:', typeof error)
        console.error('  Is Error instance:', error instanceof Error)
    } else {
        console.log('✅ Worker inserted:', data)
    }

    // Also test fixed worker insert
    console.log('\n👷 Inserting fixed worker "Test Fixed"...')
    const { data: fd, error: fe } = await supabase
        .from('fixed_workers')
        .insert({
            org_id: profile?.org_id,
            name: 'Test Fixed',
            role: 'helper',
            monthly_salary: 15000,
            is_active: true,
        })
        .select()

    if (fe) {
        console.error('❌ Fixed worker insert error:', JSON.stringify(fe, null, 2))
    } else {
        console.log('✅ Fixed worker inserted:', fd)
    }

    // Check existing workers
    console.log('\n📋 Current workers:')
    const { data: workers } = await supabase.from('workers').select('*').eq('org_id', profile?.org_id)
    console.log('  Meter workers:', workers?.length ?? 0)
    workers?.forEach(w => console.log(`    - ${w.name} (active: ${w.is_active})`))

    const { data: fws } = await supabase.from('fixed_workers').select('*').eq('org_id', profile?.org_id)
    console.log('  Fixed workers:', fws?.length ?? 0)
    fws?.forEach(w => console.log(`    - ${w.name} (${w.role}, ₹${w.monthly_salary})`))
}

test().catch(console.error)
