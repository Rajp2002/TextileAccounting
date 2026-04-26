'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ShieldCheck, Loader2, Plus } from 'lucide-react'
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
import { useUserProfile } from '@/hooks/use-user-profile'
import { ComplianceNotice } from '@/components/compliance/ComplianceNotice'
import { logWorkerConsent } from '@/app/(dashboard)/owner/actions/compliance'

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
    const [complianceConsent, setComplianceConsent] = useState(false)
    const [activeNoticeId, setActiveNoticeId] = useState<string | null>(null)
    const [granularConsent, setGranularConsent] = useState<Record<string, boolean>>({})
    const [whatsappPhone, setWhatsappPhone] = useState('')
    const [whatsappLang, setWhatsappLang] = useState<'en' | 'hi' | 'gu'>('en')
    const [whatsappConsent, setWhatsappConsent] = useState(false)
    
    const supabase = createClient()
    const queryClient = useQueryClient()
    const { t } = useTranslation()
    const { data: userProfile } = useUserProfile()

    const isSupervisor = userProfile?.role === 'supervisor'

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
    const workerName = watch('name')

    const mutation = useMutation({
        mutationFn: async (data: WorkerFormValues) => {
            let result;
            if (data.workerType === 'meter') {
                result = await addMeterWorker({
                    name: data.name.trim(),
                    pf_esi_eligible: data.pf_esi_eligible,
                    esi_number: data.esi_number?.trim() || null,
                    pf_number: data.pf_number?.trim() || null,
                })
            } else {
                result = await addFixedWorker({
                    name: data.name.trim(),
                    role: data.role === 'other' ? data.customRole?.trim() || '' : data.role || '',
                    monthly_salary: data.salary as number,
                    pf_esi_eligible: data.pf_esi_eligible,
                    esi_number: data.esi_number?.trim() || null,
                    pf_number: data.pf_number?.trim() || null,
                })
            }
            if (result.error) throw new Error(result.error)
            const workerId = (result as any).workerId as number

            // DPDP 2026: Log Granular Consent Artifact
            if (activeNoticeId) {
                await logWorkerConsent(workerId, activeNoticeId, 'CLIENT_IP_PLACEHOLDER', granularConsent)
            }

            return { ...data, workerId }
        },
        onSuccess: async (data) => {
            toast.success(`${data.name}${t('workers.added_success')}`)
            queryClient.invalidateQueries({ queryKey: ['workers'] })
            queryClient.invalidateQueries({ queryKey: ['fixed_workers'] })
            queryClient.invalidateQueries({ queryKey: ['fixed_workers_list'] })
            queryClient.invalidateQueries({ queryKey: ['fixed_payroll'] })
            queryClient.invalidateQueries({ queryKey: ['daily_workers'] })

            if (whatsappPhone.length === 10 && whatsappConsent && data.workerId) {
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
            setAgeConfirmed(false)
            setComplianceConsent(false)
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
        if (defaultSalary !== undefined && val !== 'other') {
            setValue('salary', defaultSalary)
        } else if (val === 'other') {
            setValue('salary', 0)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) { reset(); setAgeConfirmed(false); setComplianceConsent(false) } }}>
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
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="name">
                                {t('workers.worker_name')} <span className="text-red-500">*</span>
                            </Label>
                            <Input id="name" placeholder={t('workers.name_placeholder')} {...register('name')} autoFocus />
                            {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
                        </div>

                        {workerType === 'fixed' && (
                            <>
                                <div className="grid gap-2">
                                    <Label>{t('workers.role')} <span className="text-red-500">*</span></Label>
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
                                    {(errors as any).role && <span className="text-xs text-red-500">{(errors as any).role.message}</span>}
                                </div>
                                {selectedRole === 'other' && (
                                    <div className="grid gap-2">
                                        <Label>{t('workers.custom_role_name')} <span className="text-red-500">*</span></Label>
                                        <Input placeholder={t('workers.custom_role_placeholder')} {...register('customRole')} />
                                        {(errors as any).customRole && <span className="text-xs text-red-500">{(errors as any).customRole.message}</span>}
                                    </div>
                                )}
                                <div className="grid gap-2">
                                    <Label>{t('workers.monthly_salary')} <span className="text-red-500">*</span></Label>
                                    <Input type="number" placeholder={t('workers.salary_placeholder')} {...register('salary')} />
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
                        
                        <div className="border-t border-gray-100 pt-3 mt-1">
                            <div className="flex items-center gap-2 mb-3">
                                <Controller
                                    name="pf_esi_eligible"
                                    control={control}
                                    render={({ field }) => (
                                        <input type="checkbox" id="pf_esi_eligible" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-teal-600 cursor-pointer" />
                                    )}
                                />
                                <Label htmlFor="pf_esi_eligible" className="cursor-pointer font-medium text-gray-700">Eligible for ESI / PF Benefits?</Label>
                            </div>
                            {watchedPfEsiEligible && (
                                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">ESI Number</Label>
                                        <Input className="h-8 text-sm" placeholder="Optional" {...register('esi_number')} />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">PF Number</Label>
                                        <Input className="h-8 text-sm" placeholder="Optional" {...register('pf_number')} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-100 pt-3 mt-1 space-y-3">
                            <div>
                                <p className="text-xs font-medium text-gray-700 mb-0.5">WhatsApp Number <span className="text-gray-400 font-normal">(optional)</span></p>
                                <div className="flex gap-2">
                                    <div className="flex items-center px-2.5 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600 font-medium whitespace-nowrap">+91</div>
                                    <Input type="tel" inputMode="numeric" placeholder="9898989898" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} maxLength={10} className="font-mono flex-1" />
                                    <select value={whatsappLang} onChange={(e) => setWhatsappLang(e.target.value as 'en' | 'hi' | 'gu')} className="border border-gray-200 rounded-md text-xs px-2 bg-white text-gray-700">
                                        <option value="en">EN</option>
                                        <option value="hi">HI</option>
                                        <option value="gu">GU</option>
                                    </select>
                                </div>
                            </div>
                            {whatsappPhone.length === 10 && (
                                <div className="flex items-start gap-2">
                                    <input type="checkbox" id="wa-consent" checked={whatsappConsent} onChange={(e) => setWhatsappConsent(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 cursor-pointer" />
                                    <label htmlFor="wa-consent" className="text-xs text-gray-500 leading-snug cursor-pointer">Worker has consented to WhatsApp messages</label>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-100 pt-4 mt-2 space-y-4">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-blue-600" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Legal Compliance (DPDP 2026)</h3>
                            </div>
                            <ComplianceNotice 
                                type="consent" 
                                workerName={workerName} 
                                onConsentChange={(given, id, granular) => {
                                    setComplianceConsent(given)
                                    setActiveNoticeId(id)
                                    if (granular) setGranularConsent(granular)
                                }} 
                            />
                            <div className="flex items-start gap-2.5 px-1">
                                <input type="checkbox" id="age-confirm" checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                                <label htmlFor="age-confirm" className="text-xs text-gray-500 leading-snug cursor-pointer">I confirm this worker is 18 years of age or older</label>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>{t('common.cancel')}</Button>
                        <Button type="submit" disabled={mutation.isPending || !ageConfirmed || !complianceConsent} className={cn("transition-all", ageConfirmed && complianceConsent ? "bg-blue-600 hover:bg-blue-700" : "")}>
                            {mutation.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('workers.adding')}</>) : t('workers.add_worker')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
