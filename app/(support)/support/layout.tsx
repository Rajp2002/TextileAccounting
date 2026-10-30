import {ActivityTracker} from '@/components/analytics/ActivityTracker'
import {SupportWorkspaceFrame} from '@/components/support/support-workspace-frame'

export default function SupportLayout({children}:{children:React.ReactNode}){
 return <SupportWorkspaceFrame><ActivityTracker/>{children}</SupportWorkspaceFrame>
}
