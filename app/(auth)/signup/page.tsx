'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ArrowRight, Eye, EyeOff, Building2, CheckCircle2 } from 'lucide-react'
import AuthLayout from '@/components/auth/auth-layout'
import { createOrganizationAndRedirect } from '@/app/(auth)/actions/auth'
import { cn } from '@/lib/utils'

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
    const colors = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500']

    return { score, label: labels[score] ?? '', color: colors[score] ?? '', checks }
}

export default function SignupPage() {
    const [loading, setLoading] = useState(false)
    const [ownerName, setOwnerName]     = useState('')
    const [email, setEmail]             = useState('')
    const [password, setPassword]       = useState('')
    const [factoryName, setFactoryName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    const strength = getPasswordStrength(password)

    const validate = () => {
        const newErrors: Record<string, string> = {}
        if (!factoryName.trim() || factoryName.trim().length < 2)
            newErrors.factoryName = 'Factory name must be at least 2 characters'
        if (!ownerName.trim() || ownerName.trim().length < 2)
            newErrors.ownerName = 'Name must be at least 2 characters'
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            newErrors.email = 'Invalid email address'
        if (password.length < 8)
            newErrors.password = 'Password must be at least 8 characters'
        if (!/[A-Z]/.test(password))
            newErrors.password = 'Password must contain an uppercase letter'
        if (!/[0-9]/.test(password))
            newErrors.password = 'Password must contain a number'
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
                password,
                factoryName: factoryName.trim(),
            })
            // If result comes back (not a redirect), it's an error
            if (result && 'error' in result) {
                toast.error(result.error)
                setLoading(false)
            }
        } catch (err: any) {
            // NEXT_REDIRECT is not an actual error — it means redirect() was called
            if (err?.message === 'NEXT_REDIRECT' || err?.digest?.startsWith('NEXT_REDIRECT')) {
                // redirect in progress — don't reset loading state
                return
            }
            toast.error('Something went wrong. Your account was not created. Please try again.')
            setLoading(false)
        }
    }

    return (
        <AuthLayout
            title="Create your factory"
            subtitle="Get started as a factory owner"
        >
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* Factory Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="factoryName" className="text-gray-700 font-medium">
                        Factory name
                    </Label>
                    <Input
                        id="factoryName"
                        type="text"
                        placeholder="e.g. Patel Textiles Pvt. Ltd."
                        value={factoryName}
                        onChange={(e) => { setFactoryName(e.target.value); setErrors(prev => ({ ...prev, factoryName: '' })) }}
                        onBlur={validate}
                        className={cn(
                            'h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all',
                            errors.factoryName && 'border-red-400 focus:border-red-500'
                        )}
                        disabled={loading}
                    />
                    {errors.factoryName && <p className="text-xs text-red-500 mt-1">{errors.factoryName}</p>}
                </div>

                {/* Owner Name */}
                <div className="space-y-1.5">
                    <Label htmlFor="ownerName" className="text-gray-700 font-medium">
                        Your name
                    </Label>
                    <Input
                        id="ownerName"
                        type="text"
                        placeholder="e.g. Rajesh Kumar"
                        value={ownerName}
                        onChange={(e) => { setOwnerName(e.target.value); setErrors(prev => ({ ...prev, ownerName: '' })) }}
                        onBlur={validate}
                        className={cn(
                            'h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all',
                            errors.ownerName && 'border-red-400 focus:border-red-500'
                        )}
                        disabled={loading}
                    />
                    {errors.ownerName && <p className="text-xs text-red-500 mt-1">{errors.ownerName}</p>}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-gray-700 font-medium">
                        Email
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="name@factory.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: '' })) }}
                        onBlur={validate}
                        className={cn(
                            'h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all',
                            errors.email && 'border-red-400 focus:border-red-500'
                        )}
                        disabled={loading}
                    />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>

                {/* Password + Strength Indicator */}
                <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-gray-700 font-medium">
                        Password
                    </Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Min. 8 characters"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: '' })) }}
                            className={cn(
                                'h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all pr-10',
                                errors.password && 'border-red-400 focus:border-red-500'
                            )}
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>

                    {/* Strength bar */}
                    {password.length > 0 && (
                        <div className="space-y-2 pt-1">
                            <div className="flex gap-1">
                                {[1, 2, 3, 4].map((i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            'h-1 flex-1 rounded-full transition-all duration-300',
                                            i <= strength.score ? strength.color : 'bg-gray-200'
                                        )}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center justify-between">
                                <p className={cn(
                                    'text-xs font-medium transition-colors',
                                    strength.score === 4 ? 'text-emerald-600' :
                                    strength.score === 3 ? 'text-yellow-600' :
                                    strength.score === 2 ? 'text-orange-500' : 'text-red-500'
                                )}>
                                    {strength.label}
                                </p>
                                <div className="flex gap-3">
                                    {strength.checks.slice(0, 3).map((check) => (
                                        <div key={check.label} className={cn(
                                            'flex items-center gap-1 text-[10px]',
                                            check.met ? 'text-emerald-600' : 'text-gray-400'
                                        )}>
                                            <CheckCircle2 className={cn('h-3 w-3', check.met ? 'opacity-100' : 'opacity-40')} />
                                            <span className="hidden sm:inline">{check.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                </div>

                {/* Submit */}
                <Button
                    type="submit"
                    id="create-factory-btn"
                    className="w-full h-12 text-base font-semibold transition-transform active:scale-[0.98] mt-2"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Creating factory...
                        </>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Create factory
                            <ArrowRight className="h-4 w-4" />
                        </span>
                    )}
                </Button>

                <div className="space-y-3 pt-1">
                    <p className="text-center text-sm text-gray-500">
                        Already have an account?{' '}
                        <Link href="/login" className="text-amber-700 hover:underline font-medium">
                            Log in
                        </Link>
                    </p>
                    <p className="text-center text-sm text-gray-500">
                        Joining as a supervisor?{' '}
                        <Link href="/join" className="text-amber-700 hover:underline font-medium">
                            Enter your join code →
                        </Link>
                    </p>
                </div>
            </form>
        </AuthLayout>
    )
}
