'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
    CheckCircle2, ArrowRight, Loader2,
    Cpu, Layers, Users, Plus, Trash2, Upload,
    ChevronDown, ChevronUp, CreditCard, Sparkles, Star, Zap, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { addMachine, saveWorkerWhatsApp } from '@/app/(dashboard)/owner/actions'
import { addMeterWorker } from '@/app/(dashboard)/supervisor/actions'
import { savePayrollConfig } from '@/app/(dashboard)/owner/payroll/actions'
import { getOnboardingStatus, markOnboardingComplete } from '@/app/(auth)/actions/auth'
import { TrialButton } from '@/components/billing/TrialButton'
import { SubscribeButton } from '@/components/billing/SubscribeButton'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface OnboardingStatus {
    hasMachine: boolean
    hasWorker: boolean
    hasPayrollConfig: boolean
    hasPlan: boolean
    isComplete: boolean
}

interface Props { initialStatus: OnboardingStatus }

// ─── Machine Form ────────────────────────────────────────────────────────────────

function MachineForm({ onDone }: { onDone: () => void }) {
    const [machines, setMachines] = useState([{ name: '' }])
    const [bulkText, setBulkText] = useState('')
    const [bulkMode, setBulkMode] = useState(false)
    const [saving, setSaving] = useState(false)

    const addRow = () => setMachines(m => [...m, { name: '' }])
    const removeRow = (i: number) => setMachines(m => m.filter((_, idx) => idx !== i))
    const updateRow = (i: number, val: string) =>
        setMachines(m => m.map((r, idx) => idx === i ? { name: val } : r))

    const parseBulk = () => {
        const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
        if (lines.length === 0) { toast.error('No machine names found'); return }
        setMachines(lines.map(name => ({ name })))
        setBulkMode(false)
        toast.success(`Parsed ${lines.length} machine names`)
    }

    const handleSave = async () => {
        const names = machines.map(m => m.name.trim()).filter(Boolean)
        if (names.length === 0) { toast.error('Enter at least one machine name'); return }
        setSaving(true)
        let allOk = true
        for (const name of names) {
            const res = await addMachine(name)
            if (res?.error) { toast.error(`"${name}": ${res.error}`); allOk = false }
        }
        setSaving(false)
        if (allOk) {
            toast.success(`${names.length} machine${names.length > 1 ? 's' : ''} added!`)
            onDone()
        }
    }

    return (
        <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Add machines one by one or paste a list</p>
                <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => setBulkMode(b => !b)}
                    className="text-amber-700 hover:text-amber-800 hover:bg-amber-50 gap-1.5 text-xs"
                >
                    <Upload className="h-3.5 w-3.5" />
                    {bulkMode ? 'Manual entry' : 'Bulk import'}
                </Button>
            </div>

            <AnimatePresence mode="wait">
                {bulkMode ? (
                    <motion.div key="bulk"
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }} className="space-y-3"
                    >
                        <Label className="text-xs text-gray-600">Paste machine names (one per line)</Label>
                        <textarea
                            rows={5}
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                            placeholder={"Machine 1\nMachine 2\nMachine 3"}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
                        />
                        <Button type="button" size="sm" onClick={parseBulk}
                            className="bg-amber-600 hover:bg-amber-700 text-white">
                            Parse list
                        </Button>
                    </motion.div>
                ) : (
                    <motion.div key="manual"
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }} className="space-y-2"
                    >
                        {machines.map((m, i) => (
                            <div key={i} className="flex gap-2">
                                <Input
                                    value={m.name}
                                    placeholder={`e.g. Machine ${i + 1}`}
                                    onChange={e => updateRow(i, e.target.value)}
                                    className="h-9 text-sm"
                                />
                                {machines.length > 1 && (
                                    <button type="button" onClick={() => removeRow(i)}
                                        className="text-gray-300 hover:text-red-400 transition-colors">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button type="button" onClick={addRow}
                            className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-medium mt-1">
                            <Plus className="h-3.5 w-3.5" /> Add another machine
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <Button onClick={handleSave} disabled={saving}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white h-10 font-semibold">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : `Save ${machines.filter(m=>m.name.trim()).length || ''} machine${machines.filter(m=>m.name.trim()).length !== 1 ? 's' : ''}`}
            </Button>
        </div>
    )
}

// ─── Worker Form ─────────────────────────────────────────────────────────────────

interface WorkerRow { name: string; phone: string }
const emptyWorker = (): WorkerRow => ({ name: '', phone: '' })

function WorkerForm({ onDone }: { onDone: () => void }) {
    const [workers, setWorkers] = useState<WorkerRow[]>([emptyWorker()])
    const [bulkText, setBulkText] = useState('')
    const [bulkMode, setBulkMode] = useState(false)
    const [consentGiven, setConsentGiven] = useState(false)
    const [saving, setSaving] = useState(false)

    const addRow = () => setWorkers(w => [...w, emptyWorker()])
    const removeRow = (i: number) => setWorkers(w => w.filter((_, idx) => idx !== i))
    const updateRow = (i: number, field: keyof WorkerRow, val: string) =>
        setWorkers(w => w.map((r, idx) => idx === i ? { ...r, [field]: val } : r))

    // Bulk: each line is either "Name" or "Name, 9876543210"
    const parseBulk = () => {
        const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
        if (lines.length === 0) { toast.error('No worker names found'); return }
        const parsed: WorkerRow[] = lines.map(line => {
            const parts = line.split(/[,\t]/).map(p => p.trim())
            return { name: parts[0] || '', phone: parts[1] || '' }
        })
        setWorkers(parsed)
        setBulkMode(false)
        toast.success(`Parsed ${parsed.length} worker${parsed.length > 1 ? 's' : ''}`)
    }

    const handleSave = async () => {
        const valid = workers.filter(w => w.name.trim())
        if (valid.length === 0) { toast.error('Enter at least one worker name'); return }

        // Validate phone numbers if provided
        const phoneWorkers = valid.filter(w => w.phone.trim())
        const badPhones = phoneWorkers.filter(w => w.phone.replace(/\D/g, '').length !== 10)
        if (badPhones.length > 0) {
            toast.error(`Invalid phone for: ${badPhones.map(w => w.name).join(', ')} — must be 10 digits`)
            return
        }

        // Consent is required if ANY phone number is being saved
        if (phoneWorkers.length > 0 && !consentGiven) {
            toast.error('Please confirm consent before saving phone numbers')
            return
        }

        setSaving(true)

        // Phase 1: Insert all workers in parallel (eliminates N serial roundtrips)
        const results = await Promise.all(
            valid.map(worker => addMeterWorker({ name: worker.name.trim(), pf_esi_enrolled: false }))
        )

        // Check for any insert errors
        const errors = results
            .map((res, i) => res?.error ? `"${valid[i].name}": ${res.error}` : null)
            .filter(Boolean) as string[]

        if (errors.length > 0) {
            errors.forEach(e => toast.error(e))
            setSaving(false)
            return
        }

        // Phase 2: Save phone numbers in parallel (non-fatal — workers already created)
        if (phoneWorkers.length > 0) {
            await Promise.all(
                valid.map((worker, i) => {
                    const cleanPhone = worker.phone.replace(/\D/g, '')
                    const workerId = results[i]?.workerId
                    if (!cleanPhone || !workerId) return Promise.resolve()
                    return saveWorkerWhatsApp({
                        workerId,
                        workerType: 'meter',
                        phone: cleanPhone,
                        language: 'hi',
                        consentGiven: true,
                    }).catch(err => console.warn(`Phone save failed for ${worker.name}:`, err))
                })
            )
        }

        setSaving(false)
        toast.success(`${valid.length} worker${valid.length > 1 ? 's' : ''} added!`)
        onDone()
    }

    const hasAnyPhone = workers.some(w => w.phone.trim())
    const validCount = workers.filter(w => w.name.trim()).length

    return (
        <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                    Add piece-rate workers <span className="text-gray-400">(PF/ESI details can be set later in Payroll)</span>
                </p>
                <Button type="button" variant="ghost" size="sm"
                    onClick={() => setBulkMode(b => !b)}
                    className="text-emerald-700 hover:bg-emerald-50 gap-1.5 text-xs">
                    <Upload className="h-3.5 w-3.5" />
                    {bulkMode ? 'Manual entry' : 'Bulk import'}
                </Button>
            </div>

            <AnimatePresence mode="wait">
                {bulkMode ? (
                    <motion.div key="bulk"
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }} className="space-y-3"
                    >
                        <Label className="text-xs text-gray-600">
                            One per line: <span className="font-mono text-gray-500">Name</span> or <span className="font-mono text-gray-500">Name, PhoneNumber</span>
                        </Label>
                        <textarea
                            rows={5}
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                            placeholder={"Ramesh Kumar, 9876543210\nSuresh Patel\nMahesh Verma, 9123456789"}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                        />
                        <Button type="button" size="sm" onClick={parseBulk}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            Parse list
                        </Button>
                    </motion.div>
                ) : (
                    <motion.div key="manual"
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }} className="space-y-2"
                    >
                        {/* Column headers */}
                        <div className="grid grid-cols-[1fr_140px_20px] gap-2 px-0.5">
                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Worker name</span>
                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Phone (optional)</span>
                            <span />
                        </div>

                        {workers.map((w, i) => (
                            <div key={i} className="grid grid-cols-[1fr_140px_20px] gap-2 items-center">
                                <Input
                                    value={w.name}
                                    placeholder="Ramesh Kumar"
                                    onChange={e => updateRow(i, 'name', e.target.value)}
                                    className="h-9 text-sm"
                                />
                                <Input
                                    value={w.phone}
                                    type="tel"
                                    placeholder="9876543210"
                                    maxLength={10}
                                    onChange={e => updateRow(i, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    className="h-9 text-sm font-mono"
                                />
                                {workers.length > 1 ? (
                                    <button type="button" onClick={() => removeRow(i)}
                                        className="text-gray-300 hover:text-red-400 transition-colors">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                ) : <span />}
                            </div>
                        ))}
                        <button type="button" onClick={addRow}
                            className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium mt-1">
                            <Plus className="h-3.5 w-3.5" /> Add another worker
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PII Consent checkbox — appears when any phone number is entered */}
            <AnimatePresence>
                {hasAnyPhone && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                    >
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={consentGiven}
                                onChange={e => setConsentGiven(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 accent-amber-600 shrink-0 cursor-pointer"
                            />
                            <span className="text-xs text-amber-800 leading-relaxed">
                                <span className="font-semibold">Consent Declaration:</span> I confirm that I have obtained the informed consent of each worker listed above to collect, store, and use their personal contact information (phone number) within this platform, in accordance with applicable data protection regulations including the DPDP Act, 2023.
                            </span>
                        </label>
                    </motion.div>
                )}
            </AnimatePresence>

            <Button
                onClick={handleSave}
                disabled={saving || (hasAnyPhone && !consentGiven) || validCount === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-10 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {saving
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                    : `Save ${validCount || ''} worker${validCount !== 1 ? 's' : ''}`
                }
            </Button>

            {hasAnyPhone && !consentGiven && (
                <p className="text-[11px] text-center text-amber-600">
                    ↑ Confirm consent above to enable saving
                </p>
            )}
        </div>
    )
}

// ─── Payroll Cycle Form ────────────────────────────────────────────────────────

function PayrollCycleForm({ onDone }: { onDone: () => void }) {
    const [day, setDay] = useState<number | null>(null)
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (!day) { toast.error('Please select a start day'); return }
        setSaving(true)
        const res = await savePayrollConfig(day)
        setSaving(false)
        if (res?.error) {
            toast.error(res.error)
        } else {
            toast.success('Payroll cycle configured!')
            onDone()
        }
    }

    return (
        <div className="space-y-6 pt-4 border-t border-gray-100">
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 flex gap-3">
                <Calendar className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-violet-900">Why does this matter?</p>
                    <p className="text-xs text-violet-700 leading-relaxed">
                        This defines your monthly payroll period. For example, if you pick <span className="font-bold">15th</span>, 
                        your payroll for March will run from <span className="font-bold italic">15th Feb to 14th March</span>.
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                <Label className="text-xs text-gray-400 font-black uppercase tracking-widest">Select Cycle Start Day</Label>
                <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => setDay(d)}
                            className={cn(
                                "h-10 rounded-lg text-sm font-bold transition-all border",
                                day === d 
                                    ? "bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-100 scale-105" 
                                    : "bg-white border-gray-200 text-gray-600 hover:border-violet-300 hover:bg-violet-50/50"
                            )}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight text-center">Common Settings</p>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setDay(15)}
                        className="flex-1 py-2.5 rounded-xl border border-dashed border-violet-300 bg-violet-50/30 text-violet-700 text-xs font-bold hover:bg-violet-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        Surat Style (15th)
                    </button>
                    <button
                        type="button"
                        onClick={() => setDay(1)}
                        className="flex-1 py-2.5 rounded-xl border border-dashed border-gray-300 bg-gray-50/30 text-gray-700 text-xs font-bold hover:bg-gray-50 transition-colors"
                    >
                        Standard (1st)
                    </button>
                </div>
            </div>

            <Button 
                onClick={handleSave} 
                disabled={saving || !day}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white h-12 font-black uppercase tracking-widest shadow-lg shadow-violet-100"
            >
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : 'Save Payroll Config'}
            </Button>
        </div>
    )
}

 // ─── Plan Selection Form ──────────────────────────────────────────────────────────
 

const BASE_PLAN_ID    = process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_BASE    ?? ''
const PREMIUM_PLAN_ID = process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_PREMIUM ?? ''

function PlanSelectionForm({ onDone }: { onDone: () => void }) {
    const [trialEnd, setTrialEnd] = useState<string | null>(null)

    const trialEndFormatted = trialEnd
        ? new Date(trialEnd).toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
        : null

    if (trialEnd) {
        return (
            <div className="pt-4 border-t border-gray-100 space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        7-day Premium trial activated!
                    </p>
                    <p className="text-sm text-emerald-700 mt-1">
                        Your trial ends on <strong>{trialEndFormatted}</strong>.
                        You can subscribe anytime from the Billing page.
                    </p>
                </div>
                <Button
                    onClick={onDone}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white h-10 font-semibold"
                >
                    Continue to dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        )
    }

    return (
        <div className="pt-4 border-t border-gray-100 space-y-4">
            <p className="text-sm text-gray-500">Choose how you'd like to get started</p>

            {/* Free trial option */}
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <span className="font-semibold text-emerald-900 text-sm">7-Day Free Trial</span>
                    <span className="ml-auto bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">RECOMMENDED</span>
                </div>
                <p className="text-xs text-emerald-700">Full Premium access for 7 days. No credit card required.</p>
                <TrialButton
                    compact
                    onSuccess={(end) => { setTrialEnd(end) }}
                />
            </div>

            <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-gray-200" />
                <span className="mx-3 text-xs text-gray-400">or start a paid plan</span>
                <div className="flex-grow border-t border-gray-200" />
            </div>

            {/* Paid plan options */}
            <div className="grid grid-cols-1 gap-3">
                {/* Base */}
                {BASE_PLAN_ID && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-2 min-w-0">
                            <Zap className="h-5 w-5 sm:h-4 sm:w-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Base</p>
                                <p className="text-xs text-gray-500">₹2,360/mo incl. GST · Estimator only</p>
                            </div>
                        </div>
                        <div className="w-full sm:w-auto shrink-0">
                            <SubscribeButton
                                planId={BASE_PLAN_ID}
                                tierName="Base"
                                displayAmount="₹2,360/mo"
                                onSuccess={() => onDone()}
                            />
                        </div>
                    </div>
                )}
                {/* Premium */}
                {PREMIUM_PLAN_ID && (
                    <div className="rounded-xl border-2 border-amber-300 bg-amber-50/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-2 min-w-0">
                            <Star className="h-5 w-5 sm:h-4 sm:w-4 text-amber-500 fill-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Premium</p>
                                <p className="text-xs text-gray-500">₹5,900/mo incl. GST · Full access</p>
                            </div>
                        </div>
                        <div className="w-full sm:w-auto shrink-0">
                            <SubscribeButton
                                planId={PREMIUM_PLAN_ID}
                                tierName="Premium"
                                displayAmount="₹5,900/mo"
                                onSuccess={() => onDone()}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

const STEPS = [
    {
        key: 'hasMachine' as keyof OnboardingStatus,
        icon: Cpu,
        title: 'Add your machines',
        description: 'Machines are the primary production units. Add all looms/machines in your factory.',
        accentColor: 'amber',
        form: MachineForm,
    },
    {
        key: 'hasWorker' as keyof OnboardingStatus,
        icon: Users,
        title: 'Add your workers',
        description: 'Piece-rate workers tracked for production and payroll.',
        accentColor: 'emerald',
        form: WorkerForm,
    },
    {
        key: 'hasPayrollConfig' as keyof OnboardingStatus,
        icon: Calendar,
        title: 'Set your pay cycle',
        description: 'Define the monthly start day for payroll calculations (Standard or Surat-style).',
        accentColor: 'violet',
        form: PayrollCycleForm,
    },
    {
        key: 'hasPlan' as keyof OnboardingStatus,
        icon: CreditCard,
        title: 'Choose your plan',
        description: 'Start a free 7-day trial or subscribe immediately. No card required for trial.',
        accentColor: 'amber',
        form: PlanSelectionForm,
    },
]

// ─── Main Component ───────────────────────────────────────────────────────────────

export default function OnboardingChecklist({ initialStatus }: Props) {
    const [status, setStatus] = useState<OnboardingStatus>(initialStatus)
    const [openStep, setOpenStep] = useState<string | null>(
        // Auto-open the first incomplete step
        STEPS.find(s => !initialStatus[s.key])?.key ?? null
    )
    const [refreshing, setRefreshing] = useState(false)
    const [completing, setCompleting] = useState(false)

    const completedCount = [status.hasMachine, status.hasWorker, status.hasPayrollConfig, status.hasPlan].filter(Boolean).length
    const progressPct = (completedCount / 4) * 100

    const refresh = async () => {
        setRefreshing(true)
        try {
            const newStatus = await getOnboardingStatus()
            setStatus(newStatus)
            if (newStatus.isComplete) {
                toast.success('Setup complete! You can now go to the dashboard.')
                setOpenStep(null)
            }
        } catch {
            toast.error('Failed to refresh. Please try again.')
        } finally {
            setRefreshing(false)
        }
    }

    const handleStepDone = (key: string) => {
        // Update state LOCALLY — do NOT call getOnboardingStatus() here.
        // It's a server action; Next.js triggers router.refresh() after it,
        // which re-renders page.tsx on the server and causes the auto-redirect
        // blank-page issue. Local state is sufficient: each form only calls
        // this after its own save succeeds, so we know that step is complete.
        const newStatus = { ...status, [key]: true }
        newStatus.isComplete = newStatus.hasMachine && newStatus.hasWorker && newStatus.hasPayrollConfig && newStatus.hasPlan
        setStatus(newStatus)
        if (newStatus.isComplete) {
            toast.success('All done! 🎉 Click "Go to dashboard" to continue.')
            setOpenStep(null)
        } else {
            const next = STEPS.find(s => !newStatus[s.key as keyof OnboardingStatus])
            setOpenStep(next?.key ?? null)
        }
    }


    const handleGoToDashboard = async () => {
        if (!status.isComplete) return
        setCompleting(true)

        // Step 1: Mark onboarding complete in DB (non-fatal).
        // The middleware has a DB fallback that reads onboarding_complete directly
        // from the organizations table, so even if this call fails the user will
        // still reach the dashboard on the next page load.
        // getOnboardingStatus() (called on page render) already sets the flag
        // when both machine and worker exist — so this is belt-and-suspenders.
        try {
            const markRes = await markOnboardingComplete()
            if (markRes?.error) {
                // Log the specific error but DO NOT block navigation.
                // The middleware DB fallback will handle it.
                console.warn('[OnboardingChecklist] markOnboardingComplete returned error:', markRes.error)
            }
        } catch (e) {
            // Server action threw (e.g. missing env var, network blip).
            // Non-fatal — proceed to navigate; middleware DB fallback handles auth.
            console.warn('[OnboardingChecklist] markOnboardingComplete threw (non-fatal):', e)
        }

        // Step 2: Refresh JWT so middleware sees onboarding_complete=true (non-fatal)
        try {
            const supabase = createClient()
            await supabase.auth.refreshSession()
        } catch (err) {
            console.warn('[OnboardingChecklist] Session refresh failed, proceeding anyway:', err)
        }

        // Step 3: Hard navigation — gives middleware a fresh full-page request
        // so the DB fallback (reading onboarding_complete from DB) runs correctly.
        window.location.href = '/owner/analytics'
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-amber-50/20 flex items-start justify-center p-4 pt-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-xl"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 mb-4 shadow-sm">
                        <Layers className="h-7 w-7 text-amber-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Set up your factory</h1>
                    <p className="text-gray-500 mt-1 text-sm">Complete these 4 steps to start tracking production</p>

                    {/* Progress */}
                    <div className="mt-5 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPct}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                        </div>
                        <span className="text-sm font-semibold text-gray-700 tabular-nums w-12 text-right">
                            {completedCount}/4
                        </span>
                    </div>
                </div>

                {/* Steps */}
                <div className="space-y-3 mb-6">
                    {STEPS.map((step, i) => {
                        const done = !!status[step.key]
                        const isOpen = openStep === step.key
                        const Icon = step.icon
                        const FormComponent = step.form

                        const accent = {
                            amber: { border: 'border-amber-300 bg-amber-50/30', badge: 'bg-amber-100 text-amber-700', btn: 'text-amber-700 hover:bg-amber-50' },
                            violet: { border: 'border-violet-300 bg-violet-50/30', badge: 'bg-violet-100 text-violet-700', btn: 'text-violet-700 hover:bg-violet-50' },
                            emerald: { border: 'border-emerald-300 bg-emerald-50/30', badge: 'bg-emerald-100 text-emerald-700', btn: 'text-emerald-700 hover:bg-emerald-50' },
                        }[step.accentColor]!

                        return (
                            <motion.div
                                key={step.key}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.07 }}
                                className={cn(
                                    'rounded-xl border-2 overflow-hidden transition-all duration-200',
                                    done ? 'border-emerald-200 bg-emerald-50/40' :
                                    isOpen ? accent.border + ' shadow-sm' :
                                    'border-gray-200 bg-white hover:border-gray-300'
                                )}
                            >
                                {/* Step header */}
                                <button
                                    type="button"
                                    disabled={done}
                                    onClick={() => setOpenStep(isOpen ? null : step.key)}
                                    className="w-full text-left p-4 flex items-center gap-4"
                                >
                                    {/* Icon */}
                                    <div className={cn(
                                        'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                                        done ? 'bg-emerald-100' : 'bg-gray-100'
                                    )}>
                                        {done
                                            ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                            : <Icon className="h-5 w-5 text-gray-500" />
                                        }
                                    </div>

                                    {/* Text */}
                                    <div className="flex-1 min-w-0">
                                        <p className={cn(
                                            'font-semibold text-sm',
                                            done ? 'text-emerald-700 line-through decoration-1' : 'text-gray-900'
                                        )}>
                                            {step.title}
                                        </p>
                                        {!done && (
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                                {step.description}
                                            </p>
                                        )}
                                        {done && <p className="text-xs text-emerald-600 mt-0.5 font-medium">Done ✓</p>}
                                    </div>

                                    {/* Chevron / badge */}
                                    {!done && (
                                        <div className="shrink-0">
                                            {isOpen
                                                ? <ChevronUp className="h-4 w-4 text-gray-400" />
                                                : <ChevronDown className="h-4 w-4 text-gray-400" />
                                            }
                                        </div>
                                    )}
                                </button>

                                {/* Expandable form */}
                                <AnimatePresence>
                                    {isOpen && !done && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.22, ease: 'easeInOut' }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-4 pb-4">
                                                <FormComponent onDone={() => handleStepDone(step.key)} />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )
                    })}
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <Button
                        id="go-to-dashboard-btn"
                        onClick={handleGoToDashboard}
                        disabled={!status.isComplete || completing}
                        className={cn(
                            'w-full h-12 text-base font-semibold transition-all',
                            status.isComplete
                                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-200'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        )}
                    >
                        {completing ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading dashboard...</>
                        ) : (
                            <span className="flex items-center gap-2">
                                Go to dashboard <ArrowRight className="h-4 w-4" />
                            </span>
                        )}
                    </Button>

                    <Button
                        variant="ghost" size="sm" onClick={refresh}
                        disabled={refreshing || completing}
                        className="w-full text-gray-400 hover:text-gray-600 text-xs"
                    >
                        {refreshing
                            ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Checking...</>
                            : 'Refresh status'
                        }
                    </Button>
                </div>

                <p className="text-center text-xs text-gray-400 mt-5 pb-8">
                    All data can be edited later from the management pages.
                </p>
            </motion.div>
        </div>
    )
}
