import { cn } from '@/lib/utils'
import { Beam, Eyebrow } from './beam'
import { CostStackLedger } from './cost-stack'
import s from './landing.module.css'

const notes = [
    { title: 'Quick or Detailed.', copy: 'Winding, processing, finishing and loom presets when you need them.' },
    { title: 'Two PDFs.', copy: 'An internal Cost Sheet, or a customer quotation that hides your costs.' },
]

export default function LandingProduct() {
    return (
        <Beam id="product" tone="deep" labelledBy="product-title" innerClassName="py-20 sm:py-24 lg:py-28">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-10 xl:gap-x-20">
                <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                    <Eyebrow>The cost stack</Eyebrow>
                    <h2 id="product-title" className={cn(s.display, 'mt-5 text-[34px] font-semibold leading-[1.05] text-[color:var(--lp-ink)] sm:text-[46px]')}>
                        Every paisa in the price has its own line.
                    </h2>
                    <p className="mt-5 max-w-[26rem] text-[17px] leading-[1.6] text-[color:var(--lp-body)]">
                        The example above, worked line by line. Change a rate there and this moves with it.
                    </p>
                </div>
                <div className={cn(s.rise, 'min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1')}>
                    <CostStackLedger />
                </div>
                <ul className="grid list-none content-start gap-3 border-t border-[color:var(--lp-line-strong)] pt-6 lg:col-start-1 lg:row-start-2">
                    {notes.map((note) => (
                        <li key={note.title} className="max-w-[26rem] text-[15px] leading-[1.55] text-[color:var(--lp-body)]">
                            <strong className="font-semibold text-[color:var(--lp-ink)]">{note.title}</strong> {note.copy}
                        </li>
                    ))}
                </ul>
            </div>
        </Beam>
    )
}
