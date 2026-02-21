import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function purgeAllUsers() {
    console.log('Starting purging process...')

    // 1. Delete from public tables first (disable RLS if possible, or use service role which bypasses it)
    console.log('Deleting from public tables...')

    // Delete Logs
    const { error: logsError } = await supabase.from('production_logs').delete().neq('id', 0) // Delete all
    if (logsError) console.error('Error deleting logs:', logsError.message)
    else console.log('Deleted production_logs')

    // Delete Workers
    const { error: workersError } = await supabase.from('workers').delete().neq('id', 0)
    if (workersError) console.error('Error deleting workers:', workersError.message)
    else console.log('Deleted workers')

    // Delete Machines
    const { error: machinesError } = await supabase.from('machines').delete().neq('name', '_impossible_') // UUID hack
    if (machinesError) console.error('Error deleting machines:', machinesError.message)
    else console.log('Deleted machines')

    // Delete Profiles
    const { error: profilesError } = await supabase.from('profiles').delete().neq('role', '_impossible_')
    if (profilesError) console.error('Error deleting profiles:', profilesError.message)
    else console.log('Deleted profiles')

    // Delete Organizations
    const { error: orgsError } = await supabase.from('organizations').delete().neq('name', '_impossible_')
    if (orgsError) console.error('Error deleting organizations:', orgsError.message)
    else console.log('Deleted organizations')


    // 2. Delete Auth Users
    let { data: { users }, error } = await supabase.auth.admin.listUsers()

    if (error) {
        console.error('Error fetching users:', error)
        return
    }

    if (!users || users.length === 0) {
        console.log('No users found to delete.')
        return
    }

    console.log(`Found ${users.length} users. Deleting...`)

    for (const user of users) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
        if (deleteError) {
            console.error(`Failed to delete user ${user.email}:`, deleteError.message)
        } else {
            console.log(`Deleted user: ${user.email}`)
        }
    }

    console.log('Purge complete.')
}

purgeAllUsers()
