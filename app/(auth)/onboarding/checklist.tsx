'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
    CheckCircle2, Circle, ArrowRight, Loader2,
    Cpu, Layers, Users, Plus, Trash2, Upload,
    ChevronDown, ChevronUp, Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { addMachine } from '@/app/(dashboard)/owner/actions'
import { addQuality, loadSuratQualityTemplates } from '@/app/(dashboard)/owner/actions'
import { addMeterWorker } from '@/app/(dashboard)/supervisor/actions'
import { getOnboardingStatus } from '@/app/(auth)/actions/auth'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface OnboardingStatus {
    hasMachine: boolean
    hasQuality: boolean
    hasWorker: boolean
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

// ─── Quality Form ────────────────────────────────────────────────────────────────

interface QualityRow { name: string; target_yield: string; avg_sale_price: string; worker_rate: string }
const emptyQuality = (): QualityRow => ({ name: '', target_yield: '', avg_sale_price: '', worker_rate: '' })

function QualityForm({ onDone }: { onDone: () => void }) {
    const [qualities, setQualities] = useState<QualityRow[]>([emptyQuality()])
    const [bulkMode, setBulkMode] = useState(false)
    const [bulkText, setBulkText] = useState('')
    const [loadingTemplates, setLoadingTemplates] = useState(false)
    const [saving, setSaving] = useState(false)

    const updateRow = (i: number, field: keyof QualityRow, val: string) =>
        setQualities(q => q.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
    const addRow = () => setQualities(q => [...q, emptyQuality()])
    const removeRow = (i: number) => setQualities(q => q.filter((_, idx) => idx !== i))

    // CSV: name, target_yield, sale_price, worker_rate
    const parseBulk = () => {
        const rows = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
        if (rows.length === 0) { toast.error('No data found'); return }
        const parsed = rows.map(row => {
            const parts = row.split(/[,\t]/).map(p => p.trim())
            return { name: parts[0] || '', target_yield: parts[1] || '', avg_sale_price: parts[2] || '', worker_rate: parts[3] || '' }
        })
        setQualities(parsed)
        setBulkMode(false)
        toast.success(`Parsed ${parsed.length} qualities`)
    }

    const handleLoadTemplates = async () => {
        setLoadingTemplates(true)
        const res = await loadSuratQualityTemplates()
        setLoadingTemplates(false)
        if (res?.error) toast.error(res.error)
        else { toast.success('Surat quality templates loaded!'); onDone() }
    }

    const handleSave = async () => {
        const valid = qualities.filter(q => q.name.trim() && q.target_yield)
        if (valid.length === 0) { toast.error('Fill at least one quality name and yield'); return }
        setSaving(true)
        let allOk = true
        for (const q of valid) {
            const res = await addQuality({
                name: q.name.trim(),
                target_yield: Number(q.target_yield),
                avg_sale_price_per_m: Number(q.avg_sale_price || 0),
                default_worker_rate_per_m: Number(q.worker_rate || 0),
            })
            if (res?.error) { toast.error(`"${q.name}": ${res.error}`); allOk = false }
        }
        setSaving(false)
        if (allOk) { toast.success(`${valid.length} qualit${valid.length > 1 ? 'ies' : 'y'} added!`); onDone() }
    }

    return (
        <div className="space-y-4 pt-4 border-t border-gray-100">
            {/* Quick-load Surat templates */}
            <div className="flex items-center gap-2 p-3 bg-violet-50 rounded-lg border border-violet-100">
                <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
                <p className="text-xs text-violet-700 flex-1">Use Surat standard quality templates as a starting point</p>
                <Button type="button" size="sm" variant="outline"
                    onClick={handleLoadTemplates} disabled={loadingTemplates}
                    className="border-violet-300 text-violet-700 hover:bg-violet-100 text-xs shrink-0">
                    {loadingTemplates ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Load templates'}
                </Button>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">Or add manually</p>
                <Button type="button" variant="ghost" size="sm"
                    onClick={() => setBulkMode(b => !b)}
                    className="text-violet-700 hover:bg-violet-50 gap-1.5 text-xs">
                    <Upload className="h-3.5 w-3.5" />
                    {bulkMode ? 'Manual entry' : 'Bulk import (CSV)'}
                </Button>
            </div>

            <AnimatePresence mode="wait">
                {bulkMode ? (
                    <motion.div key="bulk"
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }} className="space-y-3"
                    >
                        <Label className="text-xs text-gray-600">
                            One per line: <span className="font-mono text-gray-500">Name, Target (m/kg), Sale Price, Worker Rate</span>
                        </Label>
                        <textarea
                            rows={5}
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                            placeholder={"60g Georgette, 9.5, 25, 12\nJapan Satin, 6.2, 45, 15"}
                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                        />
                        <Button type="button" size="sm" onClick={parseBulk}
                            className="bg-violet-600 hover:bg-violet-700 text-white">
                            Parse CSV
                        </Button>
                    </motion.div>
                ) : (
                    <motion.div key="manual"
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }} className="space-y-3"
                    >
                        {qualities.map((q, i) => (
                            <div key={i} className="p-3 border border-gray-100 rounded-lg bg-gray-50/50 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={q.name}
                                        placeholder="Quality name (e.g. 60g Georgette)"
                                        onChange={e => updateRow(i, 'name', e.target.value)}
                                        className="h-8 text-sm flex-1"
                                    />
                                    {qualities.length > 1 && (
                                        <button type="button" onClick={() => removeRow(i)}
                                            className="text-gray-300 hover:text-red-400">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <Label className="text-[10px] text-gray-400">Target m/kg</Label>
                                        <Input value={q.target_yield} type="number" placeholder="9.5"
                                            onChange={e => updateRow(i, 'target_yield', e.target.value)}
                                            className="h-8 text-sm" />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-gray-400">Sale ₹/m</Label>
                                        <Input value={q.avg_sale_price} type="number" placeholder="25"
                                            onChange={e => updateRow(i, 'avg_sale_price', e.target.value)}
                                            className="h-8 text-sm" />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-gray-400">Worker ₹/m</Label>
                                        <Input value={q.worker_rate} type="number" placeholder="12"
                                            onChange={e => updateRow(i, 'worker_rate', e.target.value)}
                                            className="h-8 text-sm" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={addRow}
                            className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-800 font-medium">
                            <Plus className="h-3.5 w-3.5" /> Add another quality
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <Button onClick={handleSave} disabled={saving}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white h-10 font-semibold">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : 'Save qualities'}
            </Button>
        </div>
    )
}

// ─── Worker Form ─────────────────────────────────────────────────────────────────

function WorkerForm({ onDone }: { onDone: () => void }) {
    const [workers, setWorkers] = useState([{ name: '' }])
    const [bulkText, setBulkText] = useState('')
    const [bulkMode, setBulkMode] = useState(false)
    const [saving, setSaving] = useState(false)

    const addRow = () => setWorkers(w => [...w, { name: '' }])
    const removeRow = (i: number) => setWorkers(w => w.filter((_, idx) => idx !== i))
    const updateRow = (i: number, val: string) =>
        setWorkers(w => w.map((r, idx) => idx === i ? { name: val } : r))

    const parseBulk = () => {
        const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
        if (lines.length === 0) { toast.error('No worker names found'); return }
        setWorkers(lines.map(name => ({ name })))
        setBulkMode(false)
        toast.success(`Parsed ${lines.length} worker names`)
    }

    const handleSave = async () => {
        const names = workers.map(w => w.name.trim()).filter(Boolean)
        if (names.length === 0) { toast.error('Enter at least one worker name'); return }
        setSaving(true)
        let allOk = true
        for (const name of names) {
            const res = await addMeterWorker({ name, pf_esi_eligible: false })
            if (res?.error) { toast.error(`"${name}": ${res.error}`); allOk = false }
        }
        setSaving(false)
        if (allOk) {
            toast.success(`${names.length} worker${names.length > 1 ? 's' : ''} added!`)
            onDone()
        }
    }

    return (
        <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Add piece-rate workers (set PF/ESI details later in Payroll)</p>
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
                        <Label className="text-xs text-gray-600">Paste worker names (one per line)</Label>
                        <textarea
                            rows={5}
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                            placeholder={"Ramesh Kumar\nSuresh Patel\nMahesh Verma"}
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
                        {workers.map((w, i) => (
                            <div key={i} className="flex gap-2">
                                <Input
                                    value={w.name}
                                    placeholder={`e.g. Ramesh Kumar`}
                                    onChange={e => updateRow(i, e.target.value)}
                                    className="h-9 text-sm"
                                />
                                {workers.length > 1 && (
                                    <button type="button" onClick={() => removeRow(i)}
                                        className="text-gray-300 hover:text-red-400 transition-colors">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button type="button" onClick={addRow}
                            className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-medium mt-1">
                            <Plus className="h-3.5 w-3.5" /> Add another worker
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <Button onClick={handleSave} disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-10 font-semibold">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : `Save ${workers.filter(w=>w.name.trim()).length || ''} worker${workers.filter(w=>w.name.trim()).length !== 1 ? 's' : ''}`}
            </Button>
        </div>
    )
}

// ─── Step Card ───────────────────────────────────────────────────────────────────

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
        key: 'hasQuality' as keyof OnboardingStatus,
        icon: Layers,
        title: 'Define yarn qualities',
        description: 'Qualities set target yield, sale price, and piece-rate for workers.',
        accentColor: 'violet',
        form: QualityForm,
    },
    {
        key: 'hasWorker' as keyof OnboardingStatus,
        icon: Users,
        title: 'Add your workers',
        description: 'Piece-rate workers tracked for production and payroll.',
        accentColor: 'emerald',
        form: WorkerForm,
    },
]

// ─── Main Component ───────────────────────────────────────────────────────────────

export default function OnboardingChecklist({ initialStatus }: Props) {
    const router = useRouter()
    const [status, setStatus] = useState<OnboardingStatus>(initialStatus)
    const [openStep, setOpenStep] = useState<string | null>(
        // Auto-open the first incomplete step
        STEPS.find(s => !initialStatus[s.key])?.key ?? null
    )
    const [refreshing, setRefreshing] = useState(false)
    const [completing, setCompleting] = useState(false)

    const completedCount = [status.hasMachine, status.hasQuality, status.hasWorker].filter(Boolean).length
    const progressPct = (completedCount / 3) * 100

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

    const handleStepDone = async (key: string) => {
        // Refresh status then auto-advance to the next incomplete step
        const res = await getOnboardingStatus()
        setStatus(res)
        if (res.isComplete) {
            toast.success('All done! 🎉')
            setOpenStep(null)
        } else {
            const next = STEPS.find(s => !res[s.key as keyof OnboardingStatus])
            setOpenStep(next?.key ?? null)
        }
    }

    const handleGoToDashboard = async () => {
        if (!status.isComplete) return
        setCompleting(true)
        const supabase = createClient()
        await supabase.auth.refreshSession()
        router.push('/owner/analytics')
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
                    <p className="text-gray-500 mt-1 text-sm">Complete these 3 steps to start tracking production</p>

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
                        <span className="text-sm font-semibold text-gray-700 tabular-nums w-8 text-right">
                            {completedCount}/3
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
                        }[step.accentColor]

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
