import { describe, expect, it, vi } from 'vitest'
import {
    findNavigableFormInputs,
    handleEnterKeyNavigation,
    isElementNavigable,
} from '../lib/form-navigation'

interface MockInputOptions {
    id?: string
    tagName?: string
    type?: string
    disabled?: boolean
    readOnly?: boolean
    tabIndex?: number
    ariaHidden?: string
    preventEnterNav?: string
    value?: string
}

function createMockElement(options: MockInputOptions = {}) {
    const {
        id = 'input-1',
        tagName = 'INPUT',
        type = 'text',
        disabled = false,
        readOnly = false,
        tabIndex = 0,
        ariaHidden,
        preventEnterNav,
        value = '',
    } = options

    const element: any = {
        id,
        tagName: tagName.toUpperCase(),
        type,
        disabled,
        readOnly,
        tabIndex,
        value,
        offsetParent: {},
        offsetWidth: 100,
        offsetHeight: 40,
        getClientRects: () => [{ width: 100, height: 40 }],
        getAttribute: (attr: string) => {
            if (attr === 'aria-hidden') return ariaHidden ?? null
            if (attr === 'data-prevent-enter-nav') return preventEnterNav ?? null
            return null
        },
        focus: vi.fn(),
        select: vi.fn(),
        scrollIntoView: vi.fn(),
        closest: vi.fn(),
    }
    return element
}

function createMockContainer(children: any[]) {
    const container: any = {
        tagName: 'DIV',
        querySelectorAll: vi.fn((selector: string) => {
            return children.filter(child => {
                if (child.tagName !== 'INPUT' && child.tagName !== 'SELECT' && child.tagName !== 'TEXTAREA') return false
                if (child.type === 'hidden') return false
                if (child.type === 'button' || child.type === 'submit' || child.type === 'reset') return false
                if (child.type === 'checkbox' || child.type === 'radio' || child.type === 'file') return false
                if (child.disabled) return false
                if (child.readOnly) return false
                return true
            })
        }),
        getAttribute: (attr: string) => (attr === 'data-enter-navigate-container' ? 'true' : null),
        closest: vi.fn(),
    }

    children.forEach(child => {
        child.closest = (sel: string) => {
            if (sel.includes('data-enter-navigate-container')) return container
            return null
        }
    })

    return container
}

describe('Form Enter-Key Navigation Engine', () => {
    it('identifies navigable input elements correctly and filters out buttons/hidden/disabled fields', () => {
        const in1 = createMockElement({ id: 'in1', type: 'text' })
        const in2 = createMockElement({ id: 'in2', type: 'number' })
        const inDisabled = createMockElement({ id: 'in-disabled', disabled: true })
        const inReadonly = createMockElement({ id: 'in-readonly', readOnly: true })
        const inHidden = createMockElement({ id: 'in-hidden', type: 'hidden' })
        const inCheckbox = createMockElement({ id: 'in-checkbox', type: 'checkbox' })
        const btn = createMockElement({ id: 'btn', tagName: 'BUTTON' })
        const in3 = createMockElement({ id: 'in3', type: 'number' })

        const container = createMockContainer([in1, in2, inDisabled, inReadonly, inHidden, inCheckbox, btn, in3])

        const navigable = findNavigableFormInputs(container as any)
        const ids = navigable.map(el => (el as any).id)

        expect(ids).toEqual(['in1', 'in2', 'in3'])
    })

    it('navigates to next field and selects its content on Enter', () => {
        const fieldQuality = createMockElement({ id: 'field-quality', type: 'text', value: '60g Georgette' })
        const fieldCrimp = createMockElement({ id: 'field-crimp', type: 'number', value: '5' })
        const fieldWaste = createMockElement({ id: 'field-waste', type: 'number', value: '10' })

        const container = createMockContainer([fieldQuality, fieldCrimp, fieldWaste])

        const enterEvent: any = {
            key: 'Enter',
            target: fieldQuality,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }

        const handled1 = handleEnterKeyNavigation(enterEvent, { container: container as any })

        expect(handled1).toBe(true)
        expect(enterEvent.preventDefault).toHaveBeenCalled()
        expect(fieldCrimp.focus).toHaveBeenCalled()
        expect(fieldCrimp.select).toHaveBeenCalled()
        expect(fieldCrimp.scrollIntoView).toHaveBeenCalled()

        // Press Enter on crimp -> goes to waste
        const enterEvent2: any = {
            key: 'Enter',
            target: fieldCrimp,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }
        const handled2 = handleEnterKeyNavigation(enterEvent2, { container: container as any })
        expect(handled2).toBe(true)
        expect(fieldWaste.focus).toHaveBeenCalled()
        expect(fieldWaste.select).toHaveBeenCalled()
    })

    it('navigates to previous field on Shift+Enter', () => {
        const step1 = createMockElement({ id: 'step1', type: 'text', value: 'First' })
        const step2 = createMockElement({ id: 'step2', type: 'text', value: 'Second' })
        const step3 = createMockElement({ id: 'step3', type: 'text', value: 'Third' })

        const container = createMockContainer([step1, step2, step3])

        const shiftEnterEvent: any = {
            key: 'Enter',
            shiftKey: true,
            target: step2,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }

        const handled = handleEnterKeyNavigation(shiftEnterEvent, { container: container as any })
        expect(handled).toBe(true)
        expect(step1.focus).toHaveBeenCalled()
        expect(step1.select).toHaveBeenCalled()
    })

    it('does not intercept Enter in textarea elements by default', () => {
        const textarea = createMockElement({ id: 'notes', tagName: 'TEXTAREA' })
        const nextInput = createMockElement({ id: 'next-input', type: 'text' })

        const container = createMockContainer([textarea, nextInput])

        const enterEvent: any = {
            key: 'Enter',
            target: textarea,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }

        const handled = handleEnterKeyNavigation(enterEvent, { container: container as any })
        expect(handled).toBe(false)
        expect(enterEvent.preventDefault).not.toHaveBeenCalled()
        expect(nextInput.focus).not.toHaveBeenCalled()
    })

    it('handles boundary conditions at first and last elements gracefully', () => {
        const single = createMockElement({ id: 'single', type: 'text', value: 'Only one' })
        const container = createMockContainer([single])

        const enterEvent: any = {
            key: 'Enter',
            target: single,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }

        const handledLast = handleEnterKeyNavigation(enterEvent, { container: container as any, loop: false })
        expect(handledLast).toBe(false)

        const shiftEnterEvent: any = {
            key: 'Enter',
            shiftKey: true,
            target: single,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }
        const handledFirst = handleEnterKeyNavigation(shiftEnterEvent, { container: container as any, loop: false })
        expect(handledFirst).toBe(false)
    })

    it('supports looping if loop option is explicitly enabled', () => {
        const f1 = createMockElement({ id: 'f1', type: 'text', value: 'A' })
        const f2 = createMockElement({ id: 'f2', type: 'text', value: 'B' })
        const container = createMockContainer([f1, f2])

        const enterEvent: any = {
            key: 'Enter',
            target: f2,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }

        const handled = handleEnterKeyNavigation(enterEvent, { container: container as any, loop: true })
        expect(handled).toBe(true)
        expect(f1.focus).toHaveBeenCalled()
    })

    it('dynamically adapts when rows or inputs are added to the DOM', () => {
        const w1Rate = createMockElement({ id: 'w1-rate', type: 'number', value: '110' })
        const w1Gst = createMockElement({ id: 'w1-gst', type: 'number', value: '5' })
        const children = [w1Rate, w1Gst]
        const container = createMockContainer(children)

        const enterEvent: any = {
            key: 'Enter',
            target: w1Gst,
            currentTarget: container,
            preventDefault: vi.fn(),
            defaultPrevented: false,
            isComposing: false,
        }
        expect(handleEnterKeyNavigation(enterEvent, { container: container as any })).toBe(false)

        // Dynamically append Warp row 2
        const w2Rate = createMockElement({ id: 'w2-rate', type: 'number', value: '120' })
        children.push(w2Rate)

        // Hitting Enter on w1-gst now advances to w2-rate
        const handledNew = handleEnterKeyNavigation(enterEvent, { container: container as any })
        expect(handledNew).toBe(true)
        expect(w2Rate.focus).toHaveBeenCalled()
    })
})
