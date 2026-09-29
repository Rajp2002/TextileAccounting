'use client'
import { useState, type FormEvent, type ReactNode } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { trackPlanEvent } from '@/lib/plan-analytics'
import { Edit3, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SwitchField } from '@/components/ui/switch-field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUnloadProtection } from '@/components/settings/plan-aware/unsaved-changes-dialog'
import { useTranslation } from '@/lib/i18n/context'
import type { BaseProductionMachine } from '@/lib/base-production-core'
import { createBaseProductionMachine, updateBaseProductionMachine } from '../actions'

type MachineDraft = {
    name: string
    machineType: 'jacquard' | 'power_loom' | 'rapier' | 'water_jet' | 'air_jet' | 'circular' | 'other'
    customLabel: string
    isActive: boolean
}
function emptyMachineDraft(): MachineDraft {
    return { name: '', machineType: 'other', customLabel: '', isActive: true }
}

export default function MachineEditor({ initialOpen = false, returnTo, children, tourPreview }: {
 today: string; initialOpen?: boolean; returnTo?: string;
 tourPreview?: { machine: BaseProductionMachine; editing: boolean };
 children: (actions: { isOpen: boolean; add: () => void; edit: (record: BaseProductionMachine) => void }) => ReactNode
}) {
 const router = useRouter()
 const pathname = usePathname()
 const params = useSearchParams()
 function clearAddIntent() {
  if (!params.has('add')) return
  const next = new URLSearchParams(params); next.delete('add')
  window.history.replaceState(null, '', `${pathname}${next.size ? `?${next}` : ''}`)
 }
 const { tx } = useTranslation()
 const [open, setOpen] = useState(initialOpen || Boolean(tourPreview))
 const [editingMachineId, setEditingMachineId] = useState<string | null>(tourPreview?.editing ? tourPreview.machine.id : null)
 const [machineDraft, setMachineDraft] = useState<MachineDraft>(() => tourPreview ? { name: tourPreview.machine.name, machineType: tourPreview.machine.machine_type as MachineDraft['machineType'], customLabel: tourPreview.machine.custom_label ?? '', isActive: tourPreview.machine.is_active } : emptyMachineDraft())
 const [original, setOriginal] = useState(() => JSON.stringify(emptyMachineDraft()))
 const [pendingAction, setPendingAction] = useState<string | null>(null)
 const dirty = !tourPreview && open && JSON.stringify(machineDraft) !== original
 useUnloadProtection(dirty)
 function closeDialog() {
   if (tourPreview) return
   if (pendingAction) return
   if (dirty && !window.confirm(tx('Discard unsaved changes?'))) return
   clearAddIntent(); setOpen(false)
 }
 function saved() { clearAddIntent(); setOpen(false); if (returnTo) router.push(returnTo) }
 async function runAction(key: string, action: () => Promise<unknown>, message: string, onSuccess: () => void) {
   setPendingAction(key)
   try {
     const result = await action()
     if (result && typeof result === 'object' && 'error' in result && result.error) { toast.error(String(result.error)); return }
     toast.success(tx(message)); trackPlanEvent('production_activity', { action: key }); onSuccess(); router.refresh()
   } catch { toast.error(tx('The action could not be completed.')) } finally { setPendingAction(null) }
 }
 function openEditMachine(machine: BaseProductionMachine) {
        setEditingMachineId(machine.id)
        const draft: MachineDraft = {
            name: machine.name,
            machineType: machine.machine_type as MachineDraft['machineType'],
            customLabel: machine.custom_label ?? '',
            isActive: machine.is_active,
        }
        setMachineDraft(draft)
        setOriginal(JSON.stringify(draft))
        setOpen(true)
    }
 function handleMachineSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (tourPreview) return
        if (editingMachineId) {
            void runAction(
                'machine-update',
                () => updateBaseProductionMachine({
                    machineId: editingMachineId,
                    name: machineDraft.name,
                    machineType: machineDraft.machineType,
                    customLabel: machineDraft.customLabel,
                    isActive: machineDraft.isActive,
                }),
                'Machine updated.',
                saved,
            )
            return
        }

        void runAction(
            'machine-create',
            () => createBaseProductionMachine({
                name: machineDraft.name,
                machineType: machineDraft.machineType,
                customLabel: machineDraft.customLabel,
            }),
            'Machine added.',
            saved,
        )
    }
 return <>
 {children({
   isOpen: open,
   add: () => { setEditingMachineId(null); setMachineDraft(emptyMachineDraft()); setOriginal(JSON.stringify(emptyMachineDraft())); setOpen(true) },
   edit: value => { openEditMachine(value) },
 })}
             <Dialog modal={!tourPreview} open={open} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent data-machines-tour-preview={tourPreview ? "true" : undefined} onOpenAutoFocus={event => { if (tourPreview) event.preventDefault() }} onCloseAutoFocus={event => { if (tourPreview) event.preventDefault() }} onInteractOutside={event => { if (tourPreview) event.preventDefault() }} onEscapeKeyDown={event => { if (tourPreview) event.preventDefault() }}>
                    <DialogHeader><DialogTitle>{editingMachineId ? 'Edit machine' : 'Add machine'}</DialogTitle><DialogDescription>Name your machine and choose its type.</DialogDescription></DialogHeader>
                    <form onSubmit={handleMachineSubmit}><fieldset disabled={Boolean(tourPreview)} data-machines-tour-field="details" className="space-y-4">
                        <div data-machines-tour-field="name" className="space-y-2"><Label htmlFor="base-machine-name">Machine name {!editingMachineId && <span className="font-normal text-muted-foreground">(optional)</span>}</Label><Input id="base-machine-name" autoFocus={!tourPreview} value={machineDraft.name} onChange={(event) => setMachineDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Leave blank for Loom #1" required={Boolean(editingMachineId)} /></div>
                        <div data-machines-tour-field="type" className="space-y-2"><Label htmlFor="base-machine-type">Machine type</Label><Select value={machineDraft.machineType} onValueChange={(value) => setMachineDraft((current) => ({ ...current, machineType: value as MachineDraft['machineType'] }))}><SelectTrigger id="base-machine-type" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="jacquard">Jacquard</SelectItem><SelectItem value="power_loom">Power loom</SelectItem><SelectItem value="rapier">Rapier</SelectItem><SelectItem value="water_jet">Water jet</SelectItem><SelectItem value="air_jet">Air jet</SelectItem><SelectItem value="circular">Circular</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
                        <div data-machines-tour-field="label" className="space-y-2"><Label htmlFor="base-machine-label">Custom label <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="base-machine-label" value={machineDraft.customLabel} onChange={(event) => setMachineDraft((current) => ({ ...current, customLabel: event.target.value }))} placeholder="e.g. Rapier #1" /></div>
                        {editingMachineId && <SwitchField data-machines-tour-field="availability" className="font-normal" checked={machineDraft.isActive} onCheckedChange={(isActive) => setMachineDraft((current) => ({ ...current, isActive }))}>Available for new assignments and daily context</SwitchField>}
                        <DialogFooter><Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button><Button type="submit" disabled={pendingAction === (editingMachineId ? 'machine-update' : 'machine-create')}>{pendingAction === (editingMachineId ? 'machine-update' : 'machine-create') ? <Loader2 className="h-4 w-4 animate-spin" /> : editingMachineId ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {returnTo ? tx('Save and return') : editingMachineId ? 'Save changes' : 'Add machine'}</Button></DialogFooter>
                    </fieldset></form>
                </DialogContent>
            </Dialog>
 </>
}
