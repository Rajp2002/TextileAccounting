'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react'
import AuthLayout from '@/components/auth/auth-layout'
import { signIn } from '@/app/(auth)/actions/auth'
import LoadingModal from '@/components/auth/loading-modal'
import { SIGN_IN_TRACE_STORAGE_KEY } from '@/lib/sign-in-trace'

function createTraceId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

    const bytes = crypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

export default function LoginForm() {
    const [loading, setLoading]             = useState(false)
    const [isRedirecting, setIsRedirecting] = useState(false)
    const [email, setEmail]                 = useState('')
    const [password, setPassword]           = useState('')
    const [showPassword, setShowPassword]   = useState(false)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('message') === 'password-updated') {
            toast.success('Password updated. Please sign in with your new password.')
            window.history.replaceState(null, '', window.location.pathname)
        }
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

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

            setIsRedirecting(true)
            try {
                window.sessionStorage.setItem(SIGN_IN_TRACE_STORAGE_KEY, JSON.stringify({
                    traceId,
                    destination: result.redirectTo,
                    clickStartedAt,
                    actionCompletedAt: Date.now(),
                    authRoundTripMs,
                    cleanupWaitMs: 0,
                }))
            } catch {
                // Telemetry must never delay or block navigation.
            }
            // Cross the authentication boundary with a full document request.
            // This guarantees the new session cookies are applied and avoids a
            // Safari/PWA App Router transition stalling on the login screen.
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
                        <Link href="/forgot-password" className="text-xs font-medium text-saffron-deep hover:underline">
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
                            className="h-12 pr-10 transition-all focus:bg-surface"
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/25"
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
                        <Link href="/signup" className="font-medium text-saffron-deep hover:underline">
                            Start as owner
                        </Link>
                        {' '}or{' '}
                        <Link href="/join" className="font-medium text-saffron-deep hover:underline">
                            join with a code
                        </Link>
                    </p>
                </div>
            </form>
            <LoadingModal isOpen={isRedirecting} message="Setting up your dashboard..." />
        </AuthLayout>
    )
}
