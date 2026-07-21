'use client'

import { useTransition } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { exportOrganizationData } from '@/app/(dashboard)/owner/settings/data-export'

export function OrganizationDataExportButton() {
    const [pending, startTransition] = useTransition()
    const download = () => startTransition(async () => {
        try {
            const payload = await exportOrganizationData()
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = `weavly-org-export-${new Date().toISOString().slice(0, 10)}.json`
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            URL.revokeObjectURL(url)
            toast.success('Data export downloaded')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to export organization data')
        }
    })

    return (
        <Button onClick={download} disabled={pending} className="gap-2">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {pending ? 'Preparing export' : 'Download organization data'}
        </Button>
    )
}
