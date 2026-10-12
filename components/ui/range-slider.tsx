import type { ComponentProps, CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import styles from './range-slider.module.css'

type RangeSliderProps = Omit<ComponentProps<'input'>, 'type' | 'value' | 'min' | 'max' | 'step' | 'onChange'> & {
    min: number
    max: number
    step: number
    value: number
    onValueChange: (value: number) => void
}

/**
 * The product's one range slider (first built for the landing page's cost sheet).
 * It is the native range input, so the keyboard (arrows, Page Up/Down, Home/End),
 * touch dragging and screen readers work without extra code. Pass `aria-valuetext`
 * when the bare number does not say enough.
 */
export function RangeSlider({ min, max, step, value, onValueChange, className, style, ...props }: RangeSliderProps) {
    const span = max - min
    const fill = span > 0 ? Math.min(100, Math.max(0, ((value - min) / span) * 100)) : 0
    return (
        <input
            {...props}
            type="range"
            className={cn(styles.range, className)}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => onValueChange(Number(event.target.value))}
            style={{ ...style, '--fill': `${fill}%` } as CSSProperties}
        />
    )
}
