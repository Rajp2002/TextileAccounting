'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { SAMPLE_START, type SampleInputs, type SampleResult } from './sample-format'

type Engine = typeof import('./sample-costing')
export type SampleEngineState = 'idle' | 'loading' | 'ready' | 'error'

type SampleCosting = {
    inputs: SampleInputs
    /**
     * Money for the current controls. Null after a change while the engine is
     * loading or failed: the starting money is never shown as their result.
     */
    result: SampleResult | null
    start: SampleResult
    engine: SampleEngineState
    /** Start fetching the engine (pointer or focus on the sheet), before the first change. */
    prepare: () => void
    /** Try loading the engine again after a failure. */
    retry: () => void
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
    const [loadState, setLoadState] = useState<SampleEngineState>('idle')
    const requested = useRef(false)

    const prepare = useCallback(() => {
        if (requested.current) return
        requested.current = true
        setLoadState('loading')
        import('./sample-costing')
            .then((module) => { setEngine(module); setLoadState('ready') })
            .catch(() => {
                requested.current = false
                setLoadState('error')
            })
    }, [])

    const setInput = useCallback((key: keyof SampleInputs, next: number) => {
        prepare()
        setInputs((current) => ({ ...current, [key]: next }))
    }, [prepare])
    const reset = useCallback(() => setInputs(SAMPLE_START), [])

    const unchanged = KEYS.every((key) => inputs[key] === SAMPLE_START[key])
    const computed = useMemo(() => {
        if (unchanged) return { result: start, failed: false }
        if (!engine) return { result: null, failed: false }
        try {
            return { result: engine.costSample(inputs), failed: false }
        } catch {
            return { result: null, failed: true }
        }
    }, [unchanged, engine, inputs, start])
    const state: SampleEngineState = computed.failed ? 'error' : loadState

    const value = useMemo<SampleCosting>(
        () => ({ inputs, result: computed.result, start, engine: state, prepare, retry: prepare, setInput, reset }),
        [inputs, computed.result, start, state, prepare, setInput, reset],
    )

    return <SampleCostingContext.Provider value={value}>{children}</SampleCostingContext.Provider>
}

export function useSampleCosting(): SampleCosting {
    const value = useContext(SampleCostingContext)
    if (!value) throw new Error('useSampleCosting must be used inside SampleCostingProvider')
    return value
}
