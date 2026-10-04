import type { Metadata } from 'next'
import { FounderAuthFrame } from '@/components/admin/auth-frame'
import { founderConsoleEnabled } from '@/lib/admin/founder'
import { safeFounderReturnPath } from '@/lib/admin/routes'
import { FounderLoginForm } from './login-form'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = { title: 'Founder sign-in — Weavly', robots: { index: false, follow: false } }

export default async function FounderLoginPage({ searchParams }: { searchParams: Promise<{ denied?: string; returnTo?: string }> }) {
    const params = await searchParams
    return <FounderAuthFrame title="Sign in to the founder console" description="Use the approved founder account. Verification is required before customer records can be opened."><FounderLoginForm enabled={founderConsoleEnabled()} denied={params.denied === '1'} returnTo={safeFounderReturnPath(params.returnTo)}/></FounderAuthFrame>
}
