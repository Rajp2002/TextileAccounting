const faqs = [
    {
        question: 'Does Weavly work for grey fabric weaving factories?',
        answer: 'Yes. The workflows are designed around fabric estimating, loom assignment, shift-wise meter logging, market runs, dispatch tracking, advances, and piece-rate payroll.',
    },
    {
        question: 'Can my supervisor use this on the factory floor?',
        answer: 'Yes. The supervisor flow is mobile-first and focused on daily actions: assign workers, update machine status, enter meter readings, and submit shift logs.',
    },
    {
        question: 'What happens if the factory internet is unreliable?',
        answer: 'The production flow is built for patchy internet. Meter entries can be captured locally and synced when the connection returns, so the floor is not blocked by network issues.',
    },
    {
        question: 'What does Weavly replace?',
        answer: 'For many factories, it replaces the production register, hajiri book, Excel costing sheet, paper challan follow-ups, WhatsApp status chasing, and parchi-style payroll calculations.',
    },
    {
        question: 'Is factory and worker data secure?',
        answer: 'Weavly uses tenant isolation, row-level security, and DPDP-aware privacy controls so each factory can access only its own data and authorized staff records.',
    },
    {
        question: 'Can I start with only one floor or supervisor?',
        answer: 'Yes. The best pilot is small: one factory floor, a few machines, active orders or market runs, and one supervisor using the daily production flow.',
    },
]

export default function LandingFAQ() {
    return (
        <section className="py-16 sm:py-24 relative overflow-hidden snap-start scroll-mt-20" id="faq">
            <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
                <div className="mx-auto max-w-3xl text-center">
                    <p className="text-sm font-bold leading-7 text-amber-700 dark:text-amber-500 tracking-[0.22em] uppercase">FAQ</p>
                    <h2 className="mt-2 text-4xl font-extrabold tracking-tight text-gray-950 sm:text-5xl dark:text-white">
                        Questions a factory owner should ask before switching.
                    </h2>
                    <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                        Practical answers about adoption, floor usage, data, and what Weavly replaces.
                    </p>
                </div>

                <div className="mx-auto mt-12 grid max-w-6xl gap-4 md:grid-cols-2">
                    {faqs.map((faq) => (
                        <div key={faq.question} className="border border-gray-200 bg-white/85 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
                            <h3 className="text-lg font-bold leading-7 text-gray-950 dark:text-white">{faq.question}</h3>
                            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{faq.answer}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
