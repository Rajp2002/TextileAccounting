import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testDuplicateAssignment() {
    console.log("Fetching org and worker...")
    const { data: orgs } = await supabase.from('organizations').select('id').limit(1)
    const orgId = orgs[0].id

    const { data: machines } = await supabase.from('machines').select('id').eq('org_id', orgId).limit(2)
    if (machines.length < 2) {
        console.log("Need at least 2 machines")
        return
    }

    const { data: workers } = await supabase.from('workers').select('id').eq('org_id', orgId).limit(1)
    const workerId = workers[0].id

    console.log(`Assigning worker ${workerId} to machine ${machines[0].id}...`)
    const res1 = await supabase.from('machine_assignments').upsert({
        org_id: orgId,
        machine_id: machines[0].id,
        worker_id: workerId,
        shift: 'day'
    }, { onConflict: 'org_id,machine_id,shift' })
    console.log("Res1:", res1.error ? res1.error : "Success")

    console.log(`Assigning worker ${workerId} to machine ${machines[1].id} (same shift)...`)
    const res2 = await supabase.from('machine_assignments').upsert({
        org_id: orgId,
        machine_id: machines[1].id,
        worker_id: workerId,
        shift: 'day'
    }, { onConflict: 'org_id,machine_id,shift' })
    console.log("Res2:", res2.error ? res2.error : "Success")
}

testDuplicateAssignment()
