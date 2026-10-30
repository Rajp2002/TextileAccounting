import {ActivityTracker} from '@/components/analytics/ActivityTracker'
import {SupportShell} from '@/components/support/support-shell'

export default function SupportLayout({children}:{children:React.ReactNode}){
 return <SupportShell><ActivityTracker/>{children}</SupportShell>
}
