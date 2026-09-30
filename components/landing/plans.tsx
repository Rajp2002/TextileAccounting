import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Beam, Eyebrow } from './beam'
import s from './landing.module.css'

export const PLAN_COLUMNS = [
    { key: 'free', name: 'Free', fit: 'An enquiry now and then' },
    { key: 'lite', name: 'Lite', fit: 'Costing is a daily job' },
    { key: 'base', name: 'Base', fit: 'The costing runs the floor' },
] as const

type Cell = boolean | string

// Every row maps to a capability in lib/subscription-access.ts or a route in lib/owner-navigation.ts.
const groups: Array<{ title: string; rows: Array<{ label: string; cells: [Cell, Cell, Cell] }> }> = [
    {
        title: 'Costing',
        rows: [
            { label: 'Cost estimate, Quick and Detailed', cells: [true, true, true] },
            { label: 'Costings each month', cells: ['2', 'No limit', 'No limit'] },
            { label: 'Saved costings with the full breakdown', cells: [true, true, true] },
            { label: 'Cost Sheet and customer quotation PDFs', cells: [true, true, true] },
            { label: 'Reusable fabric qualities', cells: [false, true, true] },
            { label: 'Yarn Rate Book', cells: [false, true, true] },
            { label: 'Costing versions and comparison', cells: [false, true, true] },
            { label: 'Costing defaults and drafts kept on your device', cells: [false, true, true] },
        ],
    },
    {
        title: 'Factory',
        rows: [
            { label: 'Active qualities and machine assignments', cells: [false, false, true] },
            { label: 'Daily production by machine, day and night shift', cells: [false, false, true] },
            { label: 'Fabric and yarn stock', cells: [false, false, true] },
            { label: 'Dispatches on delivery challans', cells: [false, false, true] },
            { label: 'Workers, piece-rate payroll, advances and settlement', cells: [false, false, true] },
        ],
    },
    {
        title: 'Account',
        rows: [
            { label: 'English, हिंदी and ગુજરાતી', cells: [true, true, true] },
            { label: 'Owner export of your business data', cells: [false, true, true] },
        ],
    },
]

function Value({ cell }: { cell: Cell }) {
    if (typeof cell === 'string') {
        return <span className={cn(s.figure, 'text-[14px] font-semibold text-[color:var(--lp-ink)]')}>{cell}</span>
    }
    return cell ? (
        <>
            <Check className="mx-auto h-[18px] w-[18px] text-[color:var(--lp-ink)]" strokeWidth={2.25} aria-hidden="true" />
            <span className="sr-only">Included</span>
        </>
    ) : (
        <>
            <Minus className="mx-auto h-4 w-4 text-[color:var(--lp-line-strong)]" aria-hidden="true" />
            <span className="sr-only">Not included</span>
        </>
    )
}

export default function LandingPlans() {
    return (
        <Beam id="plans" labelledBy="plans-title" innerClassName="pt-20 sm:pt-24 lg:pt-28">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
                <div>
                    <Eyebrow>Plans</Eyebrow>
                    <h2 id="plans-title" className={cn(s.display, 'mt-5 text-[34px] font-semibold leading-[1.05] text-[color:var(--lp-ink)] sm:text-[46px]')}>
                        One costing engine. Choose how far it goes.
                    </h2>
                </div>
                <p className="max-w-[34rem] text-[17px] leading-[1.6] text-[color:var(--lp-body)]">
                    Same engine and Cost Sheet on every plan. One factory workspace per plan.
                </p>
            </div>

            <div className="mt-12 sm:mt-14">
                <table className="w-full table-fixed border-collapse text-left">
                    <caption className="sr-only">What each Weavly plan includes</caption>
                    <colgroup>
                        <col />
                        <col className="w-[3.75rem] xs:w-[4.5rem] sm:w-[8rem] lg:w-[11.5rem]" />
                        <col className="w-[3.75rem] xs:w-[4.5rem] sm:w-[8rem] lg:w-[11.5rem]" />
                        <col className="w-[3.75rem] xs:w-[4.5rem] sm:w-[8rem] lg:w-[11.5rem]" />
                    </colgroup>
                    <thead>
                        <tr className="border-b-2 border-[color:var(--lp-ink)]">
                            <td className="pb-3" />
                            {PLAN_COLUMNS.map((plan) => (
                                <th key={plan.key} scope="col" className="px-1 pb-3 text-center align-top sm:px-3">
                                    <span className={cn(s.display, 'block text-[18px] font-semibold text-[color:var(--lp-ink)] sm:text-[22px]')}>{plan.name}</span>
                                    <span className="mt-1 hidden text-[13px] font-normal leading-snug text-[color:var(--lp-muted)] sm:block">{plan.fit}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    {groups.map((group) => (
                        <tbody key={group.title}>
                            <tr>
                                <th scope="rowgroup" colSpan={4} className={cn(s.label, 'pb-2 pt-7 text-[color:var(--lp-saffron-ink)]')}>
                                    {group.title}
                                </th>
                            </tr>
                            {group.rows.map((row) => (
                                <tr key={row.label} className="border-t border-[color:var(--lp-line)]">
                                    <th scope="row" className="py-3 pr-3 text-[14px] font-normal leading-snug text-[color:var(--lp-body)] sm:text-[15px]">
                                        {row.label}
                                    </th>
                                    {row.cells.map((cell, index) => (
                                        <td key={PLAN_COLUMNS[index].key} className="px-1 py-3 text-center sm:px-3">
                                            <Value cell={cell} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    ))}
                </table>
                <p className="mt-6 max-w-[48rem] text-[14px] leading-6 text-[color:var(--lp-muted)]">
                    Base is owner-led: no separate supervisor logins, attendance or statutory payroll.
                </p>
            </div>
        </Beam>
    )
}
