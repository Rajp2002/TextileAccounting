'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { BrandBackground } from '@/components/brand-background'

export default function AuthCodeError() {
    return (
        <div className="safe-area-page relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background [--page-gutter-x:1rem] [--page-gutter-y:1rem] sm:[--page-gutter-y:3rem] sm:[--page-gutter-x:1.5rem] lg:[--page-gutter-x:2rem]">
            <BrandBackground variant="auth" />
            <div className="relative z-10 w-full max-w-md text-center space-y-4 sm:space-y-8">
                <div className="mx-auto flex h-12 w-12 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-wv-status-danger-bg">
                    <AlertTriangle className="h-6 w-6 sm:h-12 sm:w-12 text-wv-status-danger-fg" aria-hidden="true" />
                </div>
                <div>
                    <h2 className="mt-3 sm:mt-6 text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                        Authentication Error
                    </h2>
                    <p className="mt-2 text-sm text-body">
                        We couldn&apos;t verify your login link. It may have expired or already been used.
                    </p>
                </div>
                <div className="mt-4 space-y-3 sm:mt-8 sm:space-y-4">
                    <Link href="/login" className="block w-full">
                        <Button className="min-h-[44px] w-full sm:min-h-0">
                            Try Logging in Again
                        </Button>
                    </Link>
                    <Link href="/" className="block w-full">
                        <Button variant="outline" className="min-h-[44px] w-full sm:min-h-0">
                            Return Home
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}
