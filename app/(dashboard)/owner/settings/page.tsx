import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { signOut } from '@/app/(auth)/actions'
import { LogOut, Copy, ArrowLeft } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Suspense } from 'react'
import { AccessCodeGenerator } from '@/components/AccessCodeGenerator'

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Fetch profile and org details
    const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, role, full_name, phone')
        .eq('id', user.id)
        .single()

    if (!profile || !profile.org_id) {
        return <div>Error loading profile</div>
    }

    const { data: org } = await supabase
        .from('organizations')
        .select('name, join_code')
        .eq('id', profile.org_id)
        .single()

    return (
        <div className="p-4 space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <a href="/owner/analytics">
                        <ArrowLeft className="h-5 w-5" />
                    </a>
                </Button>
                <h1 className="text-2xl font-bold">Settings</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Factory Information</CardTitle>
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

            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input value={profile.full_name || ''} readOnly className="bg-gray-50" />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone Number</Label>
                            <Input value={profile.phone || ''} readOnly className="bg-gray-50" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end pt-4">
                <form action={signOut}>
                    <Button variant="destructive" className="gap-2">
                        <LogOut className="h-4 w-4" />
                        Log out
                    </Button>
                </form>
            </div>
        </div>
    )
}
