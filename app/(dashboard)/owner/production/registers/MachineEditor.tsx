'use client'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
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
import { MAX_BULK_MACHINES, buildBulkMachineNames } from '@/lib/base-bulk-register'
import { createBaseProductionMachine, createBaseProductionMachinesBulk, updateBaseProductionMachine } from '../actions'

type MachineDraft = {
    name: string
    machineType: 'jacquard' | 'power_loom' | 'rapier' | 'water_jet' | 'air_jet' | 'circular' | 'other'
    customLabel: string
    isActive: boolean
}
function emptyMachineDraft(): MachineDraft {
    return { name: '', machineType: 'other', customLabel: '', isActive: true }
}
const NO_NAMES: readonly string[] = []

export default function MachineEditor({ initialOpen = false, returnTo, existingNames = NO_NAMES, children, tourPreview }: {
 today: string; initialOpen?: boolean; returnTo?: string;
 /** Names already on the register, so bulk numbering continues after them. */
 existingNames?: readonly string[];
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
 const [bulk, setBulk] = useState(false)
 const [bulkCountText, setBulkCountText] = useState('')
 const [bulkPrefix, setBulkPrefix] = useState('')
 const bulkActive = bulk && !editingMachineId
 const bulkCount = /^\d+$/.test(bulkCountText.trim()) ? Number(bulkCountText.trim()) : 0
 const bulkCountValid = bulkCount >= 1 && bulkCount <= MAX_BULK_MACHINES
 const bulkNames = useMemo(
   () => bulkActive && bulkCountValid ? buildBulkMachineNames({ count: bulkCount, prefix: bulkPrefix, existingNames }) : [],
   [bulkActive, bulkCountValid, bulkCount, bulkPrefix, existingNames],
 )
 const bulkReady = bulkNames.length > 0
 const dirty = !tourPreview && open && (JSON.stringify(machineDraft) !== original || bulkCountText.trim() !== '' || bulkPrefix.trim() !== '')
 useUnloadProtection(dirty)
 function closeDialog() {
   if (tourPreview) return
   if (pendingAction) return
   if (dirty && !window.confirm(tx('Discard unsaved changes?'))) return
   clearAddIntent(); setOpen(false)
 }
 function saved() { clearAddIntent(); setOpen(false); if (returnTo) router.push(returnTo) }
 async function runAction(key: string, action: () => Promise<unknown>, message: string | ((result: unknown) => string), onSuccess: () => void) {
   setPendingAction(key)
   try {
     const result = await action()
     if (result && typeof result === 'object' && 'error' in result && result.error) { toast.error(String(result.error)); return }
     toast.success(typeof message === 'function' ? message(result) : tx(message)); trackPlanEvent('production_activity', { action: key }); onSuccess(); router.refresh()
   } catch { toast.error(tx('The action could not be completed.')) } finally { setPendingAction(null) }
 }
 function bulkAddedMessage(result: unknown) {
        const { added = 0 } = (result ?? {}) as { added?: number }
        return added === 1 ? tx('1 machine added.') : tx('{count} machines added.', { count: added })
 }
 const bulkSubmitLabel = bulkNames.length === 0 ? tx('Add machines') : bulkNames.length === 1 ? tx('Add 1 machine') : tx('Add {count} machines', { count: bulkNames.length })
 function openEditMachine(machine: BaseProductionMachine) {
        setBulk(false); setBulkCountText(''); setBulkPrefix('')
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
        if (bulkActive) {
            if (!bulkReady) return
            void runAction(
                'machine-create-bulk',
                () => createBaseProductionMachinesBulk({
                    count: bulkCount,
                    machineType: machineDraft.machineType,
                    namePrefix: bulkPrefix,
                }),
                bulkAddedMessage,
                saved,
            )
            return
        }
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
   add: () => { setBulk(false); setBulkCountText(''); setBulkPrefix(''); setEditingMachineId(null); setMachineDraft(emptyMachineDraft()); setOriginal(JSON.stringify(emptyMachineDraft())); setOpen(true) },
   edit: value => { openEditMachine(value) },
 })}
             <Dialog modal={!tourPreview} open={open} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent data-machines-tour-preview={tourPreview ? "true" : undefined} data-tour-surface={tourPreview ? "true" : undefined} onOpenAutoFocus={event => { if (tourPreview) event.preventDefault() }} onCloseAutoFocus={event => { if (tourPreview) event.preventDefault() }} onInteractOutside={event => { if (tourPreview) event.preventDefault() }} onEscapeKeyDown={event => { if (tourPreview) event.preventDefault() }}>
                    <DialogHeader><DialogTitle>{editingMachineId ? 'Edit machine' : bulkActive ? tx('Add machines') : 'Add machine'}</DialogTitle><DialogDescription>{bulkActive ? tx('Add several machines at once. They are numbered for you.') : 'Name your machine and choose its type.'}</DialogDescription></DialogHeader>
                    <form onSubmit={handleMachineSubmit}><fieldset disabled={Boolean(tourPreview)} data-machines-tour-field="details" className="space-y-4">
                        {!editingMachineId && !tourPreview && <div data-machines-bulk-toggle className="space-y-1">
                            <SwitchField checked={bulk} disabled={Boolean(pendingAction)} onCheckedChange={setBulk}>{tx('Add in bulk')}</SwitchField>
                        </div>}
                        {bulkActive && <div data-machines-bulk-count className="space-y-2">
                            <Label htmlFor="base-machine-bulk-count">{tx('How many machines?')}</Label>
                            <Input id="base-machine-bulk-count" autoFocus type="number" inputMode="numeric" min={1} max={MAX_BULK_MACHINES} step={1} value={bulkCountText} onChange={event => setBulkCountText(event.target.value)} aria-describedby="base-machine-bulk-help" placeholder="e.g. 24" />
                            <p id="base-machine-bulk-help" aria-live="polite" className={bulkCountText.trim() !== '' && !bulkCountValid ? 'text-xs text-destructive' : 'text-xs text-body'}>
                                {bulkCountText.trim() !== '' && !bulkCountValid ? tx('Enter a whole number from 1 to {max}.', { max: MAX_BULK_MACHINES }) : bulkNames.length === 0 ? tx('Up to {max} at a time.', { max: MAX_BULK_MACHINES }) : bulkNames.length === 1 ? tx('Will add {first}.', { first: bulkNames[0] }) : tx('Will add {count} machines: {first} to {last}.', { count: bulkNames.length, first: bulkNames[0], last: bulkNames[bulkNames.length - 1] })}
                            </p>
                        </div>}
                        {!bulkActive && <div data-machines-tour-field="name" className="space-y-2"><Label htmlFor="base-machine-name">Machine name {!editingMachineId && <span className="font-normal text-muted-foreground">(optional)</span>}</Label><Input id="base-machine-name" autoFocus={!tourPreview} value={machineDraft.name} onChange={(event) => setMachineDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Leave blank for Loom #1" required={Boolean(editingMachineId)} /></div>}
                        <div data-machines-tour-field="type" className="space-y-2"><Label htmlFor="base-machine-type">Machine type</Label><Select value={machineDraft.machineType} onValueChange={(value) => setMachineDraft((current) => ({ ...current, machineType: value as MachineDraft['machineType'] }))}><SelectTrigger id="base-machine-type" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="jacquard">Jacquard</SelectItem><SelectItem value="power_loom">Power loom</SelectItem><SelectItem value="rapier">Rapier</SelectItem><SelectItem value="water_jet">Water jet</SelectItem><SelectItem value="air_jet">Air jet</SelectItem><SelectItem value="circular">Circular</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
                        {bulkActive && <div data-machines-bulk-prefix className="space-y-2">
                            <Label htmlFor="base-machine-bulk-prefix">{tx('Name prefix')} <span className="font-normal text-muted-foreground">{tx('(optional)')}</span></Label>
                            <Input id="base-machine-bulk-prefix" maxLength={80} value={bulkPrefix} onChange={event => setBulkPrefix(event.target.value)} aria-describedby="base-machine-bulk-prefix-help" placeholder="Loom" />
                            <p id="base-machine-bulk-prefix-help" className="text-xs text-body">{tx('Machines are named like Loom #1, Loom #2. Change “Loom” here if you prefer another name.')}</p>
                        </div>}
                        {!bulkActive && <div data-machines-tour-field="label" className="space-y-2"><Label htmlFor="base-machine-label">Custom label <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="base-machine-label" value={machineDraft.customLabel} onChange={(event) => setMachineDraft((current) => ({ ...current, customLabel: event.target.value }))} placeholder="e.g. Rapier #1" /></div>}
                        {editingMachineId && <SwitchField data-machines-tour-field="availability" className="font-normal" checked={machineDraft.isActive} onCheckedChange={(isActive) => setMachineDraft((current) => ({ ...current, isActive }))}>Available for new assignments and daily context</SwitchField>}
                        <DialogFooter><Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button><Button type="submit" disabled={pendingAction?.startsWith('machine-') || (bulkActive && !bulkReady)}>{pendingAction?.startsWith('machine-') ? <Loader2 className="h-4 w-4 animate-spin" /> : editingMachineId ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {returnTo ? tx('Save and return') : editingMachineId ? 'Save changes' : bulkActive ? bulkSubmitLabel : 'Add machine'}</Button></DialogFooter>
                    </fieldset></form>
                </DialogContent>
            </Dialog>
 </>
}
