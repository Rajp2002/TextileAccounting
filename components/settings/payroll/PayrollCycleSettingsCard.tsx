'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle,
    Loader2,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { toast, userFacingError } from '@/lib/app-notifications'
import {
    PayrollCycleType,
    PayrollCycleRule,
    PayrollCycleConfig,
    WeekdayName,
    WEEKDAYS,
    DEFAULT_MONTHLY_CYCLE_RULE,
    validateCycleRule,
    previewPeriods,
    formatCycleExplanation,
    getEarliestSafeCycleChangeDate,
    formatDateLabel,
    getPeriodContaining,
} from '@/lib/payroll-cycle-engine'
import {
    saveBasePayrollCycleConfig,
    getSafePayrollCycleEffectiveDateAction,
} from '@/app/(dashboard)/owner/production/actions'
import { getSuratTodayString } from '@/lib/time'

interface PayrollCycleSettingsCardProps {
    initialConfig?: PayrollCycleConfig
    isAuthorizedEditor?: boolean
    onConfigUpdated?: (newConfig: PayrollCycleConfig) => void
    onDirtyChange?: (isDirty: boolean) => void
}

const CYCLE_TYPE_OPTIONS: { value: PayrollCycleType; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'interval_weeks', label: 'Every N weeks' },
    { value: 'interval_days', label: 'Every N days' },
    { value: 'semi_monthly', label: 'Twice monthly' },
]

export function PayrollCycleSettingsCard({
    initialConfig,
    isAuthorizedEditor = true,
    onConfigUpdated,
    onDirtyChange,
}: PayrollCycleSettingsCardProps) {
    const today = useMemo(() => getSuratTodayString(), [])

    // Effective saved config state
    const savedConfig = useMemo<PayrollCycleConfig>(() => {
        if (initialConfig && initialConfig.rule) {
            const v = validateCycleRule(initialConfig.rule)
            if (v.valid && v.normalizedRule) {
                return {
                    ...initialConfig,
                    rule: v.normalizedRule,
                }
            }
        }
        return {
            cycleType: 'monthly',
            rule: DEFAULT_MONTHLY_CYCLE_RULE,
            effectiveFrom: '2020-01-01',
            effectiveUntil: null,
        }
    }, [initialConfig])

    // Form inputs initialized from savedConfig
    const [cycleType, setCycleType] = useState<PayrollCycleType>(savedConfig.cycleType)
    const [monthlyAnchor, setMonthlyAnchor] = useState<number>(
        savedConfig.rule.type === 'monthly' ? savedConfig.rule.anchorDay : 1
    )
    const [weeklyWeekday, setWeeklyWeekday] = useState<WeekdayName>(
        savedConfig.rule.type === 'weekly' ? savedConfig.rule.anchorWeekday : 'monday'
    )
    const [intervalWeeks, setIntervalWeeks] = useState<number>(
        savedConfig.rule.type === 'interval_weeks' ? savedConfig.rule.interval : 2
    )
    const [intervalWeeksAnchor, setIntervalWeeksAnchor] = useState<string>(
        savedConfig.rule.type === 'interval_weeks' ? savedConfig.rule.anchorDate : today
    )
    const [intervalDays, setIntervalDays] = useState<number>(
        savedConfig.rule.type === 'interval_days' ? savedConfig.rule.interval : 24
    )
    const [intervalDaysAnchor, setIntervalDaysAnchor] = useState<string>(
        savedConfig.rule.type === 'interval_days' ? savedConfig.rule.anchorDate : today
    )
    const [semiFirstBoundary, setSemiFirstBoundary] = useState<number>(
        savedConfig.rule.type === 'semi_monthly' ? savedConfig.rule.firstBoundary : 1
    )
    const [semiSecondBoundary, setSemiSecondBoundary] = useState<number>(
        savedConfig.rule.type === 'semi_monthly' ? savedConfig.rule.secondBoundary : 16
    )

    // Modal & submission state
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [confirmModalOpen, setConfirmModalOpen] = useState(false)
    const [safeEffectiveInfo, setSafeEffectiveInfo] = useState<{
        safeEffectiveDate: string
        reason: string
        protectedPeriodEnd?: string
    } | null>(null)
    const [loadingSafeDate, setLoadingSafeDate] = useState(false)

    // Construct current active rule from form inputs
    const currentRule: PayrollCycleRule = useMemo(() => {
        switch (cycleType) {
            case 'monthly':
                return { type: 'monthly', anchorDay: monthlyAnchor }
            case 'weekly':
                return { type: 'weekly', anchorWeekday: weeklyWeekday }
            case 'interval_weeks':
                return {
                    type: 'interval_weeks',
                    interval: Math.max(1, intervalWeeks || 1),
                    anchorDate: intervalWeeksAnchor || today,
                }
            case 'interval_days':
                return {
                    type: 'interval_days',
                    interval: Math.max(1, intervalDays || 1),
                    anchorDate: intervalDaysAnchor || today,
                }
            case 'semi_monthly':
                return {
                    type: 'semi_monthly',
                    firstBoundary: semiFirstBoundary,
                    secondBoundary: semiSecondBoundary,
                }
        }
    }, [
        cycleType,
        monthlyAnchor,
        weeklyWeekday,
        intervalWeeks,
        intervalWeeksAnchor,
        intervalDays,
        intervalDaysAnchor,
        semiFirstBoundary,
        semiSecondBoundary,
        today,
    ])

    const ruleValidation = useMemo(() => validateCycleRule(currentRule), [currentRule])

    // Check if form differs from savedConfig
    const isDirty = useMemo(() => {
        if (cycleType !== savedConfig.cycleType) return true
        const s = savedConfig.rule
        switch (cycleType) {
            case 'monthly':
                return s.type !== 'monthly' || s.anchorDay !== monthlyAnchor
            case 'weekly':
                return s.type !== 'weekly' || s.anchorWeekday !== weeklyWeekday
            case 'interval_weeks':
                return (
                    s.type !== 'interval_weeks' ||
                    s.interval !== intervalWeeks ||
                    s.anchorDate !== intervalWeeksAnchor
                )
            case 'interval_days':
                return (
                    s.type !== 'interval_days' ||
                    s.interval !== intervalDays ||
                    s.anchorDate !== intervalDaysAnchor
                )
            case 'semi_monthly':
                return (
                    s.type !== 'semi_monthly' ||
                    s.firstBoundary !== semiFirstBoundary ||
                    s.secondBoundary !== semiSecondBoundary
                )
        }
    }, [
        cycleType,
        savedConfig,
        monthlyAnchor,
        weeklyWeekday,
        intervalWeeks,
        intervalWeeksAnchor,
        intervalDays,
        intervalDaysAnchor,
        semiFirstBoundary,
        semiSecondBoundary,
    ])

    useEffect(() => {
        onDirtyChange?.(isDirty)
    }, [isDirty, onDirtyChange])

    // Live preview generation
    const previewList = useMemo(() => {
        const ruleToPreview = ruleValidation.normalizedRule ?? currentRule
        try {
            return previewPeriods(ruleToPreview, today, 4)
        } catch {
            return []
        }
    }, [ruleValidation, currentRule, today])

    // Plain-language explanation
    const plainExplanation = useMemo(() => {
        const ruleToExplain = ruleValidation.normalizedRule ?? currentRule
        try {
            return formatCycleExplanation(ruleToExplain)
        } catch {
            return ''
        }
    }, [ruleValidation, currentRule])

    // Saved plain explanation
    const savedExplanation = useMemo(() => {
        try {
            return formatCycleExplanation(savedConfig.rule)
        } catch {
            return 'Monthly beginning on the 1st'
        }
    }, [savedConfig])

    // Handle Open Save Confirmation Modal
    const handleInitiateSave = async () => {
        if (!ruleValidation.valid || !ruleValidation.normalizedRule) {
            toast.error(ruleValidation.error || 'Please correct the payroll cycle settings.')
            return
        }

        setLoadingSafeDate(true)
        setConfirmModalOpen(true)

        try {
            const res = await getSafePayrollCycleEffectiveDateAction()
            if (res && res.success) {
                setSafeEffectiveInfo({
                    safeEffectiveDate: res.safeEffectiveDate,
                    reason: res.reason,
                    protectedPeriodEnd: res.protectedPeriodEnd,
                })
            } else {
                const fallbackSafe = getEarliestSafeCycleChangeDate({
                    today,
                    currentRule: savedConfig.rule,
                })
                setSafeEffectiveInfo(fallbackSafe)
            }
        } catch {
            const fallbackSafe = getEarliestSafeCycleChangeDate({
                today,
                currentRule: savedConfig.rule,
            })
            setSafeEffectiveInfo(fallbackSafe)
        } finally {
            setLoadingSafeDate(false)
        }
    }

    // Handle Confirm Save
    const handleConfirmSave = async () => {
        if (!ruleValidation.valid || !ruleValidation.normalizedRule) return

        setIsSubmitting(true)
        try {
            const effectiveFrom = safeEffectiveInfo?.safeEffectiveDate

            const result = await saveBasePayrollCycleConfig({
                cycleType,
                rule: ruleValidation.normalizedRule as unknown as Record<string, unknown>,
                effectiveFrom,
            })

            if ('error' in result && result.error) {
                toast.error(result.error)
                return
            }

            toast.success('Payroll cycle updated successfully.')
            setConfirmModalOpen(false)

            const updated: PayrollCycleConfig = {
                id: savedConfig.id,
                orgId: savedConfig.orgId,
                cycleType,
                rule: ruleValidation.normalizedRule,
                effectiveFrom: effectiveFrom || today,
                effectiveUntil: null,
            }

            onConfigUpdated?.(updated)
            onDirtyChange?.(false)
        } catch (err: unknown) {
            toast.error(userFacingError(err, 'Failed to update payroll cycle.'))
        } finally {
            setIsSubmitting(false)
        }
    }

    const firstAffectedPeriod = useMemo(() => {
        if (!safeEffectiveInfo?.safeEffectiveDate || !ruleValidation.normalizedRule) return null
        try {
            return getPeriodContaining(safeEffectiveInfo.safeEffectiveDate, ruleValidation.normalizedRule)
        } catch {
            return null
        }
    }, [safeEffectiveInfo, ruleValidation])

    return (
        <div id="payroll-cycle" className="scroll-mt-6 rounded-2xl border border-hairline bg-surface p-6 shadow-xs">
            {/* Header */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                            PAYROLL
                        </span>
                        <Badge variant="secondary" className="text-[11px] font-medium">
                            Accounting Integrity
                        </Badge>
                    </div>
                    <h2 className="mt-1 font-heading text-lg font-bold text-ink">
                        Payroll Cycle
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                        Configure how worker earnings and salaries are grouped into payroll periods.
                    </p>
                </div>
            </div>

            <hr className="my-5 border-hairline" />

            {/* Form Section */}
            <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                    {/* Cycle Type */}
                    <div className="space-y-2">
                        <Label htmlFor="cycle-type-select" className="text-xs font-bold text-ink sm:text-sm">
                            Cycle type
                        </Label>
                        <Select
                            value={cycleType}
                            onValueChange={(val) => setCycleType(val as PayrollCycleType)}
                            disabled={!isAuthorizedEditor || isSubmitting}
                        >
                            <SelectTrigger id="cycle-type-select" className="h-10 rounded-xl bg-surface">
                                <SelectValue placeholder="Select cycle type" />
                            </SelectTrigger>
                            <SelectContent>
                                {CYCLE_TYPE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Dynamic Fields */}
                    {cycleType === 'monthly' && (
                        <div className="space-y-2">
                            <Label htmlFor="monthly-anchor-select" className="text-xs font-bold text-ink sm:text-sm">
                                Period starts on
                            </Label>
                            <Select
                                value={String(monthlyAnchor)}
                                onValueChange={(val) => setMonthlyAnchor(Number(val))}
                                disabled={!isAuthorizedEditor || isSubmitting}
                            >
                                <SelectTrigger id="monthly-anchor-select" className="h-10 rounded-xl bg-surface">
                                    <SelectValue placeholder="Select anchor day" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                        <SelectItem key={day} value={String(day)}>
                                            {day === 1 ? '1st (Calendar Month)' : `${day}${day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {monthlyAnchor >= 29 && (
                                <p className="text-xs text-[var(--wv-ochre-800)]">
                                    For shorter months, Weavly automatically uses the final calendar day.
                                </p>
                            )}
                        </div>
                    )}

                    {cycleType === 'weekly' && (
                        <div className="space-y-2">
                            <Label htmlFor="weekly-weekday-select" className="text-xs font-bold text-ink sm:text-sm">
                                Week starts on
                            </Label>
                            <Select
                                value={weeklyWeekday}
                                onValueChange={(val) => setWeeklyWeekday(val as WeekdayName)}
                                disabled={!isAuthorizedEditor || isSubmitting}
                            >
                                <SelectTrigger id="weekly-weekday-select" className="h-10 rounded-xl bg-surface">
                                    <SelectValue placeholder="Select weekday" />
                                </SelectTrigger>
                                <SelectContent>
                                    {WEEKDAYS.map((w) => (
                                        <SelectItem key={w} value={w}>
                                            {w.charAt(0).toUpperCase() + w.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {cycleType === 'interval_weeks' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="interval-weeks-input" className="text-xs font-bold text-ink sm:text-sm">
                                    Repeat every (weeks)
                                </Label>
                                <Input
                                    id="interval-weeks-input"
                                    type="number"
                                    min={1}
                                    max={52}
                                    value={intervalWeeks}
                                    onChange={(e) => setIntervalWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                                    disabled={!isAuthorizedEditor || isSubmitting}
                                    className="h-10 rounded-xl bg-surface"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="interval-weeks-anchor" className="text-xs font-bold text-ink sm:text-sm">
                                    Cycle begins
                                </Label>
                                <Input
                                    id="interval-weeks-anchor"
                                    type="date"
                                    value={intervalWeeksAnchor}
                                    onChange={(e) => setIntervalWeeksAnchor(e.target.value)}
                                    disabled={!isAuthorizedEditor || isSubmitting}
                                    className="h-10 rounded-xl bg-surface"
                                />
                            </div>
                        </>
                    )}

                    {cycleType === 'interval_days' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="interval-days-input" className="text-xs font-bold text-ink sm:text-sm">
                                    Cycle length (days)
                                </Label>
                                <Input
                                    id="interval-days-input"
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={intervalDays}
                                    onChange={(e) => setIntervalDays(Math.max(1, parseInt(e.target.value) || 1))}
                                    disabled={!isAuthorizedEditor || isSubmitting}
                                    className="h-10 rounded-xl bg-surface"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="interval-days-anchor" className="text-xs font-bold text-ink sm:text-sm">
                                    Cycle begins
                                </Label>
                                <Input
                                    id="interval-days-anchor"
                                    type="date"
                                    value={intervalDaysAnchor}
                                    onChange={(e) => setIntervalDaysAnchor(e.target.value)}
                                    disabled={!isAuthorizedEditor || isSubmitting}
                                    className="h-10 rounded-xl bg-surface"
                                />
                            </div>
                        </>
                    )}

                    {cycleType === 'semi_monthly' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="semi-first-select" className="text-xs font-bold text-ink sm:text-sm">
                                    First period starts
                                </Label>
                                <Select
                                    value={String(semiFirstBoundary)}
                                    onValueChange={(val) => setSemiFirstBoundary(Number(val))}
                                    disabled={!isAuthorizedEditor || isSubmitting}
                                >
                                    <SelectTrigger id="semi-first-select" className="h-10 rounded-xl bg-surface">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                            <SelectItem key={day} value={String(day)}>
                                                {day === 1 ? '1st' : `${day}th`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="semi-second-select" className="text-xs font-bold text-ink sm:text-sm">
                                    Second period starts
                                </Label>
                                <Select
                                    value={String(semiSecondBoundary)}
                                    onValueChange={(val) => setSemiSecondBoundary(Number(val))}
                                    disabled={!isAuthorizedEditor || isSubmitting}
                                >
                                    <SelectTrigger id="semi-second-select" className="h-10 rounded-xl bg-surface">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                            <SelectItem key={day} value={String(day)}>
                                                {day === 1 ? '1st' : `${day}th`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                </div>

                {/* Validation Error Banner */}
                {!ruleValidation.valid && (
                    <div className="flex items-center gap-2 rounded-xl border border-[var(--wv-madder-200)] bg-[var(--wv-madder-50)]/60 p-3 text-xs text-[var(--wv-madder-800)]">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{ruleValidation.error}</span>
                    </div>
                )}

                {/* Live Period Preview Section */}
                <div className="rounded-xl border border-hairline bg-surface-soft/40 p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                                PERIOD PREVIEW
                            </span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                            Current / Upcoming
                        </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {previewList.map((p, idx) => (
                            <div
                                key={p.start + p.end}
                                className="flex items-center justify-between rounded-lg border border-hairline bg-surface px-3.5 py-2.5 shadow-2xs"
                            >
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant={idx === 0 ? 'default' : 'outline'}
                                        className="h-5 px-1.5 text-[10px] font-bold"
                                    >
                                        {idx === 0 ? 'Current' : `Next ${idx}`}
                                    </Badge>
                                    <span className="text-xs font-bold text-ink sm:text-sm">
                                        {p.label}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Plain-Language Explanation */}
                    {plainExplanation && (
                        <p className="mt-3.5 text-xs font-medium text-ink/80 sm:text-sm">
                            {plainExplanation}
                        </p>
                    )}
                </div>

                {/* Save CTA */}
                <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                        onClick={handleInitiateSave}
                        disabled={!isDirty || !ruleValidation.valid || isSubmitting || !isAuthorizedEditor}
                        className="h-10 rounded-xl px-5 font-bold shadow-xs"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </Button>
                </div>
            </div>

            {/* Save Confirmation Dialog */}
            <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
                <DialogContent className="max-w-md rounded-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 font-heading text-lg font-bold text-ink">
                            <Calendar className="h-5 w-5 text-saffron-deep" />
                            Update payroll cycle?
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
                            Please confirm the new schedule and effective transition date.
                        </DialogDescription>
                    </DialogHeader>

                    {loadingSafeDate ? (
                        <div className="flex h-32 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="space-y-4 py-2 text-sm">
                            <div className="rounded-xl border border-hairline bg-surface-soft/40 p-3.5 space-y-2 text-xs sm:text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Current cycle</span>
                                    <span className="font-bold text-ink">{savedExplanation}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">New cycle</span>
                                    <span className="font-bold text-saffron-deep">
                                        {plainExplanation}
                                    </span>
                                </div>
                                <div className="border-t border-hairline pt-2 flex justify-between">
                                    <span className="text-muted-foreground">New rule becomes effective</span>
                                    <span className="font-bold text-ink">
                                        {safeEffectiveInfo?.safeEffectiveDate
                                            ? formatDateLabel(safeEffectiveInfo.safeEffectiveDate)
                                            : 'Next Period'}
                                    </span>
                                </div>
                                {firstAffectedPeriod && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">First affected period</span>
                                        <span className="font-medium text-ink">{firstAffectedPeriod.label}</span>
                                    </div>
                                )}
                            </div>

                            {/* Non-negotiable guarantee callout */}
                            <div className="flex items-start gap-2.5 rounded-xl border border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)]/60 p-3 text-xs text-[var(--wv-moss-900,#14532D)]">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--wv-moss-600)] mt-0.5" />
                                <div>
                                    <p className="font-bold">Accounting Integrity Guaranteed</p>
                                    <p className="mt-0.5">Existing settled and active payroll periods will not change.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setConfirmModalOpen(false)}
                            disabled={isSubmitting}
                            className="rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleConfirmSave}
                            disabled={isSubmitting || loadingSafeDate}
                            className="rounded-xl font-bold"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Confirm Changes'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
