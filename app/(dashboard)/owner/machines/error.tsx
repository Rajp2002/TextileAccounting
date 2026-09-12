'use client'

import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'

export default function RegisterError({ reset }: { reset: () => void }) {
  const { tx } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
          {tx('Machines')}
        </h1>
        <p className="text-sm text-subtle">
          {tx('Add and manage the machines in your factory.')}
        </p>
      </header>

      <section
        role="alert"
        aria-labelledby="machines-error-heading"
        className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden"
      >
        <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-risk/30 bg-risk-soft/60 text-risk shadow-2xs"
            aria-hidden="true"
          >
            <AlertCircle className="h-6 w-6" />
          </div>

          <h2 id="machines-error-heading" className="mt-4 text-base font-semibold text-ink">
            {tx("We couldn't load your machines.")}
          </h2>

          <p className="mt-1.5 max-w-sm text-sm text-subtle">
            {tx('Unable to load machines. Please retry.')}
          </p>

          <div className="mt-5">
            <Button
              onClick={reset}
              className="h-10 rounded-xl bg-loom px-5 font-medium text-white shadow-xs transition-all duration-150 hover:bg-loom-elevated hover:text-white active:scale-[0.98] focus-visible:ring-saffron"
            >
              {tx('Try again')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
