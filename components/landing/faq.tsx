const faqs = [
    {
        question: 'Does Weavly work for grey fabric weaving factories?',
        answer: 'Yes. The workflows are designed around Cost Estimates, Machine Assignments, Metres Produced This Shift, Market Runs, dispatch tracking, Upaad, and Piece-Rate Worker Hisaab.',
    },
    {
        question: 'Can my supervisor use this on the factory floor?',
        answer: 'Yes. The supervisor flow is mobile-first and focused on daily actions: assign workers, update Machine status, enter Metres Produced This Shift, and submit shift logs.',
    },
    {
        question: 'What happens if the factory internet is unreliable?',
        answer: 'The production flow is designed for quick mobile entry in patchy factory conditions, with drafts kept on the device while you are signed in. Saving production, Kharchi, Worker Hisaab, sale, dispatch, and payment entries requires an internet connection.',
    },
    {
        question: 'What does Weavly replace?',
        answer: 'It brings the production register, Excel costing sheet, order list, Godown Stock ledger, Delivery Challan follow-ups, Party receivables, Upaad, and Worker Hisaab into one connected record.',
    },
    {
        question: 'Is factory and worker data secure?',
        answer: 'Weavly uses tenant isolation, row-level security, role-based access, and DPDP-aware privacy controls so each factory can access only its own data and authorized staff records.',
    },
    {
        question: 'Can I start with only one floor or supervisor?',
        answer: 'Yes. The best pilot is small: one factory floor, a few machines, active orders or market runs, and one supervisor using the daily production flow.',
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
                    <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
                        Practical answers about adoption, floor usage, data, and what Weavly replaces.
                    </p>
                </div>

                <div className="mx-auto mt-12 max-w-5xl border-y border-zinc-200 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-zinc-950/60">
                    {faqs.map((faq, index) => (
                        <div key={faq.question} className="grid gap-3 border-b border-zinc-200 px-4 py-6 last:border-b-0 dark:border-white/10 md:grid-cols-[4rem_0.8fr_1.2fr] md:gap-6 md:px-6">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-400">0{index + 1}</p>
                            <h3 className="text-lg font-black leading-7 text-zinc-950 dark:text-white">{faq.question}</h3>
                            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{faq.answer}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
