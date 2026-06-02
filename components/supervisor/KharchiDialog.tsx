'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from '@/components/ui/dialog'
import { HandCoins, Loader2, Wallet, AlertCircle } from 'lucide-react'
import { formatINR } from '@/lib/finance'
import { toast } from 'sonner'
import { recordKharchi, getSupervisorBalance } from '@/app/(dashboard)/supervisor/actions'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { queueMutation } from '@/lib/db'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useTransliterate } from '@/hooks/use-transliterate'
import { getCurrentTimestampMs } from '@/lib/time'

export function KharchiDialog({
    open,
    onOpenChange,
    workerId,
    workerName,
    workerType = 'meter',
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    workerId: number
    workerName: string
    workerType?: 'meter' | 'fixed'
}) {
    const isOnline = useOnlineStatus()
    const { data: userProfile } = useUserProfile()
    const tl = useTransliterate()
    const queryClient = useQueryClient()
    
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Fetch the supervisor's current float balance
    const { data: balance, isLoading: balanceLoading } = useQuery({
        queryKey: ['supervisor_balance', userProfile?.id],
        enabled: open && !!userProfile?.id,
        queryFn: () => getSupervisorBalance(userProfile!.id)
    })

    const handleDisperse = async () => {
        if (!amount || parseFloat(amount) <= 0) return
        if (balance !== undefined && parseFloat(amount) > balance) {
            toast.error('Insufficient float balance!')
            return
        }

        setIsSubmitting(true)
        const dispersalAmount = parseFloat(amount)

        try {
            if (isOnline) {
                const res = await recordKharchi({
                    workerType,
                    workerId,
                    amount: dispersalAmount,
                    description,
                })
                if (res.error) throw new Error(res.error)
                toast.success(`₹${dispersalAmount} dispersed to ${tl(workerName)}`)
            } else {
                // Queue for offline sync
                await queueMutation('kharchi_offline', 'INSERT', {
                    worker_id: workerId,
                    amount: dispersalAmount,
                    description,
                    supervisor_id: userProfile?.id,
                    timestamp: getCurrentTimestampMs()
                })
                toast.success('Kharchi queued for sync')
            }
            
            setAmount('')
            setDescription('')
            onOpenChange(false)
            queryClient.invalidateQueries({ queryKey: ['supervisor_balance'] })
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to record Kharchi')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-saffron-deep">
                        <HandCoins className="h-5 w-5" />
                        Record Kharchi
                    </DialogTitle>
                    <DialogDescription>
                        Give a cash advance to {tl(workerName)}.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between rounded-lg border border-saffron-soft bg-saffron-soft/65 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-saffron-deep">
                            <Wallet className="h-4 w-4" />
                            Float balance
                        </div>
                        <div className="text-lg font-semibold text-saffron-deep">
                            {balanceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : formatINR(balance ?? 0)}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Amount (₹)</Label>
                        <Input
                            type="number"
                            placeholder="e.g. 500"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="h-12 text-xl font-semibold"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Reason (Optional)</Label>
                        <Input
                            placeholder="Medicine, Travel, etc."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {balance !== undefined && parseFloat(amount) > balance && (
                        <div className="flex items-center gap-2 rounded border border-risk-soft bg-risk-soft p-2 text-xs text-risk">
                            <AlertCircle className="h-4 w-4" />
                            Amount exceeds your available float.
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        className="font-semibold"
                        disabled={!amount || isSubmitting || (balance !== undefined && parseFloat(amount) > balance)}
                        onClick={handleDisperse}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <HandCoins className="h-4 w-4 mr-2" />}
                        Give Cash
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
