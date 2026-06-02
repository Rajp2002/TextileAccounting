import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vzhwahudircrpgtitwzd.supabase.co'
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

const orgId = process.env.VERIFY_ORDERS_ORG_ID ?? ''

if (!ANON_KEY || !orgId) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_ANON_KEY and VERIFY_ORDERS_ORG_ID before running this script.')
}

async function verify() {
    const supabase = createClient(SUPABASE_URL, ANON_KEY)

    console.log('--- Testing Orders Query (as per production/page.tsx) ---')
    const { data, error } = await supabase
        .from('orders')
        .select('id, party_name, quality_id, qualities(name), status')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .order('party_name', { ascending: true })

    if (error) {
        console.error('Query Error:', error)
        return
    }

    console.log(`Found ${data.length} active orders.`)
    data.forEach(o => {
        const quality = Array.isArray(o.qualities) ? o.qualities[0] : o.qualities
        console.log(`- Order: ${o.party_name} | ID: ${o.id} | Quality: ${quality?.name || 'Unknown'}`)
    })

    const hasPartyB = data.some(o => o.party_name.toLowerCase().includes('party b'))
    if (hasPartyB) {
        console.log('\n✅ SUCCESS: Party B is present in the query results.')
    } else {
        console.log('\n❌ FAILURE: Party B is missing from the query results.')
    }
}

verify()
