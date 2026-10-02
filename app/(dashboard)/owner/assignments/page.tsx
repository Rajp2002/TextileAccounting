import BaseAssignmentsClient from './BaseAssignmentsClient'
import { loadBaseAssignmentsInitialData } from './loaders'

export default async function OperationsPage() {
    const workspace = await loadBaseAssignmentsInitialData()
    if (!workspace) return null
    return <BaseAssignmentsClient initialData={workspace.initialData} tourMetadata={workspace.tourMetadata} />
}
