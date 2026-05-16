'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import AuthLayout from '@/components/auth/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const INVALID_LINK_MESSAGE = 'This reset link is invalid or expired. Please request a new password reset link.'

type RecoveryStatus = 'checking' | 'ready' | 'invalid'

function validatePasswordForm(password: string, confirmPassword: string): Record<string, string> {
    const errors: Record<string, string> = {}

    if (password.length < 8) {
        errors.password = 'Password must be at least 8 characters'
    }

    if (!confirmPassword) {
        errors.confirmPassword = 'Confirm your new password'
    } else if (confirmPassword !== password) {
        errors.confirmPassword = 'Passwords do not match'
    }

    return errors
}

function isSessionError(message: string): boolean {
    const normalized = message.toLowerCase()
    return (
        normalized.includes('session') ||
        normalized.includes('jwt') ||
        normalized.includes('token') ||
        normalized.includes('expired') ||
        normalized.includes('invalid')
    )
}

export default function ResetPasswordForm() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])

    const [status, setStatus] = useState<RecoveryStatus>('checking')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    useEffect(() => {
        let cancelled = false

        const cleanResetUrl = () => {
            window.history.replaceState(null, '', window.location.pathname)
        }

        const markReady = () => {
            if (cancelled) return
            cleanResetUrl()
            setStatus('ready')
        }

        const markInvalid = () => {
            if (cancelled) return
            setStatus('invalid')
        }

        const getCurrentSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            return session
        }

        const establishRecoverySession = async () => {
            const url = new URL(window.location.href)
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
            const accessToken = hashParams.get('access_token')
            const refreshToken = hashParams.get('refresh_token')
            const linkType = hashParams.get('type') ?? url.searchParams.get('type')
            const code = url.searchParams.get('code')
            const hasRecoveryHint =
                linkType === 'recovery' ||
                url.searchParams.get('recovery') === '1' ||
                !!code ||
                (!!accessToken && !!refreshToken)

            try {
                if (accessToken && refreshToken) {
                    const { data, error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    })

                    if (error || !data.session) {
                        markInvalid()
                        return
                    }

                    markReady()
                    return
                }

                if (code) {
                    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

                    if (!error && data.session) {
                        markReady()
                        return
                    }

                    const session = await getCurrentSession()
                    if (session && hasRecoveryHint) {
                        markReady()
                        return
                    }

                    markInvalid()
                    return
                }

                if (hasRecoveryHint) {
                    const session = await getCurrentSession()
                    if (session) {
                        markReady()
                        return
                    }
                }

                markInvalid()
            } catch {
                markInvalid()
            }
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
            if (event === 'PASSWORD_RECOVERY' && session) {
                markReady()
            }
        })

        void establishRecoverySession()

        return () => {
            cancelled = true
            subscription.unsubscribe()
        }
    }, [supabase])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const validationErrors = validatePasswordForm(password, confirmPassword)
        setErrors(validationErrors)
        if (Object.keys(validationErrors).length > 0) return

        setSaving(true)

        try {
            const { error } = await supabase.auth.updateUser({ password })

            if (error) {
                if (isSessionError(error.message)) {
                    setStatus('invalid')
                } else {
                    toast.error('Could not update password. Please try again.')
                }
                return
            }

            await supabase.auth.signOut()
            router.replace('/login?message=password-updated')
        } catch {
            toast.error('Could not update password. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    if (status === 'checking') {
        return (
            <AuthLayout
                title="Checking reset link"
                subtitle="Please wait a moment"
            >
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-saffron-deep" />
                    <p className="text-sm text-muted-foreground">Opening your reset form...</p>
                </div>
            </AuthLayout>
        )
    }

    if (status === 'invalid') {
        return (
            <AuthLayout
                title="Reset link expired"
                subtitle="Request a fresh link"
            >
                <div className="space-y-5 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                        <AlertCircle className="h-6 w-6 text-red-500" />
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                        {INVALID_LINK_MESSAGE}
                    </p>
                    <Button asChild className="h-12 w-full text-base font-semibold">
                        <Link href="/forgot-password">Request new link</Link>
                    </Button>
                    <Link href="/login" className="inline-flex items-center gap-1 text-sm font-medium text-saffron-deep hover:underline">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to login
                    </Link>
                </div>
            </AuthLayout>
        )
    }

    return (
        <AuthLayout
            title="Choose a new password"
            subtitle="Use at least 8 characters"
        >
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="space-y-1.5">
                    <Label htmlFor="password" className="font-medium text-body">
                        New password
                    </Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Min. 8 characters"
                            value={password}
                            onChange={(event) => {
                                setPassword(event.target.value)
                                setErrors((current) => ({ ...current, password: '' }))
                            }}
                            autoComplete="new-password"
                            className={cn(
                                'h-12 pr-10 transition-all focus:bg-surface',
                                errors.password && 'border-red-400 focus-visible:border-red-500'
                            )}
                            disabled={saving}
                            aria-invalid={!!errors.password}
                            aria-describedby={errors.password ? 'reset-password-error' : undefined}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-ink"
                            tabIndex={-1}
                            aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.password && (
                        <p id="reset-password-error" className="text-xs text-red-500">
                            {errors.password}
                        </p>
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="font-medium text-body">
                        Confirm password
                    </Label>
                    <div className="relative">
                        <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="Enter it again"
                            value={confirmPassword}
                            onChange={(event) => {
                                setConfirmPassword(event.target.value)
                                setErrors((current) => ({ ...current, confirmPassword: '' }))
                            }}
                            autoComplete="new-password"
                            className={cn(
                                'h-12 pr-10 transition-all focus:bg-surface',
                                errors.confirmPassword && 'border-red-400 focus-visible:border-red-500'
                            )}
                            disabled={saving}
                            aria-invalid={!!errors.confirmPassword}
                            aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword((current) => !current)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-ink"
                            tabIndex={-1}
                            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.confirmPassword && (
                        <p id="confirm-password-error" className="text-xs text-red-500">
                            {errors.confirmPassword}
                        </p>
                    )}
                </div>

                <Button
                    type="submit"
                    className="h-12 w-full text-base font-semibold transition-transform active:scale-[0.98]"
                    disabled={saving}
                >
                    {saving ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Updating...
                        </>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            <KeyRound className="h-4 w-4" />
                            Update password
                        </span>
                    )}
                </Button>

                <div className="pt-1 text-center text-sm text-muted-foreground">
                    <Link href="/forgot-password" className="font-medium text-saffron-deep hover:underline">
                        Request a new reset link
                    </Link>
                </div>
            </form>
        </AuthLayout>
    )
}
