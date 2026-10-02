import Link from 'next/link'
import { Archive, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function FeatureArchivedPage() {
    return (
        <main className="safe-area-page min-h-svh bg-canvas [--page-gutter-x:1rem] [--page-gutter-y:4rem]">
            <Card className="mx-auto max-w-md border-wv-border-default shadow-sm">
                <CardContent className="space-y-5 p-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-soft">
                        <Archive className="h-6 w-6 text-subtle" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-xl font-black text-ink">Feature unavailable</h1>
                        <p className="text-sm font-medium text-subtle">
                            This workspace is no longer available. Owners can continue in the current Free, Lite, or Base workspace.
                        </p>
                    </div>
                    <Button asChild className="gap-2">
                        <Link href="/owner/estimator">
                            <ArrowLeft className="h-4 w-4" />
                            Go to estimator
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </main>
    )
}
