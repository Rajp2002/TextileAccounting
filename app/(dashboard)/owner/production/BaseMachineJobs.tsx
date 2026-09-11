'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { setBaseMachineJobContext } from './actions'
import type { BaseProductionInitialData } from './loaders'

/** Job context belongs to production; Configuration only assigns workers. */
export default function BaseMachineJobs({ initialData }: { initialData: BaseProductionInitialData }) {
    const router = useRouter()
    const [pendingMachineId, setPendingMachineId] = useState<string | null>(null)
    const jobs = initialData.jobs.filter(job => job.status === 'planned' || job.status === 'active')
    const jobIds = new Set(jobs.map(job => job.id))
    const contexts = new Map<string, string>()
    for (const context of initialData.machineJobContexts) {
        if (!context.active || context.effective_from > initialData.today
            || (context.effective_to && context.effective_to < initialData.today)
            || !jobIds.has(context.job_id) || contexts.has(context.machine_id)) continue
        contexts.set(context.machine_id, context.job_id)
    }
    const machines = initialData.machines.filter(machine => machine.is_active)

    async function changeJob(machineId: string, value: string) {
        if (pendingMachineId) return
        setPendingMachineId(machineId)
        try {
            const result = await setBaseMachineJobContext({ machineId, jobId: value === 'none' ? null : value, effectiveFrom: initialData.today })
            if ('error' in result) { toast.error(result.error); return }
            toast.success(value === 'none' ? 'Job context cleared.' : 'Machine job context saved.')
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Machine job context could not be saved.')
        } finally {
            setPendingMachineId(null)
        }
    }

    return (
        <Card id="machine-jobs" className="scroll-mt-6">
            <CardHeader>
                <CardTitle className="text-base">Machine jobs</CardTitle>
                <CardDescription>Choose the job each machine is running. Then connect its worker in <Link href="/owner/assignments" className="font-medium text-saffron-deep underline underline-offset-2">Machine Assignments</Link>.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {machines.length === 0 && <p className="text-sm text-body">Add your machines in <Link href="/owner/machines?register=base" className="font-medium text-saffron-deep underline underline-offset-2">Machines</Link> to link them to a job.</p>}
                {machines.map(machine => (
                    <div key={machine.id} className="flex flex-col justify-between gap-2 border-t border-hairline/70 pt-3 sm:flex-row sm:items-center">
                        <span className="text-sm font-medium text-ink">{machine.custom_label || machine.name}</span>
                        <div className="flex items-center gap-2 sm:w-80">
                            {pendingMachineId === machine.id && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                            <Select value={contexts.get(machine.id) ?? 'none'} onValueChange={value => void changeJob(machine.id, value)} disabled={pendingMachineId !== null}>
                                <SelectTrigger aria-label={`Production job for ${machine.custom_label || machine.name}`} className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No active job</SelectItem>
                                    {jobs.map(job => <SelectItem key={job.id} value={job.id}>{job.quality_label}{job.costing_version ? ` · v${job.costing_version}` : ''} · {new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(job.target_meters)} m target</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
