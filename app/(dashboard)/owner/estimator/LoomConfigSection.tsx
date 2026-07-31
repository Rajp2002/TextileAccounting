'use client'

/**
 * LoomConfigSection — Extracted from EstimatorClient for testability.
 *
 * Responsibilities:
 *  1. Loom type dropdown → auto-fills RPM, power kW, efficiency from LOOM_TYPE_DEFAULTS
 *  2. Hours per shift field (drives daily output preview)
 *  3. Live daily output preview: (rpm / picks) × 60 × hoursPerShift × efficiency
 *  4. "Apply" button → explains whether the daily result updates capacity or monthly overhead output
 *  5. "customised" badge when RPM/kW diverge from class defaults
 *  6. Validation: loomType === 'other' requires explicit RPM + kW before estimate saves
 *
 * Wiring contract (all state lives in EstimatorClient reducer):
 *   dispatch SET_LOOM_TYPE, SET_LOOM_RPM, SET_LOOM_POWER_KW, SET
 */

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Cpu, Zap, RotateCcw, ArrowRight } from 'lucide-react'
import { LOOM_TYPE_DEFAULTS, type LoomType, type EstimateState } from '@/lib/estimator'
import { calcDailyOutputM } from '@/lib/estimator-capacity'
import { parseNumericInput } from '@/lib/numeric-input'

export { calcDailyOutputM } from '@/lib/estimator-capacity'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface LoomConfigSectionProps {
    state: EstimateState
    totalPicks: number   // sum of picks across all weft rows — needed for daily output calc
    onSetLoomType:    (lt: LoomType | null) => void
    onSetLoomRpm:     (v: number | null) => void
    onSetLoomPowerKw: (v: number | null) => void
    onSetHoursPerShift: (v: number | null) => void
    onSuggestOutput: (computedDailyM: number) => void  // pushes value into avgOutputPerLoomPerDay
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Ordered list for the dropdown — most common Surat loom types first
const LOOM_TYPE_OPTIONS: { value: LoomType | ''; label: string }[] = [
    { value: '', label: '— Select loom type —' },
    { value: 'jacquard_electronic', label: 'Jacquard (Electronic) — 250 RPM' },
    { value: 'jacquard_mechanical', label: 'Jacquard (Mechanical) — 130 RPM' },
    { value: 'water_jet',           label: 'Water Jet — 700 RPM' },
    { value: 'rapier',              label: 'Rapier — 450 RPM' },
    { value: 'air_jet',             label: 'Air Jet — 900 RPM' },
    { value: 'dobby',               label: 'Dobby — 500 RPM' },
    { value: 'projectile',          label: 'Projectile — 280 RPM' },
    { value: 'other',               label: 'Other / Manual — enter RPM manually' },
]

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function LoomConfigSection({
    state,
    totalPicks,
    onSetLoomType,
    onSetLoomRpm,
    onSetLoomPowerKw,
    onSetHoursPerShift,
    onSuggestOutput,
}: LoomConfigSectionProps) {
    const { loomType, loomRpm, loomPowerKw, loomRpmIsCustomised, loomPowerKwIsCustomised, hoursPerShift } = state

    // Resolve effective efficiency for the selected loom type
    const classDefaults = loomType ? LOOM_TYPE_DEFAULTS[loomType] : null
    const efficiencyPct = classDefaults?.efficiencyPct ?? 80

    // Live daily output preview
    const dailyOutputM = calcDailyOutputM(loomRpm, totalPicks, hoursPerShift, efficiencyPct)

    // "Other" validation — RPM is required
    const isOther = loomType === 'other'
    const isOtherRpmMissing = isOther && (!loomRpm || loomRpm <= 0)
    const isOtherKwMissing  = isOther && (!loomPowerKw || loomPowerKw <= 0)

    return (
        <div className="space-y-4 rounded-[13px] border border-[#EFD7A4] bg-[#FFFBF2] p-4">
            {/* ── Header ── */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[#EFD7A4] bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)]">
                        <Cpu className="h-4 w-4" />
                    </span>
                    <p className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[var(--color-warning-amber)]">
                    Loom Type & Output
                    </p>
                </div>
                {loomType && (
                    <span className="text-[10px] font-semibold bg-white text-[var(--color-warning-amber)] px-2.5 py-1 rounded-full border border-[#EFD7A4] sm:ml-auto">
                        {LOOM_TYPE_DEFAULTS[loomType].label}
                    </span>
                )}
            </div>

            {/* ── Loom Type Dropdown ── */}
            <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-[var(--color-warning-amber)]">
                    Loom Type
                </Label>
                <select
                    id="loom-type-selector"
                    value={loomType ?? ''}
                    onChange={e => {
                        const val = e.target.value as LoomType | ''
                        onSetLoomType(val === '' ? null : val)
                    }}
                    className="w-full h-11 px-3 text-sm font-semibold border border-[#EFD7A4] rounded-[10px] bg-white focus:border-[var(--color-warning-amber)] focus:ring-1 focus:ring-[var(--color-warning-amber)]/20 focus:outline-none transition-all appearance-none cursor-pointer text-[var(--color-ink)]"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem', paddingRight: '2.5rem' }}
                >
                    {LOOM_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                {!loomType && (
                    <p className="text-[11px] text-[var(--color-muted)] font-medium">
                        Select your loom type to auto-fill RPM and power draw defaults.
                    </p>
                )}
            </div>

            {/* ── RPM + Power + Hours grid ── */}
            {loomType && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {/* RPM */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                            <Label className="text-[10px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)]">
                                RPM
                            </Label>
                            {loomRpmIsCustomised && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-[#EFD7A4] bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)] font-bold ml-auto">
                                    custom
                                </Badge>
                            )}
                        </div>
                        <div className="relative group">
                            <Input
                                id="loom-rpm-field"
                                type="number"
                                min={1}
                                step={10}
                                value={loomRpm ?? ''}
                                onChange={e => {
                                    const v = parseNumericInput(e.target.value, { min: 1 })
                                    onSetLoomRpm(v)
                                }}
                                placeholder={isOther ? 'Required' : '—'}
                                className={`h-9 text-xs font-mono font-bold text-center pr-10 bg-white transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-xl ${
                                    isOtherRpmMissing
                                        ? 'border-red-300 focus:border-red-400 focus:ring-red-200/30'
                                        : 'border-[#EFD7A4] focus:border-[var(--color-warning-amber)] focus:ring-[var(--color-warning-amber)]/20'
                                }`}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold pointer-events-none">
                                RPM
                            </span>
                        </div>
                        {isOtherRpmMissing && (
                            <p className="text-[9px] text-red-600 font-bold flex items-center gap-1">
                                <AlertTriangle className="h-2.5 w-2.5 shrink-0" /> Required for Other
                            </p>
                        )}
                        {!isOther && loomRpmIsCustomised && classDefaults?.rpm && (
                            <button
                                onClick={() => onSetLoomRpm(classDefaults.rpm)}
                                className="text-[9px] text-[var(--color-warning-amber)] hover:text-[var(--color-yarn-orange-dark)] underline flex items-center gap-0.5"
                            >
                                <RotateCcw className="h-2.5 w-2.5" /> Reset to {classDefaults.rpm}
                            </button>
                        )}
                    </div>

                    {/* Power kW */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                            <Label className="text-[10px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)]">
                                Power
                            </Label>
                            {loomPowerKwIsCustomised && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-[#EFD7A4] bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)] font-bold ml-auto">
                                    custom
                                </Badge>
                            )}
                        </div>
                        <div className="relative group">
                            <Input
                                id="loom-power-kw-field"
                                type="number"
                                min={0}
                                step={0.1}
                                value={loomPowerKw ?? ''}
                                onChange={e => {
                                    const v = parseNumericInput(e.target.value, { min: 0 })
                                    onSetLoomPowerKw(v)
                                }}
                                placeholder={isOther ? 'Required' : '—'}
                                className={`h-9 text-xs font-mono font-bold text-center pr-10 bg-white transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-xl ${
                                    isOtherKwMissing
                                        ? 'border-red-300 focus:border-red-400 focus:ring-red-200/30'
                                        : 'border-[#EFD7A4] focus:border-[var(--color-warning-amber)] focus:ring-[var(--color-warning-amber)]/20'
                                }`}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold pointer-events-none">
                                kW
                            </span>
                        </div>
                        {isOtherKwMissing && (
                            <p className="text-[9px] text-red-600 font-bold flex items-center gap-1">
                                <AlertTriangle className="h-2.5 w-2.5 shrink-0" /> Required for Other
                            </p>
                        )}
                        {!isOther && loomPowerKwIsCustomised && classDefaults?.powerKw && (
                            <button
                                onClick={() => onSetLoomPowerKw(classDefaults.powerKw)}
                                className="text-[9px] text-[var(--color-warning-amber)] hover:text-[var(--color-yarn-orange-dark)] underline flex items-center gap-0.5"
                            >
                                <RotateCcw className="h-2.5 w-2.5" /> Reset to {classDefaults.powerKw}
                            </button>
                        )}
                    </div>

                    {/* Hours per Shift */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)]">
                            Shift Hrs
                        </Label>
                        <div className="relative group">
                            <Input
                                id="hours-per-shift-field"
                                type="number"
                                min={1}
                                max={24}
                                step={1}
                                value={hoursPerShift ?? ''}
                                placeholder="12"
                                onChange={e => onSetHoursPerShift(parseNumericInput(e.target.value, { min: 1 }))}
                                className="h-9 text-xs font-mono font-bold text-center pr-10 bg-white border-[#EFD7A4] focus:border-[var(--color-warning-amber)] focus:ring-1 focus:ring-[var(--color-warning-amber)]/20 transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-[10px]"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold pointer-events-none">
                                h
                            </span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium">12h = 2 shifts</p>
                    </div>
                </div>
            )}

            {/* ── Daily Output Preview ── */}
            {loomType && (
                <div className="flex flex-col gap-3 rounded-[12px] border border-[#EFD7A4] bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-[9px] uppercase font-semibold text-[var(--color-warning-amber)] tracking-[0.06em] mb-0.5">
                            Est. Daily Output per Loom
                        </p>
                        {dailyOutputM !== null ? (
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-semibold font-mono text-[var(--color-warning-amber)] leading-none">
                                    {Math.round(dailyOutputM).toLocaleString('en-IN')}
                                </span>
                                <span className="text-xs font-bold text-slate-500">m/loom/day</span>
                            </div>
                        ) : (
                            <p className="text-sm font-bold text-slate-400 italic">
                                {totalPicks === 0 ? 'Set picks in Weft section' : 'Enter RPM above'}
                            </p>
                        )}
                        {dailyOutputM !== null && classDefaults?.efficiencyPct && (
                            <p className="text-[9px] text-slate-400 mt-0.5">
                                at {loomRpm} RPM · {totalPicks} picks · {hoursPerShift ?? 12}h · {classDefaults.efficiencyPct}% eff.
                            </p>
                        )}
                    </div>
                    {dailyOutputM !== null && dailyOutputM > 0 && (
                        <button
                            id="suggest-output-btn"
                            onClick={() => onSuggestOutput(Math.round(dailyOutputM))}
                            className="flex items-center justify-center gap-1.5 bg-[var(--color-warning-amber)] hover:bg-[var(--color-yarn-orange)] text-white text-[10px] font-bold px-3 py-2 rounded-lg transition-colors shadow-sm shrink-0"
                            title={state.overheadMode === 'monthly_expenses'
                                ? 'Apply this daily result to the monthly overhead output reference'
                                : 'Apply this daily result to the capacity reference'}
                        >
                            <Zap className="h-3 w-3" />
                            {state.overheadMode === 'monthly_expenses' ? 'Use for monthly output' : 'Use for capacity'}
                            <ArrowRight className="h-3 w-3" />
                        </button>
                    )}
                </div>
            )}

            {/* ── Context note: why this matters ── */}
            {loomType && (
                <div className="bg-white/65 border border-[#EFD7A4] rounded-lg px-3 py-2">
                    <p className="text-[10px] text-[var(--color-muted)] font-medium leading-snug">
                        <span className="font-black">Note:</span> Loom type here is a costing input — independent of which machines are assigned to this order. 
                        The <span className="font-bold">{state.overheadMode === 'monthly_expenses' ? 'Use for monthly output' : 'Use for capacity'}</span> button applies this result explicitly; it never replaces your actual output silently.
                    </p>
                </div>
            )}
        </div>
    )
}
