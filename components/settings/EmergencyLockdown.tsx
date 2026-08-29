'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { ShieldAlert, Lock, AlertOctagon, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { LEGAL_OPERATOR } from '@/lib/legal-operator'

export function EmergencyLockdown() {
    const supabase = createClient()
    const queryClient = useQueryClient()
    const [lockdownDialogOpen, setLockdownDialogOpen] = useState(false)
    const [confirmText, setConfirmText] = useState('')

    // Fetch current lockdown status
    const { data: security, isLoading } = useQuery({
        queryKey: ['platform_security'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('platform_security')
                .select('is_locked_down, locked_at, locked_by')
                .maybeSingle()
            if (error) throw error
            return data
        }
    })

    const lockdownMutation = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase.rpc('emergency_lockdown')
            if (error) throw new Error(error.message)
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['platform_security'] })
            setLockdownDialogOpen(false)
            setConfirmText('')
            toast.error('PLATFORM LOCKED DOWN. All data access is now frozen.', {
                duration: 10000,
            })
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to trigger lockdown')
        }
    })

    const isLocked = security?.is_locked_down

    return (
        <Card className={`shadow-sm border-2 ${isLocked ? 'border-red-600 bg-red-50' : 'border-gray-200'}`}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className={`h-5 w-5 ${isLocked ? 'text-red-600' : 'text-orange-600'}`} />
                        <CardTitle className={isLocked ? 'text-red-900' : ''}>Emergency Lockdown</CardTitle>
                    </div>
                    {isLocked && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse">
                            <Lock className="h-3 w-3" /> ACTIVE
                        </div>
                    )}
                </div>
                <CardDescription className={isLocked ? 'text-red-700' : ''}>
                    {isLocked 
                        ? `Platform access was frozen on ${new Date(security.locked_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`
                        : 'Immediately freeze all data access across the platform in case of a breach.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLocked ? (
                    <div className="p-4 rounded-lg bg-white border border-red-200 text-sm text-red-800 space-y-2">
                        <p className="font-bold flex items-center gap-2">
                            <AlertOctagon className="h-4 w-4" /> Platform is in Restricted Mode
                        </p>
                        <p>
                            All workers, supervisors, and external APIs are currently blocked from reading or writing data per RLS lockdown policies. Contact{' '}
                            <a href={`mailto:${LEGAL_OPERATOR.contactEmail}`} className="font-medium underline underline-offset-4">
                                {LEGAL_OPERATOR.contactEmail}
                            </a>{' '}
                            to initiate the recovery protocol.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="p-4 rounded-lg bg-orange-50 border border-orange-100 text-xs text-orange-800">
                            <p className="font-bold mb-1 uppercase tracking-wider">Workspace emergency containment:</p>
                            <p>Triggering a lockdown records an immediate containment action for later investigation. It does not by itself satisfy or determine any regulatory notification duty. This action is irreversible via the UI for safety.</p>
                        </div>
                        
                        <Dialog open={lockdownDialogOpen} onOpenChange={(val) => { setLockdownDialogOpen(val); if (!val) setConfirmText('') }}>
                            <DialogTrigger asChild>
                                <Button 
                                    variant="destructive" 
                                    className="w-full bg-red-600 hover:bg-red-700 h-12 font-bold text-lg shadow-lg"
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'THE BIG RED BUTTON'}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[420px] border-red-200">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-red-700 text-2xl">
                                        <AlertOctagon className="h-8 w-8" />
                                        Critical Action
                                    </DialogTitle>
                                    <DialogDescription className="text-gray-900 font-medium pt-2">
                                        Are you absolutely sure? This will instantly block all factory operations and payroll access for your entire organization.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-3 py-4">
                                    <p className="text-sm text-gray-700">Type <span className="font-mono font-bold text-red-700">LOCKDOWN</span> to confirm emergency containment:</p>
                                    <Input 
                                        value={confirmText} 
                                        onChange={(e) => setConfirmText(e.target.value)} 
                                        placeholder="LOCKDOWN" 
                                        className="border-red-200 focus:ring-red-600 focus:border-red-600 font-bold uppercase" 
                                    />
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setLockdownDialogOpen(false)}>Cancel</Button>
                                    <Button 
                                        variant="destructive" 
                                        disabled={confirmText !== 'LOCKDOWN' || lockdownMutation.isPending} 
                                        onClick={() => lockdownMutation.mutate()}
                                        className="bg-red-700 hover:bg-red-800 font-bold px-8"
                                    >
                                        {lockdownMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldAlert className="h-4 w-4 mr-2" />}
                                        FREEZE PLATFORM
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
