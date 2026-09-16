'use client'

import type { BaseProductionJob, BaseProductionWorker } from '@/lib/base-production-core'
import { useTranslation } from '@/lib/i18n/context'
import { workersTutorialCopy } from '@/lib/i18n/workers-tutorial'

/** Display the pay source, never infer production readiness from a legacy worker rate. */
export function WorkerPayBasis({ worker, quality }: {
    worker: Pick<BaseProductionWorker, 'pay_type'>
    quality?: Pick<BaseProductionJob, 'worker_rate_per_meter'>
}) {
    const { language = 'en' } = useTranslation()
    const copy = workersTutorialCopy[language]
    const label = worker.pay_type === 'fixed_monthly'
        ? copy.salaryBasis
        : quality && quality.worker_rate_per_meter >= 0
            ? `${copy.qualityWage}: ₹${quality.worker_rate_per_meter}/m`
            : copy.wageSource
    return <span data-i18n-skip="true" lang={language}>{label}</span>
}
