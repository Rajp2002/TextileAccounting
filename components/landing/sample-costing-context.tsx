'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { SAMPLE_START, type SampleInputs, type SampleResult } from './sample-format'

type Engine = typeof import('./sample-costing')

type SampleCosting = {
    inputs: SampleInputs
    result: SampleResult
    start: SampleResult
    /** Start fetching the engine (pointer or focus on the sheet), before the first change. */
    prepare: () => void
    setInput: (key: keyof SampleInputs, value: number) => void
    reset: () => void
}

const SampleCostingContext = createContext<SampleCosting | null>(null)

const KEYS = Object.keys(SAMPLE_START) as Array<keyof SampleInputs>

/**
 * Shares one example costing between the hero sheet and the cost-stack
 * section. The starting result is rendered by the server; the engine is only
 * imported once a visitor reaches for a control, so it never competes with
 * first paint or the brand intro.
 */
export function SampleCostingProvider({ start, children }: { start: SampleResult; children: ReactNode }) {
    const [inputs, setInputs] = useState<SampleInputs>(SAMPLE_START)
    const [engine, setEngine] = useState<Engine | null>(null)
    const requested = useRef(false)

    const prepare = useCallback(() => {
        if (requested.current) return
        requested.current = true
        import('./sample-costing')
            .then((module) => setEngine(module))
            .catch(() => {
                requested.current = false
            })
    }, [])

    const setInput = useCallback((key: keyof SampleInputs, next: number) => {
        prepare()
        setInputs((current) => ({ ...current, [key]: next }))
    }, [prepare])
    const reset = useCallback(() => setInputs(SAMPLE_START), [])

    const unchanged = KEYS.every((key) => inputs[key] === SAMPLE_START[key])
    const result = useMemo(() => (unchanged || !engine ? start : engine.costSample(inputs)), [unchanged, engine, inputs, start])

    const value = useMemo<SampleCosting>(
        () => ({ inputs, result, start, prepare, setInput, reset }),
        [inputs, result, start, prepare, setInput, reset],
    )

    return <SampleCostingContext.Provider value={value}>{children}</SampleCostingContext.Provider>
}

export function useSampleCosting(): SampleCosting {
    const value = useContext(SampleCostingContext)
    if (!value) throw new Error('useSampleCosting must be used inside SampleCostingProvider')
    return value
}
