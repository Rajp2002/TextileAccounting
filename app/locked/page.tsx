import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requestUnlock } from '@/lib/actions/compliance'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldAlert, MessageSquare, LogOut } from 'lucide-react'
import { LEGAL_OPERATOR } from '@/lib/legal-operator'
import Link from 'next/link'

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
        <div className="safe-area-page min-h-svh bg-canvas flex items-center justify-center [--page-gutter-x:1rem] [--page-gutter-y:1rem]">
            <Card className="max-w-md w-full bg-surface border-wv-border-default text-ink shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-wv-status-danger-solid" />
                
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto bg-risk-soft p-3 rounded-full w-fit mb-4 border border-wv-status-danger-border">
                        <ShieldAlert className="w-10 h-10 text-wv-status-danger-fg" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Factory Access Suspended</CardTitle>
                    <CardDescription className="text-subtle">
                        Access to <span className="text-ink font-semibold">{org.name}</span> has been locked by Weavly Compliance.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 pt-4">
                    <div className="bg-surface-soft rounded-lg p-4 border border-wv-border-default">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-subtle mb-2">Detection Reason</h4>
                        <p className="text-sm text-body leading-relaxed italic">
                            &ldquo;{org.lockdown_reason || 'Automated security trigger or pending compliance verification.'}&rdquo;
                        </p>
                    </div>

                    <div className="space-y-3">
                        <p className="text-sm text-subtle">
                            State changes (production logs, attendance, payments) are blocked. You may request a review below or email the Grievance Officer at{' '}
                            <a href={`mailto:${LEGAL_OPERATOR.contactEmail}`} className="font-medium text-ink underline underline-offset-4">
                                {LEGAL_OPERATOR.contactEmail}
                            </a>.
                        </p>
                    </div>

                    <Link href="/support" className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">Open your private support tickets</Link>

                    <form action={handleRequestUnlock} className="space-y-3">
                        <textarea
                            name="reason"
                            required
                            placeholder="Provide details for the unlock request..."
                            className="w-full bg-surface border border-wv-border-control rounded-md p-3 text-sm placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-wv-border-focus focus:border-wv-border-focus min-h-[100px]"
                        />
                        <Button type="submit" className="w-full bg-ink hover:bg-body text-wv-text-on-action border-none transition-all">
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Submit Unlock Request
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="bg-surface-soft border-t border-wv-border-default pt-6">
                    <form action="/auth/signout" method="post" className="w-full">
                        <Button variant="ghost" className="w-full text-subtle hover:text-body hover:bg-transparent">
                            <LogOut className="w-4 h-4 mr-2" />
                            Sign Out
                        </Button>
                    </form>
                </CardFooter>
            </Card>
        </div>
    )
}
