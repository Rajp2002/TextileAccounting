'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, Mail, ArrowLeft, RefreshCw } from 'lucide-react'
import AuthLayout from '@/components/auth/auth-layout'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import { freeMobileEntryText } from '@/lib/i18n/free-mobile-entry'

type AuthResendError = {
    message?: string
    status?: number
}

function VerifyContent() {
    const [resending, setResending] = useState(false)
    const [resendMessage, setResendMessage] = useState('')
    const [resendFailed, setResendFailed] = useState(false)
    const { language, tx } = useTranslation()
    const searchParams = useSearchParams()
    const email = searchParams.get('email') || ''
    const supabase = createClient()

    const handleResend = async () => {
        if (!email) {
            toast.error('No email address found. Please sign up again.')
            return
        }

        setResendMessage('')
        setResendFailed(false)
        setResending(true)
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                }
            })

            if (error) throw error
            const message = tx('Verification email resent! Check your inbox.')
            setResendMessage(message)
            toast.success(message)
        } catch (error) {
            const resendError = error as AuthResendError
            const message = resendError.message?.includes('rate limit') || resendError.status === 429
                ? tx('Too many requests. Please wait a minute before trying again.')
                : tx(resendError.message || 'Failed to resend email')
            setResendFailed(true)
            setResendMessage(message)
            toast.error(message)
        } finally {
            setResending(false)
        }
    }

    return (
        <AuthLayout
            title="Check Your Email"
            subtitle={email ? tx("We've sent you a verification link") : freeMobileEntryText(language, 'missingVerificationEmail')}
        >
            <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col items-center gap-4">
                    <div className="hidden sm:flex h-16 w-16 rounded-full bg-wv-bg-selected flex items-center justify-center">
                        <Mail className="h-8 w-8 text-wv-neel-600" />
                    </div>

                    <div className="text-center space-y-2">
                        {email && <p className="text-sm text-body">
                            We sent a verification link to
                        </p>}
                        {email && (
                            <p className="break-words font-semibold text-ink">{email}</p>
                        )}
                        {email && <p className="text-xs text-subtle leading-relaxed">
                            Click the link in the email to verify your account.
                            Once verified, you can log in with your email and password.
                        </p>}
                    </div>
                </div>

                <div className="space-y-3">
                    <Button
                        onClick={handleResend}
                        variant="outline"
                        className="w-full h-11"
                        disabled={resending || !email}
                    >
                        {resending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Resend verification email
                    </Button>

                    {resendMessage && <p role={resendFailed ? 'alert' : 'status'} aria-live="polite" className="text-sm leading-relaxed text-body">{resendMessage}</p>}

                    <Button asChild variant={email ? "ghost" : "default"} className="w-full h-11">
                        <Link href="/login">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Login
                        </Link>
                    </Button>
                </div>

                <p className="text-center text-xs text-subtle">
                    Didn&apos;t receive anything? Check your spam folder or try resending.
                </p>
            </div>
        </AuthLayout>
    )
}

export default function VerifyPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-subtle" />
            </div>
        }>
            <VerifyContent />
        </Suspense>
    )
}
