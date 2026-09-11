'use client'

import { useState } from 'react'
import { ArrowUpRight, Plus, Search, Users, Wrench } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { currentBaseMonthlySalary } from '@/lib/base-salary'
import { formatINR } from '@/lib/finance'
import type { BaseProductionMachine, BaseProductionWorker } from '@/lib/base-production-core'
import type { BaseProductionInitialData } from './loaders'

export default function BaseSetupWorkspace({ initialData, initialSection, focusWorkerId, onAddWorker, onAddMachine, onEditWorker, onEditMachine }: {
    initialData: BaseProductionInitialData
    initialSection: 'workers' | 'machines'
    focusWorkerId?: string
    onAddWorker: () => void
    onAddMachine: () => void
    onEditWorker: (worker: BaseProductionWorker) => void
    onEditMachine: (machine: BaseProductionMachine) => void
}) {
    const [section, setSection] = useState(initialSection)
    const [search, setSearch] = useState(() => initialData.workers.find(worker => worker.id === focusWorkerId)?.name ?? '')
    const [showInactive, setShowInactive] = useState(() => Boolean(focusWorkerId && initialData.workers.some(worker => worker.id === focusWorkerId && !worker.is_active)))
    const query = search.trim().toLocaleLowerCase()
    const workers = initialData.workers.filter(worker => (showInactive || worker.is_active) && `${worker.name} ${worker.role ?? ''}`.toLocaleLowerCase().includes(query))
    const machines = initialData.machines.filter(machine => (showInactive || machine.is_active) && `${machine.name} ${machine.custom_label ?? ''} ${machine.machine_type.replaceAll('_', ' ')}`.toLocaleLowerCase().includes(query))

    return (
        <Tabs value={section} onValueChange={value => { setSection(value as typeof section); setSearch('') }} className="gap-0 overflow-hidden rounded-xl border border-hairline bg-surface shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-4 sm:px-5">
                <TabsList className="h-10 bg-surface-soft">
                    <TabsTrigger value="workers" className="gap-2"><Users className="h-4 w-4" /> Workers <span className="text-xs tabular-nums text-muted-foreground">{initialData.workers.length}</span></TabsTrigger>
                    <TabsTrigger value="machines" className="gap-2"><Wrench className="h-4 w-4" /> Machines <span className="text-xs tabular-nums text-muted-foreground">{initialData.machines.length}</span></TabsTrigger>
                </TabsList>
                <Button size="sm" onClick={section === 'workers' ? onAddWorker : onAddMachine}><Plus className="h-4 w-4" /> {section === 'workers' ? 'Add worker' : 'Add machine'}</Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
                <div className="relative w-full sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input aria-label={`Search ${section}`} placeholder={`Search ${section}`} value={search} onChange={event => setSearch(event.target.value)} className="pl-9" />
                </div>
                <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs text-body"><input type="checkbox" className="h-4 w-4 accent-saffron" checked={showInactive} onChange={event => setShowInactive(event.target.checked)} /> Show inactive</label>
            </div>
            <TabsContent value="workers" className="mt-0">
                <div className="divide-y divide-hairline/70">
                    {workers.map(worker => (
                        <div key={worker.id} className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
                            <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{worker.name}{!worker.is_active && <Badge variant="secondary">Inactive</Badge>}</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{worker.pay_type === 'fixed_monthly'
                                    ? `${worker.role || 'Staff'} · Fixed salary · ${formatINR(currentBaseMonthlySalary(worker, initialData.today))}/month`
                                    : `Piece rate · ${worker.shift_availability === 'both' ? 'Day & night' : worker.shift_availability === 'day' ? 'Day shift' : 'Night shift'}`}</p>
                            </div>
                            <Button variant="ghost" size="sm" aria-label={`Edit ${worker.name}`} onClick={() => onEditWorker(worker)}>Edit</Button>
                        </div>
                    ))}
                </div>
                {workers.length === 0 && <SetupEmpty title={initialData.workers.length ? 'No workers match this view' : 'Add your first worker'} description={initialData.workers.length ? 'Try another name or show inactive workers.' : 'Keep piece-rate workers and salaried staff together in one place.'} />}
            </TabsContent>
            <TabsContent value="machines" className="mt-0">
                <div className="divide-y divide-hairline/70">
                    {machines.map(machine => (
                        <div key={machine.id} className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
                            <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{machine.custom_label || machine.name}{!machine.is_active && <Badge variant="secondary">Inactive</Badge>}</p>
                                <p className="mt-1 text-xs capitalize text-muted-foreground">{machine.machine_type.replaceAll('_', ' ')}{machine.custom_label ? ` · ${machine.name}` : ''}</p>
                            </div>
                            <Button variant="ghost" size="sm" aria-label={`Edit ${machine.custom_label || machine.name}`} onClick={() => onEditMachine(machine)}>Edit</Button>
                        </div>
                    ))}
                </div>
                {machines.length === 0 && <SetupEmpty title={initialData.machines.length ? 'No machines match this view' : 'Add your first machine'} description={initialData.machines.length ? 'Try another name or show inactive machines.' : 'Add a machine, then connect it to a worker in Configuration.'} />}
            </TabsContent>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline bg-surface-soft/35 px-4 py-3 text-xs text-muted-foreground sm:px-5">
                <span>{section === 'workers' ? workers.length : machines.length} {section} shown</span>
                <Link href="/owner/operations" className="inline-flex min-h-8 items-center gap-1 font-medium text-saffron-deep">Go to Configuration <ArrowUpRight className="h-3.5 w-3.5" /></Link>
            </div>
        </Tabs>
    )
}

function SetupEmpty({ title, description }: { title: string; description: string }) {
    return <div className="px-5 py-14 text-center"><p className="font-semibold text-ink">{title}</p><p className="mt-2 text-sm text-body">{description}</p></div>
}
