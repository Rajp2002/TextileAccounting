'use client'

import { useTransition } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { exportOrganizationData } from '@/app/(dashboard)/owner/settings/data-export'
import { downloadJson } from '@/lib/browser-download'

export function OrganizationDataExportButton() {
    const [pending, startTransition] = useTransition()
    const download = () => startTransition(async () => {
        try {
            const payload = await exportOrganizationData()
            const filename = `weavly-org-export-${new Date().toISOString().slice(0, 10)}.json`
            downloadJson(payload, filename)
            toast.success('Data export downloaded', { description: filename })
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
