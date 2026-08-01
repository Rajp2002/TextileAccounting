import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

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

describe('Batch 23 Start Party Order atomicity (QUOTE-007)', () => {
    const migration = readProjectFile(
        'supabase/migrations/20260702131500_batch_23_start_party_order_transaction_boundary.sql'
    )
    const action = functionBody(
        readProjectFile('app/(dashboard)/owner/estimator/actions.ts'),
        'startPartyOrderFromEstimator'
    )
    const client = readProjectFile('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

    // ── Migration creates atomic RPC ──

    it('defines the start_party_order_from_estimator RPC', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION start_party_order_from_estimator(')
        expect(migration).toContain('LANGUAGE plpgsql')
        expect(migration).toContain('SECURITY DEFINER')
        expect(migration).toContain("SET search_path = public")
        expect(migration).toContain('p_target_meters         NUMERIC       DEFAULT NULL')
        expect(migration).toContain('p_deadline              DATE          DEFAULT NULL')
    })

    it('creates accepted quote, active order, backlink, and yarn requirements in one transaction', () => {
        // Step 1: insert accepted quote
        expect(migration).toContain("INSERT INTO estimator_quotes (")
        expect(migration).toContain("'accepted'")
        expect(migration).toContain("RETURNING id INTO v_quote_id")

        // Step 2: insert active order linked to quote
        expect(migration).toContain("INSERT INTO orders (")
        expect(migration).toContain("v_quote_id")
        expect(migration).toContain("RETURNING id INTO v_order_id")

        // Step 3: backlink quote to order
        expect(migration).toContain("UPDATE estimator_quotes")
        expect(migration).toContain("SET order_id = v_order_id")

        // Step 4: insert yarn requirements
        expect(migration).toContain("INSERT INTO order_yarn_requirements (")
    })

    it('enforces the same auth/tenant boundary as convert_accepted_quote_to_order', () => {
        expect(migration).toContain("v_org_id := NULLIF(auth.jwt() ->> 'org_id', '')::uuid")
        expect(migration).toContain("v_role   := auth.jwt() ->> 'user_role'")
        expect(migration).toContain("v_role <> 'owner'")
        expect(migration).toContain("v_org_id IS NULL")
        expect(migration).toContain("'Permission denied'")
    })

    it('includes locked-org guard matching harden_locked_tenant_writes convention', () => {
        expect(migration).toContain("PERFORM public.assert_org_not_locked(v_org_id)")
    })

    it('handles unique_violation for concurrent or duplicate creation', () => {
        expect(migration).toContain('EXCEPTION')
        expect(migration).toContain('WHEN unique_violation THEN')
    })

    it('returns quote_id and order_id on success', () => {
        expect(migration).toContain('RETURN QUERY SELECT TRUE, v_quote_id, v_order_id, NULL::text')
    })

    it('validates required inputs at the database boundary', () => {
        expect(migration).toContain("'Add a party name before starting an order.'")
        expect(migration).toContain("'Add a quality label before starting an order.'")
        expect(migration).toContain("'Target meters must be greater than zero.'")
        expect(migration).toContain("'Add a deadline before starting an order.'")
        expect(migration).toContain("'Quote price is missing. Complete the estimate first.'")
    })

    it('is forward-only: no DROP, TRUNCATE, or DELETE as SQL statements', () => {
        const lines = migration.split('\n')
        for (const line of lines) {
            if (line.trim().startsWith('--')) continue
            expect(line).not.toMatch(/^\s*DROP\b/)
            expect(line).not.toMatch(/^\s*TRUNCATE\b/)
            expect(line).not.toMatch(/^\s*DELETE\b/)
        }
    })

    it('grants execute to authenticated role', () => {
        expect(migration).toContain('GRANT EXECUTE ON FUNCTION start_party_order_from_estimator')
        expect(migration).toContain('TO authenticated')
    })

    // ── Server action uses the atomic RPC ──

    it('calls the atomic start_party_order_from_estimator RPC instead of separate insert + conversion', () => {
        expect(action).toContain("supabase.rpc(\n        'start_party_order_from_estimator_v2'")
        // Must NOT insert estimator_quotes separately in this action
        expect(action).not.toContain(".from('estimator_quotes')\n        .insert(")
        // Must NOT call executeQuoteConversion as a function
        expect(action).not.toContain('await executeQuoteConversion(')
    })

    it('exposes the atomic fast path from the Estimator UI', () => {
        expect(client).toContain('startPartyOrderFromEstimator')
        expect(client).toContain('id="btn-start-party-order"')
        expect(client).toContain('Start Party Order')
        expect(client).toContain('router.push(`/owner/orders?orderId=${result.orderId}`)')
    })

    it('pre-computes yarn requirements before the RPC call', () => {
        expect(action).toContain('calcFullTotals(estimateForOrder)')
        expect(action).toContain('p_warp_required_kg')
        expect(action).toContain('p_weft_required_kg')
        expect(action).toContain('p_total_required_kg')
        expect(action).toContain('p_estimated_beams')
        expect(action).toContain('p_requirement_snapshot')
    })

    it('preserves server-side input validation before the RPC', () => {
        expect(action).toContain('validateEstimatorQuoteBoundary')
        expect(action).toContain("'Add a party name before starting an order.'")
        expect(action).toContain("'Add a quality label before starting an order.'")
        expect(action).toContain("'Target meters must be greater than zero.'")
        expect(action).toContain("'Quote price is missing. Complete the estimate first.'")
    })

    it('passes quote snapshot fields to the RPC', () => {
        expect(action).toContain('p_party_name:')
        expect(action).toContain('p_quality_label:')
        expect(action).toContain('p_warp_rows:')
        expect(action).toContain('p_weft_rows:')
        expect(action).toContain('p_worker_rate_per_m:')
        expect(action).toContain('p_landed_cost_per_meter:')
        expect(action).toContain('p_quote_price_per_meter:')
    })

    it('passes order fields to the RPC', () => {
        expect(action).toContain('p_target_meters:')
        expect(action).toContain('p_deadline:')
        expect(action).toContain('p_notes:')
        expect(action).toContain('p_tracking_token:')
    })

    it('returns both quoteId and orderId on success', () => {
        expect(action).toContain('rpcResult.quote_id')
        expect(action).toContain('rpcResult.order_id')
    })

    it('does not leave orphaned accepted quotes on failure', () => {
        // The old pattern deliberately left the accepted quote for recovery.
        // The new pattern does NOT insert the quote separately, so a failed
        // RPC means no quote row exists.
        expect(action).not.toContain('Your estimate has been saved as an accepted quote')
        expect(action).not.toContain("Do NOT delete the accepted quote")
    })

    it('computes the normalized worker rate from the validated estimator recipe', () => {
        expect(action).toContain('calcWorkerRateSnapshot')
        expect(action).toContain('estimatorState.weftRows')
        expect(action).toContain('estimatorState.perPickCostPaisa')
        expect(action).not.toContain('input.workerRatePerM')
    })
})

describe('Batch 23 non-fast-path conversion remains unchanged', () => {
    const conversionService = readProjectFile('lib/quotes/convert-accepted-quote-to-order.ts')
    const estimatorActions = readProjectFile('app/(dashboard)/owner/estimator/actions.ts')

    it('executeQuoteConversion still calls convert_accepted_quote_to_order RPC', () => {
        expect(conversionService).toContain("supabase.rpc(\n        'convert_accepted_quote_to_order'")
        expect(conversionService).toContain("'This quote has already been converted into an order.'")
    })

    it('convertAcceptedQuoteToOrder (Quote History path) still uses executeQuoteConversion', () => {
        const quoteHistoryAction = functionBody(estimatorActions, 'convertAcceptedQuoteToOrder')
        expect(quoteHistoryAction).toContain('executeQuoteConversion')
    })

    it('saveEstimatorQuoteV3 is not affected by the refactoring', () => {
        const saveAction = functionBody(estimatorActions, 'saveEstimatorQuoteV3')
        expect(saveAction).toContain(".from('estimator_quotes')\n        .insert(")
        expect(saveAction).not.toContain('start_party_order_from_estimator')
    })

    it('existing estimator validation is wired before quote persistence in all paths', () => {
        for (const actionName of ['saveEstimatorQuoteV3', 'startPartyOrderFromEstimator', 'createMarketRunFromEstimator']) {
            const body = functionBody(estimatorActions, actionName)
            expect(body).toContain('validateEstimatorQuoteBoundary')
        }
    })
})
