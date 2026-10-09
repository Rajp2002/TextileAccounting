'use client'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
export default function RegisterError({ reset }: { reset: () => void }) {
    const { tx } = useTranslation()

    return (
        <section role="alert" className="mx-auto w-full space-y-4 p-6">
            <h1 className="border-b border-hairline/80 pb-5 text-center text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:text-[2rem]">
                {tx('Machine Assignments')}
            </h1>
            <p>{tx('Unable to load assignments. Please retry.')}</p>
            <Button onClick={reset}>{tx('Try again')}</Button>
        </section>
    )
}
