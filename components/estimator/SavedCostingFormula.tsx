'use client'

import { Fragment, useId, type ReactNode } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { fillCopy } from '@/lib/i18n/fill'
import { savedCostingFormulaText } from '@/lib/i18n/saved-costing-formula'
import type { FormulaYarnLayer, SavedCostingFormula as Formula } from '@/lib/saved-costing-formula'
import { cn } from '@/lib/utils'

type Copy = (typeof savedCostingFormulaText)[keyof typeof savedCostingFormulaText]
type Line = { expression: ReactNode; result: string; unit?: string; quiet?: boolean }

export const formulaNumber = (value: number, digits = 2) => value.toLocaleString('en-IN', { maximumFractionDigits: digits })
export const formulaMoney = (value: number) => `₹${value.toFixed(2)}`
const kg = (value: number) => value.toFixed(3)

/** What a pill holds. Each kind has its own soft colour (app/globals.css), the same in every step. */
export type FormulaInputKind = 'count' | 'ends' | 'picks' | 'width' | 'rate' | 'percent' | 'other'

/** A saved input inside a formula, coloured by its kind so the owner's own figures stand out from the arithmetic. */
export function FormulaInput({ kind, children, title }: { kind: FormulaInputKind; children: ReactNode; title?: string }) {
    return <span data-formula-input={kind} title={title} className="inline-block whitespace-nowrap rounded-md px-1.5 text-[13px] font-medium leading-6">{children}</span>
}

export function FormulaOp({ children }: { children: ReactNode }) {
    return <span className="text-muted-foreground">{children}</span>
}

/** Terms with an operator between each pair. It flows as text, so a long sum wraps between terms. */
export function FormulaExpression({ terms, op }: { terms: ReactNode[]; op?: string }) {
    return (
        <span className="tabular-nums">
            {terms.map((term, index) => (
                <Fragment key={index}>
                    {index > 0 && (op ? <> <FormulaOp>{op}</FormulaOp> </> : ' ')}
                    {term}
                </Fragment>
            ))}
        </span>
    )
}

/** Brackets that sit tight against what they hold. */
export function FormulaGroup({ children }: { children: ReactNode }) {
    return <span><FormulaOp>(</FormulaOp>{children}<FormulaOp>)</FormulaOp></span>
}

/**
 * One step of the worksheet as a ledger row: what it is, how it is worked, and
 * what it comes to, with every result in one column so the `=` signs line up.
 */
function Step({ label, detail, lines, total = false }: { label: string; detail?: string | null; lines: Line[]; total?: boolean }) {
    return (
        <li
            className={cn(
                'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-5 @min-[560px]:grid-cols-[9rem_minmax(0,1fr)_9.5rem]',
                // The band reaches past the rows by its own padding, so its columns stay in line with theirs.
                total ? 'mt-3 rounded-xl bg-[var(--wv-bg-canvas)] px-4 py-3 sm:-mx-4' : 'border-t border-hairline py-3 first:border-t-0',
            )}
        >
            <div className={cn('col-span-2 min-w-0 @min-[560px]:col-span-1', lines.length > 1 && '@min-[560px]:row-span-2')}>
                <p className={cn('font-semibold leading-7 text-ink', total ? 'text-[15px]' : 'text-sm')}>{label}</p>
                {detail && <p className="-mt-0.5 break-words text-[13px] leading-snug text-muted-foreground">{detail}</p>}
            </div>
            {lines.map((line, index) => (
                <Fragment key={index}>
                    <div className={cn('min-w-0 text-sm leading-7 text-body', total && 'text-muted-foreground')}>{line.expression}</div>
                    <p className="flex items-baseline justify-end gap-2 whitespace-nowrap leading-7 tabular-nums @min-[560px]:justify-between">
                        <span className="text-muted-foreground">=</span>
                        <span className={total ? 'text-xl font-semibold tracking-[-0.01em] text-ink' : line.quiet ? 'text-[13px] text-body' : 'text-sm font-semibold text-ink'}>
                            {line.result}
                            {line.unit && <span className={cn('ml-0.5 font-normal text-muted-foreground', total ? 'text-sm' : 'text-[12px]')}>{line.unit}</span>}
                        </span>
                    </p>
                </Fragment>
            ))}
        </li>
    )
}

const muted = (text: string) => <FormulaOp>{text}</FormulaOp>

function weightLine(layer: FormulaYarnLayer, copy: Copy): Line {
    const { weight } = layer
    const result = fillCopy(copy.kg, { kg: kg(weight.kgPer100m) })
    if (weight.mode === 'manual') return { expression: <FormulaExpression terms={[<FormulaInput key="kg" kind="other">{result}</FormulaInput>, muted(copy.manual)]} />, result, unit: copy.per100m, quiet: true }
    if (weight.mode === 'saved') return { expression: muted(copy.asSaved), result, unit: copy.per100m, quiet: true }
    const count = weight.countNe != null
        ? <FormulaGroup><FormulaExpression terms={['5315', <FormulaInput key="ne" kind="count">{fillCopy(copy.countNe, { n: formulaNumber(weight.countNe) })}</FormulaInput>]} op="÷" /></FormulaGroup>
        : <FormulaInput kind="count">{fillCopy(copy.denier, { d: formulaNumber(weight.denier) })}</FormulaInput>
    const terms = layer.system === 'warp'
        ? [count, <FormulaInput key="ends" kind="ends">{fillCopy(copy.ends, { n: formulaNumber(weight.ends ?? 0, 0) })}</FormulaInput>, '100']
        : [
            count,
            <FormulaInput key="ppi" kind="picks">{fillCopy(copy.ppi, { n: formulaNumber(weight.picks ?? 0) })}</FormulaInput>,
            <FormulaInput key="width" kind="width">{formulaNumber(weight.widthInches ?? 0)}″</FormulaInput>,
            weight.lengthM === 100 ? '100' : <span key="length" title={copy.doubleWeft} className="underline decoration-dotted underline-offset-4">{formulaNumber(weight.lengthM, 3)}</span>,
        ]
    return {
        expression: <FormulaExpression terms={[<FormulaExpression key="product" terms={terms} op="×" />, '9000000']} op="÷" />,
        result,
        unit: copy.per100m,
        quiet: true,
    }
}

function costLine(layer: FormulaYarnLayer, copy: Copy): Line {
    const result = formulaMoney(layer.baseCostPerM)
    if (!layer.costFromRate) return { expression: muted(copy.asSaved), result, unit: '/m' }
    const terms: ReactNode[] = [fillCopy(copy.kg, { kg: kg(layer.weight.kgPer100m) }), <FormulaInput key="rate" kind="rate">{fillCopy(copy.ratePerKg, { rate: formulaNumber(layer.ratePerKg) })}</FormulaInput>]
    if (layer.gstPct > 0) terms.push(<FormulaGroup key="gst"><FormulaExpression terms={['1', <FormulaInput key="pct" kind="percent">{fillCopy(copy.gst, { pct: formulaNumber(layer.gstPct) })}</FormulaInput>]} op="+" /></FormulaGroup>)
    return {
        expression: <FormulaExpression terms={[<FormulaExpression key="product" terms={terms} op="×" />, '100']} op="÷" />,
        result,
        unit: '/m',
    }
}

/** "(3% waste + 5% crimp)", or the one percentage that applies. */
function allowanceRate(wastePct: number, crimpPct: number, copy: Copy) {
    const parts = [
        wastePct ? <FormulaInput key="waste" kind="percent">{fillCopy(copy.waste, { pct: formulaNumber(wastePct) })}</FormulaInput> : null,
        crimpPct ? <FormulaInput key="crimp" kind="percent">{fillCopy(copy.crimp, { pct: formulaNumber(crimpPct) })}</FormulaInput> : null,
    ].filter(Boolean)
    return parts.length < 2 ? parts[0] : <FormulaGroup><FormulaExpression terms={parts} op="+" /></FormulaGroup>
}

/**
 * A saved costing's per-metre cost as a worksheet: each yarn layer weighed and
 * priced, the layers added, then wastage, weaving, warping and sizing, any
 * processing and factory expenses, down to the production cost. Saved inputs
 * sit in pills so the owner can see what each figure was worked from.
 */
export function SavedCostingFormula({ formula }: { formula: Formula }) {
    const { language } = useTranslation()
    const copy = savedCostingFormulaText[language]
    const titleId = useId()
    const steps: ReactNode[] = []
    const parts: number[] = []
    const savedLine = (perM: number): Line => ({ expression: muted(copy.asSaved), result: formulaMoney(perM), unit: '/m' })
    const pill = (key: string, kind: FormulaInputKind, text: string) => <FormulaInput key={key} kind={kind}>{text}</FormulaInput>
    const perHundred = (kgPer100m: number, rate: ReactNode) => <FormulaExpression terms={[<FormulaExpression key="product" terms={[fillCopy(copy.kg, { kg: kg(kgPer100m) }), rate]} op="×" />, '100']} op="÷" />

    if (formula.layers.length > 0 && formula.yarnBasePerM != null) {
        for (const layer of formula.layers) {
            steps.push(
                <Step
                    key={`${layer.system}-${layer.position}`}
                    label={fillCopy(layer.system === 'warp' ? copy.warp : copy.weft, { n: layer.position })}
                    detail={layer.name}
                    lines={[weightLine(layer, copy), costLine(layer, copy)]}
                />,
            )
        }
        steps.push(<Step key="yarn" label={copy.yarn} lines={[{ expression: <FormulaExpression terms={formula.layers.map(layer => formulaMoney(layer.baseCostPerM))} op="+" />, result: formulaMoney(formula.yarnBasePerM), unit: '/m' }]} />)
        parts.push(formula.yarnBasePerM)

        if (formula.allowancePerM != null && formula.allowancePerM > 0) {
            const shared = formula.sharedAllowance
            const terms = shared
                ? [<FormulaExpression key="shared" terms={[formulaMoney(formula.yarnBasePerM), allowanceRate(shared.wastePct, shared.crimpPct, copy)]} op="×" />]
                : formula.layers
                    .filter(layer => layer.allowancePerM > 0)
                    .map(layer => <FormulaExpression key={`${layer.system}-${layer.position}`} terms={[formulaMoney(layer.baseCostPerM), allowanceRate(layer.wastePct, layer.crimpPct, copy)]} op="×" />)
            steps.push(<Step key="allowance" label={copy.allowance} lines={[{ expression: <FormulaExpression terms={terms} op="+" />, result: formulaMoney(formula.allowancePerM), unit: '/m' }]} />)
            parts.push(formula.allowancePerM)
        }
    } else {
        steps.push(<Step key="warp" label={copy.warpYarn} lines={[savedLine(formula.warpPerM)]} />)
        steps.push(<Step key="weft" label={copy.weftYarn} lines={[savedLine(formula.weftPerM)]} />)
        parts.push(formula.warpPerM, formula.weftPerM)
    }

    const { weaving, warpingSizing, winding, overhead } = formula
    steps.push(
        <Step
            key="weaving"
            label={copy.weaving}
            lines={[weaving.picks != null && weaving.paisePerPick != null
                ? {
                    expression: <FormulaExpression terms={[pill('picks', 'picks', fillCopy(copy.ppi, { n: formulaNumber(weaving.picks) })), pill('paise', 'rate', fillCopy(copy.paisePerPick, { p: formulaNumber(weaving.paisePerPick, 4) }))]} op="×" />,
                    result: formulaMoney(weaving.perM),
                    unit: '/m',
                }
                : savedLine(weaving.perM)]}
        />,
    )
    parts.push(weaving.perM)

    if (warpingSizing.inHouse || warpingSizing.perM > 0) {
        const rates = [
            warpingSizing.warpingRatePerKg != null ? pill('warping', 'rate', fillCopy(copy.warpingRate, { rate: formulaNumber(warpingSizing.warpingRatePerKg) })) : null,
            warpingSizing.sizingRatePerKg != null ? pill('sizing', 'rate', fillCopy(copy.sizingRate, { rate: formulaNumber(warpingSizing.sizingRatePerKg) })) : null,
        ].filter(Boolean)
        const rate = rates.length > 1 ? <FormulaGroup><FormulaExpression terms={rates} op="+" /></FormulaGroup> : rates[0]
        steps.push(
            <Step
                key="warping"
                label={copy.warpingSizing}
                lines={[warpingSizing.inHouse
                    ? { expression: muted(copy.inHouse), result: formulaMoney(0), unit: '/m', quiet: true }
                    : warpingSizing.warpKgPer100m != null && rate
                        ? { expression: perHundred(warpingSizing.warpKgPer100m, rate), result: formulaMoney(warpingSizing.perM), unit: '/m' }
                        : savedLine(warpingSizing.perM)]}
            />,
        )
        parts.push(warpingSizing.perM)
    }

    if (winding) {
        steps.push(
            <Step
                key="winding"
                label={copy.winding}
                lines={[winding.kgPer100m != null && winding.ratePerKg != null
                    ? { expression: perHundred(winding.kgPer100m, pill('rate', 'rate', fillCopy(copy.windingRate, { rate: formulaNumber(winding.ratePerKg) }))), result: formulaMoney(winding.perM), unit: '/m' }
                    : savedLine(winding.perM)]}
            />,
        )
        parts.push(winding.perM)
    }
    for (const [key, label, perM] of [['processing', copy.processing, formula.processingPerM], ['finishing', copy.finishing, formula.finishingPerM]] as const) {
        if (perM == null) continue
        steps.push(<Step key={key} label={label} lines={[{ expression: pill(key, 'rate', fillCopy(copy.perM, { amount: formulaNumber(perM) })), result: formulaMoney(perM), unit: '/m' }]} />)
        parts.push(perM)
    }

    steps.push(
        <Step
            key="overhead"
            label={copy.factoryExpenses}
            lines={[{
                expression: overhead.monthlyTotal != null && overhead.monthlyOutputM != null
                    ? <FormulaExpression terms={[pill('total', 'other', fillCopy(copy.monthly, { total: formulaNumber(overhead.monthlyTotal, 0) })), pill('output', 'other', fillCopy(copy.monthlyOutput, { m: formulaNumber(overhead.monthlyOutputM, 0) }))]} op="÷" />
                    : pill('rate', 'rate', fillCopy(copy.perM, { amount: formulaNumber(overhead.perM) })),
                result: formulaMoney(overhead.perM),
                unit: '/m',
            }]}
        />,
    )
    parts.push(overhead.perM)

    return (
        <section data-saved-costing-formula="true" data-i18n-skip="true" lang={language} aria-labelledby={titleId} className="@container">
            <h3 id={titleId} className="text-[15px] font-semibold text-ink">{copy.title}</h3>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{copy.note}</p>
            {formula.layers.length === 0 && <p className="mt-2 text-[13px] text-muted-foreground">{copy.noLayers}</p>}
            <ol className="mt-2">
                {steps}
                <Step
                    total
                    label={copy.productionCost}
                    lines={[{ expression: <FormulaExpression terms={parts.filter(part => part > 0).map(formulaMoney)} op="+" />, result: formulaMoney(formula.productionCostPerM), unit: '/m' }]}
                />
            </ol>
        </section>
    )
}
