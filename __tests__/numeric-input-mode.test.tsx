import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import type { ReactElement, WheelEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Input } from '@/components/ui/input'
import { blurNumberInputOnWheel, resolveInputMode } from '@/lib/input-mode'

describe('resolveInputMode', () => {
    it('opens the decimal pad for type=number', () => {
        expect(resolveInputMode({ type: 'number' })).toBe('decimal')
    })

    it('lets an explicit inputMode win over the default', () => {
        expect(resolveInputMode({ type: 'number', inputMode: 'numeric' })).toBe('numeric')
    })

    it.each([undefined, 'text', 'email', 'password', 'date', 'search', 'tel', 'url'])(
        'adds nothing for type=%s, so letter keyboards stay standard',
        type => {
            expect(resolveInputMode({ type })).toBeUndefined()
        },
    )

    it('keeps an explicit inputMode on a non-number field', () => {
        expect(resolveInputMode({ type: 'tel', inputMode: 'numeric' })).toBe('numeric')
    })
})

function wheelOver(type: string, focused: boolean) {
    const input = { type, blur: vi.fn(), ownerDocument: { activeElement: null as unknown } }
    if (focused) input.ownerDocument.activeElement = input
    return { input, event: { currentTarget: input } as unknown as WheelEvent<HTMLInputElement> }
}

describe('blurNumberInputOnWheel', () => {
    it('drops focus from a focused number field so the wheel cannot step its value', () => {
        const { input, event } = wheelOver('number', true)
        blurNumberInputOnWheel(event)
        expect(input.blur).toHaveBeenCalledOnce()
    })

    it('leaves an unfocused number field alone', () => {
        const { input, event } = wheelOver('number', false)
        blurNumberInputOnWheel(event)
        expect(input.blur).not.toHaveBeenCalled()
    })

    it('leaves other focused fields alone', () => {
        const { input, event } = wheelOver('text', true)
        blurNumberInputOnWheel(event)
        expect(input.blur).not.toHaveBeenCalled()
    })
})

describe('Input primitive', () => {
    type WheelProps = { onWheel?: (event: WheelEvent<HTMLInputElement>) => void }

    it('guards a number field against the mouse wheel and still calls its own onWheel', () => {
        const own = vi.fn()
        const element = Input({ type: 'number', onWheel: own }) as ReactElement<WheelProps>
        const { input, event } = wheelOver('number', true)
        element.props.onWheel?.(event)
        expect(input.blur).toHaveBeenCalledOnce()
        expect(own).toHaveBeenCalledWith(event)
    })

    it('passes a text field its onWheel untouched', () => {
        const own = vi.fn()
        const element = Input({ type: 'text', onWheel: own }) as ReactElement<WheelProps>
        expect(element.props.onWheel).toBe(own)
    })

    it('renders type=number with the decimal pad by default', () => {
        expect(renderToStaticMarkup(<Input type="number" />)).toMatch(/inputmode="decimal"/i)
    })

    // `step` only sets the browser's validation grid (yarn rates use step=1 and still take paise),
    // so it must never take the decimal key away.
    it.each([1, '1', 5, 0.01])('keeps the decimal pad when step is %s', step => {
        expect(renderToStaticMarkup(<Input type="number" step={step} />)).toMatch(/inputmode="decimal"/i)
    })

    it('honours an explicit inputMode', () => {
        const html = renderToStaticMarkup(<Input type="number" step="0.01" inputMode="numeric" />)
        expect(html).toMatch(/inputmode="numeric"/i)
        expect(html).not.toMatch(/inputmode="decimal"/i)
    })

    it.each([undefined, 'text', 'email'] as const)('leaves type=%s on the standard keyboard', type => {
        expect(renderToStaticMarkup(<Input type={type} />)).not.toMatch(/inputmode/i)
    })
})

function tsxFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return tsxFiles(path)
        return path.endsWith('.tsx') ? [path] : []
    })
}

describe('whole-number fields', () => {
    // These hold counts and days, where a decimal point on the pad would only invite a mistake,
    // so each asks for the digit pad explicitly.
    it.each([
        ['components/settings/payroll/PayrollCycleSettingsCard.tsx', 'id="interval-weeks-input"'],
        ['components/settings/payroll/PayrollCycleSettingsCard.tsx', 'id="interval-days-input"'],
        ['app/(admin-console)/admin/legacy/admin-ui.tsx', 'id="g_worker_id"'],
        ['app/(dashboard)/owner/estimator/FactoryCostWizard.tsx', 'placeholder="e.g. 24"'],
        ['app/(dashboard)/owner/estimator/FactoryCostWizard.tsx', 'monthlyWorkingDays || 26) ? \'\' : workingDays'],
    ])('%s %s opens the digit pad', (file, marker) => {
        const source = readFileSync(join(process.cwd(), file), 'utf8')
        const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
        const matches: string[] = []
        const visit = (node: ts.Node) => {
            if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(sf) === 'Input') {
                const text = node.getText(sf)
                if (text.includes(marker)) matches.push(text)
            }
            ts.forEachChild(node, visit)
        }
        visit(sf)
        expect(matches).toHaveLength(1)
        expect(matches[0]).toContain('inputMode="numeric"')
    })
})

describe('raw <input> elements', () => {
    // <Input> derives its inputMode and wheel guard from `type`; a raw <input> does not, so a
    // numeric one must say which pad it wants (usually by calling resolveInputMode) and stop the
    // mouse wheel from stepping its value (blurNumberInputOnWheel).
    it('declare an inputMode and a wheel guard whenever the type is number or decided at runtime', () => {
        const offenders: string[] = []
        for (const file of ['app', 'components'].flatMap(root => tsxFiles(join(process.cwd(), root)))) {
            const source = readFileSync(file, 'utf8')
            if (!source.includes('<input')) continue
            const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
            const visit = (node: ts.Node) => {
                if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(sf) === 'input') {
                    const attrs = node.attributes.properties.filter(ts.isJsxAttribute)
                    const named = (name: string) => attrs.find(attr => attr.name.getText(sf) === name)
                    const type = named('type')
                    const staticType = type?.initializer && ts.isStringLiteral(type.initializer) ? type.initializer.text : undefined
                    const needsMode = type && (staticType === undefined || staticType === 'number')
                    if (needsMode && (!named('inputMode') || !named('onWheel'))) {
                        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
                        offenders.push(`${file.replace(`${process.cwd()}/`, '')}:${line + 1}`)
                    }
                }
                ts.forEachChild(node, visit)
            }
            visit(sf)
        }
        expect(offenders).toEqual([])
    })
})
