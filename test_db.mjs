import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = fs.readFileSync('.env.local', 'utf-8')
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1]
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    const { data: orgs } = await supabase.from('organizations').select('id').limit(1)
    if (!orgs || orgs.length === 0) return console.log("No orgs")
    const orgId = orgs[0].id
    
    console.log("Testing with role = 'plumber'")
    const res1 = await supabase.from('fixed_workers').insert({ org_id: orgId, name: 'Test Plumber', role: 'plumber', monthly_salary: 1000 })
    console.log("Res1:", res1.error ? res1.error.message : "Success")

    console.log("Testing with role = 'master'")
    const res2 = await supabase.from('fixed_workers').insert({ org_id: orgId, name: 'Test Master', role: 'master', monthly_salary: 1000 })
    console.log("Res2:", res2.error ? res2.error.message : "Success")
    
    if (!res2.error) {
       await supabase.from('fixed_workers').delete().eq('name', 'Test Master')
       await supabase.from('fixed_workers').delete().eq('name', 'Test Plumber')
    }
}
test()
