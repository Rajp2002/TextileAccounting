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
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Sentry from '@sentry/nextjs'

const FIXED_ROLES = [
    { value: 'master', label: 'Master', defaultSalary: 30000 },
    { value: 'supervisor', label: 'Supervisor', defaultSalary: 30000 },
    { value: 'helper', label: 'Helper', defaultSalary: 15000 },
    { value: 'mender', label: 'Mender', defaultSalary: 15000 },
    { value: 'sanitation', label: 'Sanitation Worker', defaultSalary: 7000 },
    { value: 'daily', label: 'Day-to-Day', defaultSalary: 15000 },
    { value: 'other', label: 'Other (Custom Role)', defaultSalary: 0 },
]

// Define Zod Schema for validation
const workerSchema = z.object({
    workerType: z.enum(['meter', 'fixed']),
    name: z.string().min(1, 'Worker name is required'),
    role: z.string().optional(),
    customRole: z.string().optional(),
    salary: z.coerce.number().optional()
}).superRefine((data, ctx) => {
    if (data.workerType === 'fixed') {
        if (!data.role) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Role is required",
                path: ["role"]
            });
        }
        if (data.role === 'other' && (!data.customRole || data.customRole.trim() === '')) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Custom role name is required",
                path: ["customRole"]
            });
        }
        if (data.salary === undefined || data.salary <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Valid salary is required",
                path: ["salary"]
            });
        }
    }
});

type WorkerFormValues = z.infer<typeof workerSchema>

interface AddWorkerDialogProps {
    orgId: string
    onWorkerAdded?: () => void
}

export function AddWorkerDialog({ orgId, onWorkerAdded }: AddWorkerDialogProps) {
    const [open, setOpen] = useState(false)
    const supabase = createClient()
    const queryClient = useQueryClient()

    const {
        register,
        handleSubmit,
        control,
        watch,
        setValue,
        reset,
        formState: { errors }
    } = useForm<WorkerFormValues>({
        // @ts-expect-error - Zod discriminated union typing mismatch with react-hook-form
        resolver: zodResolver(workerSchema),
        defaultValues: {
            workerType: 'meter',
            name: '',
            role: '',
            customRole: '',
            salary: 0
        }
    })

    const workerType = watch('workerType')
    const selectedRole = watch('role')

    const mutation = useMutation({
        mutationFn: async (data: WorkerFormValues) => {
            if (data.workerType === 'meter') {
                const { error } = await supabase
                    .from('workers')
                    .insert({
                        org_id: orgId,
                        name: data.name.trim(),
                        is_active: true,
                    })
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('fixed_workers')
                    .insert({
                        org_id: orgId,
                        name: data.name.trim(),
                        role: data.role === 'other' ? data.customRole?.trim() : data.role,
                        monthly_salary: data.salary as number,
                        is_active: true,
                    })
                if (error) throw error
            }
            return data
        },
        onSuccess: (data) => {
            toast.success(`${data.name} added as ${data.workerType === 'meter' ? 'meter' : 'fixed'} worker!`)
            // Invalidate meter worker queries
            queryClient.invalidateQueries({ queryKey: ['workers'] })
            // Invalidate ALL fixed-worker-related queries used across pages:
            // - ['fixed_workers']        → fixed-workers management page
            // - ['fixed_workers_list']   → analytics panel fixed staff section
            // - ['fixed_payroll']        → analytics panel fixed payroll card
            // - ['daily_workers']        → attendance page (day-to-day workers list)
            queryClient.invalidateQueries({ queryKey: ['fixed_workers'] })
            queryClient.invalidateQueries({ queryKey: ['fixed_workers_list'] })
            queryClient.invalidateQueries({ queryKey: ['fixed_payroll'] })
            queryClient.invalidateQueries({ queryKey: ['daily_workers'] })
            setOpen(false)
            reset()
            if (onWorkerAdded) {
                onWorkerAdded()
            }
        },
        onError: (error: unknown) => {
            // Supabase PostgrestError objects are plain objects with .message, NOT Error instances.
            // We must handle both shapes to avoid hiding real error messages.
            const message =
                error instanceof Error
                    ? error.message
                    : typeof error === 'object' && error !== null && 'message' in error
                        ? (error as { message: string }).message
                        : 'An unexpected error occurred'
            toast.error(message || 'Failed to add worker')
            Sentry.captureException(error instanceof Error ? error : new Error(message))
        }
    })

    // @ts-ignore - Bypass overly strict SubmitHandler generic bound mismatch
    const onSubmit = (data: WorkerFormValues) => {
        mutation.mutate(data)
    }

    const handleRoleChange = (val: string) => {
        setValue('role', val)
        const defaultSalary = FIXED_ROLES.find(r => r.value === val)?.defaultSalary
        if (defaultSalary !== undefined && val !== 'other') {
            setValue('salary', defaultSalary)
        } else if (val === 'other') {
            setValue('salary', 0)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) reset() }}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Worker
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit((data) => onSubmit(data as unknown as WorkerFormValues))}>
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
                                    onClick={() => setValue('workerType', 'meter')}
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
                                    onClick={() => {
                                        setValue('workerType', 'fixed')
                                        // Initialize required fields to avoid validation errors immediately
                                        setValue('role', '')
                                        setValue('customRole', '')
                                        setValue('salary', 0)
                                    }}
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
                                {...register('name')}
                                autoFocus
                            />
                            {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
                        </div>

                        {/* Fixed worker fields */}
                        {workerType === 'fixed' && (
                            <>
                                <div className="grid gap-2">
                                    <Label>Role <span className="text-red-500">*</span></Label>
                                    <Controller
                                        name="role"
                                        control={control}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={handleRoleChange}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {FIXED_ROLES.map(r => (
                                                        <SelectItem key={r.value} value={r.value}>
                                                            {r.label}{r.value !== 'other' ? ` — ${formatINR(r.defaultSalary)}/mo` : ''}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {/* Typescript needs to know this might exist depending on the discrimination union */}
                                    {(errors as any).role && <span className="text-xs text-red-500">{(errors as any).role.message}</span>}
                                </div>
                                {selectedRole === 'other' && (
                                    <div className="grid gap-2">
                                        <Label>Custom Role Name <span className="text-red-500">*</span></Label>
                                        <Input
                                            placeholder="e.g. Plumber, Electrician"
                                            {...register('customRole')}
                                        />
                                        {(errors as any).customRole && <span className="text-xs text-red-500">{(errors as any).customRole.message}</span>}
                                    </div>
                                )}
                                <div className="grid gap-2">
                                    <Label>Monthly Salary (₹) <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="number"
                                        placeholder="15000"
                                        {...register('salary')}
                                    />
                                    {(errors as any).salary && <span className="text-xs text-red-500">{(errors as any).salary.message}</span>}
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={mutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={mutation.isPending}>
                            {mutation.isPending ? (
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
