import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { FounderAuthFrame } from '@/components/admin/auth-frame'
import { requireFounderCandidate } from '@/lib/admin/founder'
import { createClient } from '@/lib/supabase/server'
import { safeFounderReturnPath } from '@/lib/admin/routes'
import { FounderVerifyForm } from './verify-form'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = { title: 'Verify founder access — Weavly', robots: { index: false, follow: false } }

export default async function FounderVerifyPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
    const params = await searchParams
    let factors: { id: string; label: string }[] = []
    try {
        await requireFounderCandidate()
        const supabase = await createClient()
        const result = await supabase.auth.mfa.listFactors()
        if (result.error) throw new Error('MFA source unavailable')
        factors = result.data.totp.filter(factor => factor.status === 'verified').map((factor, index) => ({ id: factor.id, label: `Authenticator ${index + 1}` }))
    } catch { redirect('/admin/login?denied=1') }
    return <FounderAuthFrame title="Verify founder access" description="Complete verification before any factory, support or payment records are loaded."><FounderVerifyForm factors={factors} returnTo={safeFounderReturnPath(params.returnTo)}/></FounderAuthFrame>
}
