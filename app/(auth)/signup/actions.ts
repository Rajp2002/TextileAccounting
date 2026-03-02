'use server'

import { createClient } from '@/lib/supabase/server'

export async function signUpWithEmail(formData: FormData) {
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    const role = formData.get('role') as string
    const factoryId = formData.get('factoryId') as string | null
    const orgName = formData.get('orgName') as string | null

    // Server-side validation
    if (!name || !email || !password || !role) {
        return { error: 'All fields are required.' }
    }

    if (password.length < 6) {
        return { error: 'Password must be at least 6 characters.' }
    }

    if (password !== confirmPassword) {
        return { error: 'Passwords do not match.' }
    }

    if (role !== 'owner' && role !== 'supervisor') {
        return { error: 'Invalid role.' }
    }

    if (role === 'supervisor' && (!factoryId || !factoryId.trim())) {
        return { error: 'Factory ID is required for supervisors.' }
    }

    if (role === 'owner' && (!orgName || !orgName.trim())) {
        return { error: 'Organization name is required for owners.' }
    }

    const supabase = await createClient()

    // For supervisors, validate factory ID exists before creating the user
    if (role === 'supervisor') {
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id')
            .eq('join_code', factoryId!.trim().toUpperCase())
            .maybeSingle()

        if (orgError || !org) {
            return { error: 'Invalid Factory ID. Please check with your factory owner.' }
        }
    }

    // Sign up via Supabase Auth — sends confirmation email automatically
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${siteUrl}/auth/callback`,
            data: {
                full_name: name,
                role,
                join_code: role === 'supervisor' ? factoryId!.trim().toUpperCase() : null,
                org_name: role === 'owner' ? orgName!.trim() : null,
            }
        }
    })

    if (error) {
        console.error('Signup error:', error)
        if (error.message?.includes('already registered')) {
            return { error: 'An account with this email already exists. Please log in instead.' }
        }
        return { error: error.message }
    }

    // Check if email confirmation is required (user won't have a session yet)
    if (data.user && !data.session) {
        return { success: true, message: 'Check your email to verify your account.' }
    }

    // If email confirmation is disabled (dev mode), user gets a session immediately
    // Create profile right away since we have the session
    if (data.session) {
        try {
            const userId = data.session.user.id
            let orgId = ''

            if (role === 'owner') {
                const { data: org, error: orgError } = await supabase
                    .from('organizations')
                    .insert({
                        name: orgName!.trim(),
                        owner_id: userId,
                    })
                    .select('id')
                    .single()

                if (orgError) throw orgError
                orgId = org.id
            } else if (role === 'supervisor') {
                const { data: org, error: orgError } = await supabase
                    .from('organizations')
                    .select('id')
                    .eq('join_code', factoryId!.trim().toUpperCase())
                    .single()

                if (orgError || !org) throw new Error('Invalid Factory ID')
                orgId = org.id
            }

            if (orgId) {
                await supabase
                    .from('profiles')
                    .insert({
                        id: userId,
                        org_id: orgId,
                        role,
                        full_name: name,
                        email,
                        test_password: password,
                    })
            }
        } catch (profileError: any) {
            console.error('Profile creation error:', profileError)
            // User is created but profile failed — they'll hit onboarding
        }

        return { success: true, confirmed: true, role }
    }

    return { success: true, message: 'Check your email to verify your account.' }
}
