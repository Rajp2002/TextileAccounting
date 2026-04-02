'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
    Loader2, ArrowRight, Eye, EyeOff,
    CheckCircle2, XCircle, HardHat
} from 'lucide-react'
import AuthLayout from '@/components/auth/auth-layout'
import { validateJoinCode, joinOrganization } from '@/app/(auth)/actions/auth'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export default function JoinPage() {
    const [isPending, startTransition] = useTransition()
    const [loading, setLoading] = useState(false)

    // Join code state
    const [joinCode, setJoinCode]           = useState('')
    const [codeValidating, setCodeValidating] = useState(false)
    const [codeResult, setCodeResult]       = useState<{ valid: boolean; orgName?: string; error?: string } | null>(null)

    // Form fields
    const [supervisorName, setSupervisorName] = useState('')
    const [email, setEmail]                   = useState('')
    const [password, setPassword]             = useState('')
    const [showPassword, setShowPassword]     = useState(false)
    const [errors, setErrors]                 = useState<Record<string, string>>({})

    // ── On-blur / Auto-validate: validate the join code ──────────────────────────
    const handleCodeBlur = async () => {
        const normalized = joinCode.trim().toUpperCase()
        if (!normalized || normalized.length !== 8) return

        setCodeValidating(true)
        setCodeResult(null)

        const result = await validateJoinCode(normalized)
        setCodeResult(result)
        setCodeValidating(false)
        if (result.valid) {
            setErrors(p => ({ ...p, joinCode: '' }))
        } else {
            setErrors(p => ({ ...p, joinCode: result.error || 'Please enter a valid join code' }))
        }
    }

    useEffect(() => {
        if (joinCode.length === 8 && !codeResult && !codeValidating) {
            handleCodeBlur()
        }
    }, [joinCode, codeResult, codeValidating])

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Auto-uppercase + strip spaces on each keystroke
        const val = e.target.value.toUpperCase().replace(/\s/g, '')
        setJoinCode(val)
        // Clear result if user is editing
        if (codeResult) setCodeResult(null)
    }

    const validate = () => {
        const newErrors: Record<string, string> = {}
        if (!codeResult?.valid) {
            newErrors.joinCode = codeResult?.error || 'Please enter a valid join code'
        }
        
        // Only validate details if the join code is valid and details form is meant to be shown
        if (codeResult?.valid) {
            if (!supervisorName.trim() || supervisorName.trim().length < 2)
                newErrors.supervisorName = 'Name must be at least 2 characters'
            if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                newErrors.email = 'Invalid email address'
            if (password.length < 8)
                newErrors.password = 'Password must be at least 8 characters'
            if (!/[A-Z]/.test(password))
                newErrors.password = 'Password must contain an uppercase letter'
            if (!/[0-9]/.test(password))
                newErrors.password = 'Password must contain a number'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        // If the join code is not yet valid, don't attempt to submit the registration
        if (!codeResult?.valid) {
            if (joinCode.length === 8 && !codeValidating) {
                handleCodeBlur()
            }
            return
        }

        if (!validate()) return

        setLoading(true)
        try {
            const result = await joinOrganization({
                joinCode: joinCode.trim().toUpperCase(),
                supervisorName: supervisorName.trim(),
                email: email.trim(),
                password,
            })
            if (result && 'error' in result) {
                toast.error(result.error)
                setLoading(false)
            }
        } catch (err: any) {
            if (err?.digest?.startsWith('NEXT_REDIRECT')) return
            toast.error('Something went wrong. Please try again.')
            setLoading(false)
        }
    }

    const showDetailsForm = codeResult?.valid

    return (
        <AuthLayout
            title="Join your factory"
            subtitle="Enter your join code to get started"
        >
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* ── Join Code ─────────────────────────────────────────────── */}
                <div className="space-y-1.5">
                    <Label htmlFor="joinCode" className="text-gray-700 font-medium">
                        Join code
                    </Label>
                    <div className="relative">
                        <Input
                            id="joinCode"
                            type="text"
                            placeholder="MILL4X2A"
                            value={joinCode}
                            onChange={handleCodeChange}
                            onBlur={handleCodeBlur}
                            maxLength={8}
                            autoCapitalize="characters"
                            className={cn(
                                'h-12 text-center font-mono tracking-[0.3em] text-lg uppercase bg-gray-50/50 border-gray-200 focus:bg-white transition-all pr-10',
                                codeResult?.valid === true  && 'border-emerald-400 bg-emerald-50/30',
                                codeResult?.valid === false && 'border-red-400 bg-red-50/20',
                                errors.joinCode            && 'border-red-400'
                            )}
                            disabled={loading}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {codeValidating && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                            {!codeValidating && codeResult?.valid === true && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                            {!codeValidating && codeResult?.valid === false && <XCircle className="h-4 w-4 text-red-500" />}
                        </div>
                    </div>

                    {/* Inline code feedback */}
                    <AnimatePresence mode="wait">
                        {codeResult?.valid === true && (
                            <motion.div
                                key="valid"
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="flex items-center gap-1.5 text-sm text-emerald-700 font-medium"
                            >
                                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                                Joining: <span className="font-semibold">{codeResult.orgName}</span>
                            </motion.div>
                        )}
                        {codeResult?.valid === false && (
                            <motion.div
                                key="invalid"
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="flex items-center gap-1.5 text-sm text-red-600"
                            >
                                <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                {codeResult.error}
                            </motion.div>
                        )}
                        {errors.joinCode && !codeResult && (
                            <motion.p key="error" className="text-xs text-red-500">
                                {errors.joinCode}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── Credentials form (reveals after valid code) ────────────── */}
                <AnimatePresence>
                    {showDetailsForm && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-5 overflow-hidden"
                        >
                            {/* Supervisor Name */}
                            <div className="space-y-1.5">
                                <Label htmlFor="supervisorName" className="text-gray-700 font-medium">
                                    Your name
                                </Label>
                                <Input
                                    id="supervisorName"
                                    type="text"
                                    placeholder="e.g. Amit Shah"
                                    value={supervisorName}
                                    onChange={(e) => { setSupervisorName(e.target.value); setErrors(p => ({ ...p, supervisorName: '' })) }}
                                    className={cn(
                                        'h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all',
                                        errors.supervisorName && 'border-red-400'
                                    )}
                                    disabled={loading}
                                />
                                {errors.supervisorName && <p className="text-xs text-red-500">{errors.supervisorName}</p>}
                            </div>

                            {/* Email */}
                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-gray-700 font-medium">
                                    Email
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
                                    className={cn(
                                        'h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all',
                                        errors.email && 'border-red-400'
                                    )}
                                    disabled={loading}
                                />
                                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                            </div>

                            {/* Password */}
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
                                        onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
                                        className={cn(
                                            'h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all pr-10',
                                            errors.password && 'border-red-400'
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
                                {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                            </div>

                            {/* Submit */}
                            <Button
                                type="submit"
                                id="join-factory-btn"
                                className="w-full h-12 text-base font-semibold transition-transform active:scale-[0.98]"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Joining factory...
                                    </>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        <HardHat className="h-4 w-4" />
                                        Join factory
                                        <ArrowRight className="h-4 w-4" />
                                    </span>
                                )}
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="space-y-2 pt-1">
                    <p className="text-center text-sm text-gray-500">
                        Already have an account?{' '}
                        <Link href="/login" className="text-amber-700 hover:underline font-medium">
                            Log in
                        </Link>
                    </p>
                    <p className="text-center text-sm text-gray-500">
                        Creating a factory?{' '}
                        <Link href="/signup" className="text-amber-700 hover:underline font-medium">
                            Start as owner →
                        </Link>
                    </p>
                </div>
            </form>
        </AuthLayout>
    )
}
