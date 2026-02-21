'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Building2, HardHat, Check, ArrowRight, Copy } from 'lucide-react'
import AuthLayout from '@/components/auth/auth-layout'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export default function OnboardingPage() {
    const [loading, setLoading] = useState(false)
    const [fullName, setFullName] = useState('')
    const [orgName, setOrgName] = useState('')
    const [joinCode, setJoinCode] = useState('')
    const [role, setRole] = useState<'owner' | 'supervisor'>('owner')
    const [createdJoinCode, setCreatedJoinCode] = useState<string | null>(null)
    const [userEmail, setUserEmail] = useState<string>('')
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user?.email) {
                setUserEmail(user.email)
            }
        }
        getUser()
    }, [supabase.auth])

    const handleOnboarding = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error('Session expired. Please login again.')
                router.push('/login')
                return
            }

            if (role === 'owner') {
                // Owner: create organization first, then profile
                const { data: org, error: orgError } = await supabase
                    .from('organizations')
                    .insert({
                        name: orgName,
                        owner_id: user.id,
                    })
                    .select('id, join_code')
                    .single()

                if (orgError) throw orgError

                // Create profile linked to the new org
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: user.id,
                        org_id: org.id,
                        role: 'owner',
                        full_name: fullName,
                        email: userEmail, // Save email
                        phone: user.phone || null,
                    })

                if (profileError) throw profileError

                // Show the join code before redirecting
                setCreatedJoinCode(org.join_code)
                toast.success('Organization created!')
            } else {
                // Supervisor: look up org by join code, then create profile linked to it
                if (!joinCode.trim()) {
                    toast.error('Please enter your Factory ID')
                    setLoading(false)
                    return
                }

                const { data: org, error: orgError } = await supabase
                    .from('organizations')
                    .select('id, name')
                    .eq('join_code', joinCode.trim().toUpperCase())
                    .maybeSingle()

                if (orgError) throw orgError

                if (!org) {
                    toast.error('Invalid Factory ID. Please check with your factory owner.')
                    setLoading(false)
                    return
                }

                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: user.id,
                        org_id: org.id,
                        role: 'supervisor',
                        full_name: fullName,
                        email: userEmail, // Save email
                        phone: user.phone || null,
                    })

                if (profileError) throw profileError

                toast.success(`Joined ${org.name}! Redirecting...`)
                router.push('/supervisor/production')
            }
        } catch (error: any) {
            toast.error(error.message || 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    // Success View
    if (createdJoinCode) {
        return (
            <AuthLayout
                title="Factory Created! 🎉"
                subtitle="Share this ID with your supervisors"
            >
                <div className="space-y-8">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="rounded-2xl bg-indigo-50 border border-indigo-100 p-8 text-center relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Building2 className="w-24 h-24 text-indigo-600" />
                        </div>

                        <p className="text-sm uppercase tracking-wider text-indigo-600 font-semibold mb-3">Your Factory ID</p>
                        <div className="relative group cursor-pointer" onClick={() => {
                            navigator.clipboard.writeText(createdJoinCode)
                            toast.success('Factory ID copied!')
                        }}>
                            <p className="text-5xl font-mono font-bold text-indigo-900 tracking-widest relative z-10">
                                {createdJoinCode}
                            </p>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/50 backdrop-blur-sm transition-opacity rounded-lg">
                                <span className="flex items-center gap-2 text-indigo-700 font-medium">
                                    <Copy className="w-5 h-5" /> Copy
                                </span>
                            </div>
                        </div>
                    </motion.div>

                    <div className="space-y-3">
                        <p className="text-sm text-gray-500 text-center px-4">
                            Supervisors will enter this code when they sign up to automatically join your factory.
                        </p>

                        <div className="grid gap-3 pt-4">
                            <Button
                                className="w-full h-12 text-base"
                                variant="outline"
                                onClick={() => {
                                    navigator.clipboard.writeText(createdJoinCode)
                                    toast.success('Factory ID copied!')
                                }}
                            >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy ID
                            </Button>

                            <Button
                                className="w-full h-12 text-base"
                                onClick={() => router.push('/owner/analytics')}
                            >
                                Go to Dashboard
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </AuthLayout>
        )
    }

    return (
        <AuthLayout
            title="Complete Setup"
            subtitle="Tell us about yourself to get started"
        >
            <form onSubmit={handleOnboarding} className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Signed in as</Label>
                        <Input
                            value={userEmail}
                            disabled
                            className="bg-gray-100/50 text-gray-500 cursor-not-allowed"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="fullName">Your Name</Label>
                        <Input
                            id="fullName"
                            type="text"
                            placeholder="e.g. Rajesh Kumar"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            className="h-11 bg-gray-50/50"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>I am a...</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                className={cn(
                                    "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                    role === 'owner'
                                        ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                                        : "border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                                )}
                                onClick={() => setRole('owner')}
                            >
                                <Building2 className={cn("w-8 h-8", role === 'owner' ? "text-indigo-600" : "text-gray-400")} />
                                <span className="font-semibold text-sm">Factory Owner</span>
                                {role === 'owner' && <div className="absolute top-2 right-2"><Check className="w-4 h-4 text-indigo-600" /></div>}
                            </button>

                            <button
                                type="button"
                                className={cn(
                                    "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                    role === 'supervisor'
                                        ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                                        : "border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                                )}
                                onClick={() => setRole('supervisor')}
                            >
                                <HardHat className={cn("w-8 h-8", role === 'supervisor' ? "text-indigo-600" : "text-gray-400")} />
                                <span className="font-semibold text-sm">Supervisor</span>
                                {role === 'supervisor' && <div className="absolute top-2 right-2"><Check className="w-4 h-4 text-indigo-600" /></div>}
                            </button>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {role === 'owner' ? (
                            <motion.div
                                key="owner-fields"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-2 overflow-hidden"
                            >
                                <Label htmlFor="orgName">Factory / Organization Name</Label>
                                <Input
                                    id="orgName"
                                    type="text"
                                    placeholder="e.g. Patel Textiles Pvt. Ltd."
                                    value={orgName}
                                    onChange={(e) => setOrgName(e.target.value)}
                                    required
                                    className="h-11 bg-gray-50/50"
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
                                <Label htmlFor="joinCode">Factory ID</Label>
                                <Input
                                    id="joinCode"
                                    type="text"
                                    placeholder="e.g. A3X7K"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    className="h-11 text-center font-mono tracking-widest uppercase bg-gray-50/50"
                                    required
                                />
                                <p className="text-xs text-gray-500 text-center">
                                    Ask your factory owner for this code
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <Button type="submit" className="w-full h-12 text-base font-medium" disabled={loading}>
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Setting up...
                        </>
                    ) : (
                        'Get Started'
                    )}
                </Button>
            </form>
        </AuthLayout>
    )
}
