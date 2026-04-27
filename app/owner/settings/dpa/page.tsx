import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { signDpa } from '@/lib/actions/compliance'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, CheckCircle2, AlertCircle } from 'lucide-react'

export default async function DpaPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, role, organizations(name)')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'owner') redirect('/')

    // Get active DPA template
    const { data: template } = await supabase
        .from('dpas')
        .select('*')
        .eq('is_active', true)
        .single()

    // Get current signature status
    const { data: signature } = await supabase
        .from('organization_dpas')
        .select('*, dpas(version_string)')
        .eq('org_id', profile.org_id)
        .eq('dpa_id', template?.id)
        .maybeSingle()

    const isSigned = signature?.status === 'signed'

    async function handleSign() {
        'use server'
        if (template?.id) {
            await signDpa(template.id)
        }
    }

    return (
        <div className="container max-w-4xl py-10">
            <div className="flex flex-col space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Compliance & Data Agreements</h1>
                    <p className="text-muted-foreground mt-2">
                        Manage your Data Processing Agreements (DPA) as required by DPDP 2026.
                    </p>
                </div>

                <div className="grid gap-6">
                    <Card className={isSigned ? "border-green-500/20 bg-green-50/50 dark:bg-green-950/10" : ""}>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <CardTitle className="flex items-center">
                                        <FileText className="w-5 h-5 mr-2 text-primary" />
                                        Data Processing Agreement (DPA)
                                    </CardTitle>
                                    <CardDescription>
                                        Version {template?.version_string || 'v1.0'}
                                    </CardDescription>
                                </div>
                                {isSigned ? (
                                    <div className="flex items-center text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full text-sm font-medium">
                                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                        Signed
                                    </div>
                                ) : (
                                    <div className="flex items-center text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-3 py-1 rounded-full text-sm font-medium">
                                        <AlertCircle className="w-4 h-4 mr-1.5" />
                                        Action Required
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="prose prose-sm dark:prose-invert max-w-none bg-background p-6 rounded-lg border shadow-inner max-h-[400px] overflow-y-auto mb-6">
                                <h3 className="text-center font-bold mb-4">DATA PROCESSING AGREEMENT</h3>
                                <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                                    {template?.content_text}
                                </p>
                            </div>

                            {!isSigned && (
                                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-4 rounded-lg mb-6">
                                    <p className="text-sm text-amber-800 dark:text-amber-300 flex items-start">
                                        <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                                        By clicking "Digitally Sign Agreement", you confirm that you have read and agree to the terms of this DPA on behalf of {(profile?.organizations as any)?.name || 'your factory'}. This action will be logged with your timestamp and IP address for compliance auditing.
                                    </p>
                                </div>
                            )}

                            {isSigned && (
                                <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
                                    <p>Signed by: <span className="font-medium text-foreground">{user.email}</span></p>
                                    <p>Signed at: <span className="font-medium text-foreground">{new Date(signature.signed_at).toLocaleString()}</span></p>
                                </div>
                            )}
                        </CardContent>
                        {!isSigned && (
                            <CardFooter className="flex justify-end border-t pt-6">
                                <form action={handleSign}>
                                    <Button size="lg" className="px-8">
                                        Digitally Sign Agreement
                                    </Button>
                                </form>
                            </CardFooter>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    )
}
