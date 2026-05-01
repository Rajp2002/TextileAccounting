import Link from 'next/link'
import { Archive, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function FeatureArchivedPage() {
    return (
        <main className="min-h-screen bg-slate-50 px-4 py-16">
            <Card className="mx-auto max-w-md border-slate-200 shadow-sm">
                <CardContent className="space-y-5 p-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                        <Archive className="h-6 w-6 text-slate-500" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-xl font-black text-slate-900">Feature archived for Phase 1</h1>
                        <p className="text-sm font-medium text-slate-500">
                            This module is preserved for a future release, but it is not active in the focused Phase 1 workflow.
                        </p>
                    </div>
                    <Button asChild className="gap-2">
                        <Link href="/owner/analytics">
                            <ArrowLeft className="h-4 w-4" />
                            Back to production overview
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </main>
    )
}
