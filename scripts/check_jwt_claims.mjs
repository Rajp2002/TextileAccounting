// Quick test: try to fetch workers as the supervisor to see exact error
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vzhwahudircrpgtitwzd.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6aHdhaHVkaXJjcnBndGl0d3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNDAxOTcsImV4cCI6MjA4NjgxNjE5N30.avKJfS24wW6jIO5B6XOPIWlkt8axj7FVAdxfc9rT25Y'

const supabase = createClient(SUPABASE_URL, ANON_KEY)

async function test() {
    console.log('🔐 Signing in as supervisor...')
    const { data: { session }, error: signInErr } = await supabase.auth.signInWithPassword({
        email: 'supervisor.qa.test@mailinator.com',
        password: 'TestSuper123!'
    })

    if (signInErr) { console.error('Sign in failed:', signInErr.message); return }
    console.log('✅ Signed in!')

    // Decode the JWT to see if org_id claim is present
    const jwt = session?.access_token
    if (jwt) {
        const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString())
        console.log('\n📋 JWT Claims:')
        console.log('  org_id:', payload.org_id || '❌ NOT PRESENT')
        console.log('  user_role:', payload.user_role || '❌ NOT PRESENT')
        console.log('  role:', payload.role)
        console.log('  sub:', payload.sub)
        console.log('  Full payload:', JSON.stringify(payload, null, 2))
    }

    // Try fetching workers
    console.log('\n👷 Fetching workers...')
    const { data, error } = await supabase.from('workers').select('*').limit(5)
    if (error) console.error('  Workers fetch error:', error.message, error.code)
    else console.log('  Workers fetched:', data?.length ?? 0, 'rows')

    // Also check profile to see what org_id is stored
    console.log('\n👤 Checking profile...')
    const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session?.user.id)
        .single()
    if (profileErr) console.error('  Profile error:', profileErr.message)
    else console.log('  Profile:', JSON.stringify(profile, null, 2))
}

test().catch(console.error)
