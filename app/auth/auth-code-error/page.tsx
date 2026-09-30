'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { BrandBackground } from '@/components/brand-background'

export default function AuthCodeError() {
    return (
        <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 sm:px-6 lg:px-8">
            <BrandBackground variant="auth" />
            <div className="relative z-10 w-full max-w-md text-center space-y-8">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-wv-status-danger-bg">
                    <AlertTriangle className="h-12 w-12 text-wv-status-danger-fg" aria-hidden="true" />
                </div>
                <div>
                    <h2 className="mt-6 text-3xl font-bold tracking-tight text-ink">
                        Authentication Error
                    </h2>
                    <p className="mt-2 text-sm text-body">
                        We couldn&apos;t verify your login link. It may have expired or already been used.
                    </p>
                </div>
                <div className="mt-8 space-y-4">
                    <Link href="/login" className="block w-full">
                        <Button className="w-full">
                            Try Logging in Again
                        </Button>
                    </Link>
                    <Link href="/" className="block w-full">
                        <Button variant="outline" className="w-full">
                            Return Home
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}
