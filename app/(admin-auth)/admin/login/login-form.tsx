'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { founderSignIn } from '@/app/(admin-auth)/admin/login/actions'
import type { FounderAuthState } from '@/lib/admin/auth-input'

export function FounderLoginForm({ enabled, denied, returnTo }: { enabled: boolean; denied: boolean; returnTo: string }) {
    const [state, action, pending] = useActionState<FounderAuthState, FormData>(founderSignIn, {})
    useEffect(() => {
        if (state.code === 'WRONG_EMAIL' && state.message) toast.error(state.message, { id: state.requestId })
    }, [state.code, state.message, state.requestId])
    return <>
        {!enabled && <p role="status" className="mb-5 rounded-lg border border-hairline bg-surface-soft p-4 text-sm leading-6">Founder access is awaiting approved identity and security setup.</p>}
        {denied && <p role="alert" className="mb-5 rounded-lg border border-risk/20 bg-risk-soft p-4 text-sm leading-6 text-risk">Founder access could not be verified. Sign in with the approved founder account, or sign out to change accounts.</p>}
        <form action={action} className="space-y-5" aria-busy={pending}>
            <input type="hidden" name="returnTo" value={returnTo}/>
            <div className="space-y-2"><Label htmlFor="founder-email">Email address</Label><Input className="h-11" id="founder-email" name="email" type="email" autoComplete="username" maxLength={254} required disabled={pending || !enabled}/></div>
            <div className="space-y-2"><Label htmlFor="founder-password">Password</Label><Input className="h-11" id="founder-password" name="password" type="password" autoComplete="current-password" maxLength={1024} required disabled={pending || !enabled}/></div>
            {state.message && <p role="alert" id="founder-login-error" className="text-sm leading-6 text-risk">{state.message}</p>}
            <Button className="min-h-11 w-full bg-ink text-surface hover:bg-loom-elevated" type="submit" disabled={pending || !enabled}>{pending ? 'Checking sign-in…' : 'Continue to verification'}</Button>
            <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">Recover sign-in access</Link>
        </form>
        <form action="/auth/signout" method="post" className="mt-4 border-t border-hairline pt-4"><Button type="submit" variant="outline" className="min-h-11 w-full">Sign out / change account</Button></form>
    </>
}
