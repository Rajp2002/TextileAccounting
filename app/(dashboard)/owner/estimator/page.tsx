import { getFactoryCostProfile, getEstimatorTemplates, getFixedWorkersForOverhead } from './actions'
import EstimatorClient from './EstimatorClient'

export default async function EstimatorPage() {
    // Parallelize server-side data fetching for zero-latency initial load
    const [profileRes, templatesRes, workersRes] = await Promise.all([
        getFactoryCostProfile(),
        getEstimatorTemplates(),
        getFixedWorkersForOverhead(),
    ])

    return (
        <EstimatorClient 
            initialProfile={profileRes.data}
            initialTemplates={templatesRes.data}
            initialWorkers={workersRes.data}
        />
    )
}
