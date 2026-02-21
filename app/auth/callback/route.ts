import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
            console.error('Auth Code Exchange Error:', error)
            return NextResponse.redirect(`${origin}/auth/auth-code-error`)
        }

        // Session established — get user and check/create profile
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
            const forwardedHost = request.headers.get('x-forwarded-host')
            const isLocalEnv = process.env.NODE_ENV === 'development'
            const base = isLocalEnv ? origin : (forwardedHost ? `https://${forwardedHost}` : origin)

            // Check if profile already exists
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .maybeSingle()

            if (profile) {
                // Profile exists — redirect by role
                if (profile.role === 'owner') {
                    return NextResponse.redirect(`${base}/owner/analytics`)
                } else {
                    return NextResponse.redirect(`${base}/supervisor/production`)
                }
            }

            // No profile — try to create from user_metadata
            const metadata = user.user_metadata
            if (metadata?.role && metadata?.full_name) {
                try {
                    let orgId = ''

                    if (metadata.role === 'owner' && metadata.org_name) {
                        const { data: org, error: orgError } = await supabase
                            .from('organizations')
                            .insert({
                                name: metadata.org_name,
                                owner_id: user.id,
                            })
                            .select('id')
                            .single()

                        if (orgError) throw orgError
                        orgId = org.id
                    } else if (metadata.role === 'supervisor' && metadata.join_code) {
                        const { data: org, error: orgError } = await supabase
                            .from('organizations')
                            .select('id')
                            .eq('join_code', metadata.join_code)
                            .single()

                        if (orgError || !org) throw new Error('Invalid Factory ID')
                        orgId = org.id
                    }

                    if (orgId) {
                        await supabase
                            .from('profiles')
                            .insert({
                                id: user.id,
                                org_id: orgId,
                                role: metadata.role,
                                full_name: metadata.full_name,
                                email: user.email,
                            })

                        // Redirect by newly created role
                        if (metadata.role === 'owner') {
                            return NextResponse.redirect(`${base}/owner/analytics`)
                        } else {
                            return NextResponse.redirect(`${base}/supervisor/production`)
                        }
                    }
                } catch (err) {
                    console.error('Profile creation in callback failed:', err)
                }
            }

            // Fallback — redirect to onboarding
            return NextResponse.redirect(`${base}/onboarding`)
        }
    }

    // No code or exchange failed
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
