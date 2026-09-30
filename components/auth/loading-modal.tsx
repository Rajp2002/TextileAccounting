'use client'

import { Loader2 } from 'lucide-react'
import Image from 'next/image'

interface LoadingModalProps {
    isOpen: boolean
    message?: string
}

export default function LoadingModal({ isOpen, message = 'Loading...' }: LoadingModalProps) {
    // CSS enter animations keep framer-motion out of the login first load. The
    // modal only closes by navigating away, so it needs no exit animation.
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/70 backdrop-blur-sm animate-in fade-in duration-200 motion-reduce:animate-none">
            <div className="flex w-full max-w-xs flex-col items-center rounded-2xl border border-hairline bg-surface p-8 shadow-[var(--shadow-modal)] animate-in fade-in zoom-in-90 duration-200 motion-reduce:animate-none">
                <div className="relative h-16 w-32 mb-4">
                    <Image
                        src="/images/WeavlyLogo.png"
                        alt="Weavly Logo"
                        fill
                        sizes="8rem"
                        className="object-contain animate-pulse"
                    />
                </div>
                <div className="flex items-center gap-3 font-medium text-ink">
                    <Loader2 className="h-5 w-5 animate-spin text-saffron" />
                    <span>{message}</span>
                </div>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                    Please wait while we prepare your workspace
                </p>
            </div>
        </div>
    )
}
