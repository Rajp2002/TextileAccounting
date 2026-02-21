'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ArrowRight } from 'lucide-react'
import AuthLayout from '@/components/auth/auth-layout'

export default function LoginPage() {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) throw error

            toast.success('Logged in successfully!')

            // Check role and redirect
            if (data.session) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.session.user.id)
                    .single()

                if (profile?.role === 'owner') {
                    router.push('/owner/analytics')
                } else if (profile?.role === 'supervisor') {
                    router.push('/supervisor/production')
                } else {
                    router.push('/onboarding')
                }
            } else {
                router.push('/')
            }

        } catch (error: any) {
            console.error('Login error:', error)
            toast.error(error.message || 'Invalid login credentials')
        } finally {
            setLoading(false)
        }
    }

    return (
        <AuthLayout
            title="Welcome Back"
            subtitle="Sign in to your Textile SaaS account"
        >
            <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-4">
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
                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-gray-600 font-medium">
                            Password
                        </Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="h-12 bg-gray-50/50 border-gray-200 focus:bg-white transition-all"
                        />
                    </div>
                </div>

                <Button
                    type="submit"
                    className="w-full h-12 text-base font-medium transition-transform active:scale-[0.98]"
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

                <div className="text-center text-sm text-gray-500">
                    Don't have an account?{' '}
                    <Link href="/signup" className="text-indigo-600 hover:underline font-medium">
                        Create an account
                    </Link>
                </div>
            </form>
        </AuthLayout>
    )
}
