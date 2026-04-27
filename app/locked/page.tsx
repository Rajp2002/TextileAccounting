import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requestUnlock } from '@/lib/actions/compliance'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldAlert, MessageSquare, LogOut } from 'lucide-react'

export default async function LockedPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, role, organizations(name, is_locked_down, lockdown_reason, lockdown_severity)')
        .eq('id', user.id)
        .single()

    if (!profile?.org_id) redirect('/login')
    const orgId = profile.org_id

    const org = Array.isArray(profile?.organizations) ? profile.organizations[0] : profile?.organizations

    if (!org?.is_locked_down) {
        redirect('/')
    }

    async function handleRequestUnlock(formData: FormData) {
        'use server'
        const reason = formData.get('reason') as string
        await requestUnlock(orgId, reason)
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <Card className="max-w-md w-full bg-slate-900 border-slate-800 text-slate-100 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-600" />
                
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto bg-red-950/30 p-3 rounded-full w-fit mb-4 border border-red-500/20">
                        <ShieldAlert className="w-10 h-10 text-red-500" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Factory Access Suspended</CardTitle>
                    <CardDescription className="text-slate-400">
                        Access to <span className="text-slate-200 font-semibold">{org.name}</span> has been locked by Weavly Compliance.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 pt-4">
                    <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Detection Reason</h4>
                        <p className="text-sm text-slate-300 leading-relaxed italic">
                            &ldquo;{org.lockdown_reason || 'Automated security trigger or pending compliance verification.'}&rdquo;
                        </p>
                    </div>

                    <div className="space-y-3">
                        <p className="text-sm text-slate-400">
                            State changes (production logs, attendance, payments) are blocked. You may still request a review from the Grievance Officer.
                        </p>
                    </div>

                    <form action={handleRequestUnlock} className="space-y-3">
                        <textarea
                            name="reason"
                            required
                            placeholder="Provide details for the unlock request..."
                            className="w-full bg-slate-950 border-slate-800 rounded-md p-3 text-sm focus:ring-red-500 focus:border-red-500 min-h-[100px]"
                        />
                        <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white border-none transition-all">
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Submit Unlock Request
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="bg-slate-950/30 border-t border-slate-800 pt-6">
                    <form action="/auth/sign-out" method="post" className="w-full">
                        <Button variant="ghost" className="w-full text-slate-500 hover:text-slate-300 hover:bg-transparent">
                            <LogOut className="w-4 h-4 mr-2" />
                            Sign Out
                        </Button>
                    </form>
                </CardFooter>
            </Card>
        </div>
    )
}
