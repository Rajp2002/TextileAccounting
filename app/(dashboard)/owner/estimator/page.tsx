import { getFactoryCostProfile, getEstimatorTemplates, getFixedWorkersForOverhead } from './actions'
import EstimatorClient from './EstimatorClient'
import { Suspense } from 'react'

export default async function EstimatorPage() {
    // Parallelize server-side data fetching for zero-latency initial load
    const [profileRes, templatesRes, workersRes] = await Promise.all([
        getFactoryCostProfile(),
        getEstimatorTemplates(),
        getFixedWorkersForOverhead(),
    ])

    return (
        <Suspense fallback={<div className="p-20 text-center">Loading Estimator...</div>}>
            <EstimatorClient 
                initialProfile={profileRes.data}
                initialTemplates={templatesRes.data}
                initialWorkers={workersRes.data}
            />
        </Suspense>
    )
}
