const faqs = [
    {
        question: 'Does Weavly work for grey fabric weaving factories?',
        answer: 'Yes. The current Base Plan is designed around the costing work before production: fabric qualities, warp and weft inputs, factory costs, GST, margin, break-even price, saved costings, and Cost Sheet exports.',
    },
    {
        question: 'What is included in the current rollout?',
        answer: 'The paid Base Plan includes the Estimator, reusable fabric qualities, saved costing history, configurable costing defaults, margin visibility, and Cost Sheet export. Full Suite factory operations are in development and are not available yet.',
    },
    {
        question: 'What happens if the factory internet is unreliable?',
        answer: 'The Estimator works as an installable PWA, and drafts can remain on the device while you are signed in. Saving a costing and exporting a Cost Sheet requires an internet connection.',
    },
    {
        question: 'What does Weavly replace?',
        answer: 'It replaces the spreadsheet and handwritten work used to rebuild yarn assumptions, factory costs, landed cost, break-even price, and margin for each costing.',
    },
    {
        question: 'Is my costing data secure?',
        answer: 'Weavly uses tenant isolation, row-level security, role-based access, and DPDP-aware privacy controls so each factory can access only its own account and costing data.',
    },
    {
        question: 'Can I start with only the costing desk?',
        answer: 'Yes. That is the intended Base Plan rollout: start with one factory, one owner, and a clear costing process before considering the Full Suite when it becomes available.',
    },
]

export default function LandingFAQ() {
    return (
        <section className="landing-section py-20 sm:py-28 lg:py-12 relative overflow-hidden" id="faq">
            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="mx-auto max-w-3xl text-center">
                    <p className="text-xs font-black leading-7 text-orange-700 dark:text-orange-500 tracking-[0.28em] uppercase">FAQ</p>
                    <h2 className="mt-2 text-4xl font-black tracking-tight text-zinc-950 sm:text-5xl dark:text-white">
                        Questions a factory owner should ask before switching.
                    </h2>
                    <p className="mt-6 text-lg leading-8 text-[var(--color-body)]">
                        Practical answers about adoption, floor usage, data, and what Weavly replaces.
                    </p>
                </div>

                <div className="mx-auto mt-12 max-w-5xl border-y border-zinc-200 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-zinc-950/60">
                    {faqs.map((faq, index) => (
                        <div key={faq.question} className="grid gap-3 border-b border-zinc-200 px-4 py-6 last:border-b-0 dark:border-white/10 md:grid-cols-[4rem_0.8fr_1.2fr] md:gap-6 md:px-6">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-600">0{index + 1}</p>
                            <h3 className="text-lg font-black leading-7 text-zinc-950 dark:text-white">{faq.question}</h3>
                            <p className="text-sm leading-6 text-[var(--color-body)]">{faq.answer}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
