import { createAdminClient } from '../lib/supabase/admin'

async function createAdmin(email: string, password: string, fullName: string) {
    console.log(`\n🚀 Initializing admin creation for: ${email}...`)

    const supabase = createAdminClient()

    // 1. Create auth user
    // We set email_confirm: true and user_metadata so the user is ready immediately
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { 
            role: 'admin', 
            full_name: fullName 
        }
    })

    if (authError) {
        console.error('❌ Error creating auth user:', authError.message)
        return
    }

    const userId = authData.user.id
    console.log(`✅ Auth user created with ID: ${userId}`)

    // 2. Create profile entry in public.profiles
    // The profiles table has a role check that includes 'admin' (added in recent migrations)
    const { error: profileError } = await supabase
        .from('profiles')
        .insert({
            id: userId,
            role: 'admin',
            full_name: fullName,
            email: email
        })

    if (profileError) {
        console.error('❌ Error creating profile:', profileError.message)
        // Cleanup: delete auth user if profile creation fails to maintain consistency
        console.log('🔄 Cleaning up auth user...')
        await supabase.auth.admin.deleteUser(userId)
        return
    }

    console.log('✅ Admin profile created successfully!')
    console.log('\n✨ Setup Complete!')
    console.log('--------------------------------------------------')
    console.log(`Email:    ${email}`)
    console.log(`Role:     admin`)
    console.log(`Redirect: /admin`)
    console.log('--------------------------------------------------')
    console.log('You can now log in at /login with these credentials.')
}

// CLI Argument Parsing
const email = process.argv[2]
const password = process.argv[3]
const fullName = process.argv[4] || 'System Admin'

if (!email || !password) {
    console.log('\n❌ Missing arguments!')
    console.log('Usage: npx tsx --env-file=.env.local scripts/create-admin.ts <email> <password> ["Full Name"]')
    console.log('Example: npx tsx --env-file=.env.local scripts/create-admin.ts admin@weavly.app mysecretpassword "Admin User"\n')
    process.exit(1)
}

createAdmin(email, password, fullName).catch((err) => {
    console.error('💥 Unexpected error:', err)
    process.exit(1)
})
