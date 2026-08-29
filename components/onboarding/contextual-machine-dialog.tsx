'use client'

import { useEffect, useState } from 'react'
import { Loader2, Server } from 'lucide-react'
import { toast } from 'sonner'

import { addMachine } from '@/app/(dashboard)/owner/actions'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const LOOM_TYPES = [
    { value: 'jacquard', label: 'Jacquard' },
    { value: 'rapier', label: 'Rapier' },
    { value: 'water_jet', label: 'Water Jet' },
    { value: 'air_jet', label: 'Air Jet' },
    { value: 'power_loom', label: 'Power Loom' },
    { value: 'shuttle', label: 'Shuttle' },
    { value: 'other', label: 'Other' },
]

interface ContextualMachineDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onMachineAdded?: () => void
}

export function ContextualMachineDialog({
    open,
    onOpenChange,
    onMachineAdded,
}: ContextualMachineDialogProps) {
    const [name, setName] = useState('')
    const [loomType, setLoomType] = useState('')
    const [customLabel, setCustomLabel] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open) {
            setName('')
            setLoomType('')
            setCustomLabel('')
        }
    }, [open])

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const trimmedName = name.trim()
        if (!trimmedName) {
            toast.error('Enter a loom name.')
            return
        }
        if (!loomType) {
            toast.error('Choose a loom type.')
            return
        }
        if (loomType === 'other' && !customLabel.trim()) {
            toast.error('Enter a custom loom label.')
            return
        }

        setSaving(true)
        try {
            const result = await addMachine(
                trimmedName,
                loomType,
                loomType === 'other' ? customLabel.trim() : undefined,
            )

            if (result.error) {
                toast.error(result.error)
                return
            }

            toast.success('Loom added. You can add more or configure assignments later.')
            onMachineAdded?.()
            onOpenChange(false)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to add the loom. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Server className="h-5 w-5 text-saffron-deep" />
                        Add a loom to continue
                    </DialogTitle>
                    <DialogDescription>
                        Your production workflow needs at least one loom. Add the first one now; assignments and additional looms can wait until later.
                    </DialogDescription>
                </DialogHeader>

                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                        <Label htmlFor="contextual-loom-name">Loom name</Label>
                        <Input
                            id="contextual-loom-name"
                            autoFocus
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="e.g. Loom 1"
                            maxLength={120}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="contextual-loom-type">Loom type</Label>
                        <select
                            id="contextual-loom-type"
                            value={loomType}
                            onChange={(event) => {
                                setLoomType(event.target.value)
                                if (event.target.value !== 'other') setCustomLabel('')
                            }}
                            className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ring/25"
                        >
                            <option value="">— Select type —</option>
                            {LOOM_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                    </div>

                    {loomType === 'other' && (
                        <div className="space-y-2">
                            <Label htmlFor="contextual-loom-custom-label">Custom label</Label>
                            <Input
                                id="contextual-loom-custom-label"
                                value={customLabel}
                                onChange={(event) => setCustomLabel(event.target.value)}
                                placeholder="e.g. Imported Italian Jacquard"
                                maxLength={80}
                            />
                        </div>
                    )}

                    <p className="rounded-lg border border-info-soft bg-info-soft p-3 text-xs leading-relaxed text-info">
                        This creates the loom as inactive until its order and worker assignment are configured.
                    </p>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Not now
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add loom
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
