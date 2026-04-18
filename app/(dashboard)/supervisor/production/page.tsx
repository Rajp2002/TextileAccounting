'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function ProductionRedirect() {
    const router = useRouter()
    useEffect(() => {
        router.replace('/supervisor/dashboard')
    }, [router])

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-center">
                Moving to Unified Dashboard...
            </p>
        </div>
    )
}
