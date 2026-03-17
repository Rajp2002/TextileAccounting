'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Factory, User, ShieldCheck } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AccessCodeGenerator } from '@/components/AccessCodeGenerator'
import { useUserProfile } from '@/hooks/use-user-profile'
import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsPage() {
    const supabase = createClient()
    const { data: userProfile, isLoading: profileLoading } = useUserProfile()

    // Fetch organization details on the client
    const { data: org, isLoading: orgLoading } = useQuery({
        queryKey: ['organization', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('organizations')
                .select('name, join_code')
                .eq('id', userProfile!.org_id)
                .single()
            if (error) throw error
            return data
        }
    })

    const isLoading = profileLoading || orgLoading

    if (isLoading) {
        return (
            <div className="space-y-6 max-w-2xl animate-pulse">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Card>
                    <CardHeader><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-48 mt-2" /></CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                    <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                </Card>
            </div>
        )
    }

    if (!userProfile) return null

    return (
        <div className="space-y-6 max-w-2xl pb-10">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500 mt-0.5">Factory configuration and access codes</p>
            </div>

            <Card className="shadow-sm border-gray-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Factory className="h-5 w-5 text-blue-600" />
                        <CardTitle>Factory Information</CardTitle>
                    </div>
                    <CardDescription>Manage your factory details and access codes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Factory Name</Label>
                        <Input value={org?.name || ''} readOnly className="bg-gray-50" />
                    </div>

                    <div className="space-y-2">
                        <Label>Factory ID (Join Code)</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    value={org?.join_code || ''}
                                    readOnly
                                    className="bg-blue-50 border-blue-200 text-blue-800 font-mono font-bold tracking-widest text-center text-lg"
                                />
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Share this code with your supervisors so they can join your factory.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <AccessCodeGenerator />

            <Card className="shadow-sm border-gray-200">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-teal-600" />
                        <CardTitle>Personal Information</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input value={userProfile.full_name || ''} readOnly className="bg-gray-50" />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone Number</Label>
                            <Input value={userProfile.phone || ''} readOnly className="bg-gray-50" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                        <ShieldCheck className="h-3 w-3" />
                        <span>Role: {userProfile.role}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
