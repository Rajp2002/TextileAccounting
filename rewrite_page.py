import re

with open('app/(dashboard)/supervisor/production/page.tsx', 'r') as f:
    content = f.read()

# 1. Add imports
content = content.replace(
    "import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'",
    "import { verifyAccessCode } from '@/app/(dashboard)/supervisor/actions'\nimport { CalendarDays, KeyRound, Loader2, RotateCcw, Lock } from 'lucide-react'\nimport { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'\nimport { cn } from '@/lib/utils'"
)

# 2. Add state
# Replace
#     const [metersInput, setMetersInput] = useState<Record<string, number>>({})
#     // Allow overriding worker per machine
#     const [workerOverrides, setWorkerOverrides] = useState<Record<string, string>>({})
#
#     const [loading, setLoading] = useState(false)
#     const [today, setToday] = useState<string>('')
#     const [currentShift, setCurrentShift] = useState<'day' | 'night'>('day')
#
state_old = """    const [metersInput, setMetersInput] = useState<Record<string, number>>({})
    // Allow overriding worker per machine
    const [workerOverrides, setWorkerOverrides] = useState<Record<string, string>>({})

    const [loading, setLoading] = useState(false)
    const [today, setToday] = useState<string>('')
    const [currentShift, setCurrentShift] = useState<'day' | 'night'>('day')"""

state_new = """    const [metersInput, setMetersInput] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(false)
    const [selectedDate, setSelectedDate] = useState<string>('')
    const [currentShift, setCurrentShift] = useState<'day' | 'night'>('day')
    
    // Authorization State
    const [unlocked, setUnlocked] = useState(false)
    const [verificationOpen, setVerificationOpen] = useState(false)
    const [accessCode, setAccessCode] = useState('')
    const [verifying, setVerifying] = useState(false)"""

content = content.replace(state_old, state_new)

# 3. Replace useEffect for initialization
use_effect_old = """    useEffect(() => {
        const now = new Date()
        setToday(now.toISOString().split('T')[0])

        const hour = now.getHours()
        // 7 AM to 7 PM is Day shift
        if (hour >= 7 && hour < 19) {
            setCurrentShift('day')
        } else {
            setCurrentShift('night')
        }
    }, [])"""

use_effect_new = """    useEffect(() => {
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
    
    // Lock again if date changes
    useEffect(() => {
        setUnlocked(false)
        setMetersInput({})
    }, [selectedDate])"""

content = content.replace(use_effect_old, use_effect_new)

# 4. Add existingLogs fetch
auth_query_idx = content.find("const { data: userProfile }")
auth_query_old = "    const { data: userProfile } = useQuery({"
existing_logs_query = """    const { data: existingLogs, isLoading: logsLoading } = useQuery({
        queryKey: ['production_logs', userProfile?.org_id, selectedDate],
        enabled: !!userProfile?.org_id && !!selectedDate,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('production_logs')
                .select('*')
                .eq('org_id', userProfile!.org_id)
                .eq('date', selectedDate)
            if (error) throw error
            return data
        }
    })

"""
content = content[:auth_query_idx] + existing_logs_query + content[auth_query_idx:]

# 5. Modify machineCards memo
memo_old_start = "    const machineCards = useMemo(() => {"
memo_old_end = "    }, [machines, assignments, currentShift, workerOverrides, metersInput])"
memo_old = content[content.find(memo_old_start):content.find(memo_old_end) + len(memo_old_end)]

memo_new = """    const machineCards = useMemo(() => {
        if (!machines) return []
        return machines.map(machine => {
            // Find existing log for this machine to check if already saved
            const existingLog = existingLogs?.find(l => l.machine_id === machine.id)
            
            // If already saved, we use the shift and worker from the log (if available, though log only has worker_id)
            // But we can simplify: if saved, we show what's saved.
            const assignment = assignments?.find(a => a.machine_id === machine.id && a.shift === currentShift)
            const assignedWorkerId = assignment?.worker_id

            const effectiveWorkerId = existingLog ? existingLog.worker_id : assignedWorkerId
            const isSaved = !!existingLog

            return {
                machine,
                assignedWorkerId,
                effectiveWorkerId,
                meters: existingLog ? Number(existingLog.meters) : (metersInput[machine.id] || 0),
                isSaved,
                existingLogId: existingLog?.id
            }
        })
    }, [machines, assignments, currentShift, metersInput, existingLogs])"""

content = content.replace(memo_old, memo_new)

# 6. Remove handleWorkerOverride and update handleMetersChange to respect disable state
handlers_old_start = "    const handleMetersChange"
handlers_old_end = "    const handleSaveAll = async () => {"
handlers_old = content[content.find(handlers_old_start):content.find(handlers_old_end)]

handlers_new = """    const handleMetersChange = (machineId: string, value: number, isSaved: boolean) => {
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
            await verifyAccessCode(userProfile.org_id, accessCode)
            setUnlocked(true)
            setVerificationOpen(false)
            setAccessCode('')
            toast.success('Edit mode unlocked')
            
            // Copy existing log meters to metersInput state so they can be edited seamlessly
            const newMeters: Record<string, number> = {}
            if (existingLogs) {
                existingLogs.forEach(log => {
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

"""
content = content.replace(handlers_old, handlers_new)


# 7. Modify handleSaveAll to handle upserts
save_old_start = "    const handleSaveAll = async () => {"
save_old_end = "    return ("
save_old = content[content.find(save_old_start):content.find(save_old_end)]

save_new = """    const handleSaveAll = async () => {
        // Only save entries that have meters > 0 and are either NOT saved, OR are unlocked for editing.
        // Wait, if unlocked, user might have modified a saved entry.
        const entriesToSave = machineCards.filter(c => {
             if (c.isSaved && !unlocked) return false;
             
             // If unlocked, we only want to save if there's a user input value (which might be 0, overriding the old one?).
             // Actually if unlocked, user can submit whatever is in the input. Let's just save ones where c.meters is defined.
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
                // If it's already saved, and we are unlocked, we upsert based on the existingLogId
                // Otherwise we insert a new log
                const finalMeters = metersInput[item.machine.id] !== undefined ? metersInput[item.machine.id] : item.meters
                
                const productionData: any = {
                    machine_id: item.machine.id,
                    worker_id: item.effectiveWorkerId!,
                    meters: finalMeters,
                    date: selectedDate,
                    org_id: userProfile!.org_id,
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
            queryClient.invalidateQueries({ queryKey: ['production_logs', userProfile?.org_id, selectedDate] })
            queryClient.invalidateQueries({ queryKey: ['production_daily_total', 'production_worker_stats'] })
        } catch (error: any) {
            toast.error('Failed to save: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

"""
content = content.replace(save_old, save_new)


# 8. Modify the UI
ui_old_start = "        <div className=\"space-y-4 pb-24\">"
ui_old_end = "                                <div className=\"space-y-1\">"

ui_new = """        <div className=\"space-y-4 pb-24\">
            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5 text-indigo-600" />
                            <CardTitle>Log Production</CardTitle>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex rounded-lg border overflow-hidden mr-2">
                                <button
                                    onClick={() => setCurrentShift('day')}
                                    className={cn(
                                        'px-4 py-1.5 text-sm font-medium transition-colors',
                                        currentShift === 'day' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                                    )}
                                >
                                    Day Shift
                                </button>
                                <button
                                    onClick={() => setCurrentShift('night')}
                                    className={cn(
                                        'px-4 py-1.5 text-sm font-medium transition-colors border-l',
                                        currentShift === 'night' ? 'bg-indigo-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                                    )}
                                >
                                    Night Shift
                                </button>
                            </div>
                        
                            <Button variant="ghost" size="sm" onClick={setToday} className="h-8 px-2 text-xs">
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Today
                            </Button>
                            <Input
                                type="date"
                                value={selectedDate}
                                max={new Date().toISOString().split('T')[0]} // Prevent future dates
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="h-8 w-auto text-sm"
                            />
                        </div>
                    </div>
                </CardHeader>
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

            {(machinesLoading || logsLoading) && <div className="text-center py-8">Loading data...</div>}

            <div className="grid gap-3">
                {machineCards.map(({ machine, assignedWorkerId, effectiveWorkerId, meters, isSaved }) => {
                    const rate = machine.rate_per_meter || 0
                    
                    // Priority of meters: metersInput (if user editing) > existing meters > 0
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

                                <div className="space-y-1">"""
content = content.replace(content[content.find(ui_old_start):content.find(ui_old_end) + len("                                <div className=\"space-y-1\">")], ui_new)

# 9. Modify worker dropdown and inputs
dropdown_old_start = "                                    <Label className=\"text-xs text-gray-500\">Worker</Label>"
dropdown_old_end = "                                        </SelectContent>\n                                    </Select>\n                                </div>\n\n                                <div className=\"flex items-center gap-3 pt-1\">\n                                    <Button\n                                        type=\"button\"\n                                        variant=\"outline\"\n                                        size=\"sm\"\n                                        onClick={() => handleMetersChange(machine.id, Math.max(0, meters - 10))}\n                                    >\n                                        -10\n                                    </Button>\n                                    <Input\n                                        type=\"number\"\n                                        value={meters || ''}\n                                        onChange={(e) => handleMetersChange(machine.id, Number(e.target.value))}\n                                        placeholder=\"0\"\n                                        className=\"text-center text-lg font-bold w-24\"\n                                    />\n                                    <Button\n                                        type=\"button\"\n                                        variant=\"outline\"\n                                        size=\"sm\"\n                                        onClick={() => handleMetersChange(machine.id, meters + 10)}\n                                    >\n                                        +10\n                                    </Button>\n                                </div>\n                            </CardContent>\n                        </Card>\n                    )\n                })}\n            </div>\n\n            {/* Fixed Save All button */}"

dropdown_old = content[content.find(dropdown_old_start):content.find(dropdown_old_end) + len(dropdown_old_end)]

dropdown_new = """                                    <Label className="text-xs text-gray-500">Worker</Label>
                                    <div className="text-sm font-medium h-8 flex items-center">
                                        {worker ? worker.name : <span className="text-red-500 italic">No assigned worker for this shift</span>}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
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
                                        className="text-center text-lg font-bold w-24"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
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

            {/* Fixed Save All button */}"""
content = content.replace(dropdown_old, dropdown_new)

with open('app/(dashboard)/supervisor/production/page.tsx', 'w') as f:
    f.write(content)

