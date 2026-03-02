'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ArrowRight, Building2, HardHat, Check, Eye, EyeOff } from 'lucide-react'
import AuthLayout from '@/components/auth/auth-layout'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { signUpWithEmail } from './actions'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [role, setRole] = useState<'owner' | 'supervisor'>('owner')
    const [factoryId, setFactoryId] = useState('')
    const [orgName, setOrgName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const router = useRouter()

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            toast.error('Passwords do not match')
            return
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }

        setLoading(true)

        try {
            const formData = new FormData()
            formData.append('name', name)
            formData.append('email', email)
            formData.append('password', password)
            formData.append('confirmPassword', confirmPassword)
            formData.append('role', role)
            if (role === 'supervisor') formData.append('factoryId', factoryId)
            if (role === 'owner') formData.append('orgName', orgName)

            const result = await signUpWithEmail(formData)

            if (result.error) {
                toast.error(result.error)
                return
            }

            if (result.confirmed) {
                // Email confirmation disabled — user is logged in directly, profile already created.
                // We MUST refresh the session here so Supabase re-runs the JWT custom hook
                // and injects org_id + user_role claims into the token before the dashboard loads.
                // Without this, the first page load races against a JWT that has no org_id.
                const supabase = createClient()
                await supabase.auth.refreshSession()

                toast.success('Account created!')
                if (result.role === 'owner') {
                    router.push('/owner/analytics')
                } else {
                    router.push('/supervisor/production')
                }
                return
            }

            // Email confirmation required — redirect to verify page
            toast.success('Account created! Check your email.')
            router.push(`/verify?email=${encodeURIComponent(email)}`)

        } catch (error: any) {
            console.error('Signup error:', error)
            toast.error(error.message || 'An error occurred during signup')
        } finally {
            setLoading(false)
        }
    }

    return (
        <AuthLayout
            title="Create an Account"
            subtitle="Get started with Textile SaaS today"
        >
            <form onSubmit={handleSignup} className="space-y-5">
                <div className="space-y-4">
                    {/* Full Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-gray-600 font-medium">
                            Full Name
                        </Label>
                        <Input
                            id="name"
                            type="text"
                            placeholder="e.g. Rajesh Kumar"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                        />
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-gray-600 font-medium">
                            Email Address
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                        />
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-gray-600 font-medium">
                            Password
                        </Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Min. 6 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-gray-600 font-medium">
                            Confirm Password
                        </Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="Re-enter your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                            className={cn(
                                "h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all",
                                confirmPassword && password !== confirmPassword && "border-red-300 focus:border-red-400"
                            )}
                        />
                        {confirmPassword && password !== confirmPassword && (
                            <p className="text-xs text-red-500">Passwords do not match</p>
                        )}
                    </div>

                    {/* Role Selector */}
                    <div className="space-y-2">
                        <Label className="text-gray-600 font-medium">I am a...</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                className={cn(
                                    "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                    role === 'owner'
                                        ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                                        : "border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                                )}
                                onClick={() => setRole('owner')}
                            >
                                <Building2 className={cn("w-7 h-7", role === 'owner' ? "text-indigo-600" : "text-gray-400")} />
                                <span className="font-semibold text-sm">Factory Owner</span>
                                {role === 'owner' && (
                                    <div className="absolute top-2 right-2">
                                        <Check className="w-4 h-4 text-indigo-600" />
                                    </div>
                                )}
                            </button>

                            <button
                                type="button"
                                className={cn(
                                    "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                    role === 'supervisor'
                                        ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                                        : "border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                                )}
                                onClick={() => setRole('supervisor')}
                            >
                                <HardHat className={cn("w-7 h-7", role === 'supervisor' ? "text-indigo-600" : "text-gray-400")} />
                                <span className="font-semibold text-sm">Supervisor</span>
                                {role === 'supervisor' && (
                                    <div className="absolute top-2 right-2">
                                        <Check className="w-4 h-4 text-indigo-600" />
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Conditional Fields */}
                    <AnimatePresence mode="wait">
                        {role === 'owner' ? (
                            <motion.div
                                key="owner-fields"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-2 overflow-hidden"
                            >
                                <Label htmlFor="orgName" className="text-gray-600 font-medium">
                                    Factory / Organization Name
                                </Label>
                                <Input
                                    id="orgName"
                                    type="text"
                                    placeholder="e.g. Patel Textiles Pvt. Ltd."
                                    value={orgName}
                                    onChange={(e) => setOrgName(e.target.value)}
                                    required
                                    className="h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="supervisor-fields"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-2 overflow-hidden"
                            >
                                <Label htmlFor="factoryId" className="text-gray-600 font-medium">
                                    Factory ID
                                </Label>
                                <Input
                                    id="factoryId"
                                    type="text"
                                    placeholder="e.g. A3X7K"
                                    value={factoryId}
                                    onChange={(e) => setFactoryId(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    className="h-12 text-center font-mono tracking-widest uppercase bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                                    required
                                />
                                <p className="text-xs text-gray-500 text-center">
                                    Ask your factory owner for this code
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <Button
                    type="submit"
                    className="w-full h-12 text-base font-medium transition-transform active:scale-[0.98]"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Creating account...
                        </>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            Create Account
                            <ArrowRight className="h-4 w-4" />
                        </span>
                    )}
                </Button>

                <div className="text-center text-sm text-gray-500">
                    Already have an account?{' '}
                    <Link href="/login" className="text-indigo-600 hover:underline font-medium">
                        Log in
                    </Link>
                </div>
            </form>
        </AuthLayout>
    )
}
