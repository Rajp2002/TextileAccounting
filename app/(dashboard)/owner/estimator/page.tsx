import { getFactoryCostProfile, getEstimatorTemplates, getFixedWorkersForOverhead } from './actions'
import { getQualities } from '../actions'
import EstimatorClient from './EstimatorClient'
import { Suspense } from 'react'

export default async function EstimatorPage() {
    // Parallelize server-side data fetching for zero-latency initial load
    const [profileRes, templatesRes, workersRes, qualities] = await Promise.all([
        getFactoryCostProfile(),
        getEstimatorTemplates(),
        getFixedWorkersForOverhead(),
        getQualities(),
    ])

    return (
        <Suspense fallback={<div className="p-20 text-center">Loading Estimator...</div>}>
            <EstimatorClient 
                initialProfile={profileRes.data}
                initialTemplates={templatesRes.data}
                initialWorkers={workersRes.data}
                initialQualities={qualities}
            />
        </Suspense>
    )
}
