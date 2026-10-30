'use client'

import { useTranslation } from '@/lib/i18n/context'
import { freeMobileEntryText } from '@/lib/i18n/free-mobile-entry'
import { freeText } from '@/lib/i18n/free-tier'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ArrowRight, Eye, EyeOff, Building2, CheckCircle2 } from 'lucide-react'
import AuthLayout from '@/components/auth/auth-layout'
import { AccountTypeSwitch } from '@/components/auth/AccountTypeSwitch'
import { AuthTransition } from '@/components/auth/auth-transition'
import { createOrganizationAndRedirect } from '@/app/(auth)/actions/auth'
import { cn } from '@/lib/utils'
import { isValidIndianPhone, normalizeIndianPhone } from '@/lib/phone'
import { PasswordSchema } from '@/lib/schemas'
import { SIGNUP_LEGAL_ACCEPTANCE } from '@/lib/legal-documents'
import { normalizeSignupPlan } from '@/lib/base-plan-visibility'

type RedirectError = {
    message?: string
    digest?: string
}

function isNextRedirect(error: unknown) {
    if (typeof error !== 'object' || error === null) return false
    const redirectError = error as RedirectError
    return redirectError.message === 'NEXT_REDIRECT'
        || Boolean(redirectError.digest?.startsWith('NEXT_REDIRECT'))
}

// ── Password strength scorer ───────────────────────────────────────────────────

function getPasswordStrength(password: string): {
    score: number        // 0–4
    label: string
    color: string
    checks: { label: string; met: boolean }[]
} {
    const checks = [
        { label: 'At least 8 characters', met: password.length >= 8 },
        { label: 'Uppercase letter',       met: /[A-Z]/.test(password) },
        { label: 'Number',                 met: /[0-9]/.test(password) },
        { label: 'Special character',      met: /[^A-Za-z0-9]/.test(password) },
    ]
    const score = checks.filter(c => c.met).length

    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
    const colors = ['', 'bg-[var(--wv-status-danger-fg)]', 'bg-[var(--wv-brand-accent)]', 'bg-[var(--wv-status-warning-solid)]', 'bg-[var(--wv-status-success-fg)]']

    return { score, label: labels[score] ?? '', color: colors[score] ?? '', checks }
}

function SignupForm() {
    const { language, tx } = useTranslation()
    const searchParams = useSearchParams()
    
    const [referralOpen, setReferralOpen] = useState(Boolean(searchParams?.get('ref')))
    const [referralCode, setReferralCode] = useState(searchParams?.get('ref') || '')
    // Free is the default for every new account; only an explicit Lite choice skips it.
    // Base is closed to new accounts, so plan=base normalises to Free.
    const requestedPlan = searchParams?.get('plan')
    const selectedPlan = normalizeSignupPlan(requestedPlan === 'lite' ? 'lite' as const : requestedPlan === 'base' ? 'base' as const : 'free' as const)
    const compactMobile = selectedPlan === 'free' || selectedPlan === 'lite'
    
    const [loading, setLoading] = useState(false)
    const [ownerName, setOwnerName]     = useState('')
    const [email, setEmail]             = useState('')
    const [phone, setPhone]             = useState('')
    const [password, setPassword]       = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [factoryName, setFactoryName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [consentGiven, setConsentGiven] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    const strength = getPasswordStrength(password)

    const validate = () => {
        const newErrors: Record<string, string> = {}
        if (selectedPlan !== 'free' && (!factoryName.trim() || factoryName.trim().length < 2))
            newErrors.factoryName = 'Factory name must be at least 2 characters'
        if (!ownerName.trim() || ownerName.trim().length < 2)
            newErrors.ownerName = freeMobileEntryText(language, 'nameTooShort')
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            newErrors.email = freeMobileEntryText(language, 'invalidEmail')
        if (!isValidIndianPhone(phone))
            newErrors.phone = freeMobileEntryText(language, 'invalidPhone')
        const passwordErrors = strength.checks
            .filter(check => !check.met)
            .map(check => tx(check.label))
        if (passwordErrors.length > 0)
            newErrors.password = freeMobileEntryText(language, 'passwordNeeds', { rules: passwordErrors.join(', ') })
        const passwordResult = PasswordSchema.safeParse(password)
        if (!passwordResult.success && !newErrors.password) {
            newErrors.password = passwordResult.error.issues[0]?.message ?? 'Password does not meet the requirements'
        }
        if (!confirmPassword) {
            newErrors.confirmPassword = freeMobileEntryText(language, 'confirmPassword')
        } else if (confirmPassword !== password) {
            newErrors.confirmPassword = freeMobileEntryText(language, 'passwordMismatch')
        }
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validate()) return

        setLoading(true)
        try {
            const result = await createOrganizationAndRedirect({
                ownerName: ownerName.trim(),
                email: email.trim(),
                phone: normalizeIndianPhone(phone),
                password,
                confirmPassword,
                factoryName: selectedPlan === 'free' ? ownerName.trim() : factoryName.trim(),
                referralCode: referralCode.trim() || undefined,
                selectedPlan,
                legalAcceptance: {
                    accepted: consentGiven,
                    ...SIGNUP_LEGAL_ACCEPTANCE,
                },
            })
            // If result comes back (not a redirect), it's an error
            if (result && 'error' in result) {
                toast.error(result.error)
                setLoading(false)
            }
        } catch (err) {
            // NEXT_REDIRECT is not an actual error — it means redirect() was called
            if (isNextRedirect(err)) {
                // redirect in progress — don't reset loading state
                return
            }
            // A lost response can follow a created account, so never claim none exists.
            toast.error(freeText(language, 'signupUncertain'))
            setLoading(false)
        }
    }

    return (
        <AuthLayout
            compactMobile={compactMobile}
            title={selectedPlan === 'free' ? freeText(language,'signupTitle') : "Create your factory"}
            subtitle={selectedPlan === 'free' ? freeText(language,'signupSubtitle') : 'Get started as a factory owner'}
        >
            <form onSubmit={handleSubmit} className={cn("space-y-5", compactMobile && "max-sm:space-y-4")} noValidate>
                <AccountTypeSwitch current="owner" />
                {/* Factory Name */}
                {selectedPlan !== 'free' && <div className="space-y-1.5">
                    <Label htmlFor="factoryName" className="text-ink font-medium">
                        Factory name
                    </Label>
                    <Input
                        id="factoryName"
                        type="text"
                        placeholder="e.g. Patel Textiles Pvt. Ltd."
                        value={factoryName}
                        onChange={(e) => { setFactoryName(e.target.value); setErrors(prev => ({ ...prev, factoryName: '' })) }}
                        onBlur={validate}
                        aria-invalid={Boolean(errors.factoryName)}
                        aria-describedby={errors.factoryName ? 'factoryName-error' : undefined}
                        className={cn(
                            'h-12 bg-surface border-input focus:bg-surface transition-all',
                            errors.factoryName && 'border-[var(--wv-status-danger-fg)] focus:border-[var(--wv-status-danger-fg)]'
                        )}
                        disabled={loading}
                    />
                    {errors.factoryName && <p id="factoryName-error" role="alert" className="text-xs text-[var(--wv-status-danger-fg)] mt-1">{errors.factoryName}</p>}
                </div>}

                {/* Owner Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="ownerName" className="text-ink font-medium">
                        Your name
                    </Label>
                    <Input
                        id="ownerName"
                        autoComplete="name"
                        type="text"
                        placeholder="e.g. Rajesh Kumar"
                        value={ownerName}
                        onChange={(e) => { setOwnerName(e.target.value); setErrors(prev => ({ ...prev, ownerName: '' })) }}
                        onBlur={validate}
                        aria-invalid={Boolean(errors.ownerName)}
                        aria-describedby={errors.ownerName ? 'ownerName-error' : undefined}
                        className={cn(
                            'h-12 bg-surface border-input focus:bg-surface transition-all',
                            errors.ownerName && 'border-[var(--wv-status-danger-fg)] focus:border-[var(--wv-status-danger-fg)]'
                        )}
                        disabled={loading}
                    />
                    {errors.ownerName && <p id="ownerName-error" role="alert" className="text-xs text-[var(--wv-status-danger-fg)] mt-1">{errors.ownerName}</p>}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-ink font-medium">
                        Email
                    </Label>
                    <Input
                        id="email"
                        autoComplete="email"
                        type="email"
                        placeholder="name@factory.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: '' })) }}
                        onBlur={validate}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                        className={cn(
                            'h-12 bg-surface border-input focus:bg-surface transition-all',
                            errors.email && 'border-[var(--wv-status-danger-fg)] focus:border-[var(--wv-status-danger-fg)]'
                        )}
                        disabled={loading}
                    />
                    {errors.email && <p id="email-error" role="alert" className="text-xs text-[var(--wv-status-danger-fg)] mt-1">{errors.email}</p>}
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-ink font-medium">
                        Phone Number
                    </Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">+91</span>
                        <Input
                            id="phone"
                            type="tel"
                            placeholder="9876543210"
                            maxLength={14}
                            inputMode="numeric"
                            autoComplete="tel"
                            value={phone}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^\d+\s().-]/g, '')
                                setPhone(val)
                                setErrors(prev => ({ ...prev, phone: '' })) 
                            }}
                            onBlur={validate}
                            aria-invalid={Boolean(errors.phone)}
                            aria-describedby={errors.phone ? 'phone-error' : undefined}
                            className={cn(
                                'h-12 bg-surface border-input focus:bg-surface transition-all pl-11',
                                compactMobile && 'max-sm:pl-[calc(1.75em+0.75rem)]',
                                errors.phone && 'border-[var(--wv-status-danger-fg)] focus:border-[var(--wv-status-danger-fg)]'
                            )}
                            disabled={loading}
                        />
                    </div>
                    {errors.phone && <p id="phone-error" role="alert" className="text-xs text-[var(--wv-status-danger-fg)] mt-1">{errors.phone}</p>}
                </div>

                {/* Password + Strength Indicator */}
                <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-ink font-medium">
                        Password
                    </Label>
                    <div className="relative">
                        <Input
                            id="password"
                            autoComplete="new-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Min. 8 characters"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: '', confirmPassword: '' })) }}
                            onBlur={validate}
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={errors.password ? 'password-error password-rules' : 'password-rules'}
                            className={cn(
                                'h-12 bg-surface border-input focus:bg-surface transition-all pr-12 sm:pr-10',
                                errors.password && 'border-[var(--wv-status-danger-fg)] focus:border-[var(--wv-status-danger-fg)]'
                            )}
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-0.5 sm:right-3 top-1/2 flex h-[44px] w-[44px] sm:h-auto sm:w-auto -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={freeMobileEntryText(language, showPassword ? 'hidePassword' : 'showPassword')}
                            aria-pressed={showPassword}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>

                    {/* Strength bar */}
                    <div className={cn("space-y-2 pt-1", !password.length && (compactMobile ? "sm:hidden" : "hidden"))}>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4].map((i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            'h-1 flex-1 rounded-full transition-all duration-300',
                                            i <= strength.score ? strength.color : 'bg-[var(--wv-cotton-200)]'
                                        )}
                                    />
                                ))}
                            </div>
                            <div id="password-rules" className={cn("flex items-center justify-between", compactMobile && "max-sm:flex-col max-sm:items-start max-sm:gap-2")}>
                                <p className={cn(
                                    'text-xs font-medium transition-colors',
                                    strength.score === 4 ? 'text-[var(--wv-status-success-fg)]' :
                                    strength.score === 3 ? 'text-[var(--wv-status-warning-fg)]' :
                                    strength.score === 2 ? 'text-[var(--wv-brand-accent-strong)]' : 'text-[var(--wv-status-danger-fg)]'
                                )}>
                                    {strength.label}
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    {strength.checks.map((check) => (
                                        <div key={check.label} className={cn(
                                            'flex items-center gap-1 text-[10px]',
                                            compactMobile && 'max-sm:text-xs',
                                            check.met ? 'text-[var(--wv-status-success-fg)]' : cn('text-muted-foreground', compactMobile && 'max-sm:text-body')
                                        )}>
                                            <CheckCircle2 className={cn('h-3 w-3', check.met ? 'opacity-100' : 'opacity-40')} />
                                            <span className={compactMobile ? undefined : 'hidden sm:inline'}>{check.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    {errors.password && <p id="password-error" role="alert" className="text-xs text-[var(--wv-status-danger-fg)]">{errors.password}</p>}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-ink font-medium">
                        {freeMobileEntryText(language, 'confirmPassword')}
                    </Label>
                    <Input
                        id="confirmPassword"
                        type="password"
                        placeholder={freeMobileEntryText(language, 'enterPasswordAgain')}
                        value={confirmPassword}
                        onChange={(e) => {
                            setConfirmPassword(e.target.value)
                            setErrors(prev => ({ ...prev, confirmPassword: '' }))
                        }}
                        onBlur={validate}
                        autoComplete="new-password"
                        aria-invalid={Boolean(errors.confirmPassword)}
                        aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                        className={cn(
                            'h-12 bg-surface border-input focus:bg-surface transition-all',
                            errors.confirmPassword && 'border-[var(--wv-status-danger-fg)] focus:border-[var(--wv-status-danger-fg)]'
                        )}
                        disabled={loading}
                    />
                    {errors.confirmPassword && <p id="confirm-password-error" role="alert" className="text-xs text-[var(--wv-status-danger-fg)] mt-1">{errors.confirmPassword}</p>}
                </div>

                {/* Referral Code (Optional) */}
                <div className={cn(compactMobile && "rounded-lg border border-hairline sm:border-0")}>
                    <button type="button" aria-expanded={referralOpen} aria-controls="signup-referral" onClick={() => setReferralOpen(open => !open)} className={cn("flex min-h-[44px] w-full items-center px-3 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden", !compactMobile && "hidden")}>Referral Code (Optional)</button>
                    <div id="signup-referral" className={cn("space-y-1.5", compactMobile && "max-sm:px-3 max-sm:pb-3", compactMobile && !referralOpen && "max-sm:hidden")}>
                    <Label htmlFor="referralCode" className="text-ink font-medium">
                        Referral Code (Optional)
                    </Label>
                    <Input
                        id="referralCode"
                        type="text"
                        placeholder="e.g. WEAVLY-XXXX"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value)}
                        className="h-12 bg-surface border-input focus:bg-surface transition-all uppercase"
                        disabled={loading}
                    />
                    </div>
                </div>

                {/* Versioned legal acceptance */}
                <div className="flex items-start gap-3 py-1">
                    <input
                        type="checkbox"
                        id="consent"
                        checked={consentGiven}
                        onChange={(e) => setConsentGiven(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-[var(--wv-cotton-500)] text-[var(--wv-neel-900)] focus:ring-[var(--wv-border-focus)] cursor-pointer"
                    />
                    <label htmlFor="consent" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                        I agree to the{' '}
                        <a href="/terms" target="_blank" className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:inline items-center text-ink font-semibold underline decoration-[var(--wv-cotton-400)] hover:decoration-[var(--wv-brand-accent)] underline-offset-4">Terms of Service</a>
                        {' '}and{' '}
                        <a href="/privacy" target="_blank" className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:inline items-center text-ink font-semibold underline decoration-[var(--wv-cotton-400)] hover:decoration-[var(--wv-brand-accent)] underline-offset-4">Privacy Policy</a>
                    </label>
                </div>

                {/* Submit */}
                <Button
                    type="submit"
                    id="create-factory-btn"
                    className="w-full h-12 text-base font-semibold transition-transform active:scale-[0.98] mt-2 disabled:bg-[var(--wv-cotton-200)] disabled:text-[var(--wv-disabled)] disabled:border-[var(--wv-cotton-400)]"
                    disabled={loading || !consentGiven}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            {selectedPlan === 'free' ? freeText(language, 'creatingFreeAccount') : 'Creating factory...'}
                        </>
                    ) : (
                        <span className={cn("flex items-center justify-center gap-2", compactMobile && "max-sm:min-w-0 max-sm:whitespace-normal")}>
                            <Building2 className="h-4 w-4" />
                            {selectedPlan === 'free' ? freeText(language, 'createFreeAccount') : 'Create factory'}
                            <ArrowRight className="h-4 w-4" />
                        </span>
                    )}
                </Button>

                <div className="space-y-3 pt-1">
                    <p className="text-center text-sm text-muted-foreground">
                        Already have an account?{' '}
                        <Link href="/login" className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:inline items-center text-ink font-semibold underline decoration-[var(--wv-cotton-400)] hover:decoration-[var(--wv-brand-accent)] underline-offset-4">
                            Log in
                        </Link>
                    </p>
                </div>
            </form>
            <AuthTransition open={loading} mode="sign-up" />
        </AuthLayout>
    )
}

export default function SignupPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SignupForm />
        </Suspense>
    )
}
