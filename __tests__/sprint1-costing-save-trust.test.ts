import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEstimatorDraft } from '../lib/estimator-drafts'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Sprint 1 costing save trust', () => {
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')
    const migration = read('supabase/migrations/20260801174038_sprint1_save_trust_v2.sql')
    const english = read('lib/i18n/locales/en.ts')

    it('keeps quality updates separate from costing snapshots', () => {
        expect(estimator).toContain('Update Fabric Quality')
        expect(estimator).toContain("estimator.sprint1.quality_updated_no_snapshot")
        expect(estimator).toContain("estimator.sprint1.save_version_only")
        expect(estimator).toContain("estimator.sprint1.save_version_update_quality")
        expect(english).toContain('save_version_only: "Save Version Only"')
        expect(english).toContain('save_version_update_quality: "Save Version & Update Quality"')
        expect(actions).toContain('updateSavedQuality?: boolean')
    })

    it('uses one transaction for the optional combined save', () => {
        expect(actions).toContain("save_estimator_costing_revision_v2")
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.save_estimator_costing_revision_v2')
        expect(migration).toContain("'outcome', 'no_change'")
        expect(migration).toContain('protect_costing_snapshot_update')
        expect(migration).toContain('BEFORE UPDATE OR DELETE ON public.estimator_quotes')
        expect(migration).toContain('Historical costing snapshots cannot be deleted')
        expect(migration).toContain('Re-check the request after waiting')
        expect(migration).toContain("hashtextextended(v_org_id::text || ':' || v_request_id::text, 0)")
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.create_saved_quality_with_initial_costing_v1')
        expect(migration).toContain('v_template.updated_at IS DISTINCT FROM p_expected_template_updated_at')
        expect(migration).toContain('v_source.updated_at IS DISTINCT FROM p_expected_source_updated_at')
        expect(migration).not.toContain('name = v_template.name')
    })

    it('keeps version and timestamp context in the estimator handoff', () => {
        const parsed = parseEstimatorDraft(JSON.stringify({
            state: { marker: 'saved' },
            partyName: 'Rajesh customer',
            qualityLabel: '60D Poly Brightest',
            warpInstruction: '',
            weftInstruction: '',
            savedAt: 1_000,
            sourceQuoteId: '00000000-0000-4000-8000-000000000001',
            sourceQuoteUpdatedAt: '2026-07-19T00:00:00.000Z',
            sourceQuoteVersionNumber: 3,
            sourceQuoteCreatedAt: '2026-07-18T00:00:00.000Z',
            sourceFactoryProfileUpdatedAt: '2026-07-17T00:00:00.000Z',
            sourceRecordKind: 'costing',
        }), 1_001)

        expect(parsed).toMatchObject({
            sourceQuoteVersionNumber: 3,
            sourceQuoteCreatedAt: '2026-07-18T00:00:00.000Z',
            sourceFactoryProfileUpdatedAt: '2026-07-17T00:00:00.000Z',
        })
    })
})
