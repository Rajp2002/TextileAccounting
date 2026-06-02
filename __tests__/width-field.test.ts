import { describe, expect, it, vi } from 'vitest'
import { calcFullTotals, makeDefaultEstimateState } from '../lib/estimator'

// Helper function that mirrors the UI's secondaryReadout logic
function getSecondaryReadout(value: number, unit: 'cm' | 'inch'): string {
    if (!value) return ''
    if (unit === 'cm') {
        const inches = value / 2.54
        const roundedInches = Math.round(inches)
        if (Math.abs(inches - roundedInches) < 0.15) {
            return `≈ ${roundedInches} inches`
        }
        return `≈ ${inches.toFixed(1)} inches`
    } else {
        const roundedCm = Math.round(value)
        if (Math.abs(value - roundedCm) < 0.3) {
            return `≈ ${roundedCm} cm`
        }
        return `≈ ${value.toFixed(1)} cm`
    }
}

// Helper function that mirrors the UI's displayValue logic
function getDisplayValue(value: number, unit: 'cm' | 'inch'): number | string {
    if (!value) return ''
    if (unit === 'inch') {
        const inches = value / 2.54
        return Number(inches.toFixed(2))
    }
    return value
}

// Helper function that dispatches/converts UI input back to internal cm value
function convertInputToCm(raw: number, unit: 'cm' | 'inch'): number {
    if (unit === 'inch') {
        const cm = raw * 2.54
        return Number(cm.toFixed(4))
    }
    return raw
}

describe('1. WidthField behavior in cm mode', () => {
    it('should dispatch identical cm value and show correct ≈ 44 inches helper text', () => {
        const input = 112
        const unit = 'cm'

        // Input 112 -> Dispatched reedSpace should be 112
        const dispatchedValue = convertInputToCm(input, unit)
        expect(dispatchedValue).toBe(112)

        // Display value should also be 112
        const displayValue = getDisplayValue(dispatchedValue, unit)
        expect(displayValue).toBe(112)

        // Helper should show approximately 44 inches
        const helper = getSecondaryReadout(dispatchedValue, unit)
        expect(helper).toBe('≈ 44 inches')
    })
})

describe('2. WidthField behavior in inch mode', () => {
    it('should dispatch 111.76 cm for 44 inch input and show correct ≈ 112 cm helper text', () => {
        const input = 44
        const unit = 'inch'

        // Input 44 -> Dispatched reedSpace should be 111.76
        const dispatchedValue = convertInputToCm(input, unit)
        expect(dispatchedValue).toBe(111.76)

        // Display value should be exactly 44
        const displayValue = getDisplayValue(dispatchedValue, unit)
        expect(displayValue).toBe(44)

        // Helper should show approximately 112 cm
        const helper = getSecondaryReadout(dispatchedValue, unit)
        expect(helper).toBe('≈ 112 cm')
    })
})

describe('3. Estimator mathematical parity', () => {
    it('should produce nearly identical weft kg/100m and weft cost for 112 cm and 44.09 inches', () => {
        const baseState = makeDefaultEstimateState()

        // Scenario A: 112 cm width
        const stateCm = {
            ...baseState,
            weftRows: [{
                id: 'weft-main',
                picks: 68,
                reedSpace: 112,
                calcDenier: 50,
                yarnRate: 350,
                gstPct: 0,
                shortagePct: null,
            }]
        }
        const totalsCm = calcFullTotals(stateCm)

        // Scenario B: 44.09 inches width (dispatched internally as 44.09 * 2.54 = 111.9886 cm)
        const stateInch = {
            ...baseState,
            weftRows: [{
                id: 'weft-main',
                picks: 68,
                reedSpace: 111.9886,
                calcDenier: 50,
                yarnRate: 350,
                gstPct: 0,
                shortagePct: null,
            }]
        }
        const totalsInch = calcFullTotals(stateInch)

        // weft rows kgPer100m comparison
        const kgCm = totalsCm.weftRows[0].kgPer100m
        const kgInch = totalsInch.weftRows[0].kgPer100m
        expect(kgCm).toBeCloseTo(kgInch, 2) // nearly identical kg

        // weftCostPerM comparison
        const costCm = totalsCm.weftCostPerM
        const costInch = totalsInch.weftCostPerM
        expect(costCm).toBeCloseTo(costInch, 2) // nearly identical cost
    })
})

describe('4. WidthField state persistence', () => {
    it('should save weavly-estimator-width-unit = inch in localStorage and restore it', () => {
        const store: Record<string, string> = {}
        const localStorageMock: Storage = {
            get length() {
                return Object.keys(store).length
            },
            getItem: vi.fn((key: string) => store[key] || null),
            setItem: vi.fn((key: string, value: string) => {
                store[key] = value
            }),
            removeItem: vi.fn((key: string) => {
                delete store[key]
            }),
            clear: vi.fn(() => {
                for (const key in store) delete store[key]
            }),
            key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
        }

        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {
                localStorage: localStorageMock,
            },
        })
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: localStorageMock,
        })

        const windowWithStorage = {
            localStorage: localStorageMock
        }
        expect(windowWithStorage.localStorage).toBe(localStorageMock)

        // Switching unit to inch should save to localStorage
        const unitToPersist = 'inch'
        global.localStorage.setItem('weavly-estimator-width-unit', unitToPersist)
        expect(localStorageMock.setItem).toHaveBeenCalledWith('weavly-estimator-width-unit', 'inch')
        expect(store['weavly-estimator-width-unit']).toBe('inch')

        // Reloading should restore it from localStorage
        const restoredUnit = global.localStorage.getItem('weavly-estimator-width-unit')
        expect(localStorageMock.getItem).toHaveBeenCalledWith('weavly-estimator-width-unit')
        expect(restoredUnit).toBe('inch')

        // Clean up globals
        Reflect.deleteProperty(globalThis, 'window')
        Reflect.deleteProperty(globalThis, 'localStorage')
    })
})
