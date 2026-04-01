'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { MIN_WAGE_MONTHLY } from '@/lib/wage-config'
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
import { addMeterWorker, addFixedWorker } from '@/app/(dashboard)/supervisor/actions'
import { saveWorkerWhatsApp } from '@/app/(dashboard)/owner/actions'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Sentry from '@sentry/nextjs'
import { useTranslation } from '@/lib/i18n/context'

const FIXED_ROLES = [
    { value: 'master', defaultSalary: 30000 },
    { value: 'supervisor', defaultSalary: 30000 },
    { value: 'helper', defaultSalary: 15000 },
    { value: 'mender', defaultSalary: 15000 },
    { value: 'sanitation', defaultSalary: 7000 },
    { value: 'daily', defaultSalary: 15000 },
    { value: 'other', defaultSalary: 0 },
]

// Define Zod Schema for validation
const workerSchema = z.object({
    workerType: z.enum(['meter', 'fixed']),
    name: z.string().min(1, 'Worker name is required'),
    role: z.string().optional(),
    customRole: z.string().optional(),
    salary: z.coerce.number().optional(),
    pf_esi_eligible: z.boolean().default(false),
    esi_number: z.string().optional(),
    pf_number: z.string().optional(),
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
    const [ageConfirmed, setAgeConfirmed] = useState(false)
    const [whatsappPhone, setWhatsappPhone] = useState('')
    const [whatsappLang, setWhatsappLang] = useState<'en' | 'hi' | 'gu'>('en')
    const [whatsappConsent, setWhatsappConsent] = useState(false)
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { t } = useTranslation()

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
            salary: 0,
            pf_esi_eligible: false,
            esi_number: '',
            pf_number: ''
        }
    })

    const workerType = watch('workerType')
    const selectedRole = watch('role')
    const watchedSalary = watch('salary')
    const watchedPfEsiEligible = watch('pf_esi_eligible')

    const mutation = useMutation({
        mutationFn: async (data: WorkerFormValues) => {
            if (data.workerType === 'meter') {
                const result = await addMeterWorker({
                    name: data.name.trim(),
                    pf_esi_eligible: data.pf_esi_eligible,
                    esi_number: data.esi_number?.trim() || null,
                    pf_number: data.pf_number?.trim() || null,
                })
                if (result.error) throw new Error(result.error)
                return { ...data, workerId: (result as any).workerId as number }
            } else {
                const result = await addFixedWorker({
                    name: data.name.trim(),
                    role: data.role === 'other' ? data.customRole?.trim() || '' : data.role || '',
                    monthly_salary: data.salary as number,
                    pf_esi_eligible: data.pf_esi_eligible,
                    esi_number: data.esi_number?.trim() || null,
                    pf_number: data.pf_number?.trim() || null,
                })
                if (result.error) throw new Error(result.error)
                return { ...data, workerId: (result as any).workerId as number }
            }
        },
        onSuccess: async (data) => {
            toast.success(`${data.name}${t('workers.added_success')}`)
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

            // Save WhatsApp details if phone entered and consent given
            if (whatsappPhone.length === 10 && whatsappConsent && data.workerId) {
                saveWorkerWhatsApp({
                    workerId: data.workerId,
                    workerType: data.workerType as 'meter' | 'fixed',
                    phone: whatsappPhone,
                    language: whatsappLang,
                    consentGiven: whatsappConsent,
                }).catch((err) => console.error('[saveWorkerWhatsApp]', err))
            }

            // WhatsApp opt-in is handled separately in the mutation below but
            // we reset the fields here after close.
            setOpen(false)
            reset()
            setWhatsappPhone('')
            setWhatsappLang('en')
            setWhatsappConsent(false)
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
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) { reset(); setAgeConfirmed(false) } }}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('workers.add_worker')}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit((data) => onSubmit(data as unknown as WorkerFormValues))}>
                    <DialogHeader>
                        <DialogTitle>{t('workers.add_worker')}</DialogTitle>
                        <DialogDescription>
                            {t('workers.choose_type')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Worker Type Toggle */}
                        <div className="grid gap-2">
                            <Label>{t('workers.worker_type')}</Label>
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
                                    {t('workers.meterWorkerType')}
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
                                        setValue('pf_esi_eligible', false)
                                        setValue('esi_number', '')
                                        setValue('pf_number', '')
                                    }}
                                >
                                    {t('workers.fixedSalaryType')}
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {workerType === 'meter'
                                    ? t('workers.paid_per_meter')
                                    : t('workers.paid_fixed')
                                }
                            </p>
                        </div>

                        {/* Name */}
                        <div className="grid gap-2">
                            <Label htmlFor="name">
                                {t('workers.worker_name')} <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="name"
                                placeholder={t('workers.name_placeholder')}
                                {...register('name')}
                                autoFocus
                            />
                            {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
                        </div>

                        {/* Fixed worker fields */}
                        {workerType === 'fixed' && (
                            <>
                                <div className="grid gap-2">
                                    <Label>{t('workers.role')} <span className="text-red-500">*</span></Label>
                                    <Controller
                                        name="role"
                                        control={control}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={handleRoleChange}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('workers.select_role')} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {FIXED_ROLES.map(r => (
                                                        <SelectItem key={r.value} value={r.value}>
                                                            {t(`workers.roles.${r.value}`)}
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
                                        <Label>{t('workers.custom_role_name')} <span className="text-red-500">*</span></Label>
                                        <Input
                                            placeholder={t('workers.custom_role_placeholder')}
                                            {...register('customRole')}
                                        />
                                        {(errors as any).customRole && <span className="text-xs text-red-500">{(errors as any).customRole.message}</span>}
                                    </div>
                                )}
                                <div className="grid gap-2">
                                    <Label>{t('workers.monthly_salary')} <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="number"
                                        placeholder={t('workers.salary_placeholder')}
                                        {...register('salary')}
                                    />
                                    {(errors as any).salary && <span className="text-xs text-red-500">{(errors as any).salary.message}</span>}
                                    {watchedSalary && Number(watchedSalary) > 0 && Number(watchedSalary) < MIN_WAGE_MONTHLY && (
                                        <div className="flex items-center gap-1.5 text-amber-600 mt-1">
                                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                                            <span className="text-xs">Below Gujarat minimum wage (₹{MIN_WAGE_MONTHLY.toLocaleString()}/month)</span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        
                        {/* ESI/PF Compliance Fields */}
                        <div className="border-t border-gray-100 pt-3 mt-1">
                            <div className="flex items-center gap-2 mb-3">
                                <Controller
                                    name="pf_esi_eligible"
                                    control={control}
                                    render={({ field }) => (
                                        <input
                                            type="checkbox"
                                            id="pf_esi_eligible"
                                            checked={field.value}
                                            onChange={(e) => field.onChange(e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                        />
                                    )}
                                />
                                <Label htmlFor="pf_esi_eligible" className="cursor-pointer font-medium text-gray-700">
                                    Eligible for ESI / PF Benefits?
                                </Label>
                            </div>
                            
                            {watchedPfEsiEligible && (
                                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">ESI Number</Label>
                                        <Input
                                            className="h-8 text-sm"
                                            placeholder="Optional"
                                            {...register('esi_number')}
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">PF Number</Label>
                                        <Input
                                            className="h-8 text-sm"
                                            placeholder="Optional"
                                            {...register('pf_number')}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* WhatsApp (optional) */}
                        <div className="border-t border-gray-100 pt-3 mt-1 space-y-3">
                            <div>
                                <p className="text-xs font-medium text-gray-700 mb-0.5">
                                    WhatsApp Number <span className="text-gray-400 font-normal">(optional)</span>
                                </p>
                                <p className="text-xs text-gray-400 mb-2">Used for payroll messages and advance receipts</p>
                                <div className="flex gap-2">
                                    <div className="flex items-center px-2.5 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600 font-medium whitespace-nowrap">
                                        +91
                                    </div>
                                    <Input
                                        type="tel"
                                        inputMode="numeric"
                                        placeholder="9898989898"
                                        value={whatsappPhone}
                                        onChange={(e) => setWhatsappPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        maxLength={10}
                                        className="font-mono"
                                    />
                                    <select
                                        value={whatsappLang}
                                        onChange={(e) => setWhatsappLang(e.target.value as 'en' | 'hi' | 'gu')}
                                        className="border border-gray-200 rounded-md text-xs px-2 bg-white text-gray-700"
                                    >
                                        <option value="en">English</option>
                                        <option value="hi">हिंदी</option>
                                        <option value="gu">ગુજરાતી</option>
                                    </select>
                                </div>
                            </div>

                            {whatsappPhone.length === 10 && (
                                <div className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        id="wa-consent"
                                        checked={whatsappConsent}
                                        onChange={(e) => setWhatsappConsent(e.target.checked)}
                                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 cursor-pointer"
                                    />
                                    <label htmlFor="wa-consent" className="text-xs text-gray-500 leading-snug cursor-pointer">
                                        I confirm this worker has consented to receive WhatsApp payroll messages on this number
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex-col gap-3 sm:flex-col">
                        {/* Age Declaration (DPDP Act compliance) */}
                        <div className="flex items-start gap-2.5 w-full">
                            <input
                                type="checkbox"
                                id="age-confirm"
                                checked={ageConfirmed}
                                onChange={(e) => setAgeConfirmed(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                            <label htmlFor="age-confirm" className="text-xs text-gray-500 leading-snug cursor-pointer">
                                I confirm this worker is 18 years of age or older
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 w-full">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={mutation.isPending}
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit" disabled={mutation.isPending || !ageConfirmed}>
                                {mutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t('workers.adding')}
                                    </>
                                ) : (
                                    t('workers.add_worker')
                                )}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
