'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { founderBeginEnrollment, founderVerify } from '@/app/(admin-auth)/admin/verify/actions'
import type { FounderAuthState } from '@/lib/admin/auth-input'
import type { FounderEnrollmentState } from '@/lib/admin/founder-mfa'

export function FounderVerifyForm({ factors, returnTo, enrollmentEnabled = false }: { factors: { id: string; label: string }[]; returnTo: string; enrollmentEnabled?: boolean }) {
    const [state, action, pending] = useActionState<FounderAuthState, FormData>(founderVerify, {})
    const [enrollment, setEnrollment] = useState<FounderEnrollmentState>({})
    const [settingUp, beginTransition] = useTransition()
    const firstSetup = useRef<Promise<FounderEnrollmentState> | null>(null)
    useEffect(() => {
        if (factors.length || !enrollmentEnabled) return
        let mounted = true
        // Reuse one promise through Strict Mode's effect check. The server
        // also serializes duplicate tabs/requests independently of this ref.
        firstSetup.current ??= founderBeginEnrollment()
        void firstSetup.current.then(result => { if (mounted) setEnrollment(result) })
            .catch(() => { if (mounted) setEnrollment({ message: 'Setup could not be verified. Restart to try again.' }) })
        return () => { mounted = false }
    }, [factors.length, enrollmentEnabled])
    const availableFactors = factors.length ? factors : enrollment.setup ? [{ id: enrollment.setup.factorId, label: 'New authenticator' }] : []
    return <>
        {!factors.length && enrollmentEnabled && <section className="mb-6 space-y-4" aria-label="Connect your authenticator">
            <p className="text-sm leading-6">Scan this QR code in your authenticator app, then enter the six-digit code below to finish connecting it.</p>
            {enrollment.setup ? <div className="flex justify-center rounded-xl border border-hairline bg-white p-4">
                {/* Enrollment images contain a credential; never optimize/cache them. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={enrollment.setup.qrCode} alt="Scan to connect your Weavly authenticator" width={256} height={256} data-sentry-block="true"/>
            </div> : !enrollment.message && <p role="status" className="text-sm text-subtle">Preparing your private QR code…</p>}
            {enrollment.message && <p role="alert" className="text-sm leading-6 text-risk">{enrollment.message}</p>}
            <p className="text-xs leading-5 text-subtle">Keep this QR code private. After setup, you will only need a code from the app.</p>
            <Button type="button" variant="outline" className="min-h-11" disabled={settingUp || pending} onClick={() => beginTransition(async () => {
                setEnrollment({})
                try { setEnrollment(await founderBeginEnrollment(true)) }
                catch { setEnrollment({ message: 'Setup could not be verified. Reload and try again.' }) }
            })}>{settingUp ? 'Restarting…' : 'Restart interrupted setup'}</Button>
        </section>}
        {availableFactors.length ? <form action={action} className="space-y-5" aria-busy={pending}>
            <input type="hidden" name="returnTo" value={returnTo}/>
            {enrollment.setup && <input type="hidden" name="enrollmentIntentId" value={enrollment.setup.intentId}/>}
            {availableFactors.length === 1 ? <input type="hidden" name="factorId" value={availableFactors[0].id}/> : <fieldset disabled={pending} className="space-y-3"><legend className="mb-2 text-sm font-medium">Choose your authenticator</legend>{availableFactors.map((factor, index) => <label key={factor.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm"><input className="size-4 accent-ink" type="radio" name="factorId" value={factor.id} defaultChecked={index === 0}/>{factor.label}</label>)}</fieldset>}
            <div className="space-y-2"><Label htmlFor="founder-code">Authenticator code</Label><Input id="founder-code" className="h-11 font-mono tracking-widest" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={pending} aria-describedby="founder-code-help"/><p id="founder-code-help" className="text-xs text-subtle">Enter the current six-digit code from your authenticator.</p></div>
            {state.message && <p role="alert" className="text-sm leading-6 text-risk">{state.message}</p>}
            <Button className="min-h-11 w-full bg-ink text-surface hover:bg-loom-elevated" type="submit" disabled={pending}>{pending ? 'Verifying access…' : 'Verify and open console'}</Button>
        </form> : !enrollmentEnabled && <p role="status" className="rounded-lg border border-hairline bg-surface-soft p-4 text-sm leading-6">Authenticator setup is awaiting approval. Founder access remains closed until setup and recovery are ready.</p>}
        <p className="mt-5 text-sm leading-6 text-subtle">If a connected authenticator is unavailable, use the approved founder recovery process. This screen cannot replace it.</p>
        <form action="/auth/signout" method="post" className="mt-5"><Button variant="outline" type="submit" className="min-h-11 w-full">Cancel and sign out</Button></form>
    </>
}
