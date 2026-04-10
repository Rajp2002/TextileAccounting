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
import { 
    verifyAccessCode, 
    linkOrderToMachine, 
    shiftHandover 
} from '@/app/(dashboard)/supervisor/actions'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useTranslation } from '@/lib/i18n/context'
import { useTransliterate } from '@/hooks/use-transliterate'
import { 
    CalendarDays, 
    KeyRound, 
    Loader2, 
    RotateCcw, 
    Lock, 
    ClipboardList, 
    UserMinus, 
    AlertCircle, 
    CheckCircle2, 
    Settings2 
} from 'lucide-react'
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
    status: string
}

interface Assignment {
    machine_id: string
    worker_id: number
    shift: 'day' | 'night'
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

    // Order Linking State
    const [orderModalOpen, setOrderModalOpen] = useState(false)
    const [linkingOrderMachineId, setLinkingOrderMachineId] = useState<string | null>(null)
    const [selectedOrderId, setSelectedOrderId] = useState<string>('')
    const [linkingOrder, setLinkingOrder] = useState(false)
    // Handover State
    const [handoverOpen, setHandoverOpen] = useState(false)
    const [handoverMachineId, setHandoverMachineId] = useState<string | null>(null)
    const [performingHandover, setPerformingHandover] = useState(false)

    const isOnline = useOnlineStatus()
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { t } = useTranslation()
    const tl = useTransliterate()

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

    // Listen for new orders created by the owner so the assignment dropdown updates instantly
    useEffect(() => {
        if (!userProfile?.org_id) return

        const ordersChannel = supabase.channel('supervisor_orders_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `org_id=eq.${userProfile.org_id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['active_orders'] })
                }
            )
            .subscribe()


        // Listen for machine changes (e.g. owner renames or deactivates a machine)
        const machinesChannel = supabase.channel('supervisor_machines_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'machines',
                    filter: `org_id=eq.${userProfile.org_id}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['machines', userProfile.org_id] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(ordersChannel)
            supabase.removeChannel(machinesChannel)
        }
    }, [supabase, queryClient, userProfile?.org_id])

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


    const { data: activeOrders, isLoading: ordersLoading } = useQuery({
        queryKey: ['active_orders', userProfile?.org_id],
        enabled: !!userProfile?.org_id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select('id, party_name, quality_id, qualities(name), status')
                .eq('org_id', userProfile!.org_id)
                .eq('status', 'active')
                .order('party_name', { ascending: true })
            if (error) throw error
            return data.map((o: any) => {
                const quality = Array.isArray(o.qualities) ? o.qualities[0] : o.qualities
                return {
                    id: o.id,
                    party_name: o.party_name,
                    quality_id: o.quality_id,
                    quality_name: quality?.name || 'Unknown Quality',
                    status: o.status
                }
            }) as Order[]
        }
    })

    const machineCards = useMemo(() => {
        if (!machines) return []
        return machines
            .filter(machine => {
                // Show if active OR if it has a log for this specific view (date/shift)
                const isMachineActive = machine.status === 'active'
                const hasExistingLog = existingLogs?.some(
                    (l: any) => l.machine_id === machine.id && l.shift === currentShift
                )
                return isMachineActive || hasExistingLog
            })
            .map(machine => {
                const existingLog = existingLogs?.find(
                    (l: any) => l.machine_id === machine.id && l.shift === currentShift
                )
                const assignment = assignments?.find(a => a.machine_id === machine.id && a.shift === currentShift)
                const assignedWorkerId = assignment?.worker_id
                const effectiveWorkerId = existingLog ? existingLog.worker_id : assignedWorkerId
                const isSaved = !!existingLog
                
                const activeOrder = activeOrders?.find(o => o.id === (machine as any).current_order_id)

                const isReadyToRun = !!effectiveWorkerId && !!activeOrder

                return {
                    machine,
                    assignedWorkerId,
                    effectiveWorkerId,
                    meters: existingLog ? Number(existingLog.meters) : (metersInput[machine.id] || 0),
                    isSaved,
                    existingLogId: existingLog?.id,
                    activeOrder,
                    isReadyToRun
                }
            })
    }, [machines, assignments, activeOrders, currentShift, metersInput, existingLogs])


    const handleMetersChange = (machineId: string, value: number, isSaved: boolean) => {
        if (isSaved && !unlocked) return 
        setMetersInput(prev => ({ ...prev, [machineId]: value }))
    }

    const setToday = () => {
        setSelectedDate(new Date().toISOString().split('T')[0])
    }

    const handleUnlockSubmit = async () => {
        setVerifying(true)
        try {
            if (!userProfile?.org_id) throw new Error("Missing org_id")
            const result = await verifyAccessCode(accessCode)
            if (result.error) throw new Error(result.error)

            setUnlocked(true)
            setVerificationOpen(false)
            setAccessCode('')
            toast.success(t('production.edit_unlocked'))

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
        const entriesToSave = machineCards.filter(c => {
            if (c.isSaved && !unlocked) return false;
            return (metersInput[c.machine.id] !== undefined) || (!c.isSaved && c.meters > 0)
        })

        if (entriesToSave.length === 0) {
            toast.warning(t('production.no_entries'))
            return
        }

        const missingWorker = entriesToSave.find(c => !c.effectiveWorkerId)
        if (missingWorker) {
            toast.error(t('production.assign_worker_for'))
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
                    order_id: item.activeOrder?.id || null, 
                    worker_rate_snapshot: 0,
                }

                if (item.existingLogId) {
                    productionData.id = item.existingLogId 
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
                    ? `${entriesToSave.length} ${t('production.entries_saved')}`
                    : `${entriesToSave.length} ${t('production.entries_queued')}`
            )

            setMetersInput({})
            setUnlocked(false)
            queryClient.invalidateQueries({ queryKey: ['production_logs', userProfile?.org_id, selectedDate, currentShift] })
            queryClient.invalidateQueries({ queryKey: ['production_daily_total', 'production_worker_stats'] })
        } catch (error: any) {
            toast.error(t('production.save_failed') + ': ' + error.message)
        } finally {
            setLoading(false)
        }
    }


    const handleLinkOrder = async () => {
        if (!linkingOrderMachineId || !selectedOrderId) return
        if (!isOnline) {
            toast.error(t('production.offline_order'))
            return
        }
        
        const machine = machineCards.find(c => c.machine.id === linkingOrderMachineId)
        const order = activeOrders?.find(o => o.id === selectedOrderId)

        setLinkingOrder(true)
        try {
            const res = await linkOrderToMachine(selectedOrderId, linkingOrderMachineId)
            if (res.error) throw new Error(res.error)
            toast.success(t('production.order_linked_toast'))
            setOrderModalOpen(false)
            setLinkingOrderMachineId(null)
            setSelectedOrderId('')
            queryClient.invalidateQueries({ queryKey: ['machines', userProfile?.org_id] })
        } catch (err: any) {
            toast.error(err.message || t('production.order_link_failed'))
        } finally {
            setLinkingOrder(false)
        }
    }
    const handleShiftHandover = async () => {
        if (!handoverMachineId || !userProfile?.org_id) return
        setPerformingHandover(true)
        try {
            const res = await shiftHandover(handoverMachineId, currentShift)
            if (res.error) throw new Error(res.error)
            toast.success(t('production.handover_complete'))
            setHandoverOpen(false)
            setHandoverMachineId(null)
            queryClient.invalidateQueries({ queryKey: ['machine_assignments'] })
        } catch (err: any) {
            toast.error(err.message || t('production.handover_failed'))
        } finally {
            setPerformingHandover(false)
        }
    }

    return (
        <div className="space-y-6 pb-28">
            <Card className="shadow-sm">
                <CardHeader className="p-4 sm:p-6 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-teal-600" />
                            <CardTitle className="text-xl">{t('production.log_production')}</CardTitle>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={setToday} className="h-10 px-3 text-sm flex-1 sm:flex-none">
                                <RotateCcw className="h-4 w-4 mr-2" />
                                {t('production.today')}
                            </Button>
                            <Input
                                type="date"
                                value={selectedDate}
                                max={new Date().toISOString().split('T')[0]} 
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="h-10 w-[140px] text-sm"
                            />

                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="flex rounded-xl bg-gray-100 p-1 w-full mt-2">
                        <button
                            onClick={() => setCurrentShift('day')}
                            className={cn(
                                'flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 shadow-sm',
                                currentShift === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 shadow-none'
                            )}
                        >
                            {t('production.day_shift')}
                        </button>
                        <button
                            onClick={() => setCurrentShift('night')}
                            className={cn(
                                'flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 shadow-sm',
                                currentShift === 'night' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 shadow-none'
                            )}
                        >
                            {t('production.night_shift')}
                        </button>
                    </div>
                </CardContent>
            </Card>

            {machineCards.some(c => c.isSaved) && !unlocked && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-800 text-sm">
                        <Lock className="h-4 w-4" />
                        <span>{t('production.locked_entries')}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setVerificationOpen(true)} className="h-8 text-xs border-amber-300 text-amber-800 hover:bg-amber-100">
                        {t('production.unlock_edit')}
                    </Button>
                </div>
            )}

            {(machinesLoading || logsLoading) ? (
                <div className="text-center py-12 flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-4" />
                    <p className="text-gray-500 font-medium">{t('production.loading')}</p>
                </div>
            ) : machineCards.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed rounded-xl border-gray-200 bg-white">
                    <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ClipboardList className="h-8 w-8" />
                    </div>
                    <p className="text-gray-900 font-semibold text-lg">{t('production.no_machines')}</p>
                    <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">{t('production.no_machines_desc')}</p>
                </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {machineCards.map(({ machine, assignedWorkerId, effectiveWorkerId, meters, isSaved, activeOrder, isReadyToRun }) => {
                    const displayMeters = metersInput[machine.id] !== undefined ? metersInput[machine.id] : meters
                    const worker = workers?.find(w => w.id === effectiveWorkerId)
                    const disabled = isSaved && !unlocked

                    return (
                        <Card key={machine.id} className={cn("shadow-sm transition-opacity", disabled ? "opacity-60 bg-gray-50" : "")}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-semibold text-lg">{machine.name}</div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-500">{t('production.worker')}</Label>
                                    <div className="flex items-center justify-between h-8">
                                        <div className="text-sm font-medium">
                                            {worker ? tl(worker.name) : <span className="text-red-500 italic">{t('production.no_worker')}</span>}
                                        </div>
                                        {worker && !disabled && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-[10px] text-orange-600 hover:text-orange-700 hover:bg-orange-50 bg-orange-50/50 border border-orange-100/50"
                                                onClick={() => {
                                                    setHandoverMachineId(machine.id)
                                                    setHandoverOpen(true)
                                                }}
                                            >
                                                <UserMinus className="h-3 w-3 mr-1" />
                                                {t('production.shift_change')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="mt-1 border-t pt-2">
                                     <div className="space-y-1">
                                          <Label className="text-xs text-gray-500">{t('production.active_order')}</Label>
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
                                                    {t('production.link_order')}
                                                </Button>
                                             )}
                                          </div>
                                     </div>
                                </div>

                                {!isReadyToRun ? (
                                    <div className="pt-3 border-t">
                                        <div className="bg-gray-50 rounded-lg p-3 border border-dashed border-gray-200">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Settings2 className="h-4 w-4 text-gray-400" />
                                                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('production.setup_required')}</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-gray-600">{t('production.worker_assigned')}</span>
                                                    {effectiveWorkerId ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                                                </div>

                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-gray-600">{t('production.order_linked')}</span>
                                                    {activeOrder ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-3 text-center italic">
                                                {t('production.complete_setup')}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
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
                                )}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            <Dialog open={verificationOpen} onOpenChange={setVerificationOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <KeyRound className="h-5 w-5" /> {t('auth.owner_auth_req')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('auth.unlock_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>{t('auth.access_code')}</Label>
                            <Input
                                placeholder={t('production.enter_code')}
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                                className="font-mono uppercase tracking-widest text-lg"
                                maxLength={6}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setVerificationOpen(false)}>{t('common.cancel')}</Button>
                        <Button
                            disabled={accessCode.length < 6 || verifying}
                            onClick={handleUnlockSubmit}
                        >
                            {verifying ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            {t('auth.verify_unlock')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            <Dialog open={orderModalOpen} onOpenChange={setOrderModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-teal-700">
                            <ClipboardList className="h-5 w-5" /> {t('modals.assign_order')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('modals.link_order_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>{t('modals.select_order')}</Label>
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
                                <div className="text-sm text-gray-500 p-6 border-2 border-dashed rounded-xl bg-gray-50/50 text-center space-y-2">
                                    <p className="font-bold text-gray-900">{t('modals.no_active_orders')}</p>
                                    <p className="text-xs text-gray-400">Ask the owner to create or activate an order in the Analytics dashboard.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setOrderModalOpen(false); setSelectedOrderId('') }}>{t('common.cancel')}</Button>
                        <Button
                            disabled={!selectedOrderId || linkingOrder}
                            className="bg-teal-600 hover:bg-teal-700 text-white"
                            onClick={handleLinkOrder}
                        >
                            {linkingOrder ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            {t('modals.link')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] flex justify-center z-40 pb-[env(safe-area-inset-bottom,16px)] md:pb-6">
                <div className="w-full max-w-5xl md:flex md:justify-end md:px-0">
                    <Button
                        onClick={handleSaveAll}
                        disabled={loading || machineCards.length === 0}
                        className="w-full md:w-[240px] h-[52px] text-lg font-bold shadow-md bg-teal-600 hover:bg-teal-700 text-white rounded-xl mb-14 md:mb-0 transition-all"
                    >
                        {loading ? t('production.saving') : t('production.save_all')}
                    </Button>
                </div>
            </div>
        </div>
    )
}
