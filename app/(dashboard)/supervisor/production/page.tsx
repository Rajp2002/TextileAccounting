'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queueMutation } from '@/lib/db'
import { createClient } from '@/lib/supabase/client'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { calculateDailyPay, formatINR } from '@/lib/finance'
import { verifyAccessCode, startBeam, linkOrderToMachine } from '@/app/(dashboard)/supervisor/actions'
import { useUserProfile } from '@/hooks/use-user-profile'
import { CalendarDays, KeyRound, Loader2, RotateCcw, Lock, BoxSelect, Search, Link as LinkIcon, ClipboardList } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Order {
    id: string
    party_name: string
    quality_id: string
    quality_name: string
    status: string
}

interface Worker {
    id: number
    name: string
    is_active: boolean
}

interface Machine {
    id: string
    name: string
    rate_per_meter: number
    status: string
}

interface Assignment {
    machine_id: string
    worker_id: number
    shift: 'day' | 'night'
}

interface YarnBatch {
    id: string
    name: string
    quality_id: string
    quality: { name: string, target_yield: number }
    current_machine_id: string | null
    status: string
}

export default function ProductionEntryForm() {
    const [metersInput, setMetersInput] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(false)
    const [selectedDate, setSelectedDate] = useState<string>('')
    const [currentShift, setCurrentShift] = useState<'day' | 'night'>('day')

    // Authorization State
    const [unlocked, setUnlocked] = useState(false)
    const [verificationOpen, setVerificationOpen] = useState(false)
    const [accessCode, setAccessCode] = useState('')
    const [verifying, setVerifying] = useState(false)

    // Start Beam State
    const [beamModalOpen, setBeamModalOpen] = useState(false)
    const [linkingMachineId, setLinkingMachineId] = useState<string | null>(null)
    const [linkingBatchId, setLinkingBatchId] = useState<string>('')
    const [linkingBeam, setLinkingBeam] = useState(false)

    // Order Linking State
    const [orderModalOpen, setOrderModalOpen] = useState(false)
    const [linkingOrderMachineId, setLinkingOrderMachineId] = useState<string | null>(null)
    const [selectedOrderId, setSelectedOrderId] = useState<string>('')
    const [linkingOrder, setLinkingOrder] = useState(false)


    const isOnline = useOnlineStatus()
    const supabase = createClient()
    const queryClient = useQueryClient()

    // Initialize date and shift
    useEffect(() => {
        const now = new Date()
        setSelectedDate(now.toISOString().split('T')[0])

        const hour = now.getHours()
        // 7 AM to 7 PM is Day shift
        if (hour >= 7 && hour < 19) {
            setCurrentShift('day')
        } else {
            setCurrentShift('night')
        }
    }, [])

    const { data: userProfile } = useUserProfile()

    // Lock again if date changes or session changes
    useEffect(() => {
        setUnlocked(false)
        setMetersInput({})
    }, [selectedDate, userProfile?.org_id]) // Also clear if org_id changes (session switch)

    const { data: existingLogs, isLoading: logsLoading } = useQuery({
        queryKey: ['production_logs', userProfile?.org_id, selectedDate, currentShift],
        enabled: !!userProfile?.org_id && !!selectedDate,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('production_logs')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .eq('date', selectedDate)
                .eq('shift', currentShift)
            if (error) throw error
            return data
        }
    })

    const { data: machines, isLoading: machinesLoading } = useQuery({
        queryKey: ['machines', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('machines')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .order('name')
            if (error) throw error
            return data as Machine[]
        }
    })

    const { data: workers } = useQuery({
        queryKey: ['active_workers', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('workers')
                .select('id, name, is_active')
                .eq('org_id', userProfile!.org_id)
                .eq('is_active', true)
                .order('name')
            if (error) throw error
            return data as Worker[]
        }
    })

    const { data: assignments } = useQuery({
        queryKey: ['machine_assignments', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('machine_assignments')
                .select('*')
                .eq('org_id', userProfile!.org_id)
            if (error) throw error
            return data as Assignment[]
        }
    })

    const { data: activeBatches, isLoading: batchesLoading } = useQuery({
        queryKey: ['active_yarn_batches', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('yarn_batches')
                .select('id, name, current_machine_id, status, quality_id, qualities(name, target_yield)')
                .eq('org_id', userProfile!.org_id)
                .eq('status', 'active')
            if (error) throw error
            return data.map((b: any) => ({
                ...b,
                quality: b.qualities
            })) as YarnBatch[]
        }
    })

    const { data: activeOrders, isLoading: ordersLoading } = useQuery({
        queryKey: ['active_orders', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select('id, party_name, quality_id, qualities(name), status')
                .eq('org_id', userProfile!.org_id)
                .eq('status', 'active')
            if (error) throw error
            return data.map((o: any) => ({
                id: o.id,
                party_name: o.party_name,
                quality_id: o.quality_id,
                quality_name: o.qualities?.name,
                status: o.status
            })) as Order[]
        }
    })

    const machineCards = useMemo(() => {
        if (!machines) return []
        return machines.map(machine => {
            // Filter by both machine_id AND shift so day/night logs are independent
            const existingLog = existingLogs?.find(
                (l: any) => l.machine_id === machine.id && l.shift === currentShift
            )
            const assignment = assignments?.find(a => a.machine_id === machine.id && a.shift === currentShift)
            const assignedWorkerId = assignment?.worker_id
            const effectiveWorkerId = existingLog ? existingLog.worker_id : assignedWorkerId
            const isSaved = !!existingLog
            
            const activeBatch = activeBatches?.find(b => b.current_machine_id === machine.id)
            const activeOrder = activeOrders?.find(o => o.id === (machine as any).current_order_id)

            return {
                machine,
                assignedWorkerId,
                effectiveWorkerId,
                meters: existingLog ? Number(existingLog.meters) : (metersInput[machine.id] || 0),
                isSaved,
                existingLogId: existingLog?.id,
                activeBatch,
                activeOrder
            }
        })
    }, [machines, assignments, activeBatches, activeOrders, currentShift, metersInput, existingLogs])


    const handleMetersChange = (machineId: string, value: number, isSaved: boolean) => {
        if (isSaved && !unlocked) return // Cannot change if saved and not unlocked
        setMetersInput(prev => ({ ...prev, [machineId]: value }))
    }

    const setToday = () => {
        setSelectedDate(new Date().toISOString().split('T')[0])
    }

    const handleUnlockSubmit = async () => {
        setVerifying(true)
        try {
            if (!userProfile?.org_id) throw new Error("Missing org_id")
            const result = await verifyAccessCode(userProfile.org_id, accessCode)
            if (result.error) throw new Error(result.error)

            setUnlocked(true)
            setVerificationOpen(false)
            setAccessCode('')
            toast.success('Edit mode unlocked')

            // Copy existing log meters to metersInput state so they can be edited seamlessly
            const newMeters: Record<string, number> = {}
            if (existingLogs) {
                existingLogs.forEach((log: any) => {
                    newMeters[log.machine_id] = Number(log.meters)
                })
            }
            setMetersInput(newMeters)

        } catch (error: any) {
            toast.error(error.message || 'Invalid access code')
        } finally {
            setVerifying(false)
        }
    }

    const handleSaveAll = async () => {
        // Only save entries that have meters > 0 and are either NOT saved, OR are unlocked for editing.
        const entriesToSave = machineCards.filter(c => {
            if (c.isSaved && !unlocked) return false;
            return (metersInput[c.machine.id] !== undefined) || (!c.isSaved && c.meters > 0)
        })

        if (entriesToSave.length === 0) {
            toast.warning('No new or edited meters entered.')
            return
        }

        const missingWorker = entriesToSave.find(c => !c.effectiveWorkerId)
        if (missingWorker) {
            toast.error(`Please assign a worker for ${missingWorker.machine.name} in assignments first.`)
            return
        }

        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            for (const item of entriesToSave) {
                const finalMeters = metersInput[item.machine.id] !== undefined ? metersInput[item.machine.id] : item.meters

                const productionData: any = {
                    machine_id: item.machine.id,
                    worker_id: item.effectiveWorkerId!,
                    meters: finalMeters,
                    date: selectedDate,
                    shift: currentShift,
                    org_id: userProfile!.org_id,
                    yarn_batch_id: item.activeBatch?.id || null, // Auto-fill active batch
                    order_id: item.activeOrder?.id || null, // Auto-fill active order
                }

                if (item.existingLogId) {
                    productionData.id = item.existingLogId // for upsert
                    productionData.updated_by = user.id
                } else {
                    productionData.created_by = user.id
                }

                if (isOnline) {
                    const { error } = await supabase.from('production_logs').upsert(productionData, { onConflict: 'id' })
                    if (error) throw error
                } else {
                    if (item.existingLogId) {
                        await queueMutation('production_logs', 'UPDATE', productionData)
                    } else {
                        await queueMutation('production_logs', 'INSERT', productionData)
                    }
                }
            }

            toast.success(
                isOnline
                    ? `${entriesToSave.length} entries saved!`
                    : `${entriesToSave.length} entries queued (offline).`
            )

            setMetersInput({})
            setUnlocked(false)
            queryClient.invalidateQueries({ queryKey: ['production_logs', userProfile?.org_id, selectedDate, currentShift] })
            queryClient.invalidateQueries({ queryKey: ['production_daily_total', 'production_worker_stats'] })
        } catch (error: any) {
            toast.error('Failed to save: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleStartBeam = async () => {
        if (!linkingMachineId || !linkingBatchId) return
        setLinkingBeam(true)
        try {
            const res = await startBeam(linkingBatchId, linkingMachineId)
            if (res.error) throw new Error(res.error)
            toast.success("Beam successfully linked to machine!")
            setBeamModalOpen(false)
            setLinkingMachineId(null)
            setLinkingBatchId('')
            queryClient.invalidateQueries({ queryKey: ['active_yarn_batches', userProfile?.org_id] })
        } catch (err: any) {
            toast.error(err.message || "Failed to start beam.")
        } finally {
            setLinkingBeam(false)
        }
    }

    const handleLinkOrder = async () => {
        if (!linkingOrderMachineId || !selectedOrderId) return
        
        // Quality Guardrail Check
        const machine = machineCards.find(c => c.machine.id === linkingOrderMachineId)
        const order = activeOrders?.find(o => o.id === selectedOrderId)
        
        if (machine?.activeBatch && order && machine.activeBatch.quality_id !== order.quality_id) {
            toast.warning(
                `Quality Mismatch! Order is "${order.quality_name}" but Machine has "${machine.activeBatch.quality?.name}" beam.`,
                { 
                    duration: 6000,
                    description: "Physical yarn on machine doesn't match order requirements."
                }
            )
        }

        setLinkingOrder(true)
        try {
            const res = await linkOrderToMachine(selectedOrderId, linkingOrderMachineId)
            if (res.error) throw new Error(res.error)
            toast.success("Order linked to machine!")
            setOrderModalOpen(false)
            setLinkingOrderMachineId(null)
            setSelectedOrderId('')
            queryClient.invalidateQueries({ queryKey: ['machines', userProfile?.org_id] })
        } catch (err: any) {
            toast.error(err.message || "Failed to link order.")
        } finally {
            setLinkingOrder(false)
        }
    }

    return (
        <div className="space-y-6 pb-28">
            <Card className="shadow-sm">
                <CardHeader className="p-4 sm:p-6 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-teal-600" />
                            <CardTitle className="text-xl">Log Production</CardTitle>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={setToday} className="h-10 px-3 text-sm flex-1 sm:flex-none">
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Today
                            </Button>
                            <Input
                                type="date"
                                value={selectedDate}
                                max={new Date().toISOString().split('T')[0]} // Prevent future dates
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="h-10 w-[140px] text-sm"
                            />
                        </div>
                    </div>
                </CardHeader>

                {/* Full-width Shift Toggle inside card content */}
                <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="flex rounded-xl bg-gray-100 p-1 w-full mt-2">
                        <button
                            onClick={() => setCurrentShift('day')}
                            className={cn(
                                'flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 shadow-sm',
                                currentShift === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 shadow-none'
                            )}
                        >
                            Day Shift
                        </button>
                        <button
                            onClick={() => setCurrentShift('night')}
                            className={cn(
                                'flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 shadow-sm',
                                currentShift === 'night' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 shadow-none'
                            )}
                        >
                            Night Shift
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Show unlock banner if there are saved entries and not unlocked */}
            {machineCards.some(c => c.isSaved) && !unlocked && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-800 text-sm">
                        <Lock className="h-4 w-4" />
                        <span>Some entries are already saved and locked.</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setVerificationOpen(true)} className="h-8 text-xs border-amber-300 text-amber-800 hover:bg-amber-100">
                        Unlock to Edit
                    </Button>
                </div>
            )}

            {(machinesLoading || logsLoading) ? (
                <div className="text-center py-12 flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-4" />
                    <p className="text-gray-500 font-medium">Loading factory data...</p>
                </div>
            ) : machineCards.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed rounded-xl border-gray-200 bg-white">
                    <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BoxSelect className="h-8 w-8" />
                    </div>
                    <p className="text-gray-900 font-semibold text-lg">No machines found</p>
                    <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">Please add machines in the owner view before logging production.</p>
                </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {machineCards.map(({ machine, assignedWorkerId, effectiveWorkerId, meters, isSaved, activeBatch, activeOrder }) => {
                    const rate = machine.rate_per_meter || 0
                    const displayMeters = metersInput[machine.id] !== undefined ? metersInput[machine.id] : meters
                    const pay = displayMeters > 0 ? calculateDailyPay(displayMeters, rate) : null
                    const worker = workers?.find(w => w.id === effectiveWorkerId)
                    const disabled = isSaved && !unlocked

                    return (
                        <Card key={machine.id} className={cn("shadow-sm transition-opacity", disabled ? "opacity-60 bg-gray-50" : "")}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-semibold text-lg">{machine.name}</div>
                                        <div className="text-xs text-gray-500">Rate: ₹{rate}/m</div>
                                    </div>
                                    {pay && (
                                        <span className={cn("text-sm font-bold px-2 py-1 rounded", disabled ? "bg-gray-200 text-gray-600" : "text-green-700 bg-green-50")}>
                                            Est: {formatINR(pay)}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-500">Worker</Label>
                                    <div className="text-sm font-medium h-8 flex items-center">
                                        {worker ? worker.name : <span className="text-red-500 italic">No assigned worker</span>}
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2 mt-1 border-t pt-2">
                                     <div className="space-y-1">
                                         <Label className="text-xs text-gray-500">Active Beam</Label>
                                         <div className="text-sm font-medium h-10 flex items-center">
                                            {activeBatch ? (
                                                <span className="text-indigo-700 bg-indigo-50 px-2 py-1 rounded text-xs font-semibold truncate w-full" title={`${activeBatch.name} (${activeBatch.quality?.name})`}>
                                                    {activeBatch.name} 
                                                    <span className="font-normal text-indigo-500 ml-1">
                                                        ({activeBatch.quality?.name})
                                                    </span>
                                                </span>
                                            ) : (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 w-full text-[10px] border-dashed text-gray-500 px-1"
                                                    onClick={() => {
                                                        setLinkingMachineId(machine.id)
                                                        setLinkingBatchId('')
                                                        setBeamModalOpen(true)
                                                    }}
                                                    disabled={disabled}
                                                >
                                                    <LinkIcon className="h-3 w-3 mr-1" />
                                                    Start Beam
                                                </Button>
                                            )}
                                         </div>
                                     </div>

                                     <div className="space-y-1">
                                         <Label className="text-xs text-gray-500">Active Order</Label>
                                         <div className="text-sm font-medium h-10 flex items-center">
                                            {activeOrder ? (
                                                <span className="text-teal-700 bg-teal-50 px-2 py-1 rounded text-xs font-semibold truncate w-full" title={activeOrder.party_name}>
                                                    {activeOrder.party_name}
                                                    <span className="font-normal text-teal-500 ml-1">
                                                        ({activeOrder.quality_name})
                                                    </span>
                                                </span>
                                            ) : (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 w-full text-[10px] border-dashed text-gray-500 px-1"
                                                    onClick={() => {
                                                        setLinkingOrderMachineId(machine.id)
                                                        setSelectedOrderId('')
                                                        setOrderModalOpen(true)
                                                    }}
                                                    disabled={disabled}
                                                >
                                                    <ClipboardList className="h-3 w-3 mr-1" />
                                                    Link Order
                                                </Button>
                                            )}
                                         </div>
                                     </div>
                                </div>

                                <div className="flex items-center gap-3 pt-3 border-t">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="lg"
                                        className="h-12 w-16 bg-gray-50 hover:bg-gray-100 text-gray-700 text-lg border-gray-200"
                                        disabled={disabled}
                                        onClick={() => handleMetersChange(machine.id, Math.max(0, displayMeters - 10), isSaved)}
                                    >
                                        -10
                                    </Button>
                                    <Input
                                        type="number"
                                        value={displayMeters || ''}
                                        disabled={disabled}
                                        onChange={(e) => handleMetersChange(machine.id, Number(e.target.value), isSaved)}
                                        placeholder="0"
                                        className="text-center text-xl font-bold h-12 w-full flex-1 border-gray-300 focus:border-teal-500 focus:ring-teal-500 transition-all"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="lg"
                                        className="h-12 w-16 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100 text-lg"
                                        disabled={disabled}
                                        onClick={() => handleMetersChange(machine.id, displayMeters + 10, isSaved)}
                                    >
                                        +10
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Access Code Modal */}
            <Dialog open={verificationOpen} onOpenChange={setVerificationOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <KeyRound className="h-5 w-5" /> Owner Authorization Required
                        </DialogTitle>
                        <DialogDescription>
                            Editing past or saved production entries requires a single-use access code from the factory owner.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Access Code</Label>
                            <Input
                                placeholder="Enter 6-character code"
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                                className="font-mono uppercase tracking-widest text-lg"
                                maxLength={6}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setVerificationOpen(false)}>Cancel</Button>
                        <Button
                            disabled={accessCode.length < 6 || verifying}
                            onClick={handleUnlockSubmit}
                        >
                            {verifying ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            Verify & Unlock
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Start Beam Modal */}
            <Dialog open={beamModalOpen} onOpenChange={setBeamModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-indigo-700">
                            <LinkIcon className="h-5 w-5" /> Start New Beam
                        </DialogTitle>
                        <DialogDescription>
                            Link an active yarn batch to this machine. Future logs will automatically credit this batch.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Select Batch</Label>
                            {activeBatches && activeBatches.length > 0 ? (
                                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2">
                                    {activeBatches
                                        .filter(b => b.current_machine_id !== linkingMachineId)
                                        .map(batch => (
                                        <button
                                            key={batch.id}
                                            onClick={() => setLinkingBatchId(batch.id)}
                                            className={cn(
                                                "flex flex-col text-left p-3 rounded-lg border transition-all",
                                                linkingBatchId === batch.id 
                                                    ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600" 
                                                    : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                                            )}
                                        >
                                            <span className="font-medium text-gray-900">{batch.name}</span>
                                            <span className="text-xs text-gray-500">{batch.quality?.name}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500 p-4 border rounded bg-gray-50 text-center">
                                    No active yarn batches available. Ask the owner to add inventory.
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setBeamModalOpen(false); setLinkingBatchId('') }}>Cancel</Button>
                        <Button
                            disabled={!linkingBatchId || linkingBeam}
                            className="bg-indigo-600 hover:bg-indigo-700"
                            onClick={handleStartBeam}
                        >
                            {linkingBeam ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            Link & Start
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Link Order Modal */}
            <Dialog open={orderModalOpen} onOpenChange={setOrderModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-teal-700">
                            <ClipboardList className="h-5 w-5" /> Assign Order to Machine
                        </DialogTitle>
                        <DialogDescription>
                            Select the active order for this machine. Every meter logged will be tracked against this order.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Select Order</Label>
                            {activeOrders && activeOrders.length > 0 ? (
                                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2">
                                    {activeOrders.map(order => (
                                        <button
                                            key={order.id}
                                            onClick={() => setSelectedOrderId(order.id)}
                                            className={cn(
                                                "flex flex-col text-left p-3 rounded-lg border transition-all",
                                                selectedOrderId === order.id 
                                                    ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600" 
                                                    : "border-gray-200 hover:border-teal-300 hover:bg-gray-50"
                                            )}
                                        >
                                            <span className="font-medium text-gray-900">{order.party_name}</span>
                                            <span className="text-xs text-gray-500">{order.quality_name}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500 p-4 border rounded bg-gray-50 text-center">
                                    No active orders found. Ask the owner to add orders.
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setOrderModalOpen(false); setSelectedOrderId('') }}>Cancel</Button>
                        <Button
                            disabled={!selectedOrderId || linkingOrder}
                            className="bg-teal-600 hover:bg-teal-700 text-white"
                            onClick={handleLinkOrder}
                        >
                            {linkingOrder ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            Assign Order
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Fixed Save All button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] flex justify-center z-40 pb-[env(safe-area-inset-bottom,16px)] md:pb-6">
                <div className="w-full max-w-5xl md:flex md:justify-end md:px-0">
                    <Button
                        onClick={handleSaveAll}
                        disabled={loading || machineCards.length === 0}
                        className="w-full md:w-[240px] h-[52px] text-lg font-bold shadow-md bg-teal-600 hover:bg-teal-700 text-white rounded-xl mb-14 md:mb-0 transition-all"
                    >
                        {loading ? 'Saving...' : 'Save All Entries'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
