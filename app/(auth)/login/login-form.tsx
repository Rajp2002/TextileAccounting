'use client'

import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react'
import AuthLayout from '@/components/auth/auth-layout'
import { signIn } from '@/app/(auth)/actions/auth'
import { AuthTransition } from '@/components/auth/auth-transition'
import { captureAuthHandoff } from '@/components/auth/auth-handoff'
import { SIGN_IN_TRACE_STORAGE_KEY } from '@/lib/sign-in-trace'

function createTraceId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

    const bytes = crypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

let workspaceCodeRequested = false

// Owners on every plan land on the estimator after sign-in (Free reuses it at
// /free). Fetch its code while they type so the post-login page load mostly
// comes from the browser cache. The workspace navigation is a full page load,
// so this only warms the cache; it grants nothing and skips Save-Data users.
function warmWorkspaceCode() {
    if (workspaceCodeRequested) return
    workspaceCodeRequested = true
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (connection?.saveData) return

    const load = () => {
        void import('@/app/(dashboard)/owner/estimator/EstimatorClient').catch(() => {
            // A failed warm-up only means the workspace downloads normally.
        })
    }
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(load, { timeout: 2000 })
    else window.setTimeout(load, 300)
}

export default function LoginForm({ recoveryDestination }: { recoveryDestination?: string | null }) {
    const [loading, setLoading]             = useState(false)
    const [isRedirecting, setIsRedirecting] = useState(false)
    const [email, setEmail]                 = useState('')
    const [password, setPassword]           = useState('')
    const [showPassword, setShowPassword]   = useState(false)
    // When a login page loads, Safari focuses the email or password field itself
    // ("streamlined login"), and that focus opens its saved-password popover on
    // top of the installed app's woven intro. Safari only does this for a form
    // whose credential fields are in the tab order (read-only does not stop it),
    // so the fields stay out of it until the user clicks one or presses Tab.
    const [credentialsArmed, setCredentialsArmed] = useState(false)
    const armCredentials = () => {
        setCredentialsArmed(true)
        warmWorkspaceCode()
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('message') === 'password-updated') {
            toast.success('Password updated. Please sign in with your new password.')
            window.history.replaceState(null, '', window.location.pathname)
        }
    }, [])

    useEffect(() => {
        if (credentialsArmed) return
        const armOnTab = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return
            // Restore the tab order before this Tab moves focus.
            for (const id of ['email', 'password']) {
                const field = document.getElementById(id)
                if (field) field.tabIndex = 0
            }
            setCredentialsArmed(true)
            warmWorkspaceCode()
        }
        window.addEventListener('keydown', armOnTab, true)
        return () => window.removeEventListener('keydown', armOnTab, true)
    }, [credentialsArmed])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const transitionStartedAt = performance.now()
        // Saved-password autofill can submit without focusing a field.
        warmWorkspaceCode()

        const traceId = createTraceId()
        const clickStartedAt = Date.now()
        const authStartedAt = performance.now()
        let authRoundTripMs = 0

        try {
            const signInPromise = signIn({ email: email.trim(), password, traceId }).finally(() => {
                authRoundTripMs = performance.now() - authStartedAt
            })
            const result = await signInPromise

            if (result && 'error' in result) {
                toast.error(result.error)
                setLoading(false)
                return
            }

            // The overlay switches to "signed in" before it is handed over.
            flushSync(() => setIsRedirecting(true))
            const actionCompletedAt = Date.now()
            try {
                window.sessionStorage.setItem(SIGN_IN_TRACE_STORAGE_KEY, JSON.stringify({
                    traceId,
                    destination: result.redirectTo,
                    clickStartedAt,
                    actionCompletedAt,
                    authRoundTripMs,
                    cleanupWaitMs: 0,
                }))
            } catch {
                // Telemetry must never delay or block navigation.
            }
            // Cross the authentication boundary with a full document request.
            // This guarantees the new session cookies are applied and avoids a
            // Safari/PWA App Router transition stalling on the login screen.
            // The session exists, so the workspace loads behind the loom: the
            // next page resumes it and removes it when the round ends.
            captureAuthHandoff(transitionStartedAt)
            window.location.replace(result.redirectTo)
        } catch {
            toast.error('Something went wrong. Please try again.')
            setLoading(false)
        }
    }

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Sign in to your Weavly account"
        >
            {recoveryDestination && (
                <div
                    role="status"
                    aria-live="polite"
                    className="mb-5 rounded-lg border border-[var(--wv-saffron-200)] bg-[var(--wv-saffron-50)] p-4"
                >
                    <p className="font-semibold text-ink">Your session is already active.</p>
                    <p className="mt-1 text-sm text-body">
                        The sign-in page was reopened while your workspace was loading. Continue to your workspace,
                        or sign in below with a different account.
                    </p>
                    <Button asChild variant="outline" className="mt-3 w-full">
                        <a href={recoveryDestination}>Continue to your workspace</a>
                    </Button>
                </div>
            )}
            <form onSubmit={handleLogin} className="space-y-5" noValidate>
                {/* Email */}
                <div className="space-y-1.5">
                    <Label htmlFor="email" className="font-medium text-body">
                        Email
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        tabIndex={credentialsArmed ? undefined : -1}
                        onFocus={armCredentials}
                        className="h-12 transition-all focus:bg-surface"
                        disabled={loading}
                    />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="font-medium text-body">
                            Password
                        </Label>
                        <Link href="/forgot-password" className="text-xs font-semibold text-ink underline decoration-[var(--wv-cotton-400)] hover:decoration-[var(--wv-brand-accent)] underline-offset-4">
                            Forgot password?
                        </Link>
                    </div>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            tabIndex={credentialsArmed ? undefined : -1}
                            onFocus={armCredentials}
                            className="h-12 pr-10 transition-all focus:bg-surface"
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wv-border-focus)]/25"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            aria-pressed={showPassword}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                {/* Submit */}
                <Button
                    type="submit"
                    id="login-btn"
                    data-login-primary="true"
                    className="w-full h-12 text-base font-semibold transition-transform active:scale-[0.98]"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Signing in...
                        </>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            Sign in
                            <ArrowRight className="h-4 w-4" />
                        </span>
                    )}
                </Button>

                <div className="space-y-2 pt-1 text-center text-sm text-muted-foreground">
                    <p>
                        Don&apos;t have an account?{' '}
                        <Link href="/signup" className="font-semibold text-ink underline decoration-[var(--wv-cotton-400)] hover:decoration-[var(--wv-brand-accent)] underline-offset-4">
                            Sign up
                        </Link>
                    </p>
                </div>
            </form>
            <AuthTransition
                open={loading || isRedirecting}
                mode="sign-in"
                stage={isRedirecting ? 'done' : 'working'}
            />
        </AuthLayout>
    )
}
