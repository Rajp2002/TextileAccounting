import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatDateOnly, formatTimestampDate } from '../lib/format'
import { getRateReviewStatus } from '../lib/cost-rates'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const migration = read('supabase/migrations/20260825060131_close_base_release_security_boundaries.sql')

describe('Base release blocker remediation', () => {
  it('denies Base clients direct Premium order creation', () => {
    expect(migration).toContain('PERFORM public.assert_premium_rpc_access(v_org_id)')
    expect(migration).toContain("proc.proname = 'start_party_order_from_estimator_v2'")
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.start_party_order_from_estimator(%s) FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.start_party_order_from_estimator(%s) TO service_role')
  })

  it('requires a single-use server attestation for canonical Base costings', () => {
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')

    expect(migration).toContain('CREATE TABLE public.estimator_costing_attestations')
    expect(migration).toContain('Costing attestations are server-only')
    expect(migration).toContain("attestation.payload - \\'template_id\\'")
    expect(migration).toContain('attestation.consumed_at IS NULL')
    expect(migration).toContain('The costing payload contains unsupported fields.')
    expect(migration).toContain('REVOKE INSERT ON TABLE public.estimator_quotes FROM authenticated')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.save_estimator_costing_revision_with_quality')
    expect(actions).toContain('attestCanonicalCostingPayload')
    expect(actions).toContain("p_quote_payload: trustedQuotePayload")
    // LT01B: every costing save path attests through one helper (initial
    // quality, version). The version + quality path was removed 2026-10-18:
    // a saved quality is never edited from the estimator.
    expect(actions.match(/saveAttestedCostingPayload\(user\.id, profile\.org_id, quotePayload,/g)).toHaveLength(2)
  })

  it('routes current owners through the estimator', () => {
    expect(read('app/(auth)/onboarding/page.tsx')).toContain("redirect('/owner/estimator')")
  })

  it('restores the visible direct weaving rate with a saved quality or draft', () => {
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

    expect(estimator).toContain('function getTemplateDirectWeavingRateInput')
    expect(estimator).toContain('setDirectWeavingRateInput(getTemplateDirectWeavingRateInput(tpl, state))')
    expect(estimator).toContain('restored.state.perPickCostPaisa')
    expect(estimator).toContain('restored.state.weftRows')
  })

  it('treats timestamps as instants and business dates as date-only values in IST', () => {
    const nearMidnightIst = '2026-08-23T22:45:00.000Z'

    expect(formatTimestampDate(nearMidnightIst, {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })).toBe('24/08/2026')
    expect(formatDateOnly('2026-08-23', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })).toBe('23/08/2026')
    expect(getRateReviewStatus({
      last_reviewed_at: '2026-08-10',
      review_interval_days: 13,
    }, new Date(nearMidnightIst))).toBe('overdue')
  })
})
