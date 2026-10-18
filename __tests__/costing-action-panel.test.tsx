import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CostingActionState } from '@/lib/costing-action-state'
import type { ConstructionChange } from '@/lib/quality-construction'
import { I18nContext } from '@/lib/i18n/context'
import { en } from '@/lib/i18n/locales/en'
import { gu } from '@/lib/i18n/locales/gu'
import { hi } from '@/lib/i18n/locales/hi'

vi.mock('server-only', () => ({}))
const { EstimatorLiveCostActions } = await import('@/app/(dashboard)/owner/estimator/EstimatorClient')

// The three states of the Lite/Base estimator action panel: a new fabric, the
// same fabric (Update Costing), and a changed fabric (Save as New Quality).

type Tree = { [key: string]: string | Tree }
const lookup = (tree: Tree, key: string) => key.split('.').reduce<string | Tree | undefined>(
    (node, part) => (node && typeof node === 'object' ? node[part] : undefined), tree,
)

function render(actionState: CostingActionState, options: { language?: 'en' | 'hi' | 'gu'; qualityName?: string | null } = {}) {
    const language = options.language ?? 'en'
    const dictionary = { en, hi, gu }[language] as unknown as Tree
    const t = (key: string, values?: Record<string, string | number | null | undefined>) => {
        const raw = lookup(dictionary, key) ?? lookup(en as unknown as Tree, key)
        const text = typeof raw === 'string' ? raw : key
        return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? `{${name}}`))
    }
    const props: Parameters<typeof EstimatorLiveCostActions>[0] = {
        savingQuote: false,
        actionState,
        qualityName: options.qualityName ?? 'Linen',
        canPersistCostResult: true,
        hasValidCostResult: true,
        qualityLabel: 'Linen',
        totalProductionCostPerM: 40,
        exportReady: true,
        firstCostingReadinessMessage: null,
        actionReadinessMessage: null,
        actionReadinessId: 'readiness',
        topCostingActionLabel: actionState.kind === 'new' ? t('tourControls.estimator.saveCosting')
            : actionState.kind === 'sameFabric' ? t('tourControls.estimator.updateCosting') : t('estimator.actions.saveAsNewQuality'),
        onSaveCosting: () => undefined,
        onExport: () => undefined,
        onSaveAsNewQuality: () => undefined,
        onSaveQualityAndCosting: () => undefined,
        onNewQuality: () => undefined,
        onDismiss: () => undefined,
    }
    const value = {
        language,
        setLanguage: async () => ({ ok: true as const, language }),
        languageStatus: 'ready' as const,
        pendingLanguage: null,
        languageError: null,
        t,
        tx: (text: string) => text,
    }
    return renderToStaticMarkup(createElement(I18nContext.Provider, { value }, createElement(EstimatorLiveCostActions, props)))
}

const button = (html: string, testId: string) => html.match(new RegExp(`<button[^>]*data-testid="${testId}"[^>]*>[\\s\\S]*?</button>`))?.[0] ?? ''
const isDisabled = (html: string) => /\sdisabled(=""|>)/.test(html)
const change = (overrides: Partial<ConstructionChange>): ConstructionChange => ({
    kind: 'beamEnds', side: 'warp', layer: 1, from: '4800', to: '5200', ...overrides,
})

describe('estimator action panel', () => {
    it('offers Save Costing and Save Quality & Costing for a new fabric', () => {
        const html = render({ kind: 'new' })
        expect(html).toContain('Save Costing')
        expect(html).toContain('Save Quality &amp; Costing')
        expect(html).not.toContain('Update Quality')
        expect(html).toContain('Save Costing keeps this costing only')
        expect(isDisabled(button(html, 'save-as-new-quality'))).toBe(false)
    })

    it('offers Update Costing for the same fabric and disables the second button', () => {
        const html = render({ kind: 'sameFabric', nextVersion: 3, firstCosting: false, canSaveQuality: false })
        expect(button(html, 'save-costing-action')).toContain('Update Costing')
        expect(html).toContain('saves v3')
        expect(isDisabled(button(html, 'save-as-new-quality'))).toBe(true)
        expect(button(html, 'save-as-new-quality')).toContain('Save as New Quality')
    })

    it('says the first costing is saved for a quality with none yet', () => {
        const html = render({ kind: 'sameFabric', nextVersion: 1, firstCosting: true, canSaveQuality: false }, { qualityName: 'Voile' })
        expect(button(html, 'save-costing-action')).toContain('Update Costing')
        expect(html).toContain('Saves the first costing for Voile.')
    })

    it('still offers Save Quality & Costing for an opened costing that has no quality', () => {
        const html = render({ kind: 'sameFabric', nextVersion: 2, firstCosting: false, canSaveQuality: true })
        expect(button(html, 'save-as-new-quality')).toContain('Save Quality &amp; Costing')
        expect(isDisabled(button(html, 'save-as-new-quality'))).toBe(false)
    })

    it('makes Save as New Quality the main action when the fabric changed', () => {
        const html = render({ kind: 'fabricChanged', changes: [change({})] })
        expect(button(html, 'save-costing-action')).toContain('Save as New Quality')
        expect(html).toContain('beam ends 4800 → 5200')
        expect(html).toContain('A different fabric is saved as a new quality.')
        expect(button(html, 'save-as-new-quality')).toContain('Update Costing')
        expect(isDisabled(button(html, 'save-as-new-quality'))).toBe(true)
    })

    it('lists three changes and counts the rest', () => {
        const html = render({
            kind: 'fabricChanged',
            changes: [
                change({}),
                change({ kind: 'picks', side: 'weft', from: '60', to: '64' }),
                change({ kind: 'pickRatio', side: 'weft', from: '1', to: '2' }),
                change({ kind: 'weftLayers', side: 'weft', layer: null, from: '1', to: '2' }),
            ],
        })
        expect(html).toContain('beam ends 4800 → 5200')
        expect(html).toContain('picks 60 → 64')
        expect(html).toContain('pick ratio 1 → 2')
        expect(html).not.toContain('weft layers 1 → 2')
        expect(html).toContain('+1 more')
    })

    it('wraps long labels instead of truncating them', () => {
        for (const state of [
            { kind: 'new' },
            { kind: 'sameFabric', nextVersion: 2, firstCosting: false, canSaveQuality: false },
            { kind: 'fabricChanged', changes: [change({})] },
        ] as CostingActionState[]) {
            const html = render(state)
            for (const id of ['save-costing-action', 'save-as-new-quality']) {
                expect(button(html, id)).not.toContain('truncate')
                expect(button(html, id)).toContain('whitespace-normal')
                expect(button(html, id)).toContain('min-h-[44px]')
            }
        }
    })

    it('renders in Hindi and Gujarati', () => {
        const hindi = render({ kind: 'sameFabric', nextVersion: 3, firstCosting: false, canSaveQuality: false }, { language: 'hi' })
        expect(hindi).toContain('कॉस्टिंग अपडेट करें')
        const gujarati = render({ kind: 'fabricChanged', changes: [change({})] }, { language: 'gu' })
        expect(gujarati).toContain('નવી ક્વોલિટી તરીકે સાચવો')
        expect(gujarati).toContain('4800 → 5200')
    })
})
