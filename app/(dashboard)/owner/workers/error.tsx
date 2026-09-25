'use client'

import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/context'

export default function RegisterError({ reset }: { reset: () => void }) {
  const { tx } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="border-b border-hairline/80 pb-5 text-center">
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:text-[2rem]">
          {tx('Workers')}
        </h1>
      </header>

      <section
        role="alert"
        aria-labelledby="workers-error-heading"
        className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden"
      >
        <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-risk/30 bg-risk-soft/60 text-risk shadow-2xs"
            aria-hidden="true"
          >
            <AlertCircle className="h-6 w-6" />
          </div>

          <h2 id="workers-error-heading" className="mt-4 text-base font-semibold text-ink">
            {tx("We couldn't load your workers.")}
          </h2>

          <p className="mt-1.5 max-w-sm text-sm text-subtle">
            {tx('Unable to load workers. Please retry.')}
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
