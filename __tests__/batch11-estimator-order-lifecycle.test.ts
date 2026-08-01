import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeDefaultEstimateState, type EstimateState } from '../lib/estimator'
import { validateEstimatorQuoteBoundary } from '../lib/estimator-validation'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

function functionBody(source: string, name: string) {
    const start = source.indexOf(`export async function ${name}`)
    expect(start).toBeGreaterThanOrEqual(0)

    const next = source.indexOf('\nexport async function ', start + 1)
    return source.slice(start, next === -1 ? source.length : next)
}

function validEstimate(): EstimateState {
    const state = makeDefaultEstimateState()
    return {
        ...state,
        warpRows: [{
            id: 'warp-main',
            label: 'Main Warp',
            calculationMode: 'formula',
            manualKgPer100m: null,
            calcDenier: 75,
            beamEnds: 3200,
            yarnRate: 107,
            gstPct: 5,
            shortagePct: null,
        }],
        weftRows: [{
            id: 'weft-main',
            label: 'Main Weft',
            calculationMode: 'formula',
            manualKgPer100m: null,
            picks: 68,
            reedSpace: 112,
            effectiveCostingWidthCm: 112,
            calcDenier: 75,
            yarnRate: 107,
            gstPct: 5,
            shortagePct: null,
        }],
        tapeLengthM: 1000,
        perPickCostPaisa: 0.16,
        warpingRatePerKg: 2,
        sizingRatePerKg: 1.5,
        monthlyOutputM: 10_000,
        orderQuantityM: 1500,
        overheadItems: [],
    }
}

describe('Batch 11 estimator server-boundary validation', () => {
    it('accepts a complete estimator quote boundary payload', () => {
        const result = validateEstimatorQuoteBoundary({
            estimate: validEstimate(),
            totalProductionCostPerM: 55.75,
            quotePricePerM: 64.25,
            targetMeters: 1500,
        })

        expect(result.valid).toBe(true)
    })

    it('rejects empty row arrays, impossible zero fields, and extreme values with field messages', () => {
        const estimate = {
            ...validEstimate(),
            warpRows: [],
            weftRows: [{
                ...validEstimate().weftRows[0],
                picks: 0,
                effectiveCostingWidthCm: 5001,
            }],
            perPickCostPaisa: -0.1,
        }

        const result = validateEstimatorQuoteBoundary({
            estimate,
            totalProductionCostPerM: 0,
            quotePricePerM: 64.25,
            targetMeters: 1500,
        })

        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.issues.map(issue => issue.message)).toEqual(expect.arrayContaining([
                'Add at least one warp row before saving.',
                'Weft layer 1 (Main Weft) picks must be greater than 0.',
                'Weft layer 1 (Main Weft) effective costing width is outside the supported range.',
                'Weaving rate per pick must be greater than 0.',
                'Production cost per meter must be greater than 0.',
            ]))
        }
    })

    it('runs validation before every estimator quote/order artifact write path', () => {
        const estimatorActions = readProjectFile('app/(dashboard)/owner/estimator/actions.ts')

        for (const actionName of ['saveEstimatorQuoteV3', 'startPartyOrderFromEstimator', 'createMarketRunFromEstimator']) {
            const action = functionBody(estimatorActions, actionName)
            expect(action).toContain('validateEstimatorQuoteBoundary')

            // startPartyOrderFromEstimator uses an atomic RPC (Batch 23 QUOTE-007)
            // instead of .from('estimator_quotes') directly
            if (actionName === 'startPartyOrderFromEstimator') {
                expect(action.indexOf('validateEstimatorQuoteBoundary')).toBeLessThan(action.indexOf("supabase.rpc("))
            } else {
                // Idempotency may read an existing quote before validation, but
                // every artifact write must remain after server validation.
                expect(action.indexOf('validateEstimatorQuoteBoundary')).toBeLessThan(action.indexOf('.insert('))
            }
        }
    })
})

describe('Batch 11 order edit lifecycle guards', () => {
    it('checks produced meters at the server boundary before target edits', () => {
        const orderActions = readProjectFile('app/(dashboard)/owner/orders/actions.ts')
        const updateOrderDetails = functionBody(orderActions, 'updateOrderDetails')
        const auditTrigger = readProjectFile('supabase/migrations/20260326000000_audit_trail_expansion.sql')
        const auditFunction = readProjectFile('supabase/migrations/20260514110000_fix_audit_record_id_fallback.sql')

        expect(updateOrderDetails).toContain(".from('order_progress_summary')")
        expect(updateOrderDetails).toContain('total_meters_produced')
        expect(updateOrderDetails).toContain('Target meters cannot be below already-produced')
        expect(updateOrderDetails).toContain('Deadline must be a valid date.')
        expect(auditTrigger).toContain('CREATE TRIGGER audit_orders')
        expect(auditFunction).toContain('old_data, new_data')
    })
})

describe('Batch 11 below-target completion confirmation', () => {
    it('requires explicit server confirmation for below-target or pending-dispatch completion', () => {
        const orderActions = readProjectFile('app/(dashboard)/owner/orders/actions.ts')
        const updateOrderStatus = functionBody(orderActions, 'updateOrderStatus')

        expect(updateOrderStatus).toContain('getOrderCompletionSummary')
        expect(updateOrderStatus).toContain('confirmBelowTarget')
        expect(updateOrderStatus).toContain('confirmPendingDispatch')
        expect(updateOrderStatus).toContain('confirmationRequired: true')
        expect(orderActions).toContain('pending_dispatch_meters')
    })

    it('shows one confirmation dialog from both order card and detail drawer completion paths', () => {
        const ordersClient = readProjectFile('app/(dashboard)/owner/orders/OrdersClient.tsx')

        expect(ordersClient).toContain('CompleteOrderConfirmationDialog')
        expect(ordersClient).toContain('Remaining quantity')
        expect(ordersClient).toContain('Pending dispatch')
        expect(ordersClient).toContain("updateOrderStatus(orderId, 'completed', options)")
        expect(ordersClient).toContain("updateOrderStatus(id, 'completed', options)")
        expect(ordersClient).toContain('Complete Anyway')
    })
})
