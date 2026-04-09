'use client'

import { motion } from 'framer-motion'

export default function LandingBackground() {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
            {/* Persistence Grid Pattern across entire scroll */}
            <svg
                className="absolute inset-0 h-full w-full stroke-gray-200/50 [mask-image:radial-gradient(100%_100%_at_top_center,white,transparent)] dark:stroke-zinc-800/50"
                aria-hidden="true"
            >
                <defs>
                    <pattern id="grid-pattern-global" width={40} height={40} x="50%" y={-1} patternUnits="userSpaceOnUse">
                        <path d="M40 40V.5M.5 .5H40" fill="none" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern-global)" />
            </svg>

            {/* "Paint Slab" Blurred Hue Blobs */}
            
            {/* Top Right - Orange/Amber */}
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="absolute -top-[10%] -right-[10%] aspect-[1/1] w-[60rem] bg-gradient-to-br from-amber-500/20 to-orange-600/20 blur-[120px] rounded-full"
            />

            {/* Mid Left - Amber Shift */}
            <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ 
                    opacity: 0.15, 
                    x: 0,
                    y: [0, 20, 0],
                }}
                transition={{ 
                    opacity: { duration: 2 },
                    y: { repeat: Infinity, duration: 10, ease: "easeInOut" }
                }}
                className="absolute top-[30%] -left-[20%] aspect-[1/1] w-[50rem] bg-gradient-to-tr from-orange-400/20 to-amber-500/20 blur-[100px] rounded-full"
            />

            {/* Mid Right - Deep Orange */}
            <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ 
                    opacity: 0.1, 
                    x: 0,
                    y: [0, -30, 0],
                }}
                transition={{ 
                    opacity: { duration: 2, delay: 0.5 },
                    y: { repeat: Infinity, duration: 12, ease: "easeInOut" }
                }}
                className="absolute top-[60%] -right-[15%] aspect-[1/1] w-[45rem] bg-gradient-to-bl from-amber-600/10 to-orange-500/10 blur-[110px] rounded-full"
            />

            {/* Bottom Left - Soft Amber */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.15 }}
                transition={{ duration: 3, delay: 1 }}
                className="absolute -bottom-[10%] -left-[10%] aspect-[1/1] w-[55rem] bg-gradient-to-tr from-orange-500/20 to-amber-400/20 blur-[120px] rounded-full"
            />
        </div>
    )
}
