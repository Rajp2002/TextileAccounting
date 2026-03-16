'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface AuthLayoutProps {
    children: ReactNode
    title: string
    subtitle: string
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
            {/* Decorative background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-amber-400/10 blur-3xl" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-400/10 blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="relative z-10 w-full max-w-md"
            >
                <div className="backdrop-blur-xl bg-white/70 border border-white/50 shadow-2xl rounded-2xl overflow-hidden">
                    <div className="p-8 pb-6 text-center">
                        {/* Logo placeholder - replace with actual logo if available */}
                        <div className="mx-auto mb-6 h-12 w-12 rounded-xl bg-gradient-to-br from-amber-600 to-orange-700 flex items-center justify-center shadow-lg transform rotate-3">
                            <span className="text-white font-bold text-xl">V</span>
                        </div>

                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">
                            {title}
                        </h1>
                        <p className="text-sm text-gray-500">
                            {subtitle}
                        </p>
                    </div>

                    <div className="px-8 pb-8">
                        {children}
                    </div>
                </div>

                {/* Footer links or branding */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-400 font-medium">Vastra &copy; {new Date().getFullYear()}</p>
                </div>
            </motion.div>
        </div>
    )
}
