'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2, Plus } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { addMeterWorker, addFixedWorker } from '@/app/(dashboard)/supervisor/actions'
import { saveWorkerWhatsApp } from '@/app/(dashboard)/owner/actions'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Sentry from '@sentry/nextjs'
import { useTranslation } from '@/lib/i18n/context'
import { useUserProfile } from '@/hooks/use-user-profile'

const FIXED_ROLES = [
    { value: 'master', defaultSalary: 30000 },
    { value: 'supervisor', defaultSalary: 30000 },
    { value: 'helper', defaultSalary: 15000 },
    { value: 'mender', defaultSalary: 15000 },
    { value: 'sanitation', defaultSalary: 7000 },
    { value: 'daily', defaultSalary: 15000 },
    { value: 'other', defaultSalary: 0 },
]

const AGE_VERIFICATION_METHODS = [
    { value: 'government_id', label: 'Government ID' },
    { value: 'birth_certificate', label: 'Birth certificate' },
    { value: 'school_record', label: 'School record' },
    { value: 'other', label: 'Other verified record' },
] as const

function adultCutoffDate() {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 18)
    return cutoff.toISOString().slice(0, 10)
}

// Define Zod Schema for validation
const workerSchema = z.object({
    workerType: z.enum(['meter', 'fixed']),
    name: z.string().min(1, 'Worker name is required'),
    role: z.string().optional(),
    customRole: z.string().optional(),
    salary: z.coerce.number().optional(),
    pf_esi_enrolled: z.boolean().default(false),
    esi_number: z.string().optional(),
    pf_number: z.string().optional(),
    date_of_birth: z.string().min(1, 'Verified date of birth is required'),
    age_verification_method: z.enum(['government_id', 'birth_certificate', 'school_record', 'other']),
    age_verification_reference: z.string().trim().min(4, 'Enter a non-sensitive evidence reference (at least 4 characters)'),
}).superRefine((data, ctx) => {
    if (data.date_of_birth && data.date_of_birth > adultCutoffDate()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Worker must be at least 18 years old',
            path: ['date_of_birth'],
        })
    }
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
type AddWorkerResult = {
    error?: string
    workerId?: number
}

interface AddWorkerDialogProps {
    orgId: string
    onWorkerAdded?: () => void
}

export function AddWorkerDialog({ onWorkerAdded }: AddWorkerDialogProps) {
    const [open, setOpen] = useState(false)
    const [whatsappPhone, setWhatsappPhone] = useState('')
    const [whatsappLang, setWhatsappLang] = useState<'en' | 'hi' | 'gu'>('en')
    const [whatsappConsent, setWhatsappConsent] = useState(false)
    
    const queryClient = useQueryClient()
    const { t } = useTranslation()
    const { data: userProfile } = useUserProfile()

    const isSupervisor = userProfile?.role === 'supervisor'

    const {
        register,
        handleSubmit,
        control,
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
            pf_esi_enrolled: false,
            esi_number: '',
            pf_number: '',
            date_of_birth: '',
            age_verification_method: 'government_id',
            age_verification_reference: '',
        }
    })

    const workerType = useWatch({ control, name: 'workerType' })
    const selectedRole = useWatch({ control, name: 'role' })
    const watchedSalary = useWatch({ control, name: 'salary' })
    const watchedPfEsiEnrolled = useWatch({ control, name: 'pf_esi_enrolled' })

    const mutation = useMutation({
        mutationFn: async (data: WorkerFormValues) => {
            let result: AddWorkerResult;
            if (data.workerType === 'meter') {
                result = await addMeterWorker({
                    name: data.name.trim(),
                    pf_esi_enrolled: data.pf_esi_enrolled,
                    esi_number: data.esi_number?.trim() || null,
                    pf_number: data.pf_number?.trim() || null,
                    date_of_birth: data.date_of_birth,
                    age_verification_method: data.age_verification_method,
                    age_verification_reference: data.age_verification_reference.trim(),
                })
            } else {
                result = await addFixedWorker({
                    name: data.name.trim(),
                    role: data.role === 'other' ? data.customRole?.trim() || '' : data.role || '',
                    monthly_salary: data.salary as number,
                    pf_esi_enrolled: data.pf_esi_enrolled,
                    esi_number: data.esi_number?.trim() || null,
                    pf_number: data.pf_number?.trim() || null,
                    date_of_birth: data.date_of_birth,
                    age_verification_method: data.age_verification_method,
                    age_verification_reference: data.age_verification_reference.trim(),
                })
            }
            if (result.error) throw new Error(result.error)
            const workerId = result.workerId

            return { ...data, workerId }
        },
        onSuccess: async (data) => {
            toast.success(`${data.name}${t('workers.added_success')}`)
            queryClient.invalidateQueries({ queryKey: ['workers'] })
            queryClient.invalidateQueries({ queryKey: ['fixed_workers'] })
            queryClient.invalidateQueries({ queryKey: ['fixed_workers_list'] })
            queryClient.invalidateQueries({ queryKey: ['fixed_payroll'] })
            queryClient.invalidateQueries({ queryKey: ['daily_workers'] })

            if (whatsappPhone.length === 10 && data.workerId) {
                saveWorkerWhatsApp({
                    workerId: data.workerId,
                    workerType: data.workerType as 'meter' | 'fixed',
                    phone: whatsappPhone,
                    language: whatsappLang,
                    consentGiven: whatsappConsent,
                }).catch((err) => console.error('[saveWorkerWhatsApp]', err))
            }

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
            const message = error instanceof Error ? error.message : 'An unexpected error occurred'
            toast.error(message || 'Failed to add worker')
            Sentry.captureException(error instanceof Error ? error : new Error(message))
        }
    })

    const handleRoleChange = (val: string) => {
        setValue('role', val)
        const defaultSalary = FIXED_ROLES.find(r => r.value === val)?.defaultSalary
        const currentSalary = Number(watchedSalary || 0)
        if (currentSalary === 0) {
            if (defaultSalary !== undefined && val !== 'other') {
                setValue('salary', defaultSalary)
            } else if (val === 'other') {
                setValue('salary', 0)
            }
        }
    }

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) reset() }}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('workers.add_worker')}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit((data) => mutation.mutate(data as unknown as WorkerFormValues))}>
                    <DialogHeader>
                        <DialogTitle>{t('workers.add_worker')}</DialogTitle>
                        <DialogDescription>
                            {t('workers.choose_type')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {!isSupervisor && (
                            <div className="grid gap-2">
                                <Label>{t('workers.worker_type')}</Label>
                                <div className="flex rounded-lg border overflow-hidden">
                                    <button
                                        type="button"
                                        className={cn(
                                            'flex-1 py-2.5 text-sm font-medium transition-colors',
                                            workerType === 'meter'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-surface text-body hover:bg-surface-soft'
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
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-surface text-body hover:bg-surface-soft'
                                        )}
                                        onClick={() => {
                                            setValue('workerType', 'fixed')
                                            setValue('role', '')
                                            setValue('customRole', '')
                                            setValue('salary', 0)
                                            setValue('pf_esi_enrolled', false)
                                            setValue('esi_number', '')
                                            setValue('pf_number', '')
                                        }}
                                    >
                                        {t('workers.fixedSalaryType')}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="name">
                                {t('workers.worker_name')} <span className="text-risk">*</span>
                            </Label>
                            <Input id="name" placeholder={t('workers.name_placeholder')} {...register('name')} autoFocus />
                            {errors.name && <span className="text-xs text-risk">{errors.name.message}</span>}
                        </div>

                        <div className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                            <div>
                                <p className="text-sm font-medium text-body">Adult worker verification</p>
                                <p className="text-xs text-muted-foreground">Record verified provenance. Do not enter a full Aadhaar or government ID number.</p>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="worker-date-of-birth">Verified date of birth <span className="text-risk">*</span></Label>
                                    <Input
                                        id="worker-date-of-birth"
                                        type="date"
                                        min="1900-01-01"
                                        max={adultCutoffDate()}
                                        {...register('date_of_birth')}
                                    />
                                    {errors.date_of_birth && <span className="text-xs text-risk">{errors.date_of_birth.message}</span>}
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Verification method <span className="text-risk">*</span></Label>
                                    <Controller
                                        name="age_verification_method"
                                        control={control}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {AGE_VERIFICATION_METHODS.map((method) => (
                                                        <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="worker-age-reference">Evidence reference <span className="text-risk">*</span></Label>
                                <Input
                                    id="worker-age-reference"
                                    placeholder="Document type + last 4, or internal verification record"
                                    {...register('age_verification_reference')}
                                />
                                {errors.age_verification_reference && <span className="text-xs text-risk">{errors.age_verification_reference.message}</span>}
                            </div>
                        </div>

                        {workerType === 'fixed' && (
                            <>
                                <div className="grid gap-2">
                                    <Label>{t('workers.role')} <span className="text-risk">*</span></Label>
                                    <Controller
                                        name="role"
                                        control={control}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={handleRoleChange}>
                                                <SelectTrigger><SelectValue placeholder={t('workers.select_role')} /></SelectTrigger>
                                                <SelectContent>
                                                    {FIXED_ROLES.map(r => (
                                                        <SelectItem key={r.value} value={r.value}>{t(`workers.roles.${r.value}`)}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.role && <span className="text-xs text-risk">{errors.role.message}</span>}
                                </div>
                                {selectedRole === 'other' && (
                                    <div className="grid gap-2">
                                        <Label>{t('workers.custom_role_name')} <span className="text-risk">*</span></Label>
                                        <Input placeholder={t('workers.custom_role_placeholder')} {...register('customRole')} />
                                        {errors.customRole && <span className="text-xs text-risk">{errors.customRole.message}</span>}
                                    </div>
                                )}
                                <div className="grid gap-2">
                                    <Label>{t('workers.monthly_salary')} <span className="text-risk">*</span></Label>
                                    <Input type="number" placeholder={t('workers.salary_placeholder')} {...register('salary')} />
                                    {errors.salary && <span className="text-xs text-risk">{errors.salary.message}</span>}
                                    {watchedSalary && Number(watchedSalary) > 0 && Number(watchedSalary) < MIN_WAGE_MONTHLY && (
                                        <div className="mt-1 flex items-center gap-1.5 text-warning">
                                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                                            <span className="text-xs">Below Gujarat minimum wage (₹{MIN_WAGE_MONTHLY.toLocaleString()}/month)</span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        
                        <div className="mt-1 border-t border-hairline pt-3">
                            <div className="flex items-center gap-2 mb-3">
                                <Controller
                                    name="pf_esi_enrolled"
                                    control={control}
                                    render={({ field }) => (
                                        <input type="checkbox" id="pf_esi_enrolled" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} className="h-4 w-4 cursor-pointer rounded border-hairline text-saffron" />
                                    )}
                                />
                                <Label htmlFor="pf_esi_enrolled" className="cursor-pointer font-medium text-body">{t('worker.pfEsi.label')}</Label>
                            </div>
                            <p className="mb-3 text-xs text-muted-foreground">{t('worker.pfEsi.helper')}</p>
                            {watchedPfEsiEnrolled && (
                                <div className="grid grid-cols-2 gap-3 rounded-lg border border-hairline bg-surface-soft p-3">
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">{t('worker.pfEsi.esiNumber')}</Label>
                                        <Input className="h-8 text-sm" placeholder="Optional" {...register('esi_number')} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">{t('worker.pfEsi.pfNumber')}</Label>
                                        <Input className="h-8 text-sm" placeholder="Optional" {...register('pf_number')} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-1 space-y-3 border-t border-hairline pt-3">
                            <div>
                                <p className="mb-0.5 text-xs font-medium text-body">WhatsApp Number <span className="font-normal text-muted-foreground">(optional)</span></p>
                                <div className="flex gap-2">
                                    <div className="flex items-center whitespace-nowrap rounded-md border border-hairline bg-surface-soft px-2.5 text-xs font-medium text-body">+91</div>
                                    <Input type="tel" inputMode="numeric" placeholder="9898989898" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} maxLength={10} className="font-mono flex-1" />
                                    <select value={whatsappLang} onChange={(e) => setWhatsappLang(e.target.value as 'en' | 'hi' | 'gu')} className="rounded-md border border-hairline bg-surface px-2 text-xs text-body">
                                        <option value="en">EN</option>
                                        <option value="hi">HI</option>
                                        <option value="gu">GU</option>
                                    </select>
                                </div>
                            </div>
                            {whatsappPhone.length === 10 && (
                                <div className="flex items-start gap-2">
                                    <input type="checkbox" id="wa-consent" checked={whatsappConsent} onChange={(e) => setWhatsappConsent(e.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer rounded border-hairline text-saffron" />
                                    <label htmlFor="wa-consent" className="cursor-pointer text-xs leading-snug text-muted-foreground">Worker has consented to WhatsApp messages</label>
                                </div>
                            )}
                        </div>

                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>{t('common.cancel')}</Button>
                        <Button type="submit" disabled={mutation.isPending} className="transition-all">
                            {mutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('workers.adding')}</>) : t('workers.add_worker')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
