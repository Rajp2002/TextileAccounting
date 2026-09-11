'use client'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'
export default function RegisterError({ reset }: { reset: () => void }) {
 const { tx } = useTranslation()
 return <section role="alert" className="space-y-4 p-6"><h1 className="text-2xl font-bold">{tx('Machines')}</h1><p>{tx('Unable to load machines. Please retry.')}</p><Button onClick={reset}>{tx('Try again')}</Button></section>
}
