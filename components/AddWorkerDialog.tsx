'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Plus } from 'lucide-react'
import { formatINR } from '@/lib/finance'
import { cn } from '@/lib/utils'

const FIXED_ROLES = [
    { value: 'master', label: 'Master', defaultSalary: 30000 },
    { value: 'supervisor', label: 'Supervisor', defaultSalary: 30000 },
    { value: 'helper', label: 'Helper', defaultSalary: 15000 },
    { value: 'mender', label: 'Mender', defaultSalary: 15000 },
    { value: 'sanitation', label: 'Sanitation Worker', defaultSalary: 7000 },
    { value: 'daily', label: 'Day-to-Day', defaultSalary: 15000 },
]

interface AddWorkerDialogProps {
    orgId: string
    onWorkerAdded?: () => void
}

export function AddWorkerDialog({ orgId, onWorkerAdded }: AddWorkerDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [workerType, setWorkerType] = useState<'meter' | 'fixed'>('meter')
    const [name, setName] = useState('')
    // Fixed worker fields
    const [role, setRole] = useState('')
    const [salary, setSalary] = useState('')

    const supabase = createClient()

    const resetForm = () => {
        setName('')
        setRole('')
        setSalary('')
        setWorkerType('meter')
    }

    const handleRoleChange = (val: string) => {
        setRole(val)
        const defaultSalary = FIXED_ROLES.find(r => r.value === val)?.defaultSalary
        if (defaultSalary) setSalary(defaultSalary.toString())
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name.trim()) {
            toast.error('Please enter worker name')
            return
        }

        if (workerType === 'fixed') {
            if (!role) {
                toast.error('Please select a role')
                return
            }
            if (!salary || parseFloat(salary) <= 0) {
                toast.error('Please enter a valid salary')
                return
            }
        }

        setLoading(true)

        try {
            if (workerType === 'meter') {
                const { error } = await supabase
                    .from('workers')
                    .insert({
                        org_id: orgId,
                        name: name.trim(),
                        is_active: true,
                    })
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('fixed_workers')
                    .insert({
                        org_id: orgId,
                        name: name.trim(),
                        role,
                        monthly_salary: parseFloat(salary),
                        is_active: true,
                    })
                if (error) throw error
            }

            toast.success(`${name} added as ${workerType === 'meter' ? 'meter' : 'fixed'} worker!`)
            setOpen(false)
            resetForm()

            if (onWorkerAdded) {
                onWorkerAdded()
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to add worker')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm() }}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Worker
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add New Worker</DialogTitle>
                        <DialogDescription>
                            Choose worker type and fill in details.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Worker Type Toggle */}
                        <div className="grid gap-2">
                            <Label>Worker Type</Label>
                            <div className="flex rounded-lg border overflow-hidden">
                                <button
                                    type="button"
                                    className={cn(
                                        'flex-1 py-2.5 text-sm font-medium transition-colors',
                                        workerType === 'meter'
                                            ? 'bg-gray-900 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'
                                    )}
                                    onClick={() => setWorkerType('meter')}
                                >
                                    Meter Worker
                                </button>
                                <button
                                    type="button"
                                    className={cn(
                                        'flex-1 py-2.5 text-sm font-medium transition-colors border-l',
                                        workerType === 'fixed'
                                            ? 'bg-gray-900 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'
                                    )}
                                    onClick={() => setWorkerType('fixed')}
                                >
                                    Fixed Salary
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {workerType === 'meter'
                                    ? 'Paid per meter of production on assigned machines'
                                    : 'Paid a fixed monthly salary (e.g. master, helper, daily)'
                                }
                            </p>
                        </div>

                        {/* Name */}
                        <div className="grid gap-2">
                            <Label htmlFor="name">
                                Worker Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="name"
                                placeholder="e.g. Rajesh Kumar"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        {/* Fixed worker fields */}
                        {workerType === 'fixed' && (
                            <>
                                <div className="grid gap-2">
                                    <Label>Role <span className="text-red-500">*</span></Label>
                                    <Select value={role} onValueChange={handleRoleChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FIXED_ROLES.map(r => (
                                                <SelectItem key={r.value} value={r.value}>
                                                    {r.label} — {formatINR(r.defaultSalary)}/mo
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Monthly Salary (₹) <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="number"
                                        placeholder="15000"
                                        value={salary}
                                        onChange={(e) => setSalary(e.target.value)}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                'Add Worker'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
