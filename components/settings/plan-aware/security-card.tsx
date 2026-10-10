'use client'

import React, { useState } from 'react'
import { ShieldCheck, Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast, userFacingError } from '@/lib/app-notifications'
import { useTranslation } from '@/lib/i18n/context'
import { requestSecurityPasswordReset } from '@/app/(dashboard)/owner/settings/actions'

interface SecurityCardProps {
    email: string
}

export function SecurityCard({ email }: SecurityCardProps) {
    const { tx } = useTranslation()
    const [isSending, setIsSending] = useState(false)
    const [sentStatus, setSentStatus] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const handleSendReset = async () => {
        setIsSending(true)
        setErrorMessage(null)
        setSentStatus(null)

        try {
            const result = await requestSecurityPasswordReset()
            if ('error' in result && result.error) {
                const msg = userFacingError(result.error, 'Unable to send password reset link')
                setErrorMessage(msg)
                toast.error(tx(msg))
            } else if (result.success) {
                const successText = tx('Password reset link sent to {email}. Check your inbox.', { email: result.email ?? email })
                setSentStatus(successText)
                toast.success(successText)
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unable to send password reset link'
            setErrorMessage(msg)
            toast.error(tx(msg))
        } finally {
            setIsSending(false)
        }
    }

    return (
        <section
            aria-labelledby="security-heading"
            className="rounded-2xl border border-hairline bg-surface p-6 shadow-xs sm:p-8"
        >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-hairline/80 pb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron-soft text-saffron-deep">
                            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <h2 id="security-heading" className="text-lg font-bold tracking-tight text-ink">
                            {tx('Security')}
                        </h2>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        {tx('Manage your password and sign-in authentication security.')}
                    </p>
                </div>
                <Badge variant="outline" className="text-xs font-medium text-muted-foreground">
                    {tx('Personal: Only affects your account.')}
                </Badge>
            </div>

            <div className="mt-6 space-y-4">
                <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-ink">
                            {tx('Password & sign-in')}
                        </h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            {tx('Send a secure password reset link to your registered email address.')}
                        </p>
                        {email && (
                            <p className="text-xs font-mono text-ink/80 pt-0.5 select-all">
                                {email}
                            </p>
                        )}
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleSendReset}
                        disabled={isSending || !email}
                        className="min-h-11 shrink-0 rounded-xl gap-2 font-semibold shadow-xs"
                    >
                        {isSending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                {tx('Sending reset link…')}
                            </>
                        ) : (
                            <>
                                <Mail className="h-4 w-4 text-subtle" aria-hidden="true" />
                                {tx('Send reset link')}
                            </>
                        )}
                    </Button>
                </div>

                {sentStatus && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success-soft/60 p-3.5 text-xs text-success" role="status">
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                        <p>{sentStatus}</p>
                    </div>
                )}

                {errorMessage && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-risk/30 bg-risk-soft p-3.5 text-xs text-risk" role="alert">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                        <p>{errorMessage}</p>
                    </div>
                )}
            </div>
        </section>
    )
}
