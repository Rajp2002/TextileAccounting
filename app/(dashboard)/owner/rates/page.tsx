import RatesClient from './RatesClient'
import { getCostRates } from './actions'
import { requireRole } from '@/lib/auth'
import type { CostRateRow } from '@/lib/cost-rates'
import type { YarnRateConflict } from '@/lib/yarn-rate-reconciliation'

export default async function RatesPage() {
    const [{ user, profile }, result] = await Promise.all([
        requireRole(['owner']),
        getCostRates({ includeArchived: true }),
    ])

    return (
        <RatesClient
            initialRates={(result.data ?? []) as CostRateRow[]}
            initialConflicts={(result.conflicts ?? []) as YarnRateConflict[]}
            defaultReviewIntervalDays={result.yarnReviewIntervalDays ?? 90}
            userMetadata={user.user_metadata}
            userId={user.id}
            orgId={profile.org_id}
        />
    )
}

