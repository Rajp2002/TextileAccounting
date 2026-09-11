'use client'
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import WorkersRegister from './registers/WorkersRegister'
import MachinesRegister from './registers/MachinesRegister'
import type { BaseProductionInitialData } from './loaders'
/** Rollback composition only: canonical routes never mount this combined adapter. */
export default function BaseSetupWorkspace({ initialData, initialSection = 'workers' }: { initialData: BaseProductionInitialData; initialSection?: 'workers' | 'machines' }) {
 const [section, setSection] = useState(initialSection)
 return <Tabs value={section} onValueChange={value => setSection(value as typeof section)}><TabsList><TabsTrigger value="workers">Workers</TabsTrigger><TabsTrigger value="machines">Machines</TabsTrigger></TabsList><TabsContent value="workers"><WorkersRegister workers={initialData.workers} today={initialData.today} /></TabsContent><TabsContent value="machines"><MachinesRegister machines={initialData.machines} today={initialData.today} /></TabsContent></Tabs>
}
