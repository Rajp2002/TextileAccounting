'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react'
import AuthLayout from '@/components/auth/auth-layout'
import { signIn } from '@/app/(auth)/actions/auth'
import LoadingModal from '@/components/auth/loading-modal'

export default function LoginPage() {
    const [loading, setLoading]             = useState(false)
    const [isRedirecting, setIsRedirecting] = useState(false)
    const [email, setEmail]                 = useState('')
    const [password, setPassword]           = useState('')
    const [showPassword, setShowPassword]   = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const result = await signIn({ email: email.trim(), password })

            // result only returns on error — success triggers a redirect() on server
            if (result && 'error' in result) {
                toast.error(result.error)
                setLoading(false)
            }
        } catch (err: any) {
            // NEXT_REDIRECT is not an error — it means redirect() fired
            if (err?.digest?.startsWith('NEXT_REDIRECT')) {
                setIsRedirecting(true)
                return
            }
            toast.error('Something went wrong. Please try again.')
            setLoading(false)
        }
    }

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Sign in to your Vastra account"
        >
            <form onSubmit={handleLogin} className="space-y-5" noValidate>
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
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                        disabled={loading}
                    />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-gray-700 font-medium">
                            Password
                        </Label>
                        {/* Placeholder for future forgot password */}
                        {/* <Link href="/reset-password" className="text-xs text-amber-700 hover:underline">
                            Forgot password?
                        </Link> */}
                    </div>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            className="h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all pr-10"
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
                </div>

                {/* Submit */}
                <Button
                    type="submit"
                    id="login-btn"
                    className="w-full h-12 text-base font-semibold transition-transform active:scale-[0.98]"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Signing in...
                        </>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            Sign in
                            <ArrowRight className="h-4 w-4" />
                        </span>
                    )}
                </Button>

                <div className="space-y-2 text-center text-sm text-gray-500 pt-1">
                    <p>
                        Don't have an account?{' '}
                        <Link href="/signup" className="text-amber-700 hover:underline font-medium">
                            Start as owner
                        </Link>
                        {' '}or{' '}
                        <Link href="/join" className="text-amber-700 hover:underline font-medium">
                            join with a code
                        </Link>
                    </p>
                </div>
            </form>
            <LoadingModal isOpen={isRedirecting} message="Setting up your dashboard..." />
        </AuthLayout>
    )
}
