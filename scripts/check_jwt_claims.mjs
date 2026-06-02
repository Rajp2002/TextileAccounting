// Quick test: try to fetch workers as the supervisor to see exact error
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vzhwahudircrpgtitwzd.supabase.co'
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPERVISOR_EMAIL = process.env.SUPERVISOR_QA_EMAIL
const SUPERVISOR_PASSWORD = process.env.SUPERVISOR_QA_PASSWORD

if (!ANON_KEY || !SUPERVISOR_EMAIL || !SUPERVISOR_PASSWORD) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPERVISOR_QA_EMAIL, and SUPERVISOR_QA_PASSWORD before running this script.')
}

const supabase = createClient(SUPABASE_URL, ANON_KEY)

async function test() {
    console.log('🔐 Signing in as supervisor...')
    const { data: { session }, error: signInErr } = await supabase.auth.signInWithPassword({
        email: SUPERVISOR_EMAIL,
        password: SUPERVISOR_PASSWORD
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
