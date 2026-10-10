import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
const bar = read('components/ui/keyboard-next-bar.tsx')

function inputBlock(source: string, start: string) {
    const from = source.indexOf(start)
    expect(from).toBeGreaterThan(-1)
    const open = source.indexOf('<Input', from)
    return source.slice(open, source.indexOf('/>', open))
}

describe('estimator phone keyboard Next flow', () => {
    it('asks phone keyboards for a Next key on estimator number fields', () => {
        expect(inputBlock(estimator, 'function NumField(')).toContain('enterKeyHint="next"')
        expect(inputBlock(estimator, 'function StepperField(')).toContain('enterKeyHint="next"')
        expect(inputBlock(estimator, 'const rateInputId')).toContain('enterKeyHint="next"')
    })

    it('mounts the keyboard Next bar on the estimator', () => {
        expect(estimator).toContain("import { KeyboardNextBar } from '@/components/ui/keyboard-next-bar'")
        expect(estimator).toMatch(/<KeyboardNextBar summary=\{!freeMode && hasValidCostResult/)
    })

    it('steps through the same fields as Enter navigation without closing the keyboard', () => {
        expect(bar).toContain("'[data-enter-navigate-container]'")
        expect(bar).toContain('findNavigableFormInputs(container)')
        expect(bar).toContain('focusAndSelectInput(target)')
        expect(bar).toContain('onPointerDown={keepFocus}')
        expect(bar).toContain('useMobileKeyboard()')
        expect(bar).toContain('var(--mobile-viewport-height')
    })

    it('labels its actions in every app language with 44px targets', () => {
        for (const language of ['en:', 'hi:', 'gu:']) expect(bar).toContain(language)
        expect(bar.match(/className="flex h-11/g)?.length).toBe(2)
    })
})

describe('estimator keyboard Next bar on iPhone', () => {
    it('stays hidden where iOS draws its own field bar, so the keyboard never shows two', () => {
        const effect = bar.slice(bar.indexOf('useEffect(() => {'))
        expect(effect.indexOf('if (hasIosFieldBar()) return')).toBeGreaterThan(-1)
        expect(effect.indexOf('if (hasIosFieldBar()) return')).toBeLessThan(effect.indexOf("addEventListener('focusin'"))
    })
})
