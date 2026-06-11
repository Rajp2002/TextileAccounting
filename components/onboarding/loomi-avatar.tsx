'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface LoomiAvatarProps {
    className?: string
    size?: 'sm' | 'md' | 'lg'
}

export function LoomiAvatar({ className, size = 'md' }: LoomiAvatarProps) {
    const prefersReducedMotion = useReducedMotion()
    const sizes = {
        sm: 'h-10 w-10',
        md: 'h-12 w-12',
        lg: 'h-16 w-16',
    }

    return (
        <motion.div
            data-loomi-avatar="true"
            animate={prefersReducedMotion ? undefined : { y: [0, -2, 0], rotate: [0, -0.8, 0.6, 0] }}
            transition={prefersReducedMotion ? undefined : {
                duration: 4.2,
                ease: 'easeInOut',
                repeat: Infinity,
            }}
            className={cn(
                'relative shrink-0 rounded-2xl border border-saffron/25 bg-saffron-soft shadow-sm',
                "before:absolute before:left-2 before:top-2 before:h-3 before:w-3 before:rounded-full before:bg-white/45 before:content-['']",
                sizes[size],
                className
            )}
            aria-hidden="true"
        >
            <div className="absolute left-[28%] top-[30%] h-1.5 w-1.5 rounded-full bg-ink" />
            <div className="absolute right-[28%] top-[30%] h-1.5 w-1.5 rounded-full bg-ink" />
            <div className="absolute left-1/2 top-[49%] h-1.5 w-4 -translate-x-1/2 rounded-b-full border-b-2 border-ink/80" />
            <div className="absolute bottom-2 left-1/2 h-2.5 w-6 -translate-x-1/2 rounded-full border border-saffron-deep/25 bg-saffron/70" />
            <div className="absolute -bottom-1 right-1 h-3 w-5 rotate-[-10deg] rounded-full border border-saffron/35 bg-canvas" />
        </motion.div>
    )
}
