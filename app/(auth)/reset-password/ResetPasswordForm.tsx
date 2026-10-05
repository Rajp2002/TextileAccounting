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
import { PasswordSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { founderOnlyIdentity } from '@/lib/admin/founder-email'

const INVALID_LINK_MESSAGE = 'This reset link is invalid or expired. Please request a new password reset link.'
const SESSION_CHECK_TIMEOUT_MS = 2500

type RecoveryStatus = 'checking' | 'ready' | 'invalid'

function validatePasswordForm(password: string, confirmPassword: string): Record<string, string> {
    const errors: Record<string, string> = {}
    const passwordResult = PasswordSchema.safeParse(password)

    if (!passwordResult.success) {
        errors.password = passwordResult.error.issues[0]?.message ?? 'Password does not meet requirements'
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
        let invalidTimer: ReturnType<typeof setTimeout> | null = null

        const cleanResetUrl = () => {
            window.history.replaceState(null, '', window.location.pathname)
        }

        const clearInvalidTimer = () => {
            if (invalidTimer) {
                clearTimeout(invalidTimer)
                invalidTimer = null
            }
        }

        const markReady = (session: Session | null) => {
            if (cancelled || !session) return
            clearInvalidTimer()
            cleanResetUrl()
            setStatus('ready')
        }

        const markInvalid = () => {
            if (cancelled) return
            setStatus((current) => current === 'ready' ? current : 'invalid')
        }

        const checkCurrentSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (session) {
                    markReady(session)
                    return
                }
            } catch {
                // Fall through to the timeout below so the user still gets a stable loading state first.
            }

            if (!cancelled) {
                invalidTimer = setTimeout(markInvalid, SESSION_CHECK_TIMEOUT_MS)
            }
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
            markReady(session)
        })

        void checkCurrentSession()

        return () => {
            cancelled = true
            clearInvalidTimer()
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
            const { data, error } = await supabase.auth.updateUser({ password })

            if (error) {
                if (isSessionError(error.message)) {
                    setStatus('invalid')
                } else {
                    toast.error('Could not update password. Please try again.')
                }
                return
            }

            await supabase.auth.signOut()
            // The provider's successful update returns the current identity.
            // This chooses a login screen only; MFA/grant checks still apply.
            if (founderOnlyIdentity(data.user?.email, data.user?.app_metadata?.role)) {
                router.replace('/admin/login?message=password-updated')
            } else {
                router.replace('/login?message=password-updated')
            }
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
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-wv-status-danger-bg">
                        <AlertCircle className="h-6 w-6 text-wv-status-danger-fg" />
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
            subtitle="Use 8+ characters with an uppercase letter, number, and special character"
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
                            placeholder="8+ chars, uppercase, number, special"
                            value={password}
                            onChange={(event) => {
                                setPassword(event.target.value)
                                setErrors((current) => ({ ...current, password: '' }))
                            }}
                            autoComplete="new-password"
                            className={cn(
                                'h-12 pr-10 transition-all focus:bg-surface',
                                errors.password && 'border-wv-status-danger-fg focus-visible:border-wv-status-danger-fg'
                            )}
                            disabled={saving}
                            aria-invalid={!!errors.password}
                            aria-describedby={errors.password ? 'reset-password-error' : undefined}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-ink"
                            aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.password && (
                        <p id="reset-password-error" className="text-xs text-wv-status-danger-fg">
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
                                errors.confirmPassword && 'border-wv-status-danger-fg focus-visible:border-wv-status-danger-fg'
                            )}
                            disabled={saving}
                            aria-invalid={!!errors.confirmPassword}
                            aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword((current) => !current)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-ink"
                            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.confirmPassword && (
                        <p id="confirm-password-error" className="text-xs text-wv-status-danger-fg">
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
