'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { BrandBackground } from '@/components/brand-background'
import type { Session } from '@supabase/supabase-js'
import { SUPERVISOR_HOME_PATH } from '@/lib/supervisor-access'

function parseJWTClaims(token: string): Record<string, unknown> {
    try {
        const payload = token.split('.')[1]
        return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    } catch {
        return {}
    }
}

function ConfirmContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()
    const [status, setStatus] = useState('Verifying your account...')
    const [error, setError] = useState<string | null>(null)
    const processingRef = useRef(false)

    const redirectByRole = async (session: Session) => {
        const jwt = parseJWTClaims(session.access_token)
        const role = jwt.user_role
        const onboardingComplete = jwt.onboarding_complete

        if (role === 'owner') {
            if (!onboardingComplete) {
                router.push('/onboarding')
            } else {
                router.push('/owner/estimator')
            }
        } else if (role === 'supervisor') {
            router.push(SUPERVISOR_HOME_PATH)
        } else {
            router.push('/login')
        }
    }

    const finalizeLogin = async (session: Session) => {
        if (processingRef.current) return
        processingRef.current = true

        setStatus('Redirecting to dashboard...')
        try {
            await redirectByRole(session)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to finish login')
            processingRef.current = false
        }
    }

    useEffect(() => {
        const run = async () => {
            // Step 1: Check for tokens in URL hash (implicit flow)
            if (typeof window !== 'undefined' && window.location.hash) {
                const hashStr = window.location.hash.substring(1)
                const hashParams = new URLSearchParams(hashStr)
                const accessToken = hashParams.get('access_token')
                const refreshToken = hashParams.get('refresh_token')

                if (accessToken && refreshToken) {
                    setStatus('Verifying session...')

                    const { data, error: setSessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    })

                    if (setSessionError) {
                        setError(setSessionError.message)
                        return
                    }

                    if (data.session) {
                        window.history.replaceState(null, '', window.location.pathname + window.location.search)
                        await finalizeLogin(data.session)
                        return
                    }
                }
            }

            // Step 2: Check for existing authenticated user (cookie-based)
            setStatus('Checking session...')
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                const role = user.app_metadata?.role ?? user.app_metadata?.user_role
                const onboardingComplete = user.app_metadata?.onboarding_complete === true
                if (role === 'owner') {
                    router.push(onboardingComplete ? '/owner/estimator' : '/onboarding')
                } else if (role === 'supervisor') {
                    router.push(SUPERVISOR_HOME_PATH)
                } else {
                    router.push('/login')
                }
                return
            }

            // Step 3: Check for PKCE code in query params
            const code = searchParams.get('code')
            if (code) {
                setStatus('Exchanging authorization code...')
                const { data, error: codeError } = await supabase.auth.exchangeCodeForSession(code)
                if (codeError) {
                    setError(codeError.message)
                    return
                }
                if (data.session) {
                    await finalizeLogin(data.session)
                    return
                }
            }

            // Step 4: Nothing worked
            setError('Could not verify your account. The link may have expired. Please try signing up again.')
        }

        run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="safe-area-page relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background [--page-gutter-x:1rem] [--page-gutter-y:1rem]">
            <BrandBackground variant="auth" />
            <div className="relative z-10 w-full max-w-md bg-surface/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 p-8 flex flex-col items-center space-y-6 text-center">
                {error ? (
                    <>
                        <div className="h-14 w-14 rounded-full bg-wv-status-danger-bg flex items-center justify-center">
                            <AlertCircle className="h-7 w-7 text-wv-status-danger-fg" />
                        </div>
                        <div className="space-y-2" role="alert">
                            <h3 className="font-semibold text-lg text-ink">Verification Failed</h3>
                            <p className="text-sm text-subtle">{error}</p>
                        </div>
                        <div className="space-y-2 w-full">
                            <Button asChild className="min-h-[44px] w-full sm:min-h-0">
                                <Link href="/login">Go to Login</Link>
                            </Button>
                            <Button asChild variant="outline" className="min-h-[44px] w-full sm:min-h-0">
                                <Link href="/signup">Create New Account</Link>
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <Loader2 className="h-10 w-10 animate-spin text-wv-neel-600" />
                        <div className="space-y-1">
                            <p className="font-medium text-ink" role="status" aria-live="polite">{status}</p>
                            <p className="text-xs text-subtle">Please wait...</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default function ConfirmPage() {
    return (
        <Suspense fallback={
            <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-background">
                <BrandBackground variant="auth" />
                <Loader2 className="relative z-10 h-8 w-8 animate-spin text-subtle" />
            </div>
        }>
            <ConfirmContent />
        </Suspense>
    )
}
