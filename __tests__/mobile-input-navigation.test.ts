import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getMobileInputNavigation, keepMobileInputVisible, moveMobileInput } from '../lib/mobile-input-navigation'

function form() {
    const fields: HTMLInputElement[] = []
    const container = {
        tagName: 'FORM',
        querySelectorAll: (selector: string) => fields.filter(field => field.tagName === 'BUTTON'
            ? selector.includes('button[data-input-flow-expand][aria-expanded="false"]')
            : field.matches('input')),
        submit: vi.fn(),
        requestSubmit: vi.fn(),
    }
    function add(type = 'number', extra = {}) {
        const field = {
            tagName: 'INPUT', type, disabled: false, readOnly: false, tabIndex: 0,
            value: '12.50', scope: container, blockedAncestor: false, preventNavigation: false,
            isConnected: true, offsetWidth: 100, offsetHeight: 44, offsetParent: {},
            getClientRects: () => [{ width: 100, height: 44 }],
            getAttribute: (name: string): string | null => name === 'data-prevent-enter-nav' && field.preventNavigation ? 'true' : null,
            matches: (): boolean => !['checkbox', 'hidden', 'range', 'color'].includes(field.type) && !field.disabled && !field.readOnly,
            closest: (selector: string): object | null => selector.startsWith('[data-enter-navigate-container]')
                ? field.scope : selector.startsWith('[inert]') && field.blockedAncestor ? {} : null,
            focus: vi.fn(), select: vi.fn(), scrollIntoView: vi.fn(),
            ...extra,
        }
        fields.push(field as unknown as HTMLInputElement)
        return field
    }
    const asInput = (field: ReturnType<typeof add>) => field as unknown as HTMLInputElement
    return { fields, container, add, asInput }
}

afterEach(() => vi.unstubAllGlobals())

describe('mobile number-pad field navigation', () => {
    it('moves synchronously through text, decimal, and number fields without submitting', () => {
        const h = form()
        const name = h.add('text')
        const tax = h.add('text', { inputMode: 'decimal' })
        const amount = h.add()
        expect(moveMobileInput(h.asInput(name), 'next')).toBe(true)
        expect(tax.focus).toHaveBeenCalledWith({ preventScroll: true })
        expect(tax.select).toHaveBeenCalledOnce()
        expect(moveMobileInput(h.asInput(tax), 'next')).toBe(true)
        expect(amount.focus).toHaveBeenCalledWith({ preventScroll: true })
        expect(amount.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center', inline: 'nearest' })
        expect(amount.value).toBe('12.50')
        expect(h.container.submit).not.toHaveBeenCalled()
        expect(h.container.requestSubmit).not.toHaveBeenCalled()
    })

    it('supports Previous and stops at both ends without wrapping or submitting', () => {
        const h = form()
        const first = h.add()
        const last = h.add()
        expect(moveMobileInput(h.asInput(last), 'previous')).toBe(true)
        expect(first.focus).toHaveBeenCalledOnce()
        expect(moveMobileInput(h.asInput(first), 'previous')).toBe(false)
        expect(moveMobileInput(h.asInput(last), 'next')).toBe(false)
        expect(h.container.requestSubmit).not.toHaveBeenCalled()
    })

    it('skips disabled, readonly, hidden, inert, and opted-out controls', () => {
        const h = form()
        const first = h.add()
        h.add('number', { disabled: true })
        h.add('number', { readOnly: true })
        h.add('hidden')
        h.add('checkbox')
        h.add('number', { blockedAncestor: true })
        h.add('number', { preventNavigation: true })
        const next = h.add()
        expect(getMobileInputNavigation(h.asInput(first))?.next).toBe(next)
    })

    it('keeps fields from another form or a nested modal outside the current flow', () => {
        const h = form()
        const first = h.add()
        h.add('number', { scope: { tagName: 'FORM' } })
        h.add('number', { scope: { tagName: 'DIV', role: 'dialog' } })
        const next = h.add()
        expect(getMobileInputNavigation(h.asInput(first))?.next).toBe(next)
        expect(getMobileInputNavigation(h.asInput(next))?.previous).toBe(first)
    })

    it('re-reads the form when a row is removed or added between taps', () => {
        const h = form()
        const first = h.add()
        const removed = h.add()
        const next = h.add()
        h.fields.splice(1, 1)
        expect(moveMobileInput(h.asInput(first), 'next')).toBe(true)
        expect(removed.focus).not.toHaveBeenCalled()
        expect(next.focus).toHaveBeenCalledOnce()
        const added = h.add()
        expect(moveMobileInput(h.asInput(next), 'next')).toBe(true)
        expect(added.focus).toHaveBeenCalledOnce()
    })

    describe('a collapsed section between fields (a phone yarn row)', () => {
        function collapsedRow(h: ReturnType<typeof form>, rowFields: HTMLInputElement[]) {
            const region = { querySelectorAll: () => [] as HTMLInputElement[] }
            const toggle = {
                tagName: 'BUTTON', type: 'button', disabled: false, tabIndex: 0, isConnected: true,
                offsetWidth: 100, offsetHeight: 44, offsetParent: {}, getClientRects: () => [{ width: 100, height: 44 }],
                getAttribute: (name: string) => ({ 'data-input-flow-expand': 'true', 'aria-controls': 'row-2' } as Record<string, string>)[name] ?? null,
                matches: () => true,
                closest: (selector: string) => selector.startsWith('[data-enter-navigate-container]') ? h.container : null,
                click: vi.fn(),
            }
            h.fields.push(toggle as unknown as HTMLInputElement)
            vi.stubGlobal('document', { getElementById: (id: string) => id === 'row-2' ? region : null })
            // Opening the row mounts its fields, as React does inside flushSync.
            const expand = vi.fn(() => { region.querySelectorAll = () => rowFields })
            return { toggle, expand }
        }

        it('Next opens the row and focuses its first field inside the same tap', () => {
            const h = form()
            const count = h.add()
            const denier = { ...h.add(), focus: vi.fn(), select: vi.fn() }
            h.fields.pop()
            const rate = { ...h.add(), focus: vi.fn() }
            h.fields.pop()
            const { toggle, expand } = collapsedRow(h, [h.asInput(denier), h.asInput(rate)])
            h.add()
            expect(getMobileInputNavigation(h.asInput(count))?.next).toBe(toggle)
            expect(moveMobileInput(h.asInput(count), 'next', expand)).toBe(true)
            expect(expand).toHaveBeenCalledWith(toggle)
            expect(denier.focus).toHaveBeenCalledWith({ preventScroll: true })
            expect(denier.select).toHaveBeenCalledOnce()
            expect(rate.focus).not.toHaveBeenCalled()
        })

        it('Previous opens the row and focuses its last field', () => {
            const h = form()
            h.add()
            const denier = { ...h.add(), focus: vi.fn() }
            h.fields.pop()
            const rate = { ...h.add(), focus: vi.fn() }
            h.fields.pop()
            const { expand } = collapsedRow(h, [h.asInput(denier), h.asInput(rate)])
            const after = h.add()
            expect(moveMobileInput(h.asInput(after), 'previous', expand)).toBe(true)
            expect(rate.focus).toHaveBeenCalledOnce()
            expect(denier.focus).not.toHaveBeenCalled()
        })
    })

    it('does not navigate outside a known form, dialog, or main content boundary', () => {
        const h = form()
        const field = h.add('number', { scope: null })
        expect(getMobileInputNavigation(h.asInput(field))).toBeNull()
        expect(moveMobileInput(h.asInput(field), 'next')).toBe(false)
    })
})

describe('field clearance above the number-pad accessory', () => {
    it('scrolls the dialog instead of the locked document', () => {
        const body = {}
        const panel = { parentElement: body, clientHeight: 400, scrollHeight: 900, scrollBy: vi.fn() }
        const input = { isConnected: true, parentElement: panel, getBoundingClientRect: () => ({ top: 340, bottom: 384 }) }
        const scrollBy = vi.fn()
        vi.stubGlobal('document', { body })
        vi.stubGlobal('window', { visualViewport: { height: 400, offsetTop: 20, scale: 1 }, getComputedStyle: () => ({ overflowY: 'auto' }), scrollBy })
        keepMobileInputVisible(input as unknown as HTMLElement)
        expect(panel.scrollBy).toHaveBeenCalledWith({ top: 44, behavior: 'auto' })
        expect(scrollBy).not.toHaveBeenCalled()
    })

    it('brings an offscreen page field below the mobile header', () => {
        const body = {}
        const scrollBy = vi.fn()
        const input = { isConnected: true, parentElement: body, getBoundingClientRect: () => ({ top: 32, bottom: 76 }) }
        vi.stubGlobal('document', { body })
        vi.stubGlobal('window', { visualViewport: { height: 400, offsetTop: 20, scale: 1 }, scrollBy })
        keepMobileInputVisible(input as unknown as HTMLElement)
        expect(scrollBy).toHaveBeenCalledWith({ top: -60, behavior: 'auto' })
    })

    it('leaves pinch zoom and removed fields under user control', () => {
        const rect = vi.fn(() => ({ top: 0, bottom: 44 }))
        vi.stubGlobal('window', { visualViewport: { height: 200, offsetTop: 20, scale: 2 } })
        keepMobileInputVisible({ isConnected: true, getBoundingClientRect: rect } as unknown as HTMLElement)
        keepMobileInputVisible({ isConnected: false, getBoundingClientRect: rect } as unknown as HTMLElement)
        expect(rect).not.toHaveBeenCalled()
    })
})

describe('number-pad accessory wiring', () => {
    const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

    it('opens a collapsed yarn row synchronously so iOS keeps the keyboard up', () => {
        const accessory = read('components/mobile-input-navigation.tsx')
        expect(accessory).toMatch(/import \{[^}]*\bflushSync\b[^}]*\} from 'react-dom'/)
        expect(accessory).toContain('moveMobileInput(field, direction, toggle => flushSync(() => toggle.click()))')
        const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
        expect(estimator).toMatch(/data-input-flow-expand="true"\s+aria-expanded=\{isExpanded\}\s+aria-controls=\{detailsId\}/)
    })

    it('re-reads Previous and Next while the user types, so added rows never leave Next disabled', () => {
        const accessory = read('components/mobile-input-navigation.tsx')
        expect(accessory).toMatch(/document\.addEventListener\('input', refresh\)/)
        expect(accessory).toMatch(/document\.removeEventListener\('input', refresh\)/)
    })
})
