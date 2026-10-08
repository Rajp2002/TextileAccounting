'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowRight, Eye, EyeOff, Factory, Loader2 } from 'lucide-react'
import AuthLayout from '@/components/auth/auth-layout'
import { AccountTypeSwitch } from '@/components/auth/AccountTypeSwitch'
import { AuthTransition } from '@/components/auth/auth-transition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslation } from '@/lib/i18n/context'
import { supervisorText, type SupervisorTextKey } from '@/lib/i18n/supervisor-access'
import { checkSupervisorJoinCode, joinFactoryAsSupervisor } from '@/app/(auth)/actions/supervisor-join'
import { formatJoinCode, isValidJoinCode, normalizeJoinCode } from '@/lib/supervisor-access'
import { isValidIndianPhone } from '@/lib/phone'
import { PasswordSchema } from '@/lib/schemas'
import { SIGNUP_LEGAL_ACCEPTANCE } from '@/lib/legal-documents'
import { cn } from '@/lib/utils'

type Field = 'code' | 'fullName' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'legal' | 'form'

function isNextRedirect(error: unknown) {
    if (typeof error !== 'object' || error === null) return false
    const redirectError = error as { message?: string; digest?: string }
    return redirectError.message === 'NEXT_REDIRECT' || Boolean(redirectError.digest?.startsWith('NEXT_REDIRECT'))
}

const inputClass = 'h-12 bg-surface border-input focus:bg-surface transition-all'
const errorInputClass = 'border-[var(--wv-status-danger-fg)] focus:border-[var(--wv-status-danger-fg)]'
const linkClass = 'inline-flex min-h-[44px] items-center text-ink font-semibold underline decoration-[var(--wv-cotton-400)] underline-offset-4 hover:decoration-[var(--wv-brand-accent)] sm:min-h-0'

export function JoinForm({ initialCode }: { initialCode: string }) {
    const { language } = useTranslation()
    const text = (key: SupervisorTextKey, values?: Record<string, string | number>) => supervisorText(language, key, values)

    const [code, setCode] = useState(formatJoinCode(normalizeJoinCode(initialCode).slice(0, 8)))
    const [factoryName, setFactoryName] = useState<string | null>(null)
    const [checking, setChecking] = useState(false)
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [accepted, setAccepted] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
    const autoChecked = useRef(false)

    const normalizedCode = normalizeJoinCode(code)

    async function checkCode() {
        if (checking) return
        if (!isValidJoinCode(normalizedCode)) {
            setErrors({ code: text('codeInvalid') })
            return
        }
        setChecking(true)
        setErrors({})
        try {
            const result = await checkSupervisorJoinCode(normalizedCode)
            if (result.valid) setFactoryName(result.factoryName)
            else setErrors({ code: text(result.error) })
        } catch {
            setErrors({ code: text('joinFailed') })
        } finally {
            setChecking(false)
        }
    }

    // A shared link carries the code; check it once on arrival.
    useEffect(() => {
        if (autoChecked.current || !isValidJoinCode(normalizeJoinCode(initialCode))) return
        autoChecked.current = true
        void checkCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the code in the link
    }, [])

    function validateDetails() {
        const next: Partial<Record<Field, string>> = {}
        if (fullName.trim().length < 2) next.fullName = text('nameInvalid')
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = text('emailInvalid')
        if (!isValidIndianPhone(phone)) next.phone = text('phoneInvalid')
        const passwordResult = PasswordSchema.safeParse(password)
        if (!passwordResult.success) next.password = passwordResult.error.issues[0]?.message ?? text('joinFailed')
        if (password !== confirmPassword) next.confirmPassword = text('passwordMismatch')
        if (!accepted) next.legal = text('legalRequired')
        setErrors(next)
        return Object.keys(next).length === 0
    }

    async function submit(event: FormEvent) {
        event.preventDefault()
        if (!factoryName) return void checkCode()
        if (loading || !validateDetails()) return
        setLoading(true)
        try {
            const result = await joinFactoryAsSupervisor({
                code: normalizedCode, fullName, email, phone, password, confirmPassword,
                legalAcceptance: { accepted, ...SIGNUP_LEGAL_ACCEPTANCE },
            })
            const field: Field = result.error === 'codeInvalid' ? 'code' : result.error === 'phoneInvalid' ? 'phone'
                : result.error === 'emailTaken' || result.error === 'emailInvalid' ? 'email' : 'form'
            if (result.error === 'codeInvalid') setFactoryName(null)
            setErrors({ [field]: result.message ?? text(result.error) })
            setLoading(false)
        } catch (error) {
            if (isNextRedirect(error)) return
            setErrors({ form: text('joinFailed') })
            setLoading(false)
        }
    }

    const fieldError = (field: Field) => errors[field]
        ? <p id={`join-${field}-error`} role="alert" className="mt-1 text-xs text-[var(--wv-status-danger-fg)]">{errors[field]}</p>
        : null

    return (
        <AuthLayout title={text('joinTitle')} subtitle={factoryName ? text('codeFound', { factory: factoryName }) : text('joinSubtitle')}>
            <form onSubmit={submit} className="space-y-4" noValidate>
                <AccountTypeSwitch current="supervisor" />
                {!factoryName ? (
                    <div className="space-y-1.5">
                        <Label htmlFor="join-code" className="font-medium text-ink">{text('codeLabel')}</Label>
                        <Input
                            id="join-code"
                            value={code}
                            onChange={event => {
                                const next = normalizeJoinCode(event.target.value).slice(0, 8)
                                setCode(next.length > 4 ? `${next.slice(0, 4)}-${next.slice(4)}` : next)
                                setErrors({})
                            }}
                            placeholder={text('codePlaceholder')}
                            autoCapitalize="characters"
                            autoComplete="off"
                            spellCheck={false}
                            inputMode="text"
                            aria-invalid={Boolean(errors.code)}
                            aria-describedby={errors.code ? 'join-code-error' : undefined}
                            className={cn(inputClass, 'text-center font-mono text-xl tracking-[0.2em] uppercase', errors.code && errorInputClass)}
                            disabled={checking}
                        />
                        {fieldError('code')}
                    </div>
                ) : (
                    <>
                        <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-hairline bg-surface-soft px-3 py-2">
                            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                                <Factory className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <span className="truncate">{factoryName}</span>
                                <span className="font-mono text-xs text-muted-foreground">{formatJoinCode(normalizedCode)}</span>
                            </span>
                            <button type="button" onClick={() => { setFactoryName(null); setErrors({}) }} className="min-h-11 shrink-0 text-xs font-semibold text-ink underline underline-offset-4" disabled={loading}>
                                {text('changeCode')}
                            </button>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="join-name" className="font-medium text-ink">{text('nameLabel')}</Label>
                            <Input id="join-name" value={fullName} autoComplete="name" onChange={event => setFullName(event.target.value)}
                                aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? 'join-fullName-error' : undefined}
                                className={cn(inputClass, errors.fullName && errorInputClass)} disabled={loading} />
                            {fieldError('fullName')}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="join-email" className="font-medium text-ink">{text('emailLabel')}</Label>
                            <Input id="join-email" type="email" value={email} autoComplete="email" onChange={event => setEmail(event.target.value)}
                                aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'join-email-error' : undefined}
                                className={cn(inputClass, errors.email && errorInputClass)} disabled={loading} />
                            {fieldError('email')}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="join-phone" className="font-medium text-ink">{text('phoneLabel')}</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-muted-foreground">+91</span>
                                <Input id="join-phone" type="tel" inputMode="numeric" autoComplete="tel" maxLength={14} placeholder="9876543210" value={phone}
                                    onChange={event => setPhone(event.target.value.replace(/[^\d+\s().-]/g, ''))}
                                    aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'join-phone-error' : undefined}
                                    className={cn(inputClass, 'pl-11', errors.phone && errorInputClass)} disabled={loading} />
                            </div>
                            {fieldError('phone')}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="join-password" className="font-medium text-ink">{text('passwordLabel')}</Label>
                            <div className="relative">
                                <Input id="join-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password}
                                    onChange={event => setPassword(event.target.value)}
                                    aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'join-password-error' : undefined}
                                    className={cn(inputClass, 'pr-12', errors.password && errorInputClass)} disabled={loading} />
                                <button type="button" onClick={() => setShowPassword(value => !value)} aria-pressed={showPassword}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-ink">
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {fieldError('password')}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="join-confirm" className="font-medium text-ink">{text('confirmPasswordLabel')}</Label>
                            <Input id="join-confirm" type="password" autoComplete="new-password" value={confirmPassword}
                                onChange={event => setConfirmPassword(event.target.value)}
                                aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? 'join-confirmPassword-error' : undefined}
                                className={cn(inputClass, errors.confirmPassword && errorInputClass)} disabled={loading} />
                            {fieldError('confirmPassword')}
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-start gap-3 py-1">
                                <input type="checkbox" id="join-legal" checked={accepted} onChange={event => setAccepted(event.target.checked)}
                                    className="mt-1 h-4 w-4 cursor-pointer rounded border-[var(--wv-cotton-500)]" />
                                <label htmlFor="join-legal" className="cursor-pointer text-sm leading-snug text-muted-foreground">{text('legalAgree')}</label>
                            </div>
                            <p className="flex flex-wrap gap-x-4 pl-7 text-sm">
                                <a href="/terms" target="_blank" className={linkClass}>{text('readTerms')}</a>
                                <a href="/privacy" target="_blank" className={linkClass}>{text('readPrivacy')}</a>
                            </p>
                            {fieldError('legal')}
                        </div>
                    </>
                )}

                {fieldError('form')}

                <Button type="submit" className="mt-2 h-12 w-full text-base font-semibold" disabled={checking || loading || (!factoryName && normalizedCode.length < 8)}>
                    {checking || loading
                        ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />{checking ? text('checkingCode') : text('submittingJoin')}</>
                        : <span className="flex items-center justify-center gap-2">{factoryName ? text('submitJoin') : text('checkCode')}<ArrowRight className="h-4 w-4" /></span>}
                </Button>

                <p className="pt-1 text-center text-sm text-muted-foreground">
                    <Link href="/login" className={linkClass}>{text('haveAccount')}</Link>
                </p>
            </form>
            <AuthTransition open={loading} mode="sign-up" />
        </AuthLayout>
    )
}
