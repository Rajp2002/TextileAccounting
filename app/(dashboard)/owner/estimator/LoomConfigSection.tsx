'use client'

/**
 * LoomConfigSection — Extracted from EstimatorClient for testability.
 *
 * Responsibilities:
 *  1. Loom type dropdown → auto-fills RPM, power kW, efficiency from LOOM_TYPE_DEFAULTS
 *  2. Hours per shift field (drives daily output preview)
 *  3. Live daily output preview: (rpm / picks) × 60 × hoursPerShift × efficiency
 *  4. "Suggest" button → pushes computed daily output into avgOutputPerLoomPerDay
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

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface LoomConfigSectionProps {
    state: EstimateState
    totalPicks: number   // sum of picks across all weft rows — needed for daily output calc
    onSetLoomType:    (lt: LoomType | null) => void
    onSetLoomRpm:     (v: number | null) => void
    onSetLoomPowerKw: (v: number | null) => void
    onSetHoursPerShift: (v: number) => void
    onSuggestOutput: (computedDailyM: number) => void  // pushes value into avgOutputPerLoomPerDay
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** 
 * Calculate estimated daily output in metres.
 * Formula: (rpm / picks) × 60 min × hoursPerShift × (efficiency/100)
 * This matches the industry paper calculation used by Surat mills.
 */
export function calcDailyOutputM(
    rpm: number | null,
    picks: number,
    hoursPerShift: number,
    efficiencyPct: number
): number | null {
    if (!rpm || !picks || !hoursPerShift || rpm <= 0 || picks <= 0) return null
    return (rpm / picks) * 60 * hoursPerShift * (efficiencyPct / 100)
}

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
        <div className="rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50/40 p-4 space-y-4">
            {/* ── Header ── */}
            <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-violet-600" />
                <p className="text-[11px] uppercase tracking-widest font-black text-violet-700">
                    Loom Type & Output
                </p>
                {loomType && (
                    <span className="ml-auto text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200">
                        {LOOM_TYPE_DEFAULTS[loomType].label}
                    </span>
                )}
            </div>

            {/* ── Loom Type Dropdown ── */}
            <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider font-semibold text-violet-700/80">
                    Loom Type
                </Label>
                <select
                    id="loom-type-selector"
                    value={loomType ?? ''}
                    onChange={e => {
                        const val = e.target.value as LoomType | ''
                        onSetLoomType(val === '' ? null : val)
                    }}
                    className="w-full h-10 px-3 text-sm font-semibold border border-violet-200 rounded-xl bg-white focus:border-violet-400 focus:ring-1 focus:ring-violet-300/30 focus:outline-none transition-all appearance-none cursor-pointer text-slate-700"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem', paddingRight: '2.5rem' }}
                >
                    {LOOM_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                {!loomType && (
                    <p className="text-[9.5px] text-violet-600/70 font-medium">
                        Select your loom type to auto-fill RPM and power draw defaults.
                    </p>
                )}
            </div>

            {/* ── RPM + Power + Hours grid ── */}
            {loomType && (
                <div className="grid grid-cols-3 gap-3">
                    {/* RPM */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                                RPM
                            </Label>
                            {loomRpmIsCustomised && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-amber-300 bg-amber-50 text-amber-700 font-bold ml-auto">
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
                                    const v = e.target.value === '' ? null : Number(e.target.value)
                                    onSetLoomRpm(v)
                                }}
                                placeholder={isOther ? 'Required' : '—'}
                                className={`h-9 text-xs font-mono font-bold text-center pr-10 bg-white transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-xl ${
                                    isOtherRpmMissing
                                        ? 'border-red-300 focus:border-red-400 focus:ring-red-200/30'
                                        : 'border-violet-200 focus:border-violet-400 focus:ring-violet-200/30'
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
                                className="text-[9px] text-violet-500 hover:text-violet-700 underline flex items-center gap-0.5"
                            >
                                <RotateCcw className="h-2.5 w-2.5" /> Reset to {classDefaults.rpm}
                            </button>
                        )}
                    </div>

                    {/* Power kW */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                                Power
                            </Label>
                            {loomPowerKwIsCustomised && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-amber-300 bg-amber-50 text-amber-700 font-bold ml-auto">
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
                                    const v = e.target.value === '' ? null : Number(e.target.value)
                                    onSetLoomPowerKw(v)
                                }}
                                placeholder={isOther ? 'Required' : '—'}
                                className={`h-9 text-xs font-mono font-bold text-center pr-10 bg-white transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-xl ${
                                    isOtherKwMissing
                                        ? 'border-red-300 focus:border-red-400 focus:ring-red-200/30'
                                        : 'border-violet-200 focus:border-violet-400 focus:ring-violet-200/30'
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
                                className="text-[9px] text-violet-500 hover:text-violet-700 underline flex items-center gap-0.5"
                            >
                                <RotateCcw className="h-2.5 w-2.5" /> Reset to {classDefaults.powerKw}
                            </button>
                        )}
                    </div>

                    {/* Hours per Shift */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                            Shift Hrs
                        </Label>
                        <div className="relative group">
                            <Input
                                id="hours-per-shift-field"
                                type="number"
                                min={1}
                                max={24}
                                step={1}
                                value={hoursPerShift}
                                onChange={e => onSetHoursPerShift(Number(e.target.value) || 12)}
                                className="h-9 text-xs font-mono font-bold text-center pr-10 bg-white border-violet-200 focus:border-violet-400 focus:ring-1 focus:ring-violet-200/30 transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-xl"
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
                <div className="flex items-center justify-between bg-white/80 border border-violet-100 rounded-xl px-4 py-3">
                    <div>
                        <p className="text-[9px] uppercase font-black text-violet-600/70 tracking-wider mb-0.5">
                            Est. Daily Output per Loom
                        </p>
                        {dailyOutputM !== null ? (
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black font-mono text-violet-700 leading-none">
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
                                at {loomRpm} RPM · {totalPicks} picks · {hoursPerShift}h · {classDefaults.efficiencyPct}% eff.
                            </p>
                        )}
                    </div>
                    {dailyOutputM !== null && dailyOutputM > 0 && (
                        <button
                            id="suggest-output-btn"
                            onClick={() => onSuggestOutput(Math.round(dailyOutputM))}
                            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold px-3 py-2 rounded-lg transition-colors shadow-sm shrink-0"
                            title="Push this value into 'Avg Daily Output' in the Overhead section"
                        >
                            <Zap className="h-3 w-3" />
                            Suggest
                            <ArrowRight className="h-3 w-3" />
                        </button>
                    )}
                </div>
            )}

            {/* ── Context note: why this matters ── */}
            {loomType && (
                <div className="bg-violet-50/60 border border-violet-100 rounded-lg px-3 py-2">
                    <p className="text-[9.5px] text-violet-700/80 font-medium leading-snug">
                        <span className="font-black">Note:</span> Loom type here is a costing input — independent of which machines are assigned to this order. 
                        Use the <span className="font-bold">Suggest →</span> button to sync daily output into the Overhead section so overhead/m and electricity/m 
                        reflect your actual loom class, not a generic default.
                    </p>
                </div>
            )}
        </div>
    )
}
