import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vzhwahudircrpgtitwzd.supabase.co'
const ANON_KEY = '***REMOVED_JWT***'

const org_id = '38932c6c-526d-40fd-bb3b-6054d72036a7' // Anil/Sunil's Org

async function verify() {
    const supabase = createClient(SUPABASE_URL, ANON_KEY)

    console.log('--- Testing Orders Query (as per production/page.tsx) ---')
    const { data, error } = await supabase
        .from('orders')
        .select('id, party_name, quality_id, qualities(name), status')
        .eq('org_id', org_id)
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
