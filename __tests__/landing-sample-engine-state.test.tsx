import React, { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SampleCostingProvider, useSampleCosting } from '../components/landing/sample-costing-context'
import { SAMPLE_START, type SampleResult } from '../components/landing/sample-format'
import { sampleDisplay } from '../components/landing/cost-sheet-demo'

const engine = vi.hoisted(() => ({ fail: true }))
// The provider lazy-imports the shared engine; a rejected chunk is the
// failure an owner sees on a slow or interrupted connection.
vi.mock('../components/landing/sample-costing', async (importOriginal) => {
  if (engine.fail) throw new Error('chunk failed to load')
  return importOriginal()
})

class HostElement extends EventTarget {
  nodeType = 1
  tagName = 'DIV'
  namespaceURI = 'http://www.w3.org/1999/xhtml'
  textContent = ''
  constructor(public ownerDocument: EventTarget) { super() }
}

const START: SampleResult = {
  warpYarnPerM: 4, weftYarnPerM: 3, weavingPerM: 2, overheadPerM: 1.5,
  productionCostPerM: 10.5, breakEvenPricePerM: 11, suggestedPricePerM: 12,
} as SampleResult

let root: Root | null
let current: ReturnType<typeof useSampleCosting>

async function mount() {
  function Probe() {
    const sample = useSampleCosting()
    useLayoutEffect(() => { current = sample })
    return null
  }
  await act(() => root!.render(<SampleCostingProvider start={START}><Probe /></SampleCostingProvider>))
}

const settle = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0)) })

beforeEach(() => {
  engine.fail = true
  const documentHost = Object.assign(new EventTarget(), { nodeType: 9, activeElement: null, visibilityState: 'visible' })
  vi.stubGlobal('window', Object.assign(new EventTarget(), { document: documentHost, HTMLIFrameElement: class {}, setTimeout, clearTimeout }))
  vi.stubGlobal('document', documentHost)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  root = createRoot(new HostElement(documentHost) as unknown as HTMLElement)
})

afterEach(async () => {
  await act(() => root?.unmount())
  root = null
  vi.unstubAllGlobals()
})

describe('F13 landing sample engine is unavailable', () => {
  it('never presents the starting money as the result of changed controls', async () => {
    await mount()
    await act(() => current.setInput('weftRatePerKg', SAMPLE_START.weftRatePerKg + 20))
    await settle()

    expect(current.inputs.weftRatePerKg).toBe(SAMPLE_START.weftRatePerKg + 20)
    expect(current.result).not.toBe(START)
    expect(current.engine).toBe('error')
    expect(current.result).toBeNull()
  })

  it('reset returns to the starting example, whose money is correct without the engine', async () => {
    await mount()
    await act(() => current.setInput('picksPerInch', SAMPLE_START.picksPerInch + 4))
    await settle()
    await act(() => current.reset())
    expect(current.result).toBe(START)
  })

  it('retry loads the engine and then shows money for the changed controls', async () => {
    await mount()
    await act(() => current.setInput('weftRatePerKg', SAMPLE_START.weftRatePerKg + 20))
    await settle()
    expect(current.engine).toBe('error')

    engine.fail = false
    await act(() => current.retry())
    // The real engine module is large; wait for the load to finish.
    await vi.waitFor(async () => { await settle(); expect(current.engine).not.toBe('loading') }, { timeout: 10_000 })
    expect(current.engine).toBe('ready')
    expect(current.result).not.toBeNull()
    expect(current.result).not.toBe(START)
  })
})

describe('sampleDisplay', () => {
  it('shows computed money as the result of the current controls', () => {
    const computed = { ...START, productionCostPerM: 11 }
    expect(sampleDisplay(computed, START, 'ready')).toEqual({ shown: computed, baseline: false, status: null })
  })

  it('labels the starting money as the example baseline while the engine loads or after it fails', () => {
    expect(sampleDisplay(null, START, 'loading')).toEqual({ shown: START, baseline: true, status: 'loading' })
    expect(sampleDisplay(null, START, 'error')).toEqual({ shown: START, baseline: true, status: 'error' })
    expect(sampleDisplay(null, START, 'idle')).toEqual({ shown: START, baseline: true, status: 'loading' })
  })
})
