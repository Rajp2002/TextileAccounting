'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { LoomiAvatar } from '@/components/onboarding/loomi-avatar'
import type { LucideIcon } from 'lucide-react'
import type { ProductionMode } from '@/lib/production-mode'
import {
    CheckCircle2,
    Store,
    Server,
    Palette,
    Users,
    UserPlus,
    ShieldCheck,
    Calendar,
    CreditCard,
    ArrowRight,
    SkipForward,
    X,
    Sparkles,
    Info,
    ClipboardList,
    Link2,
    Activity,
    Warehouse,
    Truck,
    IndianRupee,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SetupChecklist {
    hasProductionMode: boolean
    hasMachine: boolean
    hasLoomAssignment: boolean
    hasLoomTarget: boolean
    hasQuality: boolean
    hasMeterWorker: boolean
    hasFixedWorker: boolean
    hasSupervisor: boolean
    hasPayrollConfig: boolean
    hasPlan: boolean
}

export interface ActivationChecklist {
    hasEstimate: boolean
    hasQuality: boolean
    hasOrder: boolean
    hasProductionLog: boolean
    hasStockEntry: boolean
    hasMarketRun: boolean
    hasDispatch: boolean
    hasCommercial: boolean
}

interface SetupPanelProps {
    checklist: SetupChecklist
    activationChecklist?: ActivationChecklist
    productionMode: ProductionMode
}

type StepStatus = 'completed' | 'incomplete'

interface HelpContent {
    intro: string
    why: string[]
    actions: string[]
    clickPath: string[]
    doneWhen: string
    note?: string
}

interface SetupStep {
    id: string
    icon: LucideIcon
    title: string
    description: string
    href: string
    ctaLabel: string
    skippable?: boolean
    isComplete: (context: StepContext) => boolean
    help: HelpContent
}

interface StepContext {
    checklist: SetupChecklist
    activationChecklist: ActivationChecklist
    productionMode: ProductionMode
    skippedFixed: boolean
}

const EMPTY_ACTIVATION: ActivationChecklist = {
    hasEstimate: false,
    hasQuality: false,
    hasOrder: false,
    hasProductionLog: false,
    hasStockEntry: false,
    hasMarketRun: false,
    hasDispatch: false,
    hasCommercial: false,
}

const SKIP_STORAGE_KEY = 'weavly_skip_fixed_staff'

// ─── Step Definitions ───────────────────────────────────────────────────────────

function getModeLabel(productionMode: ProductionMode) {
    if (productionMode === 'order_based') return 'Order-run path'
    if (productionMode === 'both') return 'Order or market-run path'
    return 'Market-run path'
}

function getRunLabels(productionMode: ProductionMode) {
    if (productionMode === 'order_based') {
        return {
            qualityTitle: 'Create first quote and quality',
            qualityDescription: 'Build a costed quote with the fabric quality and worker rate.',
            qualityCta: 'Open estimator',
            runTitle: 'Convert quote to order',
            runDescription: 'Create the live party order that production will run against.',
            runCta: 'Open quotes',
            runHref: '/owner/quotes',
            linkTitle: 'Link order to looms',
            linkDescription: 'Select the order as the active cost analysis on the looms that will run it.',
            dispatchTitle: 'Create first order dispatch',
            dispatchDescription: 'Owner records dispatch sent. Owner records received quantity after confirmation.',
            stockStep: null as SetupStep | null,
        }
    }

    if (productionMode === 'both') {
        return {
            qualityTitle: 'Create first costing',
            qualityDescription: 'Define the fabric quality, costing, and worker rate for your first run.',
            qualityCta: 'Open estimator',
            runTitle: 'Start first order or market run',
            runDescription: 'Pick one path for your first run: convert a quote to an order or start market maal.',
            runCta: 'Start run',
            runHref: '/owner/estimator',
            linkTitle: 'Link run to looms',
            linkDescription: 'Assign the selected order or market run to the looms that will produce it.',
            dispatchTitle: 'Create first dispatch',
            dispatchDescription: 'Owner records dispatch sent. Owner records received quantity after confirmation.',
            stockStep: null as SetupStep | null,
        }
    }

    return {
        qualityTitle: 'Create first market costing',
        qualityDescription: 'Define the fabric quality, costing, and worker rate for market production.',
        qualityCta: 'Open estimator',
        runTitle: 'Start market run',
        runDescription: 'Create the market maal run that will move from production into godown stock.',
        runCta: 'Start market run',
        runHref: '/owner/estimator?mode=market',
        linkTitle: 'Link market run to looms',
        linkDescription: 'Select the market run as the active cost analysis on the looms that will run it.',
        dispatchTitle: 'Sell and dispatch stock',
        dispatchDescription: 'Owner records dispatch sent. Owner records received quantity after confirmation.',
        stockStep: null as SetupStep | null,
    }
}

function buildSetupSteps(productionMode: ProductionMode): SetupStep[] {
    const labels = getRunLabels(productionMode)

    const steps: SetupStep[] = [
        {
            id: 'production-mode',
            icon: Store,
            title: 'Choose production mode',
            description: 'Tell Weavly if this factory runs market stock, party orders, or both.',
            href: '/owner/settings',
            ctaLabel: 'Review mode',
            isComplete: ({ checklist }) => checklist.hasProductionMode,
            help: {
                intro: 'Production mode controls which workflow Weavly shows first and which first-run path this checklist follows.',
                why: [
                    'Market run factories produce fabric first, move it to godown stock, then sell and dispatch later.',
                    'Order-run factories produce against confirmed party requirements, deadlines, and dispatches.',
                    'Both mode keeps both workflows visible and lets the first completed run finish this checklist.',
                ],
                actions: [
                    'Choose the closest day-to-day operating style.',
                    'Use Both only if the factory regularly does both workflows.',
                    'Change it later from Owner Settings if your workflow changes.',
                ],
                clickPath: ['Owner sidebar', 'Settings', 'Factory settings', 'Production mode'],
                doneWhen: 'A production mode is saved for the organization.',
            },
        },
        {
            id: 'looms',
            icon: Server,
            title: 'Add your looms',
            description: 'Add all active looms or machines before assigning work.',
            href: '/owner/machines',
            ctaLabel: 'Add looms',
            isComplete: ({ checklist }) => checklist.hasMachine,
            help: {
                intro: 'Looms are the production units that receive qualities, workers, and daily shift-meter totals.',
                why: [
                    'Production logs need a loom so output can be traced to the right machine.',
                    'Loom status helps the owner see idle, active, and attention-needed machines.',
                    'Rates and assignments become clearer when every physical loom exists in the system.',
                ],
                actions: [
                    'Add each active loom with a practical factory label.',
                    'Set loom type where possible so reporting and grouping are cleaner.',
                    'Keep unused looms inactive instead of deleting production history later.',
                ],
                clickPath: ['Owner sidebar', 'Looms', 'Add loom'],
                doneWhen: 'At least one loom exists in the factory.',
            },
        },
        {
            id: 'piece-rate-workers',
            icon: Users,
            title: 'Add piece-rate workers',
            description: 'Add the weavers who will be paid from production meters.',
            href: '/owner/fixed-workers',
            ctaLabel: 'Add workers',
            isComplete: ({ checklist }) => checklist.hasMeterWorker,
            help: {
                intro: 'Piece-rate workers are the workers assigned to looms and paid from logged production.',
                why: [
                    'Supervisor production entry requires a worker on the loom.',
                    'Payroll uses production logs to calculate worker hisaab.',
                    'Worker history remains accurate when workers are created before the first shift.',
                ],
                actions: [
                    'Add each production worker by name.',
                    'Add phone numbers if WhatsApp receipts or reminders will be used.',
                    'Keep salary-only staff for the optional fixed staff step.',
                ],
                clickPath: ['Owner sidebar', 'Workers', 'Piece-rate workers', 'Add worker'],
                doneWhen: 'At least one piece-rate worker exists.',
            },
        },
        {
            id: 'loom-workers',
            icon: Link2,
            title: 'Assign workers to looms',
            description: 'Select at least one day or night worker on a loom before production.',
            href: '/owner/machines',
            ctaLabel: 'Assign workers',
            isComplete: ({ checklist }) => checklist.hasLoomAssignment,
            help: {
                intro: 'This connects a worker to a loom shift so Weavly knows who produced the meters.',
                why: [
                    'A loom can be activated once at least one shift has an assigned worker.',
                    'The production log needs the assigned worker to calculate wages correctly.',
                    'Owners can review who was responsible for output, shortages, or idle shifts.',
                ],
                actions: [
                    'Open the Looms page and find the loom card.',
                    'Use the Day and Night worker selectors on the card.',
                    'Select the normal worker for each shift the factory actually runs.',
                ],
                clickPath: ['Owner sidebar', 'Looms', 'Loom card', 'Day worker / Night worker selectors'],
                doneWhen: 'At least one loom has a day or night worker assigned.',
                note: 'This step is separate from linking the order or market run. Workers answer "who runs the loom"; the active cost analysis answers "what is being produced".',
            },
        },
        {
            id: 'quality',
            icon: Palette,
            title: labels.qualityTitle,
            description: labels.qualityDescription,
            href: '/owner/estimator',
            ctaLabel: labels.qualityCta,
            isComplete: ({ checklist, activationChecklist }) => (
                checklist.hasQuality &&
                (activationChecklist.hasEstimate || activationChecklist.hasOrder || activationChecklist.hasMarketRun)
            ),
            help: {
                intro: 'A costing gives the first run its fabric quality, construction details, expected cost, and worker rate.',
                why: [
                    'Production needs a quality or cost analysis before a loom can be linked to work.',
                    'Commercials uses the costing to compare revenue against expected cost.',
                    'Worker wage rates flow from the selected quality or costing into production logs.',
                ],
                actions: [
                    'Open Estimator and create the first fabric quality.',
                    'Fill enough costing details to save the quote or market costing.',
                    'Confirm the worker rate per meter before starting production.',
                ],
                clickPath: ['Owner sidebar', 'Estimator', 'Create quality or quote', 'Save costing'],
                doneWhen: 'A quality exists and at least one estimate, order, or market run has been created.',
            },
        },
        {
            id: 'first-run',
            icon: ClipboardList,
            title: labels.runTitle,
            description: labels.runDescription,
            href: labels.runHref,
            ctaLabel: labels.runCta,
            isComplete: ({ activationChecklist, productionMode }) => {
                if (productionMode === 'market_run') return activationChecklist.hasMarketRun
                if (productionMode === 'order_based') return activationChecklist.hasOrder
                return activationChecklist.hasOrder || activationChecklist.hasMarketRun
            },
            help: {
                intro: 'This creates the live work item that the factory will actually produce.',
                why: [
                    'An order gives party name, target meters, and deadline for order-based production.',
                    'A market run gives target meters and stock identity for market maal.',
                    'Factory Today can only track pace and idle work after a run exists.',
                ],
                actions: productionMode === 'order_based'
                    ? ['Open Quotes after saving a quote.', 'Convert the accepted quote to an order.', 'Check party name, target meters, and deadline before saving.']
                    : productionMode === 'market_run'
                        ? ['Open Estimator in market mode.', 'Create a market run from the costing.', 'Check fabric label, target meters, and planned quantity before saving.']
                        : ['Create either a party order from Quotes or a market run from Estimator.', 'Use the workflow the factory will run first.', 'Finish one path end to end before starting the second path.'],
                clickPath: productionMode === 'order_based'
                    ? ['Owner sidebar', 'Quotes', 'Quote row', 'Convert to order']
                    : ['Owner sidebar', 'Estimator', 'Market mode', 'Start market run'],
                doneWhen: productionMode === 'order_based'
                    ? 'At least one order exists.'
                    : productionMode === 'market_run'
                        ? 'At least one market run exists.'
                        : 'At least one order or market run exists.',
            },
        },
        {
            id: 'loom-target',
            icon: Activity,
            title: labels.linkTitle,
            description: labels.linkDescription,
            href: '/owner/machines',
            ctaLabel: 'Link to looms',
            isComplete: ({ checklist }) => checklist.hasLoomTarget,
            help: {
                intro: 'This links the live order or market run to the loom that will produce it.',
                why: [
                    'The loom needs an active cost analysis before production can be saved.',
                    'Factory Today uses this link to show assigned and unassigned machines.',
                    'Production logs inherit the correct quality and rate from the linked work.',
                ],
                actions: [
                    'Open the Looms page after creating the order or market run.',
                    'On the loom card, click Cost analysis / quality.',
                    'Select the order or market run that loom should produce.',
                ],
                clickPath: ['Owner sidebar', 'Looms', 'Loom card', 'Cost analysis / quality selector'],
                doneWhen: 'At least one loom is linked to an active order or market run.',
            },
        },
        {
            id: 'supervisor',
            icon: ShieldCheck,
            title: 'Invite your supervisor',
            description: 'Give the person logging production access to the supervisor app.',
            href: '/owner/settings',
            ctaLabel: 'Get join code',
            isComplete: ({ checklist }) => checklist.hasSupervisor,
            help: {
                intro: 'The supervisor account is the daily entry point for loom status, assignments, and production logs.',
                why: [
                    'The supervisor flow is optimized for mobile shop-floor entry.',
                    'Separating owner and supervisor roles keeps commercials and payroll controls protected.',
                    'Daily logs are cleaner when the person entering them has their own account.',
                ],
                actions: [
                    'Open Settings and generate the supervisor join code.',
                    'Share the code with the supervisor and ask them to sign in.',
                    'If you do not have a separate supervisor, create a second account for yourself with the join code.',
                ],
                clickPath: ['Owner sidebar', 'Settings', 'Supervisor access', 'Generate join code'],
                doneWhen: 'At least one supervisor profile has joined this factory.',
            },
        },
        {
            id: 'production-log',
            icon: Activity,
            title: 'Log first production',
            description: 'Enter the first shift meters after loom, worker, and run are linked.',
            href: '/supervisor/production',
            ctaLabel: 'Log production',
            isComplete: ({ activationChecklist }) => activationChecklist.hasProductionLog,
            help: {
                intro: 'The first production log proves the setup can run from costing to actual output.',
                why: [
                    'Meters drive progress, stock movement, payroll, and daily owner alerts.',
                    'The log captures loom, worker, shift, quality, and shift-total meters in one record.',
                    'Commercial and dispatch readiness depends on production being recorded first.',
                ],
                actions: [
                    'Sign in as supervisor or use the supervisor flow.',
                    'Open Production and choose the loom/shift.',
                    'Enter the shift-total meters produced, then save.',
                ],
                clickPath: ['Supervisor app', 'Production', 'Select loom and shift', 'Save production'],
                doneWhen: 'At least one production log exists.',
                note: 'If saving is blocked, check that the selected shift has an assigned worker and the loom has an active order or market run selected.',
            },
        },
    ]

    if (productionMode === 'market_run') {
        steps.push({
            id: 'stock',
            icon: Warehouse,
            title: 'Move fabric into godown',
            description: 'Confirm produced market maal as stock so it can be sold and dispatched.',
            href: '/owner/stock',
            ctaLabel: 'Open godown',
            isComplete: ({ activationChecklist }) => activationChecklist.hasStockEntry,
            help: {
                intro: 'Market-run production must become godown stock before it can be sold to a party.',
                why: [
                    'Stock lots preserve quality, meters, taka count, cost, and source run.',
                    'Dispatches for market maal start from sold stock.',
                    'Commercial profit depends on the stock cost captured before sale.',
                ],
                actions: [
                    'Open Godown Ledger after production is logged.',
                    'Review expected stock from the market run.',
                    'Confirm the lot or inward entry when the fabric is physically in godown.',
                ],
                clickPath: ['Owner sidebar', 'Godown Ledger', 'Expected stock', 'Confirm inward'],
                doneWhen: 'At least one stock lot exists.',
            },
        })
    }

    steps.push(
        {
            id: 'dispatch',
            icon: Truck,
            title: labels.dispatchTitle,
            description: labels.dispatchDescription,
            href: '/owner/dispatches',
            ctaLabel: 'Open dispatches',
            isComplete: ({ activationChecklist }) => activationChecklist.hasDispatch,
            help: {
                intro: 'Dispatch records what fabric left the factory. Owner records received quantity after confirmation.',
                why: [
                    'Open dispatches show fabric in transit and receipt delays.',
                    'Shortage and received quantity are tracked against the sent quantity.',
                    'Commercial receivables become easier to follow when dispatches are clean.',
                ],
                actions: productionMode === 'market_run'
                    ? ['Sell stock to a named party from Godown Ledger or Dispatches.', 'Create the dispatch for the sold stock.', 'Owner records received quantity after confirmation.']
                    : ['Open Dispatches for the order.', 'Create a dispatch batch with sent meters.', 'Owner records received quantity after confirmation.'],
                clickPath: productionMode === 'market_run'
                    ? ['Owner sidebar', 'Dispatches', 'Pending dispatches', 'Sell and dispatch stock']
                    : ['Owner sidebar', 'Dispatches', 'Create dispatch'],
                doneWhen: 'At least one dispatch exists.',
            },
        },
        {
            id: 'commercials',
            icon: IndianRupee,
            title: 'Review commercials',
            description: 'Check revenue, expected cost, profit, and receivables after the first sale or dispatch.',
            href: '/owner/commercials',
            ctaLabel: 'Open commercials',
            isComplete: ({ activationChecklist }) => activationChecklist.hasCommercial,
            help: {
                intro: 'Commercials is where the owner reviews whether the run made money and what the party still owes.',
                why: [
                    'Expected and realized profit help catch pricing or costing mistakes early.',
                    'Receivables show unpaid, partial, and collected amounts by party.',
                    'The first review confirms that costing, stock, dispatch, and payment data are connected.',
                ],
                actions: [
                    'Open Commercials after the first sale, dispatch, or invoice-linked event.',
                    'Review the profit snapshot and receivables list.',
                    'Record payment when the party pays so outstanding balance stays current.',
                ],
                clickPath: ['Owner sidebar', 'Commercials', 'Profit snapshot / Receivables', 'Record payment'],
                doneWhen: 'At least one commercial profit entry exists.',
            },
        },
        {
            id: 'fixed-staff',
            icon: UserPlus,
            title: 'Add fixed/salary staff',
            description: 'Add salaried staff only if you track attendance-based pay.',
            href: '/owner/fixed-workers',
            ctaLabel: 'Add staff',
            skippable: true,
            isComplete: ({ checklist, skippedFixed }) => skippedFixed || checklist.hasFixedWorker,
            help: {
                intro: 'Fixed staff are salaried or attendance-paid people, separate from piece-rate loom workers.',
                why: [
                    'Payroll can handle both production wages and fixed staff salary.',
                    'Attendance-based pay needs staff records before the payroll period closes.',
                    'Factories without fixed staff can skip this step.',
                ],
                actions: [
                    'Add salary staff if you pay supervisors, helpers, or office staff monthly.',
                    'Enter salary and optional PF/ESI details when relevant.',
                    'Skip the step if your factory only pays piece-rate workers.',
                ],
                clickPath: ['Owner sidebar', 'Workers', 'Fixed/salary staff', 'Add staff'],
                doneWhen: 'At least one fixed worker exists, or the owner has skipped this optional step on this device.',
            },
        },
        {
            id: 'pay-cycle',
            icon: Calendar,
            title: 'Set your pay cycle',
            description: 'Define monthly payroll period, pay date, and reminders.',
            href: '/owner/payroll',
            ctaLabel: 'Configure payroll',
            isComplete: ({ checklist }) => checklist.hasPayrollConfig,
            help: {
                intro: 'The pay cycle tells Weavly which production logs belong in each monthly hisaab.',
                why: [
                    'Payroll needs clear cycle boundaries before settlement.',
                    'The pay date drives due, upcoming, and overdue payroll alerts.',
                    'Consistent periods prevent mixing two months of worker wages.',
                ],
                actions: [
                    'Choose the cycle start day used by your factory.',
                    'Choose the pay date day.',
                    'Pick a reminder window so Factory Today warns before payroll is due.',
                ],
                clickPath: ['Owner sidebar', 'Payroll', 'Payroll settings', 'Save payroll config'],
                doneWhen: 'A payroll configuration exists.',
            },
        },
        {
            id: 'plan',
            icon: CreditCard,
            title: 'Choose your plan',
            description: 'Start trial or subscribe so the factory can keep using the workflow.',
            href: '/owner/billing',
            ctaLabel: 'View plans',
            isComplete: ({ checklist }) => checklist.hasPlan,
            help: {
                intro: 'The plan step activates the account for continued use after setup.',
                why: [
                    'A trial lets the factory complete the first run without entering card details.',
                    'Billing status gates long-term access to premium workflows.',
                    'Owners can change plan details later from Billing.',
                ],
                actions: [
                    'Open Billing.',
                    'Start the free trial or select a paid plan.',
                    'Return to Factory Today to continue the first-run checklist.',
                ],
                clickPath: ['Owner sidebar', 'Billing', 'Choose trial or plan'],
                doneWhen: 'An active trial or subscription exists.',
            },
        },
    )

    return steps
}

// ─── Help Modal ────────────────────────────────────────────────────────────────

function StepHelpModal({ step, onClose }: { step: SetupStep | null; onClose: () => void }) {
    const { tx } = useTranslation()

    if (typeof document === 'undefined') return null

    return createPortal(
        <AnimatePresence>
            {step && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[90] flex h-[100dvh] items-center justify-center overflow-hidden bg-black/45 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-sm sm:px-4 sm:py-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="setup-step-help-title"
                >
                    <button
                        type="button"
                        className="absolute inset-0 cursor-default"
                        aria-label={tx("Close setup help")}
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ y: 20, scale: 0.98 }}
                        animate={{ y: 0, scale: 1 }}
                        exit={{ y: 20, scale: 0.98 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                        data-i18n-skip="true"
                        className="relative z-10 flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xl"
                    >
                        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-5 py-4">
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-saffron-deep">{tx("Step guide")}</p>
                                <h3 id="setup-step-help-title" className="mt-1 text-lg font-bold leading-tight text-ink">
                                    {tx(step.title)}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="shrink-0 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                                aria-label={tx("Close step guide")}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch]">
                            <p className="text-sm leading-relaxed text-body">{tx(step.help.intro)}</p>

                            <div className="mt-4 space-y-4">
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-ink">{tx("Why it matters")}</h4>
                                    <ul className="mt-2 space-y-2">
                                        {step.help.why.map((item) => (
                                            <li key={item} className="flex gap-2 text-sm leading-relaxed text-body">
                                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" />
                                                <span>{tx(item)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-ink">{tx("What to do")}</h4>
                                    <ol className="mt-2 space-y-2">
                                        {step.help.actions.map((item, index) => (
                                            <li key={item} className="flex gap-2 text-sm leading-relaxed text-body">
                                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-soft text-[11px] font-bold text-saffron-deep">
                                                    {index + 1}
                                                </span>
                                                <span>{tx(item)}</span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>

                                <div className="rounded-xl border border-saffron/20 bg-saffron/5 px-3 py-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-saffron-deep">{tx("Where to click")}</h4>
                                    <p className="mt-1 text-sm font-semibold leading-relaxed text-ink">
                                        {step.help.clickPath.map((item) => tx(item)).join(' -> ')}
                                    </p>
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wide text-ink">{tx("Done when")}</h4>
                                    <p className="mt-1 text-sm leading-relaxed text-body">{tx(step.help.doneWhen)}</p>
                                </div>

                                {step.help.note && (
                                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-3">
                                        <p className="text-sm leading-relaxed text-blue-900">{tx(step.help.note)}</p>
                                    </div>
                                )}
                            </div>

                            <Link
                                href={step.href}
                                onClick={onClose}
                                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-saffron px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-saffron-deep sm:w-auto"
                            >
                                {tx(step.ctaLabel)}
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    )
}

// ─── Step List (shared between desktop and mobile) ──────────────────────────────

function SetupStepList({
    checklist,
    activationChecklist,
    productionMode,
    skippedFixed,
    onSkipFixed,
}: {
    checklist: SetupChecklist
    activationChecklist: ActivationChecklist
    productionMode: ProductionMode
    skippedFixed: boolean
    onSkipFixed: () => void
}) {
    const { tx } = useTranslation()
    const [helpStep, setHelpStep] = useState<SetupStep | null>(null)
    const steps = buildSetupSteps(productionMode)

    const context: StepContext = {
        checklist,
        activationChecklist,
        productionMode,
        skippedFixed,
    }

    const getStepStatus = (step: SetupStep): StepStatus => {
        return step.isComplete(context) ? 'completed' : 'incomplete'
    }

    const completedCount = steps.reduce((count, step) => {
        return count + (getStepStatus(step) === 'completed' ? 1 : 0)
    }, 0)

    const totalSteps = steps.length
    const progressPct = (completedCount / totalSteps) * 100
    const currentStep = steps.find((step) => getStepStatus(step) === 'incomplete') ?? null
    const currentStepId = currentStep?.id ?? null
    const currentStepNumber = currentStep ? steps.findIndex((step) => step.id === currentStep.id) + 1 : totalSteps

    return (
        <div className="flex h-full flex-col" data-i18n-skip="true">
            {/* Header */}
            <div className="px-5 pb-4 pt-5">
                <div className="mb-1 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-saffron" />
                    <h2 className="text-sm font-bold uppercase tracking-wide text-ink">{tx("Factory Setup")}</h2>
                </div>
                <p className="mt-0.5 text-xs text-body">
                    {tx("{completed} of {total} steps complete · {mode}", {
                        completed: completedCount,
                        total: totalSteps,
                        mode: tx(getModeLabel(productionMode)),
                    })}
                </p>

                {/* Progress bar */}
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-saffron to-amber-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                </div>
            </div>

            <AnimatePresence mode="wait">
                {currentStep && (
                    <motion.div
                        key={currentStep.id}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.24, ease: 'easeOut' }}
                        className="px-5 pb-4"
                    >
                        <div
                            data-setup-next-guide="true"
                            className="rounded-2xl border border-saffron/20 bg-saffron/5 p-3 shadow-sm"
                        >
                            <div className="flex items-start gap-3">
                                <LoomiAvatar size="sm" className="rounded-xl" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-saffron-deep">
                                        <span>Loomi</span> · {tx("Next step")} · {tx("Step {step} of {total}", {
                                            step: currentStepNumber,
                                            total: totalSteps,
                                        })}
                                    </p>
                                    <h3 className="mt-1 text-sm font-bold leading-tight text-ink">{tx(currentStep.title)}</h3>
                                    <p className="mt-1 text-xs leading-relaxed text-body">{tx(currentStep.description)}</p>

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <Link
                                            href={currentStep.href}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-saffron px-3 py-1.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-saffron-deep"
                                        >
                                            {tx(currentStep.ctaLabel)}
                                            <ArrowRight className="h-3 w-3" />
                                        </Link>
                                        <button
                                            type="button"
                                            data-setup-guide-action="true"
                                            onClick={() => setHelpStep(currentStep)}
                                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-saffron-deep transition-all hover:-translate-y-0.5 hover:bg-saffron/10"
                                        >
                                            <Info className="h-3 w-3" />
                                            {tx("Guide")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Step list */}
            <div className="flex-1 overflow-y-auto px-5 pb-5">
                <div className="relative">
                    {/* Vertical connector line */}
                    <div className="absolute bottom-4 left-[15px] top-4 w-px bg-gray-200" />

                    <div className="space-y-1">
                        {steps.map((step, i) => {
                            const status = getStepStatus(step)
                            const isCurrent = step.id === currentStepId
                            const Icon = step.icon

                            return (
                                <motion.div
                                    key={step.id}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.025 }}
                                >
                                    <div
                                        className={cn(
                                            'relative rounded-xl transition-all duration-200',
                                            isCurrent
                                                ? 'border border-saffron/30 bg-white p-3 shadow-sm'
                                                : 'p-3',
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Step circle */}
                                            <div className={cn(
                                                'relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full transition-all duration-200',
                                                status === 'completed'
                                                    ? 'bg-emerald-100'
                                                    : isCurrent
                                                        ? 'bg-saffron/10 ring-2 ring-saffron/30'
                                                        : 'bg-gray-100'
                                            )}>
                                                {status === 'completed' ? (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                ) : (
                                                    <span className={cn(
                                                        'text-xs font-bold',
                                                        isCurrent ? 'text-saffron' : 'text-gray-400'
                                                    )}>
                                                        {i + 1}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Step content */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start gap-2">
                                                    <p className={cn(
                                                        'min-w-0 flex-1 text-sm font-semibold leading-tight',
                                                        status === 'completed'
                                                            ? 'text-emerald-700 line-through decoration-1'
                                                            : isCurrent ? 'text-ink' : 'text-body'
                                                    )}>
                                                        {tx(step.title)}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setHelpStep(step)}
                                                        className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-saffron/10 hover:text-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30"
                                                        aria-label={tx("Learn more about {title}", { title: tx(step.title) })}
                                                    >
                                                        <Info className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>

                                                {status === 'completed' && (
                                                    <p className="mt-0.5 text-[11px] font-medium text-emerald-500">{tx("Done")}</p>
                                                )}

                                                {/* Expanded content for current step */}
                                                {isCurrent && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        className="mt-1.5"
                                                    >
                                                        <p className="text-xs leading-relaxed text-body">
                                                            {tx(step.description)}
                                                        </p>

                                                        {step.id === 'supervisor' && (
                                                            <div className="mt-2 rounded-lg border border-amber-200/60 bg-amber-50 px-3 py-2">
                                                                <p className="text-[11px] leading-relaxed text-amber-800">
                                                                    {tx("If you do not have a separate supervisor, create a second account for yourself using the join code from Settings.")}
                                                                </p>
                                                                <p className="mt-1 text-[11px] italic text-amber-600">
                                                                    {tx("Planned update: production logging from owner account.")}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {step.id === 'supervisor' && (
                                                            <div className={cn(
                                                                'mt-2 flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium',
                                                                checklist.hasSupervisor
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : 'bg-red-50 text-red-600'
                                                            )}>
                                                                {checklist.hasSupervisor ? tx("Supervisor joined") : tx("No supervisor yet")}
                                                            </div>
                                                        )}

                                                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                                            <Link
                                                                href={step.href}
                                                                className={cn(
                                                                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5',
                                                                    'bg-saffron text-xs font-semibold text-white transition-colors',
                                                                    'hover:bg-saffron-deep'
                                                                )}
                                                            >
                                                                <Icon className="h-3.5 w-3.5" />
                                                                {tx(step.ctaLabel)}
                                                                <ArrowRight className="h-3 w-3" />
                                                            </Link>

                                                            <button
                                                                type="button"
                                                                onClick={() => setHelpStep(step)}
                                                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-saffron-deep transition-colors hover:bg-saffron/10"
                                                            >
                                                                <Info className="h-3 w-3" />
                                                                {tx("Guide")}
                                                            </button>
                                                        </div>

                                                        {/* Skip button for fixed staff step */}
                                                        {step.id === 'fixed-staff' && (
                                                            <button
                                                                type="button"
                                                                onClick={onSkipFixed}
                                                                className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400 transition-colors hover:text-gray-600"
                                                            >
                                                                <SkipForward className="h-3 w-3" />
                                                                {tx("Skip - I do not have salary staff")}
                                                            </button>
                                                        )}
                                                    </motion.div>
                                                )}

                                                {/* Upcoming step — show description in muted */}
                                                {!isCurrent && status !== 'completed' && (
                                                    <p className="mt-0.5 line-clamp-1 text-[11px] text-gray-400">
                                                        {tx(step.description)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-5 pb-4 pt-2">
                <p className="text-center text-[10px] text-gray-400">
                    {tx("Complete this once to prove the factory can run end to end.")}
                </p>
            </div>

            <StepHelpModal step={helpStep} onClose={() => setHelpStep(null)} />
        </div>
    )
}

// ─── Desktop Panel ──────────────────────────────────────────────────────────────

export function SetupPanel({ checklist, activationChecklist = EMPTY_ACTIVATION, productionMode }: SetupPanelProps) {
    const [skippedFixed, setSkippedFixed] = useState(() => {
        return typeof window !== 'undefined' && localStorage.getItem(SKIP_STORAGE_KEY) === 'true'
    })

    const handleSkipFixed = () => {
        localStorage.setItem(SKIP_STORAGE_KEY, 'true')
        setSkippedFixed(true)
    }

    const steps = buildSetupSteps(productionMode)
    const context: StepContext = {
        checklist,
        activationChecklist,
        productionMode,
        skippedFixed,
    }

    const isAllComplete = steps.every((step) => step.isComplete(context))

    if (isAllComplete) return null

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.3 }}
            className="hidden min-w-0 flex-col overflow-hidden rounded-2xl border border-saffron/15 bg-white/80 shadow-[0_4px_24px_-4px_rgba(226,112,37,0.08)] backdrop-blur-sm md:flex md:max-h-[calc(100vh-3rem)] min-[1440px]:sticky min-[1440px]:top-6"
        >
            <SetupStepList
                checklist={checklist}
                activationChecklist={activationChecklist}
                productionMode={productionMode}
                skippedFixed={skippedFixed}
                onSkipFixed={handleSkipFixed}
            />
        </motion.div>
    )
}

// ─── Mobile Floating Button + Modal ─────────────────────────────────────────────

export function SetupFloatingButton({ checklist, activationChecklist = EMPTY_ACTIVATION, productionMode }: SetupPanelProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [skippedFixed, setSkippedFixed] = useState(() => {
        return typeof window !== 'undefined' && localStorage.getItem(SKIP_STORAGE_KEY) === 'true'
    })

    const handleSkipFixed = () => {
        localStorage.setItem(SKIP_STORAGE_KEY, 'true')
        setSkippedFixed(true)
    }

    const steps = buildSetupSteps(productionMode)
    const context: StepContext = {
        checklist,
        activationChecklist,
        productionMode,
        skippedFixed,
    }

    const completedCount = steps.reduce((count, step) => {
        return count + (step.isComplete(context) ? 1 : 0)
    }, 0)

    const totalSteps = steps.length
    const isAllComplete = completedCount === totalSteps

    if (isAllComplete) return null

    const progressPct = (completedCount / totalSteps) * 100
    // SVG circle math
    const radius = 22
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (progressPct / 100) * circumference

    return (
        <>
            {/* Floating circle button */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className={cn(
                            'fixed z-50 flex h-14 w-14 items-center justify-center rounded-full md:hidden',
                            'bg-[#111111] shadow-xl shadow-black/20',
                            'bottom-[calc(80px+env(safe-area-inset-bottom,0px))] right-4',
                        )}
                        aria-label={`Factory setup: ${completedCount} of ${totalSteps} complete`}
                    >
                        {/* Progress ring */}
                        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 56 56">
                            <circle
                                cx="28" cy="28" r={radius}
                                fill="none"
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth="3"
                            />
                            <motion.circle
                                cx="28" cy="28" r={radius}
                                fill="none"
                                stroke="#E27025"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                        </svg>
                        {/* Center text */}
                        <span className="relative text-[11px] font-bold text-white">
                            {completedCount}/{totalSteps}
                        </span>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Modal overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[60] flex items-end justify-center md:hidden"
                    >
                        {/* Backdrop */}
                        <motion.div
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Modal content */}
                        <motion.div
                            initial={{ y: '100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                            className={cn(
                                'relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl',
                                'bg-white shadow-[0_-8px_30px_-4px_rgba(0,0,0,0.2)]',
                                'pb-safe',
                            )}
                        >
                            {/* Modal drag handle + close */}
                            <div className="flex items-center justify-between px-4 pb-1 pt-3">
                                <div className="mx-auto h-1 w-10 rounded-full bg-gray-300" />
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="absolute right-3 top-3 rounded-full p-1.5 transition-colors hover:bg-gray-100"
                                    aria-label="Close setup panel"
                                >
                                    <X className="h-4 w-4 text-gray-400" />
                                </button>
                            </div>

                            <SetupStepList
                                checklist={checklist}
                                activationChecklist={activationChecklist}
                                productionMode={productionMode}
                                skippedFixed={skippedFixed}
                                onSkipFixed={handleSkipFixed}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
