'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, Mail, ArrowLeft, RefreshCw } from 'lucide-react'
import AuthLayout from '@/components/auth/auth-layout'
import Link from 'next/link'

function VerifyContent() {
    const [resending, setResending] = useState(false)
    const searchParams = useSearchParams()
    const email = searchParams.get('email') || ''
    const supabase = createClient()

    const handleResend = async () => {
        if (!email) {
            toast.error('No email address found. Please sign up again.')
            return
        }

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
            toast.success('Verification email resent! Check your inbox.')
        } catch (error: any) {
            if (error.message?.includes('rate limit') || error.status === 429) {
                toast.error('Too many requests. Please wait a minute before trying again.')
            } else {
                toast.error(error.message || 'Failed to resend email')
            }
        } finally {
            setResending(false)
        }
    }

    return (
        <AuthLayout
            title="Check Your Email"
            subtitle="We've sent you a verification link"
        >
            <div className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-indigo-50 flex items-center justify-center">
                        <Mail className="h-8 w-8 text-indigo-600" />
                    </div>

                    <div className="text-center space-y-2">
                        <p className="text-sm text-gray-600">
                            We sent a verification link to
                        </p>
                        {email && (
                            <p className="font-semibold text-gray-900">{email}</p>
                        )}
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Click the link in the email to verify your account.
                            Once verified, you can log in with your email and password.
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <Button
                        onClick={handleResend}
                        variant="outline"
                        className="w-full h-11"
                        disabled={resending}
                    >
                        {resending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Resend verification email
                    </Button>

                    <Button asChild variant="ghost" className="w-full h-11">
                        <Link href="/login">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Login
                        </Link>
                    </Button>
                </div>

                <p className="text-center text-xs text-gray-400">
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
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        }>
            <VerifyContent />
        </Suspense>
    )
}
