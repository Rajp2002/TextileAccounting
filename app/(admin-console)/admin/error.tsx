'use client'

import { AdminUnavailable } from '@/components/admin/primitives'
import { Button } from '@/components/ui/button'

export default function FounderError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <div className="space-y-4"><AdminUnavailable title="This view could not be loaded" description="No records or counts have been assumed. Try the source again, or sign in again if your session has ended."/><Button onClick={reset}>Try again</Button><form action="/auth/signout" method="post"><Button variant="outline" type="submit">Sign out</Button></form></div>
}
