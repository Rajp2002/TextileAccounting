'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { founderVerify } from './actions'
import type { FounderAuthState } from '@/lib/admin/auth-input'

export function FounderVerifyForm({ factors, returnTo }: { factors: { id: string; label: string }[]; returnTo: string }) {
    const [state, action, pending] = useActionState<FounderAuthState, FormData>(founderVerify, {})
    return <>
        {factors.length ? <form action={action} className="space-y-5" aria-busy={pending}>
            <input type="hidden" name="returnTo" value={returnTo}/>
            {factors.length === 1 ? <input type="hidden" name="factorId" value={factors[0].id}/> : <fieldset disabled={pending} className="space-y-3"><legend className="mb-2 text-sm font-medium">Choose your authenticator</legend>{factors.map((factor, index) => <label key={factor.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm"><input className="size-4 accent-ink" type="radio" name="factorId" value={factor.id} defaultChecked={index === 0}/>{factor.label}</label>)}</fieldset>}
            <div className="space-y-2"><Label htmlFor="founder-code">Authenticator code</Label><Input id="founder-code" className="h-11 font-mono tracking-widest" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={pending} aria-describedby="founder-code-help"/><p id="founder-code-help" className="text-xs text-subtle">Enter the current six-digit code from your authenticator.</p></div>
            {state.message && <p role="alert" className="text-sm leading-6 text-risk">{state.message}</p>}
            <Button className="min-h-11 w-full bg-ink text-surface hover:bg-loom-elevated" type="submit" disabled={pending}>{pending ? 'Verifying access…' : 'Verify and open console'}</Button>
        </form> : <p role="status" className="rounded-lg border border-hairline bg-surface-soft p-4 text-sm leading-6">A verified authenticator has not been connected to this account. Founder access remains closed until approved MFA setup and recovery are completed through the secure setup process.</p>}
        <p className="mt-5 text-sm leading-6 text-subtle">If your authenticator is unavailable, use the approved founder recovery process. This screen cannot enroll or replace a factor.</p>
        <form action="/auth/signout" method="post" className="mt-5"><Button variant="outline" type="submit" className="min-h-11 w-full">Cancel and sign out</Button></form>
    </>
}
