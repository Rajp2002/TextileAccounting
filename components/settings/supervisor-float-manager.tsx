'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Wallet, Plus, History, Loader2, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { formatINR } from '@/lib/finance'
import { toast } from 'sonner'
import { refillSupervisorFloat, getSupervisorBalance } from '@/app/(dashboard)/supervisor/actions'
import { useTranslation } from '@/lib/i18n/context'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useTransliterate } from '@/hooks/use-transliterate'
import { Badge } from '@/components/ui/badge'

export function SupervisorFloatManager() {
    const { t } = useTranslation()
    const tl = useTransliterate()
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { data: userProfile } = useUserProfile()
    const [refillAmounts, setRefillAmounts] = useState<Record<string, string>>({})

    // 1. Fetch all supervisors in the org
    const { data: supervisors, isLoading } = useQuery({
        queryKey: ['supervisors_floats', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            // Get profiles with role 'supervisor'
            const { data: profiles, error: pErr } = await supabase
                .from('profiles')
                .select('id, full_name, phone')
                .eq('org_id', userProfile!.org_id)
                .eq('role', 'supervisor')

            if (pErr) throw pErr

            // For each supervisor, get their balance
            const supervisorsWithBalances = await Promise.all(
                (profiles || []).map(async (p) => {
                    const balance = await getSupervisorBalance(p.id)
                    return { ...p, balance }
                })
            )

            return supervisorsWithBalances
        }
    })

    const refillMutation = useMutation({
        mutationFn: async ({ supervisorId, amount }: { supervisorId: string, amount: number }) => {
            const res = await refillSupervisorFloat(supervisorId, amount)
            if (res.error) throw new Error(res.error)
            return res
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supervisors_floats'] })
            toast.success('Float refilled successfully')
            setRefillAmounts({})
        },
        onError: (err: any) => {
            toast.error(err.message)
        }
    })

    if (isLoading) return <div className="space-y-4 shadow-sm border rounded-xl p-6 bg-white animate-pulse">
        <div className="h-6 w-48 bg-gray-100 rounded" />
        <div className="h-20 w-full bg-gray-50 rounded" />
    </div>

    if (!supervisors || supervisors.length === 0) return null

    return (
        <Card className="shadow-sm border-gray-200">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-indigo-600" />
                    <CardTitle>Supervisor Floats</CardTitle>
                </div>
                <CardDescription>Manage petty cash for floor supervisors to disperse Kharchi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4">
                    {supervisors.map((s) => (
                        <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700">
                                    {tl(s.full_name || 'S')[0]}
                                </div>
                                <div className="space-y-0.5">
                                    <div className="font-bold text-gray-900">{tl(s.full_name || 'Supervisor')}</div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-none text-[10px] h-4">
                                            Balance: {formatINR(s.balance)}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative w-32">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">₹</span>
                                    <Input 
                                        type="number" 
                                        placeholder="Amount" 
                                        className="h-9 pl-6 text-sm bg-white"
                                        value={refillAmounts[s.id] || ''}
                                        onChange={(e) => setRefillAmounts(prev => ({ ...prev, [s.id]: e.target.value }))}
                                    />
                                </div>
                                <Button 
                                    size="sm" 
                                    className="bg-indigo-600 hover:bg-indigo-700 h-9"
                                    disabled={!refillAmounts[s.id] || refillMutation.isPending}
                                    onClick={() => refillMutation.mutate({ supervisorId: s.id, amount: parseFloat(refillAmounts[s.id]) })}
                                >
                                    {refillMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
                                    Refill
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
