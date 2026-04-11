'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface AmountProps {
    value: number | string
    className?: string
    currency?: string
    locale?: string
    showDecimals?: boolean
}

/**
 * Renders a currency amount with professional formatting:
 * - Hides decimals if they are .00 (unless showDecimals is true)
 * - Renders non-zero decimals in a smaller font size for better visual hierarchy.
 */
export function Amount({ 
    value, 
    className, 
    currency = 'INR', 
    locale = 'en-IN',
    showDecimals = false 
}: AmountProps) {
    const num = typeof value === 'string' ? parseFloat(value) : value
    
    if (isNaN(num)) return <span className={className}>—</span>

    const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })

    const parts = formatter.formatToParts(num)
    
    // Check if we should hide decimals (if they are .00 and showDecimals is false)
    const fractionPart = parts.find(p => p.type === 'fraction')?.value
    const isZeroDecimal = fractionPart === '00'
    const hideDecimals = isZeroDecimal && !showDecimals

    return (
        <span className={cn('inline-flex items-baseline font-semibold', className)}>
            {parts.map((part, i) => {
                if (hideDecimals && (part.type === 'decimal' || part.type === 'fraction')) {
                    return null
                }
                
                if (part.type === 'decimal' || part.type === 'fraction') {
                    return (
                        <span key={i} className="text-[0.75em] opacity-85 font-medium">
                            {part.value}
                        </span>
                    )
                }
                
                return <span key={i}>{part.value}</span>
            })}
        </span>
    )
}
