import { BaseWorkspaceLoading } from '@/components/production/base-workspace-loading'

export default function Loading() {
    return <BaseWorkspaceLoading route="/owner/production" title="Production" summaryCards={2} />
}
