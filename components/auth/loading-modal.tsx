'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'

interface LoadingModalProps {
    isOpen: boolean
    message?: string
}

export default function LoadingModal({ isOpen, message = 'Loading...' }: LoadingModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white p-8 rounded-2xl shadow-2xl border border-amber-100 flex flex-col items-center max-w-xs w-full"
                    >
                        <div className="relative h-16 w-16 mb-4">
                            <Image
                                src="/logo.png"
                                alt="Loomi Logo"
                                fill
                                className="object-contain animate-pulse"
                            />
                        </div>
                        <div className="flex items-center gap-3 text-amber-900 font-medium">
                            <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                            <span>{message}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-4 text-center">
                            Please wait while we prepare your workspace
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
