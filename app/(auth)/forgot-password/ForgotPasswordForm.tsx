'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { requestPasswordReset } from '@/app/(auth)/actions/auth'
import AuthLayout from '@/components/auth/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const SUCCESS_MESSAGE = 'If an account exists for that email, we’ve sent password reset instructions.'

function validateEmail(email: string): string | null {
    if (!email.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address'
    return null
}

export default function ForgotPasswordForm() {
    const [email, setEmail] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const validationError = validateEmail(email)
        if (validationError) {
            setError(validationError)
            setSuccess(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const result = await requestPasswordReset({ email: email.trim() })

            if (result && 'error' in result) {
                setError(result.error ?? 'Enter a valid email address')
                setSuccess(false)
                return
            }

            setSuccess(true)
            toast.success(SUCCESS_MESSAGE)
        } catch {
            toast.error('Could not send reset instructions. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <AuthLayout
            title="Reset your password"
            subtitle="Enter your account email"
        >
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="space-y-1.5">
                    <Label htmlFor="email" className="font-medium text-body">
                        Email
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(event) => {
                            setEmail(event.target.value)
                            setError(null)
                        }}
                        autoComplete="email"
                        className={cn(
                            'h-12 transition-all focus:bg-surface',
                            error && 'border-wv-status-danger-fg focus-visible:border-wv-status-danger-fg'
                        )}
                        disabled={loading}
                        aria-invalid={!!error}
                        aria-describedby={error ? 'forgot-password-error' : success ? 'forgot-password-success' : undefined}
                    />
                    {error && (
                        <p id="forgot-password-error" className="text-xs text-wv-status-danger-fg">
                            {error}
                        </p>
                    )}
                </div>

                {success && (
                    <div
                        id="forgot-password-success"
                        className="flex items-start gap-2 rounded-lg border border-wv-status-success-border bg-wv-status-success-bg p-3 text-sm text-wv-status-success-fg"
                    >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{SUCCESS_MESSAGE}</span>
                    </div>
                )}

                <Button
                    type="submit"
                    className="h-12 w-full text-base font-semibold transition-transform active:scale-[0.98]"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            Send instructions
                            <ArrowRight className="h-4 w-4" />
                        </span>
                    )}
                </Button>

                <div className="pt-1 text-center text-sm text-muted-foreground">
                    <Link href="/login" className="inline-flex items-center gap-1 font-medium text-saffron-deep hover:underline">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to login
                    </Link>
                </div>
            </form>
        </AuthLayout>
    )
}
